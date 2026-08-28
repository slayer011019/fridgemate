import 'dotenv/config';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { buildProductionRecipeEmbeddingText } from '../server/src/services/recipeEmbeddingTextBuilder.js';
import { evaluateRecipeSearch } from './evaluate-recipe-search.js';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

export function parseArgs(argv = process.argv.slice(2)) {
  const backfillMissing = argv.includes('--backfill-missing');
  const backfillStale = argv.includes('--backfill-stale');
  const options = {
    dryRun: argv.includes('--dry-run') || (!backfillMissing && !backfillStale),
    evaluate: argv.includes('--evaluate'),
    executeEvaluation: argv.includes('--execute'),
    backfillMissing,
    backfillStale,
    quiet: argv.includes('--quiet'),
    resumeFrom: '',
    output: '',
    limit: 25,
    batchSize: 25
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--limit=')) {
      options.limit = Math.max(1, Number.parseInt(arg.split('=')[1], 10) || options.limit);
    }

    if (arg.startsWith('--batch-size=')) {
      options.batchSize = Math.max(1, Number.parseInt(arg.split('=')[1], 10) || options.batchSize);
    }

    if (arg.startsWith('--resume-from=')) options.resumeFrom = arg.slice('--resume-from='.length).trim();
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

function getEmbeddingConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.RECIPE_EMBEDDING_MODEL || DEFAULT_MODEL,
    dimensions: Number(process.env.RECIPE_EMBEDDING_DIMENSIONS || DEFAULT_DIMENSIONS)
  };
}

async function createEmbedding(text, config) {
  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY is required to generate recipe embeddings.');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      dimensions: config.dimensions,
      input: text
    })
  });

  if (!response.ok) {
    throw new Error(`Recipe embedding request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const embedding = payload?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length !== config.dimensions) {
    throw new Error(`Recipe embedding response must include ${config.dimensions} dimensions.`);
  }

  return embedding;
}

async function fetchRecipeBatch(prisma, { limit, offset, resumeFrom = '' }) {
  const whereClause = resumeFrom ? 'WHERE id > $1::uuid' : '';
  const parameters = resumeFrom ? [resumeFrom] : [];
  return prisma.$queryRawUnsafe(
    `
      SELECT id, name, dish_type, cooking_method, ingredients_text, hash_tag, steps, raw
      FROM recipes
      ${whereClause}
      ORDER BY id
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    ...parameters
  );
}

async function fetchIngredientsForRecipes(prisma, recipeIds = []) {
  if (!recipeIds.length) {
    return new Map();
  }

  const quotedIds = recipeIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT recipe_id, normalized_name, canonical_name, category, raw_name, raw_text
      FROM recipe_ingredients
      WHERE recipe_id IN (${quotedIds})
      ORDER BY recipe_id, normalized_name NULLS LAST, canonical_name NULLS LAST, raw_name NULLS LAST
    `
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

export async function embedRecipes(options = parseArgs()) {
  const prisma = options.prismaClient || new PrismaClient();
  const config = {
    ...getEmbeddingConfig(),
    ...options.embeddingConfig
  };
  const summary = {
    processed: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    current: 0,
    missing: 0,
    stale: 0,
    lastProcessedRecipeId: null
  };

  if (!options.dryRun && !config.apiKey) {
    throw new Error('OPENAI_API_KEY is required unless --dry-run is used.');
  }

  try {
    for (let offset = 0; offset < options.limit; offset += options.batchSize) {
      const take = Math.min(options.batchSize, options.limit - offset);
      const recipes = await fetchRecipeBatch(prisma, { limit: take, offset, resumeFrom: options.resumeFrom });

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

      for (const recipe of recipes) {
        const ingredients = ingredientsByRecipeId.get(String(recipe.id)) || [];
        const embeddingText = buildProductionRecipeEmbeddingText(recipe, ingredients);
        const contentHash = contentHashFor(embeddingText);
        summary.processed += 1;
        summary.lastProcessedRecipeId = String(recipe.id);
        const storedHash = embeddingHashes.get(String(recipe.id));
        const embeddingState = !storedHash ? 'missing' : storedHash === contentHash ? 'current' : 'stale';
        summary[embeddingState] += 1;

        if (options.dryRun) {
          summary.skipped += 1;
          if (!options.quiet) {
            console.log(
              `[dry-run] ${recipe.id} ${recipe.name || '(untitled)'} state=${embeddingState} hash=${contentHash.slice(0, 12)} chars=${embeddingText.length}`
            );
          }
          continue;
        }

        try {
          const shouldGenerate =
            (options.backfillMissing && embeddingState === 'missing') ||
            (options.backfillStale && embeddingState === 'stale');
          if (!shouldGenerate) {
            summary.skipped += 1;
            continue;
          }

          const embedding = await createEmbedding(embeddingText, config);
          await upsertEmbedding(prisma, {
            recipeId: recipe.id,
            embeddingText,
            embedding,
            model: config.model,
            dimensions: config.dimensions,
            contentHash
          });
          summary.generated += 1;
        } catch (error) {
          summary.failed += 1;
          console.error(`[failed] ${recipe.id} ${error.message}`);
        }
      }
    }

    console.log(
      `Summary: processed=${summary.processed} generated=${summary.generated} skipped=${summary.skipped} failed=${summary.failed} current=${summary.current} missing=${summary.missing} stale=${summary.stale} lastProcessedRecipeId=${summary.lastProcessedRecipeId || 'none'}`
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
        limit: options.limit,
        output: options.output
      }).then((report) => console.log(JSON.stringify(report, null, 2)))
    : embedRecipes(options);

  operation.catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
