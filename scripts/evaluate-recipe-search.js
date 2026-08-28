import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { buildProductionRecipeEmbeddingText } from '../server/src/services/recipeEmbeddingTextBuilder.js';
import { generateRecipeEmbeddings } from '../server/src/services/recipeEmbeddingService.js';
import { buildRecipeVectorQueryText } from '../server/src/services/recipeVectorService.js';
import { classifyRecipeIngredientsForEmbedding } from '../src/features/recipes/recipeEmbeddingText.js';
import {
  classifyRecipeIngredient,
  dedupeRecipeIngredients,
  normalizeRecipeIngredientName
} from '../src/features/recipes/recipeIngredientClassification.js';
import { getRecipeMatchScore } from '../src/utils/recommendations.js';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_CANDIDATE_LIMIT = 250;
const MAX_CANDIDATE_LIMIT = 1200;
const EMBEDDING_BATCH_SIZE = 100;
const FIXTURE_PATH = new URL('./fixtures/recipe-search-evaluation.json', import.meta.url);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    dryRun: argv.includes('--dry-run') || !argv.includes('--execute'),
    limit: DEFAULT_CANDIDATE_LIMIT,
    output: ''
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--limit=')) {
      options.limit = Math.max(10, Math.min(MAX_CANDIDATE_LIMIT, Number.parseInt(arg.split('=')[1], 10) || options.limit));
    }
    if (arg.startsWith('--output=')) options.output = arg.slice('--output='.length).trim();
  });

  return options;
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(Number(value || 0) * scale) / scale;
}

function cosineSimilarity(left, right) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  return leftMagnitude && rightMagnitude ? dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)) : 0;
}

function median(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function generateInBatches(texts, config, generateBatch) {
  const vectors = [];
  let requestCount = 0;

  for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const generated = await generateBatch(batch, config);
    vectors.push(...generated);
    requestCount += 1;
  }

  return { vectors, requestCount };
}

async function loadFixture() {
  return JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
}

async function loadCandidates(prisma, fixture, limit) {
  const rows = await prisma.$queryRawUnsafe(`
    WITH selected_recipes AS (
      SELECT id, external_id, name, dish_type, cooking_method, ingredients_text, source, updated_at
      FROM recipes
      ORDER BY id
      LIMIT ${limit}
    )
    SELECT
      r.id AS recipe_id,
      r.external_id,
      r.name,
      r.dish_type,
      r.cooking_method,
      r.ingredients_text,
      r.source,
      r.updated_at,
      ri.id AS ingredient_id,
      ri.raw_text,
      ri.raw_name,
      ri.normalized_name,
      ri.canonical_name,
      ri.amount,
      ri.unit,
      ri.category,
      ri.confidence
    FROM selected_recipes r
    LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    ORDER BY r.id, ri.id
  `);
  const recipeById = new Map();

  rows.forEach((row) => {
    const recipeId = String(row.recipe_id);
    const recipe = recipeById.get(recipeId) || {
      id: recipeId,
      externalId: String(row.external_id || ''),
      name: String(row.name || ''),
      category: String(row.dish_type || '') || '기타',
      cookingMethod: String(row.cooking_method || ''),
      rawIngredientsText: String(row.ingredients_text || ''),
      source: String(row.source || ''),
      updatedAt: row.updated_at || null,
      ingredients: []
    };

    if (row.ingredient_id) {
      const normalizedName = normalizeRecipeIngredientName(
        row.canonical_name || row.normalized_name || row.raw_name || row.raw_text
      );
      const classification = classifyRecipeIngredient({
        category: row.category,
        rawText: row.raw_text,
        rawName: row.raw_name,
        normalizedName,
        canonicalName: row.canonical_name,
        recipeName: recipe.name,
        amount: row.amount,
        unit: row.unit
      });
      recipe.ingredients.push({
        id: String(row.ingredient_id),
        rawName: String(row.raw_name || row.raw_text || normalizedName),
        normalizedName,
        canonicalName: String(row.canonical_name || ''),
        ingredientType: classification.type,
        classificationConfidence: classification.confidence,
        classificationReason: classification.reason,
        amountValue: row.amount === null || row.amount === undefined ? null : Number(row.amount),
        amountUnit: String(row.unit || '') || null,
        confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence)
      });
    }
    recipeById.set(recipeId, recipe);
  });

  const recipes = [...recipeById.values()].map((recipe) => ({
    ...recipe,
    ingredients: dedupeRecipeIngredients(recipe.ingredients)
  }));
  const loadedIds = new Set(recipes.map((recipe) => recipe.id));
  if (fixture.recipes.some((recipe) => !loadedIds.has(recipe.id))) {
    throw new Error('Evaluation limit does not include every fixed fixture recipe.');
  }
  return recipes;
}

function assertOutputPath(output) {
  if (!output) return '';
  const resolved = path.resolve(process.cwd(), output);
  const relative = path.relative(process.cwd(), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('--output must stay inside the project workspace.');
  }
  return resolved;
}

export async function evaluateRecipeSearch(options = {}) {
  if (!options.prismaClient) {
    const prisma = new PrismaClient();
    try {
      return await prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          return evaluateRecipeSearch({ ...options, prismaClient: transaction });
        },
        { maxWait: 10000, timeout: 600000 }
      );
    } finally {
      await prisma.$disconnect();
    }
  }

  const settings = { dryRun: true, limit: DEFAULT_CANDIDATE_LIMIT, output: '', ...options };
  settings.limit = Math.max(10, Math.min(MAX_CANDIDATE_LIMIT, Number(settings.limit) || DEFAULT_CANDIDATE_LIMIT));
  const prisma = settings.prismaClient;
  const fixture = settings.fixture || (await loadFixture());
  const config = {
    apiKey: settings.apiKey ?? process.env.OPENAI_API_KEY ?? '',
    model: settings.model ?? process.env.RECIPE_EMBEDDING_MODEL ?? DEFAULT_MODEL,
    dimensions: Number(settings.dimensions ?? process.env.RECIPE_EMBEDDING_DIMENSIONS ?? DEFAULT_DIMENSIONS)
  };

  try {
    const candidates = await loadCandidates(prisma, fixture, settings.limit);
    const candidateById = new Map(candidates.map((recipe) => [recipe.id, recipe]));
    const targets = fixture.recipes.map((item) => candidateById.get(item.id)).filter(Boolean);
    if (targets.length !== fixture.recipes.length) {
      throw new Error('The fixed recipe search evaluation fixture is incomplete in the current catalog.');
    }

    const candidateTexts = candidates.map((recipe) => buildProductionRecipeEmbeddingText(recipe, recipe.ingredients));
    const queryTexts = targets.map((recipe) => buildRecipeVectorQueryText(recipe.ingredients));
    const totalInputs = candidateTexts.length + queryTexts.length;
    const expectedApiRequests = Math.ceil(totalInputs / EMBEDDING_BATCH_SIZE);
    const estimatedInputTokens = Math.ceil([...candidateTexts, ...queryTexts].reduce((sum, text) => sum + text.length, 0) / 4);
    const classifiedIngredients = candidates.flatMap((recipe) =>
      classifyRecipeIngredientsForEmbedding(recipe, recipe.ingredients)
    );
    const unknownCount = classifiedIngredients.filter((ingredient) => ingredient.ingredientType === 'unknown').length;
    const existingRows = await prisma.$queryRawUnsafe(
      `
        SELECT count(*)::int AS count
        FROM recipe_embeddings
        WHERE recipe_id = ANY($1::uuid[])
          AND embedding_model = $2
          AND embedding_dimensions = $3
      `,
      candidates.map((recipe) => recipe.id),
      config.model,
      config.dimensions
    );
    const existingEmbeddingCount = Number(existingRows[0]?.count || 0);
    const preflight = {
      mode: settings.dryRun ? 'dry-run' : 'evaluate',
      model: config.model,
      dimensions: config.dimensions,
      candidateCount: candidates.length,
      targetCount: targets.length,
      totalEmbeddingInputs: totalInputs,
      expectedApiRequests,
      estimatedInputTokens,
      productionWrites: 0,
      classificationRate: round(classifiedIngredients.length ? (classifiedIngredients.length - unknownCount) / classifiedIngredients.length : 0),
      unknownRate: round(classifiedIngredients.length ? unknownCount / classifiedIngredients.length : 0),
      embeddingMissingRate: round(candidates.length ? (candidates.length - existingEmbeddingCount) / candidates.length : 0)
    };

    if (settings.dryRun) return { preflight, metrics: null, results: [] };
    if (!config.apiKey) throw new Error('OPENAI_API_KEY is required for --evaluate --execute.');

    const generateBatch = settings.generateBatch || generateRecipeEmbeddings;
    const generated = await generateInBatches([...candidateTexts, ...queryTexts], config, generateBatch);
    const candidateVectors = generated.vectors.slice(0, candidates.length);
    const queryVectors = generated.vectors.slice(candidates.length);
    const missingCounts = [];
    const seasoningCounts = [];
    const results = targets.map((target, targetIndex) => {
      const ranked = candidates
        .map((candidate, candidateIndex) => ({
          recipe: candidate,
          similarity: cosineSimilarity(queryVectors[targetIndex], candidateVectors[candidateIndex])
        }))
        .sort((left, right) => right.similarity - left.similarity || left.recipe.id.localeCompare(right.recipe.id));
      const originalRank = ranked.findIndex((item) => item.recipe.id === target.id) + 1;
      const available = target.ingredients.map((ingredient) => ({ name: ingredient.normalizedName }));
      const top5 = ranked.slice(0, 5).map(({ recipe, similarity }) => {
        const structured = getRecipeMatchScore(available, recipe.ingredients, { recipeId: recipe.id });
        missingCounts.push(structured.missingIngredients.length);
        seasoningCounts.push(structured.missingSeasonings.length);
        return {
          id: recipe.id,
          name: recipe.name,
          similarity: round(similarity, 6),
          missingIngredientCount: structured.missingIngredients.length,
          missingSeasoningCount: structured.missingSeasonings.length
        };
      });

      return {
        id: target.id,
        name: target.name,
        queryText: queryTexts[targetIndex],
        embeddingText: candidateTexts[candidates.findIndex((candidate) => candidate.id === target.id)],
        originalRank,
        hit1: originalRank === 1,
        hit5: originalRank <= 5,
        reciprocalRankAt5: originalRank <= 5 ? 1 / originalRank : 0,
        top5
      };
    });
    const hit1Count = results.filter((result) => result.hit1).length;
    const hit5Count = results.filter((result) => result.hit5).length;
    const metrics = {
      hitAt1: `${hit1Count}/${targets.length}`,
      hitAt5: `${hit5Count}/${targets.length}`,
      mrrAt5: round(results.reduce((sum, result) => sum + result.reciprocalRankAt5, 0) / targets.length),
      averageOriginalRank: round(results.reduce((sum, result) => sum + result.originalRank, 0) / targets.length),
      medianMissingIngredientsTop5: median(missingCounts),
      medianMissingSeasoningsTop5: median(seasoningCounts),
      apiRequestCount: generated.requestCount,
      fullBackfillGate: hit5Count >= 7 ? 'Go' : 'No-Go'
    };
    const report = { preflight: { ...preflight, mode: 'evaluate' }, metrics, results };
    const outputPath = assertOutputPath(settings.output);
    if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return report;
  } finally {
    // The caller owns the transaction or injected Prisma client.
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs();
  evaluateRecipeSearch(options)
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
