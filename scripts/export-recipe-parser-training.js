import 'dotenv/config';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseIngredientsText } from './parse-recipe-ingredients.js';

const SOURCE = 'MFDS_COOKRCP01';
const DEFAULT_LIMIT = 100;
const DEFAULT_OUTPUT = 'data/training/recipe-parser-examples.jsonl';
const PAGE_SIZE = 1000;
const SCHEMA_VERSION = 1;
const PARSER_VERSION = 'rule-mfds-v1';

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalizeSupabaseUrl(url) {
  return url.replace(/\/rest\/v1\/?$/, '');
}

function parseArgs(argv = process.argv.slice(2)) {
  const isAll = argv.includes('--all');
  const includeSkipped = !argv.includes('--no-skipped');
  const lowConfidenceOnly = argv.includes('--low-confidence-only');
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));
  const outputArg = argv.find((arg) => arg.startsWith('--output='));
  const minConfidenceArg = argv.find((arg) => arg.startsWith('--min-confidence='));

  const limit = isAll ? 0 : (limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : DEFAULT_LIMIT);
  const minConfidence = minConfidenceArg ? Number.parseFloat(minConfidenceArg.split('=')[1]) : 0.7;

  return {
    includeSkipped,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 0,
    lowConfidenceOnly,
    minConfidence: Number.isFinite(minConfidence) ? Math.max(0, Math.min(1, minConfidence)) : 0.7,
    output: outputArg ? outputArg.slice('--output='.length) : DEFAULT_OUTPUT
  };
}

async function readRecipes({ supabase, limit }) {
  const allRecipes = [];
  let from = 0;

  while (true) {
    const remainingLimit = limit > 0 ? limit - allRecipes.length : PAGE_SIZE;
    if (remainingLimit <= 0) break;

    const batchSize = limit > 0 ? Math.min(PAGE_SIZE, remainingLimit) : PAGE_SIZE;
    const to = from + batchSize - 1;
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, external_id, name, ingredients_text, source')
      .not('ingredients_text', 'is', null)
      .neq('ingredients_text', '')
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!recipes?.length) break;

    allRecipes.push(...recipes);

    if (recipes.length < batchSize) break;
    from += batchSize;
  }

  return allRecipes;
}

function buildParsedExample({ recipe, ingredient, index, minConfidence }) {
  const needsReview = ingredient.confidence < minConfidence;

  return {
    schemaVersion: SCHEMA_VERSION,
    task: 'recipe_ingredient_parse',
    source: recipe.source || SOURCE,
    sourceKind: 'supabase_recipes.ingredients_text',
    parserVersion: PARSER_VERSION,
    recipe: {
      id: recipe.id,
      externalId: recipe.external_id || null,
      name: recipe.name
    },
    input: {
      rawText: ingredient.raw_text,
      fullIngredientsText: recipe.ingredients_text
    },
    label: {
      action: 'parse',
      rawName: ingredient.raw_name,
      normalizedName: ingredient.normalized_name,
      canonicalName: ingredient.canonical_name,
      amount: ingredient.amount,
      unit: ingredient.unit
    },
    metadata: {
      chunkIndex: index,
      confidence: ingredient.confidence,
      lowConfidenceReason: ingredient.lowConfidenceReason,
      needsReview
    }
  };
}

function buildSkippedExample({ recipe, skipped, index }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    task: 'recipe_ingredient_parse',
    source: recipe.source || SOURCE,
    sourceKind: 'supabase_recipes.ingredients_text',
    parserVersion: PARSER_VERSION,
    recipe: {
      id: recipe.id,
      externalId: recipe.external_id || null,
      name: recipe.name
    },
    input: {
      rawText: skipped.line,
      fullIngredientsText: recipe.ingredients_text
    },
    label: {
      action: 'skip',
      reason: skipped.reason
    },
    metadata: {
      chunkIndex: index,
      confidence: 1,
      lowConfidenceReason: null,
      needsReview: false
    }
  };
}

function buildTrainingExamples(recipe, options = {}) {
  const { includeSkipped = true, lowConfidenceOnly = false, minConfidence = 0.7 } = options;
  const { chunks, skipped } = parseIngredientsText(recipe.ingredients_text, recipe.name);
  const parsedExamples = chunks
    .map((ingredient, index) => buildParsedExample({ recipe, ingredient, index, minConfidence }))
    .filter((example) => !lowConfidenceOnly || example.metadata.needsReview);
  const skippedExamples = includeSkipped && !lowConfidenceOnly
    ? skipped.map((item, index) => buildSkippedExample({ recipe, skipped: item, index: chunks.length + index }))
    : [];

  return [...parsedExamples, ...skippedExamples];
}

async function writeJsonl(filePath, examples) {
  await mkdir(dirname(filePath), { recursive: true });

  const stream = createWriteStream(filePath, { encoding: 'utf8' });

  for (const example of examples) {
    stream.write(`${JSON.stringify(example)}\n`);
  }

  await new Promise((resolve, reject) => {
    stream.end(resolve);
    stream.on('error', reject);
  });
}

async function run() {
  const options = parseArgs();
  const supabaseUrl = normalizeSupabaseUrl(requireEnv('SUPABASE_URL'));
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  console.log('=== Recipe Parser Training Export ===');
  console.log(`Output: ${options.output}`);
  console.log(`Mode: ${options.limit > 0 ? `limit ${options.limit}` : 'all'}`);

  const recipes = await readRecipes({ supabase, limit: options.limit });
  const examples = recipes.flatMap((recipe) => buildTrainingExamples(recipe, options));
  const reviewCount = examples.filter((example) => example.metadata.needsReview).length;
  const parsedCount = examples.filter((example) => example.label.action === 'parse').length;
  const skippedCount = examples.filter((example) => example.label.action === 'skip').length;

  await writeJsonl(options.output, examples);

  console.log(
    JSON.stringify(
      {
        recipes: recipes.length,
        examples: examples.length,
        parsedExamples: parsedCount,
        skippedExamples: skippedCount,
        needsReview: reviewCount,
        output: options.output
      },
      null,
      2
    )
  );
}

export {
  buildParsedExample,
  buildSkippedExample,
  buildTrainingExamples,
  parseArgs
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
