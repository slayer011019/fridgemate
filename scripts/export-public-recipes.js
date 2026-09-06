import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const API_BASE_URL = 'https://openapi.foodsafetykorea.go.kr/api';
const DATASET_ID = 'COOKRCP01';
const SOURCE_URL =
  'https://www.foodsafetykorea.go.kr/api/openApiInfo.do?menu_grp=MENU_GRP31&menu_no=661&show_cnt=10&start_idx=1&svc_no=COOKRCP01';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const STEP_COUNT = 20;

function emptyToNull(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function parseNumeric(value) {
  const normalized = emptyToNull(value);
  if (!normalized) return null;
  const match = normalized.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/u);
  const parsed = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePublicUrl(value) {
  const normalized = emptyToNull(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (!/(^|\.)foodsafetykorea\.go\.kr$/iu.test(url.hostname)) return null;
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
    }
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch (_error) {
    return null;
  }
}

function mapSteps(row) {
  const steps = [];

  for (let index = 1; index <= STEP_COUNT; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const text = emptyToNull(row[`MANUAL${suffix}`])?.replace(/\.[a-z]$/iu, '.');
    if (!text) continue;

    steps.push({
      order: steps.length + 1,
      text,
      imageUrl: normalizePublicUrl(row[`MANUAL_IMG${suffix}`])
    });
  }

  return steps;
}

export function mapPublicRecipe(row = {}) {
  const externalId = emptyToNull(row.RCP_SEQ);
  const name = emptyToNull(row.RCP_NM);
  const ingredientsText = emptyToNull(row.RCP_PARTS_DTLS);
  const steps = mapSteps(row);
  const imageLargeUrl = normalizePublicUrl(row.ATT_FILE_NO_MK);
  const imageSmallUrl = normalizePublicUrl(row.ATT_FILE_NO_MAIN);

  if (!externalId || !name || !ingredientsText || steps.length < 2 || (!imageLargeUrl && !imageSmallUrl)) {
    return null;
  }

  return {
    externalId,
    name,
    cookingMethod: emptyToNull(row.RCP_WAY2),
    dishType: emptyToNull(row.RCP_PAT2),
    servingWeight: emptyToNull(row.INFO_WGT),
    nutrition: {
      calories: parseNumeric(row.INFO_ENG),
      carbohydrate: parseNumeric(row.INFO_CAR),
      protein: parseNumeric(row.INFO_PRO),
      fat: parseNumeric(row.INFO_FAT),
      sodium: parseNumeric(row.INFO_NA)
    },
    hashTags: String(row.HASH_TAG || '')
      .split(/[,#]/u)
      .map((tag) => tag.trim())
      .filter(Boolean),
    imageSmallUrl,
    imageLargeUrl,
    ingredientsText,
    steps,
    sodiumTip: emptyToNull(row.RCP_NA_TIP),
    source: '식품의약품안전처 조리식품의 레시피 DB',
    sourceUrl: SOURCE_URL
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));
  const parsedLimit = Number.parseInt(limitArg?.slice('--limit='.length) || '', 10);

  return {
    write: argv.includes('--write'),
    limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.min(MAX_LIMIT, parsedLimit)) : DEFAULT_LIMIT
  };
}

async function fetchRows(apiKey, limit) {
  const url = `${API_BASE_URL}/${apiKey}/${DATASET_ID}/json/1/${limit}`;
  const response = await fetch(url);
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Food Safety Korea request failed with status ${response.status}.`);
  }

  const payload = JSON.parse(responseText);
  const result = payload?.[DATASET_ID]?.RESULT;
  if (result?.CODE && result.CODE !== 'INFO-000') {
    throw new Error(`Food Safety Korea returned ${result.CODE}: ${result.MSG || 'Unknown error'}`);
  }

  return Array.isArray(payload?.[DATASET_ID]?.row) ? payload[DATASET_ID].row : [];
}

export async function exportPublicRecipes(options = parseArgs()) {
  const apiKey = String(process.env.FOODSAFETY_API_KEY || '').trim();
  if (!apiKey) throw new Error('FOODSAFETY_API_KEY is required.');

  const rows = await fetchRows(apiKey, options.limit);
  const recipes = rows.map(mapPublicRecipe).filter(Boolean);
  const outputPath = resolve(process.cwd(), 'src/data/publicRecipes.json');

  if (options.write) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
  }

  console.log(
    `Public recipe export: fetched=${rows.length} ready=${recipes.length} write=${options.write} output=src/data/publicRecipes.json`
  );

  return recipes;
}

const isMainModule = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMainModule) {
  exportPublicRecipes().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
