import 'dotenv/config';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { buildProductionRecipeEmbeddingText } from '../server/src/services/recipeEmbeddingTextBuilder.js';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    dryRun: argv.includes('--dry-run'),
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
  });

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

async function fetchRecipeBatch(prisma, { limit, offset }) {
  return prisma.$queryRawUnsafe(
    `
      SELECT id, name, dish_type, cooking_method, ingredients_text, steps, raw
      FROM recipes
      ORDER BY id
      LIMIT ${limit}
      OFFSET ${offset}
    `
  );
}

async function fetchIngredientsForRecipes(prisma, recipeIds = []) {
  if (!recipeIds.length) {
    return new Map();
  }

  const quotedIds = recipeIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT recipe_id, normalized_name, canonical_name, category, raw_name
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

async function hasCurrentEmbedding(prisma, { recipeId, model, dimensions, contentHash }) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT 1
      FROM recipe_embeddings
      WHERE recipe_id = '${String(recipeId).replace(/'/g, "''")}'
        AND embedding_model = '${String(model).replace(/'/g, "''")}'
        AND embedding_dimensions = ${dimensions}
        AND content_hash = '${String(contentHash).replace(/'/g, "''")}'
      LIMIT 1
    `
  );

  return rows.length > 0;
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
    failed: 0
  };

  if (!options.dryRun && !config.apiKey) {
    throw new Error('OPENAI_API_KEY is required unless --dry-run is used.');
  }

  try {
    for (let offset = 0; offset < options.limit; offset += options.batchSize) {
      const take = Math.min(options.batchSize, options.limit - offset);
      const recipes = await fetchRecipeBatch(prisma, { limit: take, offset });

      if (!recipes.length) {
        break;
      }

      const ingredientsByRecipeId = await fetchIngredientsForRecipes(
        prisma,
        recipes.map((recipe) => recipe.id)
      );

      for (const recipe of recipes) {
        const ingredients = ingredientsByRecipeId.get(String(recipe.id)) || [];
        const embeddingText = buildProductionRecipeEmbeddingText(recipe, ingredients);
        const contentHash = contentHashFor(embeddingText);
        summary.processed += 1;

        if (options.dryRun) {
          summary.skipped += 1;
          console.log(
            `[dry-run] ${recipe.id} ${recipe.name || '(untitled)'} hash=${contentHash.slice(0, 12)} chars=${embeddingText.length}`
          );
          continue;
        }

        try {
          const alreadyEmbedded = await hasCurrentEmbedding(prisma, {
            recipeId: recipe.id,
            model: config.model,
            dimensions: config.dimensions,
            contentHash
          });

          if (alreadyEmbedded) {
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
      `Summary: processed=${summary.processed} generated=${summary.generated} skipped=${summary.skipped} failed=${summary.failed}`
    );
    return summary;
  } finally {
    if (!options.prismaClient) {
      await prisma.$disconnect();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  embedRecipes().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
