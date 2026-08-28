import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import iconv from 'iconv-lite';
import { parseIngredientsText } from './parse-recipe-ingredients.js';

const TARGET_MENUS = [
  '김치찌개', '된장찌개', '제육볶음', '계란말이', '두부조림',
  '계란찜', '장조림', '멸치볶음', '닭볶음탕', '돼지고기김치찌개',
  '고등어구이', '비빔밥', '콩나물밥', '간장계란밥', '순두부찌개',
  '부대찌개', '콩나물무침', '시금치나물', '잔치국수', '수제비'
];

const MFDS_BASE_URL = 'http://openapi.foodsafetykorea.go.kr/api';
const MFDS_SERVICE_ID = 'COOKRCP01';
const MAFRA_API_BASE_URL = 'http://211.237.50.150:7080/openapi';
const MAFRA_DOWNLOAD_URL = 'https://data.mafra.go.kr/opendata/data/getDataFile.do';
const MAFRA_GRIDS = {
  basic: 'Grid_20150827000000000226_1',
  ingredients: 'Grid_20150827000000000227_1',
  courses: 'Grid_20150827000000000228_1'
};

const MAFRA_ENTITIES = {
  basic: 'TI_RECIPE_INFO',
  ingredients: 'TI_RECIPE_IRDNT',
  courses: 'TI_RECIPE_CRSE'
};

const MAFRA_BASIC_FIELDS = {
  id: '레시피 코드 (SEQ_RECIPE)',
  name: '레시피 이름(한글)',
  category: '음식분류',
  cookingTime: '조리시간',
  servings: '분량',
  difficulty: '난이도'
};

const MAFRA_INGREDIENT_FIELDS = {
  id: '레시피 코드',
  sequence: '재료순번',
  name: '재료명',
  capacity: '재료용량',
  type: '재료타입명'
};

const FIELD_MISSINGNESS_KEYS = [
  'RCP_PAT2', 'HASH_TAG', 'INFO_WGT', 'INFO_ENG', 'INFO_CAR',
  'INFO_PRO', 'INFO_FAT', 'INFO_NA', 'ATT_FILE_NO_MAIN', 'RCP_PARTS_DTLS'
];

// Name similarity is reviewed explicitly because character-level similarity alone
// produces unsafe matches such as 돼지고기김치찌개 -> 닭고기김치찌개.
const ADJUDICATED_SIMILAR_NAMES = {
  mfds: {
    '김치찌개': '완자김치찌개',
    '된장찌개': '부대된장찌개',
    '제육볶음': '단호박제육볶음',
    '계란말이': '일본식 계란말이',
    '두부조림': '두부 튀김 조림',
    '계란찜': '삼색계란찜',
    '장조림': '구기자모듬장조림',
    '멸치볶음': '잔멸치땅콩볶음',
    '닭볶음탕': '매실입은가지닭볶음탕',
    '돼지고기김치찌개': null,
    '비빔밥': '채소비빔밥',
    '콩나물밥': '죽순콩나물밥',
    '간장계란밥': null,
    '순두부찌개': '들깨순두부찌개',
    '부대찌개': '맑은부대찌개',
    '콩나물무침': null,
    '시금치나물': '시금치들깨무침',
    '잔치국수': null,
    '수제비': '들깨곤약수제비'
  },
  mafra: {
    '제육볶음': '제육불고기',
    '장조림': '쇠고기장조림',
    '닭볶음탕': null,
    '고등어구이': '고등어양념구이',
    '비빔밥': '나물비빔밥',
    '간장계란밥': null,
    '수제비': '감자수제비'
  }
};

function parseArgs(argv = process.argv.slice(2)) {
  const outputArg = argv.find((argument) => argument.startsWith('--output='));
  return {
    output: outputArg ? outputArg.slice('--output='.length) : null,
    probeLimits: argv.includes('--probe-limits')
  };
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'null';
}

function normalizeName(value) {
  return String(value || '').replace(/\s+/gu, '').trim();
}

function bigrams(value) {
  const normalized = normalizeName(value);
  if (normalized.length < 2) return normalized ? [normalized] : [];
  return Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2));
}

function diceSimilarity(left, right) {
  const leftParts = bigrams(left);
  const rightParts = [...bigrams(right)];
  if (!leftParts.length || !rightParts.length) return 0;
  let overlap = 0;
  leftParts.forEach((part) => {
    const index = rightParts.indexOf(part);
    if (index >= 0) {
      overlap += 1;
      rightParts.splice(index, 1);
    }
  });
  return (2 * overlap) / (leftParts.length + bigrams(right).length);
}

function rankSimilarNames(target, rows, getName) {
  return rows
    .map((row) => ({ row, score: diceSimilarity(target, getName(row)) }))
    .filter(({ score }) => score >= 0.42)
    .sort((left, right) => right.score - left.score || getName(left.row).localeCompare(getName(right.row), 'ko'))
    .slice(0, 5);
}

function selectRepresentative(target, rows, getName, completenessScore) {
  const exactRows = rows.filter((row) => normalizeName(getName(row)) === normalizeName(target));
  if (exactRows.length) {
    const selected = [...exactRows].sort((left, right) => completenessScore(right) - completenessScore(left))[0];
    return { classification: 'exact', exactCount: exactRows.length, selected, similarCandidates: [] };
  }

  const containsRows = rows.filter((row) => {
    const name = normalizeName(getName(row));
    const normalizedTarget = normalizeName(target);
    return name.includes(normalizedTarget) || normalizedTarget.includes(name);
  });
  const ranked = containsRows.length
    ? containsRows.map((row) => ({ row, score: diceSimilarity(target, getName(row)) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
    : rankSimilarNames(target, rows, getName);
  const selectedCandidate = ranked[0];
  const classification = selectedCandidate && selectedCandidate.score >= 0.42 ? 'similar' : 'none';

  return {
    classification,
    exactCount: 0,
    selected: classification === 'similar' ? selectedCandidate.row : null,
    similarCandidates: ranked.map(({ row, score }) => ({
      name: getName(row),
      score: Number(score.toFixed(3))
    }))
  };
}

function applyAdjudication(source, target, selection, rows, getName) {
  if (!Object.hasOwn(ADJUDICATED_SIMILAR_NAMES[source], target)) return selection;
  const adjudicatedName = ADJUDICATED_SIMILAR_NAMES[source][target];
  if (adjudicatedName === null) {
    return { ...selection, classification: 'none', selected: null, adjudication: 'manual-semantic' };
  }
  const selected = rows.find((row) => normalizeName(getName(row)) === normalizeName(adjudicatedName));
  if (!selected) throw new Error(`Adjudicated ${source} candidate not found: ${target} -> ${adjudicatedName}`);
  return { ...selection, classification: 'similar', selected, adjudication: 'manual-semantic' };
}

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      record.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      record.push(field.trim());
      if (record.some((value) => value !== '')) records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || record.length) {
    record.push(field.trim());
    if (record.some((value) => value !== '')) records.push(record);
  }
  if (!records.length) return [];

  const headers = records[0].map((header) => header.replace(/^\ufeff/u, '').trim());
  return records.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_error) {
    throw new Error(`Expected JSON from ${new URL(url).hostname}; received ${response.status}: ${text.slice(0, 200)}`);
  }
  return { response, payload };
}

async function fetchMfds({ apiKey, start = 1, end = 100, menuName = null }) {
  const filter = menuName ? `/RCP_NM=${encodeURIComponent(menuName)}` : '';
  const url = `${MFDS_BASE_URL}/${apiKey}/${MFDS_SERVICE_ID}/json/${start}/${end}${filter}`;
  const { response, payload } = await fetchJson(url);
  const root = payload?.[MFDS_SERVICE_ID] || {};
  return {
    httpStatus: response.status,
    code: root.RESULT?.CODE || null,
    message: root.RESULT?.MSG || null,
    totalCount: Number(root.total_count || 0),
    rows: Array.isArray(root.row) ? root.row : []
  };
}

async function fetchMfdsCatalog(apiKey) {
  const first = await fetchMfds({ apiKey, start: 1, end: 1000 });
  if (first.code !== 'INFO-000') throw new Error(`MFDS ${first.code}: ${first.message}`);
  if (first.totalCount <= 1000) return first.rows;
  const second = await fetchMfds({ apiKey, start: 1001, end: first.totalCount });
  if (second.code !== 'INFO-000') throw new Error(`MFDS ${second.code}: ${second.message}`);
  return [...first.rows, ...second.rows];
}

async function fetchMafraSample(kind, { start = 1, end = 5, filters = {} } = {}) {
  const grid = MAFRA_GRIDS[kind];
  const url = new URL(`${MAFRA_API_BASE_URL}/sample/json/${grid}/${start}/${end}`);
  Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, value));
  const { response, payload } = await fetchJson(url);
  const root = payload?.[grid] || {};
  const result = root.result || payload?.result || {};
  return {
    httpStatus: response.status,
    code: result.code || null,
    message: result.message || null,
    totalCount: Number(root.totalCnt || 0),
    rows: Array.isArray(root.row) ? root.row : []
  };
}

async function downloadMafraCsv(kind, filters = {}) {
  const form = new URLSearchParams({
    s_entity_id: MAFRA_ENTITIES[kind],
    fileGubun: 'CSV'
  });
  const filterEntries = Object.entries(filters).filter(([, value]) => isPresent(value));
  form.set('s_search_form_name', filterEntries.map(([key]) => `s_search_${key}`).join(',') + (filterEntries.length ? ',' : ''));
  form.set('s_search_form_value', filterEntries.map(([, value]) => String(value)).join(',') + (filterEntries.length ? ',' : ''));

  const response = await fetch(MAFRA_DOWNLOAD_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: form
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/download')) {
    const text = buffer.toString('utf8');
    throw new Error(`MAFRA ${kind} CSV download failed (${response.status}): ${text.match(/<h3>([^<]+)/u)?.[1] || contentType}`);
  }
  return parseCsv(iconv.decode(buffer, 'cp949'));
}

function mfdsCompletenessScore(row) {
  return ['RCP_PARTS_DTLS', 'ATT_FILE_NO_MAIN', 'MANUAL01', 'RCP_PAT2', 'INFO_WGT']
    .reduce((score, key) => score + Number(isPresent(row[key])), 0);
}

function mafraCompletenessScore(row) {
  return Object.values(MAFRA_BASIC_FIELDS)
    .reduce((score, key) => score + Number(isPresent(row[key])), 0);
}

function summarizeMatches(matches) {
  const counts = { exact: 0, similar: 0, none: 0 };
  matches.forEach((match) => { counts[match.classification] += 1; });
  return {
    ...counts,
    usable: counts.exact + counts.similar,
    exactRate: Number((counts.exact / matches.length).toFixed(3)),
    usableRate: Number(((counts.exact + counts.similar) / matches.length).toFixed(3))
  };
}

function calculateCompleteness(rows, fieldMap) {
  return Object.fromEntries(Object.entries(fieldMap).map(([label, field]) => {
    const present = rows.filter((row) => isPresent(row[field])).length;
    return [label, {
      present,
      total: rows.length,
      rate: rows.length ? Number((present / rows.length).toFixed(3)) : null
    }];
  }));
}

function calculateMissingness(rows, fields) {
  return Object.fromEntries(fields.map((field) => {
    const missing = rows.filter((row) => !isPresent(row[field])).length;
    return [field, {
      missing,
      total: rows.length,
      missingRate: rows.length ? Number((missing / rows.length).toFixed(3)) : null
    }];
  }));
}

function assessParserRow(row) {
  const parsed = parseIngredientsText(row.RCP_PARTS_DTLS, row.RCP_NM);
  const assessed = parsed.chunks.map((chunk) => {
    const patterns = [];
    if (chunk.confidence < 0.8) patterns.push('low_confidence');
    if (chunk.amount === null && !chunk.unit) patterns.push('quantity_unit_missing');
    if (String(chunk.normalized_name || '').length > 25) patterns.push('name_too_long');
    if (normalizeName(chunk.normalized_name).startsWith(normalizeName(row.RCP_NM))) patterns.push('recipe_title_embedded');
    if (/^(?:(?:양념장|소스|드레싱|육수|고명|주재료|부재료)\s+|\S+육수\s+)|(?:양념장|소스소개)[\s:\]]/u.test(chunk.normalized_name || '')) {
      patterns.push('section_header_embedded');
    }
    return { ...chunk, failed: patterns.length > 0, failurePatterns: patterns };
  });
  return {
    recipeId: row.RCP_SEQ,
    recipeName: row.RCP_NM,
    rawIngredientsText: row.RCP_PARTS_DTLS,
    parsedChunkCount: assessed.length,
    failedChunkCount: assessed.filter((chunk) => chunk.failed).length,
    chunks: assessed
  };
}

function summarizeParser(recipeAssessments) {
  const chunks = recipeAssessments.flatMap((recipe) => recipe.chunks.map((chunk) => ({ recipeName: recipe.recipeName, ...chunk })));
  const failed = chunks.filter((chunk) => chunk.failed);
  const patternCounts = {};
  failed.forEach((chunk) => chunk.failurePatterns.forEach((pattern) => {
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
  }));
  return {
    recipeCount: recipeAssessments.length,
    totalChunks: chunks.length,
    failedChunks: failed.length,
    failureRate: chunks.length ? Number((failed.length / chunks.length).toFixed(3)) : null,
    recipesWithFailure: recipeAssessments.filter((recipe) => recipe.failedChunkCount > 0).length,
    patternCounts,
    failureExamples: failed.slice(0, 30).map((chunk) => ({
      recipeName: chunk.recipeName,
      rawText: chunk.raw_text,
      parsedName: chunk.normalized_name,
      amount: chunk.amount,
      unit: chunk.unit,
      confidence: chunk.confidence,
      patterns: chunk.failurePatterns
    }))
  };
}

function normalizeIngredientForComparison(value) {
  return normalizeName(value)
    .replace(/^(?:저염|다진|국물용)/u, '')
    .replace(/(?:약간|적당량)$/u, '');
}

function compareIngredientSets(mfdsAssessment, mafraRows) {
  const mfdsNames = [...new Set(mfdsAssessment.chunks.map((chunk) => normalizeIngredientForComparison(chunk.normalized_name)).filter(Boolean))];
  const mafraNames = [...new Set(mafraRows.map((row) => normalizeIngredientForComparison(row[MAFRA_INGREDIENT_FIELDS.name])).filter(Boolean))];
  const intersection = mfdsNames.filter((name) => mafraNames.includes(name));
  const union = new Set([...mfdsNames, ...mafraNames]);
  return {
    mfdsNames,
    mafraNames,
    sharedNames: intersection,
    jaccard: union.size ? Number((intersection.length / union.size).toFixed(3)) : null
  };
}

async function probeLimits(apiKey) {
  const [mfdsSample, mfdsConfigured, mafraSample] = await Promise.all([
    fetchMfds({ apiKey: 'sample', start: 1, end: 1002 }),
    fetchMfds({ apiKey, start: 1, end: 1002 }),
    fetchMafraSample('basic', { start: 1, end: 6 })
  ]);
  return {
    mfdsSamplePerRequestBoundary: {
      code: mfdsSample.code,
      message: mfdsSample.message,
      returnedRows: mfdsSample.rows.length,
      observation: '샘플키는 과대 범위를 오류 대신 5건으로 조용히 제한함'
    },
    mfdsConfiguredPerRequestBoundary: { code: mfdsConfigured.code, message: mfdsConfigured.message },
    mafraSamplePerRequestBoundary: { code: mafraSample.code, message: mafraSample.message },
    dailyExhaustion: {
      attempted: false,
      reason: '일일 할당량 소진은 공공 서비스에 불필요한 부하를 유발하므로 수행하지 않음'
    }
  };
}

async function main() {
  const options = parseArgs();
  const mfdsApiKey = process.env.FOODSAFETY_API_KEY?.trim();
  if (!mfdsApiKey) throw new Error('FOODSAFETY_API_KEY is required for a complete MFDS catalog validation.');

  const [mfdsCatalog, mafraBasicRows, mafraCourseRows] = await Promise.all([
    fetchMfdsCatalog(mfdsApiKey),
    downloadMafraCsv('basic'),
    downloadMafraCsv('courses')
  ]);

  const mfdsQueryResults = [];
  const mafraQueryResults = [];
  for (const target of TARGET_MENUS) {
    const [mfdsResult, mafraResult] = await Promise.all([
      fetchMfds({ apiKey: mfdsApiKey, start: 1, end: 100, menuName: target }),
      fetchMafraSample('basic', { filters: { RECIPE_NM_KO: target } })
    ]);
    mfdsQueryResults.push({
      target,
      code: mfdsResult.code,
      totalCount: mfdsResult.totalCount,
      returnedNames: mfdsResult.rows.map((row) => row.RCP_NM)
    });
    mafraQueryResults.push({
      target,
      code: mafraResult.code,
      totalCount: mafraResult.totalCount,
      returnedNames: mafraResult.rows.map((row) => row.RECIPE_NM_KO)
    });
  }

  const mfdsMatches = TARGET_MENUS.map((target) => {
    const automaticSelection = selectRepresentative(target, mfdsCatalog, (row) => row.RCP_NM, mfdsCompletenessScore);
    const selection = applyAdjudication('mfds', target, automaticSelection, mfdsCatalog, (row) => row.RCP_NM);
    const query = mfdsQueryResults.find((result) => result.target === target);
    return {
      target,
      classification: selection.classification,
      exactCount: selection.exactCount,
      selectedId: selection.selected?.RCP_SEQ || null,
      selectedName: selection.selected?.RCP_NM || null,
      queryReturnedNames: query?.returnedNames || [],
      similarCandidates: selection.similarCandidates,
      adjudication: selection.adjudication || 'automatic-exact-or-name-similarity'
    };
  });

  const mafraMatches = TARGET_MENUS.map((target) => {
    const automaticSelection = selectRepresentative(target, mafraBasicRows, (row) => row[MAFRA_BASIC_FIELDS.name], mafraCompletenessScore);
    const selection = applyAdjudication('mafra', target, automaticSelection, mafraBasicRows, (row) => row[MAFRA_BASIC_FIELDS.name]);
    const query = mafraQueryResults.find((result) => result.target === target);
    return {
      target,
      classification: selection.classification,
      exactCount: selection.exactCount,
      selectedId: selection.selected?.[MAFRA_BASIC_FIELDS.id] || null,
      selectedName: selection.selected?.[MAFRA_BASIC_FIELDS.name] || null,
      queryReturnedNames: query?.returnedNames || [],
      similarCandidates: selection.similarCandidates,
      adjudication: selection.adjudication || 'automatic-exact-or-name-similarity'
    };
  });

  const selectedMfdsRows = mfdsMatches
    .map((match) => mfdsCatalog.find((row) => String(row.RCP_SEQ) === String(match.selectedId)))
    .filter(Boolean);
  const selectedMafraRows = mafraMatches
    .map((match) => mafraBasicRows.find((row) => String(row[MAFRA_BASIC_FIELDS.id]) === String(match.selectedId)))
    .filter(Boolean);

  const mfdsParserAssessments = selectedMfdsRows.map(assessParserRow);
  const mafraIngredientsByRecipe = {};
  for (const row of selectedMafraRows) {
    const recipeId = row[MAFRA_BASIC_FIELDS.id];
    if (!mafraIngredientsByRecipe[recipeId]) {
      mafraIngredientsByRecipe[recipeId] = await downloadMafraCsv('ingredients', { RECIPE_ID: recipeId });
    }
  }

  const crossValidation = TARGET_MENUS.flatMap((target) => {
    const mfdsMatch = mfdsMatches.find((match) => match.target === target);
    const mafraMatch = mafraMatches.find((match) => match.target === target);
    if (mfdsMatch?.classification === 'none' || mafraMatch?.classification === 'none') return [];
    const mfdsAssessment = mfdsParserAssessments.find((assessment) => String(assessment.recipeId) === String(mfdsMatch.selectedId));
    const mafraIngredients = mafraIngredientsByRecipe[mafraMatch.selectedId] || [];
    if (!mfdsAssessment || !mafraIngredients.length) return [];
    return [{
      target,
      mfdsRecipeId: mfdsMatch.selectedId,
      mafraRecipeId: mafraMatch.selectedId,
      ...compareIngredientSets(mfdsAssessment, mafraIngredients)
    }];
  });

  const mafraIngredientRows = Object.values(mafraIngredientsByRecipe).flat();
  const mafraIngredientStructure = {
    rows: mafraIngredientRows.length,
    recipeCount: Object.keys(mafraIngredientsByRecipe).length,
    ingredientNameSeparateFieldRate: mafraIngredientRows.length
      ? Number((mafraIngredientRows.filter((row) => isPresent(row[MAFRA_INGREDIENT_FIELDS.name])).length / mafraIngredientRows.length).toFixed(3))
      : null,
    capacitySeparateFieldRate: mafraIngredientRows.length
      ? Number((mafraIngredientRows.filter((row) => isPresent(row[MAFRA_INGREDIENT_FIELDS.capacity])).length / mafraIngredientRows.length).toFixed(3))
      : null,
    amountAndUnitSeparateColumns: false,
    fields: Object.values(MAFRA_INGREDIENT_FIELDS),
    examples: mafraIngredientRows.slice(0, 20)
  };

  const result = {
    generatedAt: new Date().toISOString(),
    targetMenus: TARGET_MENUS,
    authentication: {
      mfdsConfiguredKeyPresent: true,
      mfdsConfiguredKeyWorked: true,
      mafraPersonalKeyPresent: false,
      mafraSampleSearchWorked: mafraQueryResults.every((result) => result.code === 'INFO-000'),
      mafraCsvDownloadWorked: true
    },
    rateLimits: options.probeLimits ? await probeLimits(mfdsApiKey) : { probed: false },
    mfds: {
      catalogRowCount: mfdsCatalog.length,
      queryResults: mfdsQueryResults,
      matches: mfdsMatches,
      matchSummary: summarizeMatches(mfdsMatches),
      observedRcpPat2: [...new Set(selectedMfdsRows.map((row) => row.RCP_PAT2).filter(isPresent))].sort((a, b) => a.localeCompare(b, 'ko')),
      fieldMissingness: calculateMissingness(selectedMfdsRows, FIELD_MISSINGNESS_KEYS),
      parser: summarizeParser(mfdsParserAssessments),
      parserRecipes: mfdsParserAssessments
    },
    mafra: {
      basicRowCount: mafraBasicRows.length,
      courseRowCount: mafraCourseRows.length,
      queryResults: mafraQueryResults,
      matches: mafraMatches,
      matchSummary: summarizeMatches(mafraMatches),
      matchedFieldCompleteness: calculateCompleteness(selectedMafraRows, {
        cookingTime: MAFRA_BASIC_FIELDS.cookingTime,
        difficulty: MAFRA_BASIC_FIELDS.difficulty,
        servings: MAFRA_BASIC_FIELDS.servings,
        category: MAFRA_BASIC_FIELDS.category
      }),
      allRowsFieldCompleteness: calculateCompleteness(mafraBasicRows, {
        cookingTime: MAFRA_BASIC_FIELDS.cookingTime,
        difficulty: MAFRA_BASIC_FIELDS.difficulty,
        servings: MAFRA_BASIC_FIELDS.servings,
        category: MAFRA_BASIC_FIELDS.category
      }),
      ingredientStructure: mafraIngredientStructure
    },
    crossValidation
  };

  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) {
    await writeFile(options.output, serialized, 'utf8');
    console.log(`Validation result written to ${options.output}`);
  } else {
    process.stdout.write(serialized);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
