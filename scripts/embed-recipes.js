import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { buildProductionRecipeEmbeddingText } from '../server/src/services/recipeEmbeddingTextBuilder.js';
import { evaluateRecipeSearch } from './evaluate-recipe-search.js';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_API_BATCH_SIZE = 25;
const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_RETRY_BASE_MS = 500;
const DEFAULT_RETRY_MAX_MS = 10000;
const DEFAULT_STATE_FILE = '.local/recipe-embedding-backfill-state.json';
const MAX_API_BATCH_SIZE = 100;

export function parseArgs(argv = process.argv.slice(2)) {
  const backfillMissing = argv.includes('--backfill-missing');
  const backfillStale = argv.includes('--backfill-stale');
  const options = {
    dryRun: argv.includes('--dry-run') || (!backfillMissing && !backfillStale),
    evaluate: argv.includes('--evaluate'),
    executeEvaluation: argv.includes('--execute'),
    storedVectors: argv.includes('--stored-vectors'),
    backfillMissing,
    backfillStale,
    quiet: argv.includes('--quiet'),
    resume: argv.includes('--resume'),
    resumeFrom: '',
    stateFile: DEFAULT_STATE_FILE,
    output: '',
    limit: 25,
    batchSize: 25,
    apiBatchSize: DEFAULT_API_BATCH_SIZE,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryBaseMs: DEFAULT_RETRY_BASE_MS,
    retryMaxMs: DEFAULT_RETRY_MAX_MS,
    maxWrites: Number.POSITIVE_INFINITY
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--limit=')) {
      options.limit = Math.max(1, Number.parseInt(arg.split('=')[1], 10) || options.limit);
    }

    if (arg.startsWith('--batch-size=')) {
      options.batchSize = Math.max(1, Number.parseInt(arg.split('=')[1], 10) || options.batchSize);
    }

    if (arg.startsWith('--api-batch-size=')) {
      options.apiBatchSize = Math.max(
        1,
        Math.min(MAX_API_BATCH_SIZE, Number.parseInt(arg.split('=')[1], 10) || options.apiBatchSize)
      );
    }

    if (arg.startsWith('--max-retries=')) {
      options.maxRetries = Math.max(0, Number.parseInt(arg.split('=')[1], 10) || 0);
    }

    if (arg.startsWith('--retry-base-ms=')) {
      options.retryBaseMs = Math.max(0, Number.parseInt(arg.split('=')[1], 10) || 0);
    }

    if (arg.startsWith('--retry-max-ms=')) {
      options.retryMaxMs = Math.max(0, Number.parseInt(arg.split('=')[1], 10) || 0);
    }

    if (arg.startsWith('--max-writes=')) {
      options.maxWrites = Math.max(1, Number.parseInt(arg.split('=')[1], 10) || 1);
    }

    if (arg.startsWith('--resume-from=')) options.resumeFrom = arg.slice('--resume-from='.length).trim();
    if (arg.startsWith('--state-file=')) options.stateFile = arg.slice('--state-file='.length).trim();
    if (arg.startsWith('--output=')) options.output = arg.slice('--output='.length).trim();
  });

  if (backfillMissing && backfillStale) {
    throw new Error('Choose either --backfill-missing or --backfill-stale, not both.');
  }

  return options;
}

function toVectorLiteral(vector = []) {
  if (!Array.isArray(vector) || !vector.every((value) => Number.isFinite(value))) {
    throw new Error('Embedding response must be a numeric vector.');
  }

  return `[${vector.join(',')}]`;
}

function contentHashFor(text) {
  return createHash('sha256').update(text).digest('hex');
}

function estimateTokens(texts = []) {
  return Math.ceil(texts.reduce((sum, text) => sum + String(text || '').length, 0) / 4);
}

function round(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(Number(value || 0) * scale) / scale;
}

function getBackfillOperation(options = {}) {
  if (options.backfillMissing) return 'missing';
  if (options.backfillStale) return 'stale';
  return 'scan';
}

function resolveWorkspaceFile(filePath, label) {
  const resolved = path.resolve(process.cwd(), filePath || '');
  const relative = path.relative(process.cwd(), resolved);
  if (!filePath || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the project workspace.`);
  }
  return resolved;
}

async function loadBackfillState(filePath) {
  const resolved = resolveWorkspaceFile(filePath, '--state-file');
  let state;
  try {
    state = JSON.parse(await readFile(resolved, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Backfill state file not found: ${filePath}`);
    }
    throw new Error(`Backfill state file is invalid: ${filePath}`);
  }

  if (state?.version !== 1 || !Object.hasOwn(state, 'lastSuccessfulRecipeId')) {
    throw new Error(`Backfill state file is incomplete: ${filePath}`);
  }
  return state;
}

async function saveBackfillState(filePath, state) {
  const resolved = resolveWorkspaceFile(filePath, '--state-file');
  const temporary = `${resolved}.tmp`;
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(temporary, resolved);
}

function getEmbeddingConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.RECIPE_EMBEDDING_MODEL || DEFAULT_MODEL,
    dimensions: Number(process.env.RECIPE_EMBEDDING_DIMENSIONS || DEFAULT_DIMENSIONS),
    pricePerMillionTokens: Number(process.env.RECIPE_EMBEDDING_PRICE_PER_MILLION_TOKENS || 0)
  };
}

function retryDelayMs(response, attempt, options) {
  const retryAfter = response?.headers?.get?.('retry-after');
  const retryAfterSeconds = Number(retryAfter);
  if (retryAfter !== null && retryAfter !== '' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(options.retryMaxMs, retryAfterSeconds * 1000);
  }

  return Math.min(options.retryMaxMs, options.retryBaseMs * 2 ** attempt);
}

function normalizeEmbeddingPayload(payload, expectedCount, dimensions) {
  const rows = Array.isArray(payload?.data) ? [...payload.data] : [];
  rows.sort((left, right) => Number(left?.index || 0) - Number(right?.index || 0));
  const vectors = rows.map((row) => row?.embedding);

  if (
    vectors.length !== expectedCount ||
    vectors.some(
      (embedding) =>
        !Array.isArray(embedding) ||
        embedding.length !== dimensions ||
        !embedding.every((value) => Number.isFinite(value))
    )
  ) {
    throw new Error(
      `Recipe embedding response must include ${expectedCount} vectors with ${dimensions} dimensions.`
    );
  }

  return vectors;
}

export async function createEmbeddingBatch(texts, config, options = {}) {
  if (!Array.isArray(texts) || !texts.length) {
    return { vectors: [], requestCount: 0, retryCount: 0 };
  }
  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY is required to generate recipe embeddings.');
  }

  const settings = {
    maxRetries: DEFAULT_MAX_RETRIES,
    retryBaseMs: DEFAULT_RETRY_BASE_MS,
    retryMaxMs: DEFAULT_RETRY_MAX_MS,
    fetchImpl: fetch,
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    ...options
  };
  let requestCount = 0;
  let retryCount = 0;

  for (let attempt = 0; attempt <= settings.maxRetries; attempt += 1) {
    requestCount += 1;
    let response;
    try {
      response = await settings.fetchImpl('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          dimensions: config.dimensions,
          input: texts
        })
      });
    } catch {
      if (attempt >= settings.maxRetries) {
        const error = new Error('Recipe embedding request failed because of a network error.');
        error.requestCount = requestCount;
        error.retryCount = retryCount;
        throw error;
      }
      retryCount += 1;
      await settings.sleep(Math.min(settings.retryMaxMs, settings.retryBaseMs * 2 ** attempt));
      continue;
    }

    if (response.ok) {
      const payload = await response.json();
      try {
        return {
          vectors: normalizeEmbeddingPayload(payload, texts.length, config.dimensions),
          requestCount,
          retryCount
        };
      } catch (error) {
        error.requestCount = requestCount;
        error.retryCount = retryCount;
        throw error;
      }
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= settings.maxRetries) {
      const error = new Error(`Recipe embedding request failed with status ${response.status}.`);
      error.requestCount = requestCount;
      error.retryCount = retryCount;
      throw error;
    }

    retryCount += 1;
    await settings.sleep(retryDelayMs(response, attempt, settings));
  }

  throw new Error('Recipe embedding request exhausted retries.');
}

async function fetchRecipeBatch(prisma, { limit, resumeFrom = '' }) {
  const whereClause = resumeFrom ? 'WHERE id > $1::uuid' : '';
  const parameters = resumeFrom ? [resumeFrom] : [];
  return prisma.$queryRawUnsafe(
    `
      SELECT id, name, dish_type, cooking_method, ingredients_text, hash_tag, steps, raw
      FROM recipes
      ${whereClause}
      ORDER BY id
      LIMIT ${limit}
    `,
    ...parameters
  );
}

async function fetchIngredientsForRecipes(prisma, recipeIds = []) {
  if (!recipeIds.length) {
    return new Map();
  }

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT recipe_id, normalized_name, canonical_name, category, raw_name, raw_text
      FROM recipe_ingredients
      WHERE recipe_id = ANY($1::uuid[])
      ORDER BY recipe_id, normalized_name NULLS LAST, canonical_name NULLS LAST, raw_name NULLS LAST
    `,
    recipeIds.map(String)
  );

  return rows.reduce((byRecipeId, row) => {
    const recipeId = String(row.recipe_id);
    const items = byRecipeId.get(recipeId) || [];
    items.push(row);
    byRecipeId.set(recipeId, items);
    return byRecipeId;
  }, new Map());
}

async function fetchEmbeddingHashes(prisma, { recipeIds, model, dimensions }) {
  if (!recipeIds.length) return new Map();
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT recipe_id, content_hash
      FROM recipe_embeddings
      WHERE recipe_id = ANY($1::uuid[])
        AND embedding_model = $2
        AND embedding_dimensions = $3
    `,
    recipeIds.map(String),
    String(model),
    Number(dimensions)
  );
  return new Map(rows.map((row) => [String(row.recipe_id), String(row.content_hash || '')]));
}

async function upsertEmbedding(prisma, { recipeId, embeddingText, embedding, model, dimensions, contentHash }) {
  const vectorLiteral = toVectorLiteral(embedding);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO recipe_embeddings (
        recipe_id,
        embedding_text,
        embedding,
        embedding_model,
        embedding_dimensions,
        content_hash,
        updated_at
      )
      VALUES ($1::uuid, $2, $3::vector, $4, $5, $6, now())
      ON CONFLICT (recipe_id, embedding_model, embedding_dimensions)
      DO UPDATE SET
        embedding_text = EXCLUDED.embedding_text,
        embedding = EXCLUDED.embedding,
        content_hash = EXCLUDED.content_hash,
        updated_at = now()
    `,
    String(recipeId),
    embeddingText,
    vectorLiteral,
    model,
    dimensions,
    contentHash
  );
}

function shouldGenerateForState(embeddingState, options) {
  if (options.backfillMissing) return embeddingState === 'missing';
  if (options.backfillStale) return embeddingState === 'stale';
  return embeddingState !== 'current';
}

function normalizeGeneratedBatch(result, expectedCount, dimensions) {
  const normalized = Array.isArray(result)
    ? { vectors: result, requestCount: 1, retryCount: 0 }
    : result;
  if (
    !Array.isArray(normalized?.vectors) ||
    normalized.vectors.length !== expectedCount ||
    normalized.vectors.some(
      (vector) =>
        !Array.isArray(vector) ||
        vector.length !== dimensions ||
        !vector.every((value) => Number.isFinite(value))
    )
  ) {
    throw new Error(`Embedding batch must return ${expectedCount} numeric vectors with ${dimensions} dimensions.`);
  }
  return {
    vectors: normalized.vectors,
    requestCount: Number(normalized.requestCount || 0),
    retryCount: Number(normalized.retryCount || 0)
  };
}

export async function embedRecipes(options = parseArgs()) {
  const startedAt = Date.now();
  const settings = {
    limit: 25,
    batchSize: 25,
    apiBatchSize: DEFAULT_API_BATCH_SIZE,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryBaseMs: DEFAULT_RETRY_BASE_MS,
    retryMaxMs: DEFAULT_RETRY_MAX_MS,
    stateFile: DEFAULT_STATE_FILE,
    resume: false,
    resumeFrom: '',
    quiet: false,
    persistState: true,
    ...options
  };
  const prisma = options.prismaClient || new PrismaClient();
  const createEmbeddingsForBatch = options.createEmbeddings
    || (options.createEmbedding
      ? async (texts, config) => ({
          vectors: await Promise.all(texts.map((text) => options.createEmbedding(text, config))),
          requestCount: texts.length,
          retryCount: 0
        })
      : createEmbeddingBatch);
  const upsertEmbeddingForRecipe = options.upsertEmbedding || upsertEmbedding;
  const readState = options.loadState || loadBackfillState;
  const writeState = options.saveState || saveBackfillState;
  const maxWrites = Number.isFinite(settings.maxWrites)
    ? Math.max(1, Math.floor(settings.maxWrites))
    : Number.POSITIVE_INFINITY;
  const config = {
    ...getEmbeddingConfig(),
    ...options.embeddingConfig
  };
  const operation = getBackfillOperation(settings);
  const summary = {
    processed: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    current: 0,
    missing: 0,
    stale: 0,
    plannedInputs: 0,
    apiInputCount: 0,
    apiRequestCount: 0,
    retryCount: 0,
    estimatedInputTokens: 0,
    estimatedCostUsd: null,
    elapsedMs: 0,
    throughputPerSecond: 0,
    resumed: false,
    writeLimitReached: false,
    lastProcessedRecipeId: null,
    lastSuccessfulRecipeId: null
  };

  if (!settings.dryRun && operation === 'scan') {
    throw new Error('Choose --backfill-missing or --backfill-stale for production writes.');
  }
  if (!settings.dryRun && !config.apiKey) {
    throw new Error('OPENAI_API_KEY is required unless --dry-run is used.');
  }

  let resumeFrom = String(settings.resumeFrom || '').trim();
  if (settings.resume && !resumeFrom) {
    const savedState = await readState(settings.stateFile);
    if (
      savedState.operation !== operation ||
      savedState.model !== config.model ||
      Number(savedState.dimensions) !== Number(config.dimensions)
    ) {
      throw new Error('Backfill state does not match the requested operation, model, or dimensions.');
    }
    resumeFrom = String(savedState.lastSuccessfulRecipeId || '');
    summary.resumed = true;
  }

  summary.lastSuccessfulRecipeId = resumeFrom || null;
  let cursor = resumeFrom;
  let stopRequested = false;

  const recordScanned = (item) => {
    summary.processed += 1;
    summary[item.embeddingState] += 1;
    summary.lastProcessedRecipeId = String(item.recipe.id);
  };

  const persistState = async (status) => {
    if (settings.dryRun || settings.persistState === false) return;
    await writeState(settings.stateFile, {
      version: 1,
      status,
      operation,
      model: config.model,
      dimensions: Number(config.dimensions),
      lastSuccessfulRecipeId: summary.lastSuccessfulRecipeId,
      generated: summary.generated,
      failed: summary.failed,
      apiInputCount: summary.apiInputCount,
      apiRequestCount: summary.apiRequestCount,
      retryCount: summary.retryCount,
      updatedAt: new Date().toISOString()
    });
  };

  try {
    while (summary.processed < settings.limit && !stopRequested) {
      const take = Math.min(settings.batchSize, settings.limit - summary.processed);
      const recipes = await fetchRecipeBatch(prisma, { limit: take, resumeFrom: cursor });

      if (!recipes.length) {
        break;
      }

      const ingredientsByRecipeId = await fetchIngredientsForRecipes(
        prisma,
        recipes.map((recipe) => recipe.id)
      );
      const embeddingHashes = await fetchEmbeddingHashes(prisma, {
        recipeIds: recipes.map((recipe) => recipe.id),
        model: config.model,
        dimensions: config.dimensions
      });

      const prepared = recipes.map((recipe) => {
        const ingredients = ingredientsByRecipeId.get(String(recipe.id)) || [];
        const embeddingText = buildProductionRecipeEmbeddingText(recipe, ingredients);
        const contentHash = contentHashFor(embeddingText);
        const storedHash = embeddingHashes.get(String(recipe.id));
        const embeddingState = !storedHash ? 'missing' : storedHash === contentHash ? 'current' : 'stale';
        return { recipe, embeddingText, contentHash, embeddingState };
      });

      if (settings.dryRun) {
        for (const item of prepared) {
          recordScanned(item);
          summary.skipped += 1;
          if (shouldGenerateForState(item.embeddingState, settings)) {
            summary.plannedInputs += 1;
            summary.estimatedInputTokens += estimateTokens([item.embeddingText]);
          }
          cursor = String(item.recipe.id);
          summary.lastSuccessfulRecipeId = cursor;
          if (!settings.quiet) {
            console.log(
              `[dry-run] ${item.recipe.id} ${item.recipe.name || '(untitled)'} state=${item.embeddingState} hash=${item.contentHash.slice(0, 12)} chars=${item.embeddingText.length}`
            );
          }
        }
        continue;
      }

      let position = 0;
      while (position < prepared.length && !stopRequested) {
        while (
          position < prepared.length &&
          !shouldGenerateForState(prepared[position].embeddingState, settings)
        ) {
          const item = prepared[position];
          recordScanned(item);
          summary.skipped += 1;
          cursor = String(item.recipe.id);
          summary.lastSuccessfulRecipeId = cursor;
          position += 1;
        }

        if (position >= prepared.length) break;
        const remainingWrites = maxWrites - summary.generated;
        if (remainingWrites <= 0) {
          summary.writeLimitReached = true;
          stopRequested = true;
          break;
        }

        const selected = [];
        let lastSelectedIndex = position;
        const selectionLimit = Math.min(settings.apiBatchSize, remainingWrites);
        for (let index = position; index < prepared.length && selected.length < selectionLimit; index += 1) {
          if (shouldGenerateForState(prepared[index].embeddingState, settings)) {
            selected.push(prepared[index]);
            lastSelectedIndex = index;
          }
        }

        const texts = selected.map((item) => item.embeddingText);
        summary.apiInputCount += texts.length;
        summary.estimatedInputTokens += estimateTokens(texts);
        let generatedBatch;

        try {
          generatedBatch = normalizeGeneratedBatch(
            await createEmbeddingsForBatch(texts, config, {
              maxRetries: settings.maxRetries,
              retryBaseMs: settings.retryBaseMs,
              retryMaxMs: settings.retryMaxMs
            }),
            selected.length,
            Number(config.dimensions)
          );
          summary.apiRequestCount += generatedBatch.requestCount;
          summary.retryCount += generatedBatch.retryCount;
        } catch (error) {
          summary.apiRequestCount += Number(error.requestCount || 0);
          summary.retryCount += Number(error.retryCount || 0);
          selected.forEach((item) => recordScanned(item));
          summary.failed += selected.length;
          console.error(`[failed-batch] count=${selected.length} ${error.message}`);
          stopRequested = true;
          await persistState('failed');
          break;
        }

        const vectorByRecipeId = new Map(
          selected.map((item, index) => [String(item.recipe.id), generatedBatch.vectors[index]])
        );

        for (let index = position; index <= lastSelectedIndex; index += 1) {
          const item = prepared[index];
          recordScanned(item);
          const embedding = vectorByRecipeId.get(String(item.recipe.id));
          if (!embedding) {
            summary.skipped += 1;
            cursor = String(item.recipe.id);
            summary.lastSuccessfulRecipeId = cursor;
            continue;
          }

          try {
            await upsertEmbeddingForRecipe(prisma, {
              recipeId: item.recipe.id,
              embeddingText: item.embeddingText,
              embedding,
              model: config.model,
              dimensions: config.dimensions,
              contentHash: item.contentHash
            });
          } catch (error) {
            summary.failed += 1;
            console.error(`[failed] ${item.recipe.id} ${error.message}`);
            stopRequested = true;
            await persistState('failed');
            break;
          }

          summary.generated += 1;
          cursor = String(item.recipe.id);
          summary.lastSuccessfulRecipeId = cursor;
          await persistState(summary.generated >= maxWrites ? 'paused' : 'running');
        }

        position = lastSelectedIndex + 1;
        if (summary.generated >= maxWrites) {
          summary.writeLimitReached = true;
          stopRequested = true;
        }
      }

      if (!stopRequested && prepared.length) {
        cursor = String(prepared[prepared.length - 1].recipe.id);
        summary.lastSuccessfulRecipeId = cursor;
        await persistState('running');
      }
    }

    const finalStatus = summary.failed > 0
      ? 'failed'
      : summary.writeLimitReached
        ? 'paused'
        : 'complete';
    await persistState(finalStatus);
    summary.elapsedMs = Date.now() - startedAt;
    summary.throughputPerSecond = round(
      summary.generated / Math.max(summary.elapsedMs / 1000, 0.001),
      3
    );
    summary.estimatedCostUsd = config.pricePerMillionTokens > 0
      ? round((summary.estimatedInputTokens / 1_000_000) * config.pricePerMillionTokens, 8)
      : null;

    console.log(
      `Summary: processed=${summary.processed} generated=${summary.generated} skipped=${summary.skipped} failed=${summary.failed} current=${summary.current} missing=${summary.missing} stale=${summary.stale} plannedInputs=${summary.plannedInputs} apiInputCount=${summary.apiInputCount} apiRequestCount=${summary.apiRequestCount} retries=${summary.retryCount} estimatedInputTokens=${summary.estimatedInputTokens} estimatedCostUsd=${summary.estimatedCostUsd ?? 'unconfigured'} elapsedMs=${summary.elapsedMs} throughputPerSecond=${summary.throughputPerSecond} resumed=${summary.resumed} writeLimitReached=${summary.writeLimitReached} lastProcessedRecipeId=${summary.lastProcessedRecipeId || 'none'} lastSuccessfulRecipeId=${summary.lastSuccessfulRecipeId || 'none'}`
    );
    return summary;
  } finally {
    if (!options.prismaClient) {
      await prisma.$disconnect();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs();
  const operation = options.evaluate
      ? evaluateRecipeSearch({
        dryRun: !options.executeEvaluation,
        storedVectors: options.storedVectors,
        limit: options.limit,
        output: options.output
      }).then((report) => console.log(JSON.stringify(report, null, 2)))
    : embedRecipes(options);

  operation.catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
