import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SERVICE_ID = 'COOKRCP01';
const DATA_TYPE = 'json';
const SOURCE = 'MFDS_COOKRCP01';
const API_BASE_URL = 'http://openapi.foodsafetykorea.go.kr/api';
const MANUAL_STEP_COUNT = 20;
const DEFAULT_PAGE_SIZE = 1000;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
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

function buildRequestUrl({ apiKey, startIdx, endIdx }) {
  // Format: http://openapi.foodsafetykorea.go.kr/api/{apiKey}/COOKRCP01/json/{startIdx}/{endIdx}
  return `${API_BASE_URL}/${apiKey}/${SERVICE_ID}/${DATA_TYPE}/${startIdx}/${endIdx}`;
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
    // INFO-200 is "No data found", which is a valid end condition for pagination
    if (result.CODE === 'INFO-200') {
      return { rows: [], totalCount: 0 };
    }
    throw new Error(`Food Safety Korea error ${result.CODE}: ${result.MSG || 'Unknown API error'}`);
  }

  const rows = payload?.[SERVICE_ID]?.row;
  const totalCount = Number(payload?.[SERVICE_ID]?.total_count || 0);

  return {
    rows: Array.isArray(rows) ? rows : [],
    totalCount
  };
}

async function upsertRecipeBatch({ supabase, recipes, startIdx, endIdx, isDryRun }) {
  if (!recipes.length) return 0;

  if (isDryRun) {
    console.log(`[Dry Run] Would upsert ${recipes.length} recipes from index ${startIdx}-${endIdx}`);
    return recipes.length;
  }

  const { error } = await supabase.from('recipes').upsert(recipes, {
    onConflict: 'external_id',
    ignoreDuplicates: false
  });

  if (error) {
    throw new Error(`Supabase upsert failed for batch ${startIdx}-${endIdx}: ${error.message}`);
  }

  return recipes.length;
}

async function seedRecipes() {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const isDryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = isAll ? 0 : (limitArg ? parseInt(limitArg.split('=')[1], 10) : 10);

  const mode = isDryRun ? 'dry-run' : (isAll ? 'all' : 'limit');
  console.log(`=== MFDS Recipe Seeding ===`);
  console.log(`Mode: ${mode}${limit > 0 ? ` (limit: ${limit})` : ''}`);

  const supabaseUrlRaw = requireEnv('SUPABASE_URL');
  const supabaseUrl = supabaseUrlRaw.replace(/\/rest\/v1\/?$/, '');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const foodSafetyApiKey = requireEnv('FOODSAFETY_API_KEY');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  let startIdx = 1;
  let totalCount = null;
  let totalUpserted = 0;
  const pageSize = DEFAULT_PAGE_SIZE;

  while (true) {
    let currentBatchSize = pageSize;
    if (limit > 0 && totalUpserted + pageSize > limit) {
      currentBatchSize = limit - totalUpserted;
    }

    if (currentBatchSize <= 0) break;

    const endIdx = startIdx + currentBatchSize - 1;
    console.log(`Fetching API range: ${startIdx} to ${endIdx}...`);

    try {
      const { rows, totalCount: apiTotalCount } = await fetchRecipePage({
        apiKey: foodSafetyApiKey,
        startIdx,
        endIdx
      });

      if (totalCount === null) {
        totalCount = apiTotalCount;
        console.log(`Total records available from API: ${totalCount}`);
      }

      if (rows.length === 0) {
        console.log('No more data returned from API.');
        break;
      }

      const recipes = rows.map(mapRecipe).filter(Boolean);
      const upsertedInBatch = await upsertRecipeBatch({
        supabase,
        recipes,
        startIdx,
        endIdx,
        isDryRun
      });

      totalUpserted += upsertedInBatch;
      console.log(`Fetched ${rows.length} rows, mapped ${recipes.length} recipes. Total upserted: ${totalUpserted}`);

      if (rows.length < currentBatchSize || (limit > 0 && totalUpserted >= limit)) {
        break;
      }

      startIdx = endIdx + 1;
    } catch (error) {
      console.error(`Error processing batch ${startIdx}-${endIdx}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }

  console.log(`\nSeeding complete.`);
  console.log(`Final total upserted: ${totalUpserted}`);
}

seedRecipes().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
