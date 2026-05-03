import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SERVICE_ID = 'COOKRCP01';
const DATA_TYPE = 'json';
const SOURCE = 'MFDS_COOKRCP01';
const API_BASE_URL = 'http://openapi.foodsafetykorea.go.kr/api';
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;
const MANUAL_STEP_COUNT = 20;

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function emptyToNull(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function parseNumeric(value) {
  const normalized = emptyToNull(value);

  if (!normalized) {
    return null;
  }

  const match = normalized.replace(/,/g, '').match(/-?\d+(\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSteps(row) {
  const steps = [];

  for (let index = 1; index <= MANUAL_STEP_COUNT; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const text = emptyToNull(row[`MANUAL${suffix}`]);
    const imageUrl = emptyToNull(row[`MANUAL_IMG${suffix}`]);

    if (text || imageUrl) {
      steps.push({
        order: index,
        text,
        imageUrl
      });
    }
  }

  return steps;
}

function mapRecipe(row) {
  const externalId = emptyToNull(row.RCP_SEQ);
  const name = emptyToNull(row.RCP_NM);

  if (!externalId || !name) {
    return null;
  }

  return {
    external_id: externalId,
    name,
    cooking_method: emptyToNull(row.RCP_WAY2),
    dish_type: emptyToNull(row.RCP_PAT2),
    serving_weight: emptyToNull(row.INFO_WGT),
    calories: parseNumeric(row.INFO_ENG),
    carbohydrate: parseNumeric(row.INFO_CAR),
    protein: parseNumeric(row.INFO_PRO),
    fat: parseNumeric(row.INFO_FAT),
    sodium: parseNumeric(row.INFO_NA),
    hash_tag: emptyToNull(row.HASH_TAG),
    image_small_url: emptyToNull(row.ATT_FILE_NO_MAIN),
    image_large_url: emptyToNull(row.ATT_FILE_NO_MK),
    ingredients_text: emptyToNull(row.RCP_PARTS_DTLS),
    steps: mapSteps(row),
    sodium_tip: emptyToNull(row.RCP_NA_TIP),
    source: SOURCE,
    raw: row
  };
}

function buildRequestUrl({ apiKey, startIdx, endIdx, filters = {} }) {
  const filterSegments = Object.entries(filters)
    .filter(([, value]) => emptyToNull(value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);

  return [API_BASE_URL, apiKey, SERVICE_ID, DATA_TYPE, startIdx, endIdx, ...filterSegments].join('/');
}

async function fetchRecipePage({ apiKey, startIdx, endIdx }) {
  const url = buildRequestUrl({ apiKey, startIdx, endIdx });
  const response = await fetch(url);
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Food Safety Korea request failed (${response.status}): ${responseText.slice(0, 500)}`);
  }

  let payload;

  try {
    payload = JSON.parse(responseText);
  } catch (_error) {
    throw new Error(`Food Safety Korea returned invalid JSON: ${responseText.slice(0, 500)}`);
  }

  const result = payload?.[SERVICE_ID]?.RESULT;

  if (result && result.CODE !== 'INFO-000') {
    throw new Error(`Food Safety Korea error ${result.CODE}: ${result.MSG || 'Unknown API error'}`);
  }

  const rows = payload?.[SERVICE_ID]?.row;
  const totalCount = Number(payload?.[SERVICE_ID]?.total_count || 0);

  if (!Array.isArray(rows)) {
    return {
      rows: [],
      totalCount
    };
  }

  return {
    rows,
    totalCount
  };
}

async function upsertRecipeBatch({ supabase, recipes, startIdx, endIdx }) {
  if (!recipes.length) {
    return;
  }

  const { error } = await supabase.from('recipes').upsert(recipes, {
    onConflict: 'external_id',
    ignoreDuplicates: false
  });

  if (error) {
    throw new Error(`Supabase upsert failed for batch ${startIdx}-${endIdx}: ${error.message}`);
  }
}

async function seedRecipes() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const foodSafetyApiKey = requireEnv('FOODSAFETY_API_KEY');

  if (foodSafetyApiKey.toLowerCase() === 'sample') {
    console.warn('FOODSAFETY_API_KEY is set to "sample"; replace it with an issued API key before production seeding.');
  }

  const pageSize = parsePositiveInt(process.env.MFDS_RECIPE_PAGE_SIZE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const maxRows = parsePositiveInt(process.env.MFDS_RECIPE_MAX_ROWS, 0, Number.MAX_SAFE_INTEGER);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  let startIdx = 1;
  let totalCount = null;
  let upsertedCount = 0;

  while (totalCount === null || startIdx <= totalCount) {
    const remainingRows = maxRows ? maxRows - upsertedCount : pageSize;

    if (remainingRows <= 0) {
      break;
    }

    const batchSize = Math.min(pageSize, remainingRows);
    const endIdx = startIdx + batchSize - 1;
    console.log(`Fetching ${SERVICE_ID} rows ${startIdx}-${endIdx}`);

    const page = await fetchRecipePage({
      apiKey: foodSafetyApiKey,
      startIdx,
      endIdx
    });

    if (totalCount === null) {
      totalCount = page.totalCount;
      console.log(`Food Safety Korea reports ${totalCount} total recipes.`);
    }

    if (!page.rows.length) {
      console.log(`No rows returned for ${startIdx}-${endIdx}; stopping.`);
      break;
    }

    const recipes = page.rows.map(mapRecipe).filter(Boolean);
    await upsertRecipeBatch({
      supabase,
      recipes,
      startIdx,
      endIdx
    });

    upsertedCount += recipes.length;
    console.log(`Upserted ${recipes.length} recipes from ${startIdx}-${endIdx}; total upserted ${upsertedCount}.`);

    if (page.rows.length < batchSize) {
      break;
    }

    startIdx = endIdx + 1;
  }

  console.log(`Recipe seed complete. Upserted ${upsertedCount} ${SOURCE} recipes.`);
}

seedRecipes().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
