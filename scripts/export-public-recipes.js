import 'dotenv/config';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const API_BASE_URL = 'https://openapi.foodsafetykorea.go.kr/api';
const DATASET_ID = 'COOKRCP01';
const SOURCE_URL =
  'https://www.foodsafetykorea.go.kr/api/openApiInfo.do?menu_grp=MENU_GRP31&menu_no=661&show_cnt=10&start_idx=1&svc_no=COOKRCP01';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const STEP_COUNT = 20;
const MAX_API_RESPONSE_BYTES = 20 * 1024 * 1024;
const MAX_REVIEW_FILE_BYTES = 20 * 1024 * 1024;
const FILE_READ_CHUNK_BYTES = 64 * 1024;
const NO_FOLLOW_FLAG = constants.O_NOFOLLOW ?? 0;
const NON_BLOCKING_FLAG = constants.O_NONBLOCK ?? 0;
const ALLOWED_PUBLIC_URL_HOSTS = new Set(['foodsafetykorea.go.kr', 'www.foodsafetykorea.go.kr']);
export const PUBLIC_RECIPES_OUTPUT_PATH = resolve(process.cwd(), 'src/data/publicRecipes.json');

function emptyToNull(value, maxLength = 500) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const normalized = String(value).normalize('NFC').trim();
  if (normalized.length > maxLength) return null;

  for (const character of normalized) {
    const codePoint = character.codePointAt(0);
    if (codePoint === 0 || (codePoint < 32 && character !== '\n' && character !== '\r' && character !== '\t')) {
      return null;
    }
  }

  return normalized || null;
}

function normalizeExternalId(value) {
  const normalized = emptyToNull(value, 64);
  if (!normalized) return null;

  for (const character of normalized) {
    const codePoint = character.codePointAt(0);
    if (codePoint < 48 || codePoint > 57) return null;
  }

  return normalized;
}

function parseNumeric(value) {
  const normalized = emptyToNull(value);
  if (!normalized) return null;
  const match = normalized.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/u);
  const parsed = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePublicUrl(value) {
  const normalized = emptyToNull(value, 2048);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (!ALLOWED_PUBLIC_URL_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || (url.port && url.port !== '443')) return null;
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
    const text = emptyToNull(row[`MANUAL${suffix}`], 4000)?.replace(/\.[a-z]$/iu, '.');
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
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;

  const externalId = normalizeExternalId(row.RCP_SEQ);
  const name = emptyToNull(row.RCP_NM, 200);
  const ingredientsText = emptyToNull(row.RCP_PARTS_DTLS, 20_000);
  const steps = mapSteps(row);
  const imageLargeUrl = normalizePublicUrl(row.ATT_FILE_NO_MK);
  const imageSmallUrl = normalizePublicUrl(row.ATT_FILE_NO_MAIN);

  if (!externalId || !name || !ingredientsText || steps.length < 2 || (!imageLargeUrl && !imageSmallUrl)) {
    return null;
  }

  return {
    externalId,
    name,
    cookingMethod: emptyToNull(row.RCP_WAY2, 100),
    dishType: emptyToNull(row.RCP_PAT2, 100),
    servingWeight: emptyToNull(row.INFO_WGT, 100),
    nutrition: {
      calories: parseNumeric(row.INFO_ENG),
      carbohydrate: parseNumeric(row.INFO_CAR),
      protein: parseNumeric(row.INFO_PRO),
      fat: parseNumeric(row.INFO_FAT),
      sodium: parseNumeric(row.INFO_NA)
    },
    hashTags: String(emptyToNull(row.HASH_TAG, 500) || '')
      .split(/[,#]/u)
      .map((tag) => tag.trim())
      .filter(Boolean),
    imageSmallUrl,
    imageLargeUrl,
    ingredientsText,
    steps,
    sodiumTip: emptyToNull(row.RCP_NA_TIP, 2000),
    source: '식품의약품안전처 조리식품의 레시피 DB',
    sourceUrl: SOURCE_URL
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));
  const parsedLimit = Number.parseInt(limitArg?.slice('--limit='.length) || '', 10);
  const writeFromArg = argv.find((arg) => arg.startsWith('--write-from='));

  if (argv.includes('--write')) {
    throw new Error('Direct network-to-file export is disabled. Review a --print-review file, then use --write-from=.');
  }

  return {
    printReview: argv.includes('--print-review'),
    writeFrom: writeFromArg?.slice('--write-from='.length).trim() || '',
    limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.min(MAX_LIMIT, parsedLimit)) : DEFAULT_LIMIT
  };
}

async function readBoundedResponseText(response) {
  if (typeof response.body?.getReader !== 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_API_RESPONSE_BYTES) {
      throw new Error('Food Safety Korea response exceeded the safe size limit.');
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    byteLength += value.byteLength;
    if (byteLength > MAX_API_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Food Safety Korea response exceeded the safe size limit.');
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, byteLength).toString('utf8');
}

async function fetchRows(apiKey, limit) {
  const url = `${API_BASE_URL}/${apiKey}/${DATASET_ID}/json/1/${limit}`;
  const response = await fetch(url, { redirect: 'error' });
  const declaredLength = Number(response.headers?.get?.('content-length'));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_API_RESPONSE_BYTES) {
    throw new Error('Food Safety Korea response exceeded the safe size limit.');
  }

  const responseText = await readBoundedResponseText(response);

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

function isPathOutsideRoot(workspaceRoot, filePath) {
  const workspaceRelativePath = relative(workspaceRoot, filePath);
  return (
    isAbsolute(workspaceRelativePath) ||
    workspaceRelativePath === '..' ||
    workspaceRelativePath.startsWith(`..${sep}`)
  );
}

function isSameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function isSameResolvedPath(left, right) {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function isUnlinkedRegularFile(stats) {
  return !stats.isSymbolicLink() && stats.isFile() && stats.nlink === 1;
}

async function openVerifiedWorkspaceFile(
  filePath,
  { flags, invalidMessage, maxBytes = Number.POSITIVE_INFINITY, workspaceRoot = process.cwd() }
) {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const resolvedFilePath = resolve(resolvedWorkspaceRoot, filePath);
  let handle;

  if (isPathOutsideRoot(resolvedWorkspaceRoot, resolvedFilePath)) {
    throw new Error(invalidMessage);
  }

  try {
    // Open without truncating first. Once this handle is verified, all I/O uses
    // the handle so a later path or symlink swap cannot redirect the operation.
    handle = await open(resolvedFilePath, flags | NO_FOLLOW_FLAG | NON_BLOCKING_FLAG);
    const openedStats = await handle.stat();
    const pathStats = await lstat(resolvedFilePath);
    const canonicalWorkspaceRoot = await realpath(resolvedWorkspaceRoot);
    const canonicalFilePath = await realpath(resolvedFilePath);

    if (
      !isSameResolvedPath(canonicalWorkspaceRoot, resolvedWorkspaceRoot) ||
      !isSameResolvedPath(canonicalFilePath, resolvedFilePath) ||
      !isUnlinkedRegularFile(openedStats) ||
      !isUnlinkedRegularFile(pathStats) ||
      !isSameFileIdentity(openedStats, pathStats) ||
      openedStats.size > maxBytes
    ) {
      throw new Error(invalidMessage);
    }

    return handle;
  } catch (error) {
    await handle?.close().catch(() => {});
    if (error?.message === invalidMessage) throw error;
    throw new Error(invalidMessage, { cause: error });
  }
}

async function readBoundedFileHandle(handle, maxBytes) {
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const remainingBytes = maxBytes + 1 - totalBytes;
    const buffer = Buffer.allocUnsafe(Math.min(FILE_READ_CHUNK_BYTES, remainingBytes));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, totalBytes);

    if (bytesRead === 0) break;
    totalBytes += bytesRead;
    if (totalBytes > maxBytes) {
      throw new Error('The reviewed recipe file is not a bounded regular file.');
    }
    chunks.push(buffer.subarray(0, bytesRead));
  }

  return Buffer.concat(chunks, totalBytes).toString('utf8');
}

function resolveReviewFilePath(reviewFile, workspaceRoot = process.cwd()) {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const reviewPath = resolve(resolvedWorkspaceRoot, reviewFile);

  if (
    !reviewFile ||
    isPathOutsideRoot(resolvedWorkspaceRoot, reviewPath) ||
    !reviewPath.toLowerCase().endsWith('.json')
  ) {
    throw new Error('The reviewed recipe file must be a JSON file inside the workspace.');
  }

  return reviewPath;
}

export async function readReviewedRows(reviewFile, { workspaceRoot = process.cwd() } = {}) {
  const reviewPath = resolveReviewFilePath(reviewFile, workspaceRoot);
  const handle = await openVerifiedWorkspaceFile(reviewPath, {
    flags: constants.O_RDONLY,
    invalidMessage: 'The reviewed recipe file is not a bounded regular file.',
    maxBytes: MAX_REVIEW_FILE_BYTES,
    workspaceRoot
  });
  let rows;

  try {
    rows = JSON.parse(await readBoundedFileHandle(handle, MAX_REVIEW_FILE_BYTES));
  } finally {
    await handle.close();
  }
  if (!Array.isArray(rows) || rows.length > MAX_LIMIT) {
    throw new Error(`The reviewed recipe file must contain at most ${MAX_LIMIT} rows.`);
  }

  return rows;
}

export async function writeVerifiedPublicRecipeArtifact(
  outputPath,
  contents,
  { workspaceRoot = process.cwd() } = {}
) {
  const invalidMessage = 'The public recipe output must be an existing, unlinked regular repository file.';
  const handle = await openVerifiedWorkspaceFile(outputPath, {
    flags: constants.O_WRONLY,
    invalidMessage,
    workspaceRoot
  });
  try {
    await handle.truncate(0);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeReviewedPublicRecipes(reviewFile) {
  const rows = await readReviewedRows(reviewFile);
  const recipes = rows.map(mapPublicRecipe).filter(Boolean);

  await writeVerifiedPublicRecipeArtifact(
    PUBLIC_RECIPES_OUTPUT_PATH,
    `${JSON.stringify(recipes, null, 2)}\n`
  );

  console.log(
    `Reviewed public recipe import: reviewed=${rows.length} ready=${recipes.length} output=src/data/publicRecipes.json`
  );
  return recipes;
}

export async function exportPublicRecipes(options = parseArgs()) {
  if (options.writeFrom) return writeReviewedPublicRecipes(options.writeFrom);

  const apiKey = String(process.env.FOODSAFETY_API_KEY || '').trim();
  if (!apiKey) throw new Error('FOODSAFETY_API_KEY is required.');

  const rows = await fetchRows(apiKey, options.limit);
  const recipes = rows.map(mapPublicRecipe).filter(Boolean);

  if (options.printReview) {
    console.log(JSON.stringify(rows, null, 2));
  }

  const log = options.printReview ? console.error : console.log;
  log(`Public recipe preview: fetched=${rows.length} ready=${recipes.length} write=false`);

  return recipes;
}

const isMainModule = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMainModule) {
  exportPublicRecipes().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
