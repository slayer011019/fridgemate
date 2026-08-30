import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  parseWriteIntent,
  requireConfirmedSupabaseWrite
} from './lib/supabaseWriteGuard.js';

const SERVICE_ID = 'COOKRCP01';
const DATA_TYPE = 'json';
const SOURCE = 'MFDS_COOKRCP01';
const API_BASE_URL = 'https://openapi.foodsafetykorea.go.kr/api';
const API_ORIGIN = new URL(API_BASE_URL).origin;
const MANUAL_STEP_COUNT = 20;
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_LIMIT = 10;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_COUNT = 100_000;
const MAX_ROW_FIELDS = 200;
const MAX_FIELD_LENGTH = 250_000;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parsePositiveIntegerOption(value, optionName) {
  if (!/^\d+$/.test(value || '')) {
    throw new Error(`${optionName} must be a positive integer.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }

  return parsed;
}

function parseSeedArgs(argv = process.argv.slice(2)) {
  const writeIntent = parseWriteIntent(argv);
  const isAll = argv.includes('--all');
  const limitArgs = argv.filter((arg) => arg.startsWith('--limit='));

  if (limitArgs.length > 1) {
    throw new Error('--limit must be provided at most once.');
  }
  if (isAll && limitArgs.length > 0) {
    throw new Error('--all and --limit cannot be used together.');
  }

  const limit = isAll
    ? 0
    : (limitArgs.length > 0
      ? parsePositiveIntegerOption(limitArgs[0].slice('--limit='.length), '--limit')
      : DEFAULT_LIMIT);

  return {
    ...writeIntent,
    isAll,
    limit
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseNonNegativeCount(value, label) {
  const normalized = typeof value === 'number' ? String(value) : String(value || '').trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`Food Safety Korea response has an invalid ${label}.`);
  }

  const count = Number(normalized);
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_TOTAL_COUNT) {
    throw new Error(`Food Safety Korea response has an out-of-range ${label}.`);
  }

  return count;
}

function assertTrustedMfdsUrl(rawUrl, label = 'URL') {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Food Safety Korea ${label} is invalid.`);
  }

  if (
    url.protocol !== 'https:' ||
    url.origin !== API_ORIGIN ||
    url.username ||
    url.password ||
    !url.pathname.startsWith('/api/')
  ) {
    throw new Error(`Food Safety Korea ${label} must remain on the trusted HTTPS API origin.`);
  }

  return url;
}

function validateMfdsRow(row, index) {
  if (!isPlainObject(row)) {
    throw new Error(`Food Safety Korea row ${index} must be an object.`);
  }

  const entries = Object.entries(row);
  if (entries.length === 0 || entries.length > MAX_ROW_FIELDS) {
    throw new Error(`Food Safety Korea row ${index} has an invalid field count.`);
  }

  for (const [field, value] of entries) {
    if (!/^[A-Z0-9_]{1,64}$/.test(field)) {
      throw new Error(`Food Safety Korea row ${index} contains an invalid field name.`);
    }
    const isScalar = value === null || ['string', 'number', 'boolean'].includes(typeof value);
    if (!isScalar || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new Error(`Food Safety Korea row ${index} contains a non-scalar field.`);
    }
    if (typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
      throw new Error(`Food Safety Korea row ${index} contains an oversized field.`);
    }
  }

  for (const requiredField of ['RCP_SEQ', 'RCP_NM']) {
    const value = row[requiredField];
    if (!['string', 'number'].includes(typeof value) || !String(value).trim()) {
      throw new Error(`Food Safety Korea row ${index} is missing ${requiredField}.`);
    }
  }
}

function validateMfdsPayload(payload, { requestedCount, startIdx = 1 }) {
  if (!isPlainObject(payload) || !isPlainObject(payload[SERVICE_ID])) {
    throw new Error('Food Safety Korea response is missing the expected service envelope.');
  }

  const servicePayload = payload[SERVICE_ID];
  const result = servicePayload.RESULT;
  if (
    !isPlainObject(result) ||
    typeof result.CODE !== 'string' ||
    !/^[A-Z]+-\d{3}$/.test(result.CODE)
  ) {
    throw new Error('Food Safety Korea response is missing a valid result code.');
  }

  if (result.CODE === 'INFO-200') {
    if (servicePayload.row !== undefined && (!Array.isArray(servicePayload.row) || servicePayload.row.length > 0)) {
      throw new Error('Food Safety Korea no-data response contains unexpected rows.');
    }
    return { rows: [], totalCount: 0 };
  }

  if (result.CODE !== 'INFO-000') {
    throw new Error(`Food Safety Korea API returned error code ${result.CODE}.`);
  }

  const totalCount = parseNonNegativeCount(servicePayload.total_count, 'total_count');
  const rows = servicePayload.row;
  if (!Array.isArray(rows)) {
    throw new Error('Food Safety Korea response row must be an array.');
  }
  if (
    !Number.isSafeInteger(requestedCount) ||
    requestedCount <= 0 ||
    requestedCount > DEFAULT_PAGE_SIZE ||
    rows.length > requestedCount ||
    rows.length > totalCount ||
    (rows.length > 0 && startIdx + rows.length - 1 > totalCount)
  ) {
    throw new Error('Food Safety Korea response row count is inconsistent with the request.');
  }

  const externalIds = new Set();
  rows.forEach((row, index) => {
    validateMfdsRow(row, index);
    const externalId = String(row.RCP_SEQ).trim();
    if (externalIds.has(externalId)) {
      throw new Error('Food Safety Korea response contains duplicate recipe identifiers.');
    }
    externalIds.add(externalId);
  });

  return { rows, totalCount };
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
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error('FOODSAFETY_API_KEY is required.');
  }
  if (
    !Number.isSafeInteger(startIdx) ||
    !Number.isSafeInteger(endIdx) ||
    startIdx <= 0 ||
    endIdx < startIdx ||
    endIdx - startIdx + 1 > DEFAULT_PAGE_SIZE
  ) {
    throw new Error('Food Safety Korea request range is invalid.');
  }

  const url = `${API_BASE_URL}/${encodeURIComponent(String(apiKey).trim())}/${SERVICE_ID}/${DATA_TYPE}/${startIdx}/${endIdx}`;
  return assertTrustedMfdsUrl(url, 'request URL').href;
}

function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

async function fetchWithTrustedRedirects(url, fetchImpl = fetch) {
  let currentUrl = assertTrustedMfdsUrl(url, 'request URL');

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let response;
    try {
      response = await fetchImpl(currentUrl.href, {
        headers: { Accept: 'application/json' },
        redirect: 'manual'
      });
    } catch {
      throw new Error('Food Safety Korea request failed before receiving a response.');
    }

    const responseUrl = assertTrustedMfdsUrl(response.url, 'response URL');
    if (response.redirected || responseUrl.href !== currentUrl.href) {
      throw new Error('Food Safety Korea response URL does not match the validated request URL.');
    }

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    if (redirectCount === MAX_REDIRECTS) {
      throw new Error('Food Safety Korea request exceeded the trusted redirect limit.');
    }

    const location = response.headers?.get?.('location');
    if (!location) {
      throw new Error('Food Safety Korea redirect is missing a location.');
    }

    let redirectUrl;
    try {
      redirectUrl = new URL(location, currentUrl);
    } catch {
      throw new Error('Food Safety Korea redirect location is invalid.');
    }
    currentUrl = assertTrustedMfdsUrl(redirectUrl.href, 'redirect URL');
  }

  throw new Error('Food Safety Korea request exceeded the trusted redirect limit.');
}

async function readResponseTextLimited(response, maxBytes = MAX_RESPONSE_BYTES) {
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength !== null && contentLength !== undefined) {
    const normalizedLength = String(contentLength).trim();
    if (!/^\d+$/.test(normalizedLength) || Number(normalizedLength) > maxBytes) {
      throw new Error('Food Safety Korea response exceeds the allowed size.');
    }
  }

  if (!response.body?.getReader) {
    let responseText;
    try {
      responseText = await response.text();
    } catch {
      throw new Error('Food Safety Korea response body could not be read.');
    }
    if (new TextEncoder().encode(responseText).byteLength > maxBytes) {
      throw new Error('Food Safety Korea response exceeds the allowed size.');
    }
    return responseText;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let responseText = '';

  while (true) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch {
      throw new Error('Food Safety Korea response body could not be read.');
    }
    const { done, value } = chunk;
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error('Food Safety Korea response exceeds the allowed size.');
    }
    responseText += decoder.decode(value, { stream: true });
  }

  return responseText + decoder.decode();
}

async function fetchRecipePage({ apiKey, startIdx, endIdx, fetchImpl = fetch }) {
  const url = buildRequestUrl({ apiKey, startIdx, endIdx });
  const response = await fetchWithTrustedRedirects(url, fetchImpl);

  if (!response.ok) {
    throw new Error(`Food Safety Korea request failed with status ${response.status}.`);
  }

  const contentType = response.headers?.get?.('content-type') || '';
  if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new Error('Food Safety Korea response must use a JSON content type.');
  }

  const responseText = await readResponseTextLimited(response);

  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch (_error) {
    throw new Error('Food Safety Korea returned invalid JSON.');
  }

  return validateMfdsPayload(payload, {
    requestedCount: endIdx - startIdx + 1,
    startIdx
  });
}

async function upsertRecipeBatch({ supabase, recipes, startIdx, endIdx, isDryRun }) {
  if (!recipes.length) return 0;

  if (isDryRun) {
    console.log(`[Dry Run] Would upsert ${recipes.length} recipes from index ${startIdx}-${endIdx}`);
    return recipes.length;
  }

  if (!supabase) {
    throw new Error('Supabase client is unavailable for an executed write.');
  }

  const { error } = await supabase.from('recipes').upsert(recipes, {
    onConflict: 'external_id',
    ignoreDuplicates: false
  });

  if (error) {
    throw new Error(`Supabase upsert failed for batch ${startIdx}-${endIdx}.`);
  }

  return recipes.length;
}

async function seedRecipes() {
  const options = parseSeedArgs();
  const { confirmProjectRef, execute, isAll, isDryRun, limit } = options;

  console.log(`=== MFDS Recipe Seeding ===`);
  console.log(`Mode: ${isDryRun ? 'dry-run' : 'execute'}${isAll ? ' (all)' : ` (limit: ${limit})`}`);

  const foodSafetyApiKey = requireEnv('FOODSAFETY_API_KEY');
  let supabase = null;

  if (execute) {
    const target = requireConfirmedSupabaseWrite({
      confirmProjectRef,
      execute,
      supabaseUrl: requireEnv('SUPABASE_URL')
    });
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    supabase = createClient(target.supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
  }

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
      if (recipes.length !== rows.length) {
        throw new Error('Validated Food Safety Korea rows could not be mapped safely.');
      }
      const upsertedInBatch = await upsertRecipeBatch({
        supabase,
        recipes,
        startIdx,
        endIdx,
        isDryRun
      });

      totalUpserted += upsertedInBatch;
      console.log(
        `Fetched ${rows.length} rows, mapped ${recipes.length} recipes. ` +
        `${isDryRun ? 'Total validated' : 'Total upserted'}: ${totalUpserted}`
      );

      if (
        rows.length < currentBatchSize ||
        (limit > 0 && totalUpserted >= limit) ||
        (totalCount > 0 && endIdx >= totalCount)
      ) {
        break;
      }

      startIdx = endIdx + 1;
    } catch (error) {
      console.error(`Error processing batch ${startIdx}-${endIdx}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }

  console.log(`\n${isDryRun ? 'Dry run' : 'Seeding'} complete.`);
  console.log(`Final total ${isDryRun ? 'validated' : 'upserted'}: ${totalUpserted}`);
}

export {
  assertTrustedMfdsUrl,
  buildRequestUrl,
  fetchRecipePage,
  parseSeedArgs,
  readResponseTextLimited,
  validateMfdsPayload
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedRecipes().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Recipe seeding failed.');
    process.exitCode = 1;
  });
}
