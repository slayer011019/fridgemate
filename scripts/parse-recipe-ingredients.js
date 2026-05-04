import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { EXACT_ALIASES } from './lib/ingredientAliases.js';
import {
  ALL_UNIT_TOKENS,
  buildUnitAlternation,
  normalizeUnit
} from './lib/unitNormalizer.js';

const SOURCE = 'MFDS_COOKRCP01';

const FRACTIONS = {
  '⅓': 0.333,
  '⅔': 0.667,
  '¼': 0.25,
  '¾': 0.75,
  '½': 0.5,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

const HTML_TAG_PATTERN = /<[^>]*>/g;
const BR_TAG_PATTERN = /<br\s*\/?>/gi;
const SERVING_INFO_PATTERN = /^\d+\s*인분(?:\s*기준)?$/;
const METADATA_LINE_PATTERN = /^(?:\d+\s*인분(?:\s*기준)?|기준)$/;
const UNIT_ALTERNATION = buildUnitAlternation();
const QUANTITY_PATTERN = /(\d*\.?\d+|\d*\s*[⅓⅔¼¾½⅛⅜⅝⅞]+|\d+\/\d+)$/;

const HEADER_PATTERN = /^[[·\s]*(고명|양념장|소스|드레싱|육수|재료|반죽|튀김옷|마리네이드)[\s:\]]*$/;

const LEADING_SECTION_PATTERN = /^[[·●\s]*(주재료|부재료|재료|양념장|소스|드레싱|육수|고명|반죽|튀김옷|마리네이드)\s*[>:\]]\s*/;
const NOISE_WORDS = ['선택', '장식용', '고명용', '생략가능', '기호에 따라', '취향껏', '채', '다진 것', '송송 썬 것'];
const NOISE_CHARS = /^[():,·●:\s]+$/;
const NUMERIC_FRAGMENT_PATTERN = new RegExp(`^[0-9]+(?:\\.[0-9]+)?\\s*(?:${UNIT_ALTERNATION})\\)?$`);

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parseFraction(text) {
  if (!text) return null;
  
  let total = 0;
  let hasMatch = false;

  // Unicode fractions
  let processed = text;
  for (const [char, value] of Object.entries(FRACTIONS)) {
    if (processed.includes(char)) {
      const parts = processed.split(char);
      const whole = parseFloat(parts[0]) || 0;
      total = whole + value;
      hasMatch = true;
      break;
    }
  }

  if (!hasMatch) {
    // String fractions like 1/2
    const slashMatch = processed.match(/(\d+)\s*\/\s*(\d+)/);
    if (slashMatch) {
      const numerator = parseInt(slashMatch[1], 10);
      const denominator = parseInt(slashMatch[2], 10);
      if (denominator !== 0) {
        total = numerator / denominator;
        hasMatch = true;
      }
    }
  }

  if (!hasMatch) {
    const num = parseFloat(processed);
    if (!isNaN(num)) {
      total = num;
      hasMatch = true;
    }
  }

  return hasMatch ? total : null;
}

function stripHtml(text) {
  return String(text || '')
    .replace(BR_TAG_PATTERN, '\n')
    .replace(HTML_TAG_PATTERN, '')
    .trim();
}

function normalizeIngredientsText(text) {
  return String(text || '')
    .replace(BR_TAG_PATTERN, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function splitRespectingParens(text) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const char of String(text || '')) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    }

    if (char === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) {
        parts.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) {
    parts.push(trimmed);
  }

  return parts;
}

function isMetadataLine(text) {
  return METADATA_LINE_PATTERN.test(String(text || '').trim());
}

function cleanDetailText(text) {
  return String(text || '')
    .replace(/^[,·\s]+|[,·\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAmountOnlyText(text) {
  return QUANTITY_PATTERN.test(String(text || '').trim());
}

function isHeaderLine(line, recipeName) {
  const trimmed = line.trim();
  if (!trimmed) return { skip: true, reason: 'empty' };
  if (trimmed === recipeName) return { skip: true, reason: 'recipe title' };
  if (HEADER_PATTERN.test(trimmed)) return { skip: true, reason: 'header' };
  if (trimmed.endsWith(':')) return { skip: true, reason: 'header' };
  if (trimmed.length < 2 && !/\d/.test(trimmed)) return { skip: true, reason: 'noise' };
  if (NOISE_CHARS.test(trimmed)) return { skip: true, reason: 'noise' };
  return { skip: false };
}

function extractQuantity(text) {
  let amount = null;
  let unit = null;
  let remainingText = String(text || '').trim();

  for (const token of ALL_UNIT_TOKENS) {
    if (!remainingText.endsWith(token)) {
      continue;
    }

    const partBeforeUnit = remainingText.slice(0, -token.length).trim();
    const amountMatch = partBeforeUnit.match(QUANTITY_PATTERN);

    if (amountMatch) {
      const amountStr = amountMatch[0];
      amount = parseFraction(amountStr);
      unit = normalizeUnit(token);
      remainingText = partBeforeUnit.slice(0, -amountStr.length).trim();
      return { amount, unit, remainingText };
    }

    const normalizedUnit = normalizeUnit(token);
    if (normalizedUnit === '약간' || normalizedUnit === '적당량') {
      unit = normalizedUnit;
      remainingText = partBeforeUnit;
      return { amount, unit, remainingText };
    }
  }

  const amountOnlyMatch = remainingText.match(QUANTITY_PATTERN);
  if (amountOnlyMatch && isAmountOnlyText(remainingText)) {
    const amountStr = amountOnlyMatch[0];
    amount = parseFraction(amountStr);
    remainingText = remainingText.slice(0, -amountStr.length).trim();
    return { amount, unit: null, remainingText };
  }

  return { amount: null, unit: null, remainingText };
}

function parseIngredientChunk(chunk) {
  const originalChunk = String(chunk || '').trim();
  const raw_text = stripHtml(originalChunk);
  if (!raw_text) {
    return HTML_TAG_PATTERN.test(originalChunk) ? { skip: true, reason: 'html_tag_only' } : null;
  }
  if (NOISE_CHARS.test(raw_text)) return null;

  let processed = raw_text.replace(/^\[[^\]]+\]/, '').replace(/^·/, '').trim();
  if (!processed) {
    return { skip: true, reason: 'html_tag_only' };
  }

  processed = processed.replace(LEADING_SECTION_PATTERN, '').trim();
  if (!processed) {
    return { skip: true, reason: 'html_tag_only' };
  }
  if (isMetadataLine(processed) || SERVING_INFO_PATTERN.test(processed)) {
    return { skip: true, reason: 'metadata' };
  }

  let amount = null;
  let unit = null;
  let raw_name = '';
  let detail = '';
  let lowConfidenceReason = null;

  const textWithoutParen = processed.replace(/\([^)]+\)/g, '').trim();
  const qPrimary = extractQuantity(textWithoutParen);
  
  const parenMatch = processed.match(/\(([^)]+)\)/);
  let qSecondary = { amount: null, unit: null, remainingText: '' };
  if (parenMatch) {
    const parenContent = parenMatch[1].trim();
    qSecondary = extractQuantity(parenContent);
  }

  if (qPrimary.amount !== null || qPrimary.unit !== null) {
    amount = qPrimary.amount;
    unit = qPrimary.unit;
    raw_name = qPrimary.remainingText;
    if (parenMatch) {
      const parenContent = cleanDetailText(parenMatch[1]);
      if (!NOISE_WORDS.includes(parenContent)) {
        detail = parenContent;
      }
    }
  } else if (qSecondary.amount !== null || qSecondary.unit !== null) {
    amount = qSecondary.amount;
    unit = qSecondary.unit;
    raw_name = textWithoutParen;
    if (qSecondary.remainingText) {
      const nextDetail = cleanDetailText(qSecondary.remainingText);
      if (nextDetail && !NOISE_WORDS.includes(nextDetail)) {
        detail = nextDetail;
      }
    }
  } else {
    raw_name = textWithoutParen;
    if (parenMatch) {
      const parenContent = cleanDetailText(parenMatch[1]);
      if (parenContent && !NOISE_WORDS.includes(parenContent)) {
        detail = parenContent;
      }
    }
  }

  raw_name = raw_name.replace(LEADING_SECTION_PATTERN, '').replace(/[)\]:·,]+$/, '').trim();
  
  const isNumericFragment = NUMERIC_FRAGMENT_PATTERN.test(raw_text) || 
                            NUMERIC_FRAGMENT_PATTERN.test(raw_name) || 
                            (normalizeIngredientName(raw_name) && NUMERIC_FRAGMENT_PATTERN.test(normalizeIngredientName(raw_name)));

  if (!raw_name || NOISE_CHARS.test(raw_name) || isNumericFragment) {
    if (amount !== null || unit !== null || isNumericFragment) {
      return { skip: true, reason: 'numeric_unit_fragment' };
    }
    return null;
  }

  const normalized_name = normalizeIngredientName(raw_name);
  if (!normalized_name || (normalized_name.length <= 1 && amount === null && unit === null)) {
    return null;
  }

  const trimmedName = raw_name.trim();
  const spaceNormalizedName = trimmedName.replace(/\s+/g, ' ');
  const aliasName = EXACT_ALIASES[trimmedName] || EXACT_ALIASES[spaceNormalizedName] || normalized_name;
  const canonical_name = detail ? `${aliasName} ${detail}` : aliasName;

  let confidence = 0.5;
  if (normalized_name) {
    if (amount !== null && unit !== null) {
      confidence = 0.95;
      lowConfidenceReason = null;
    } else if (unit === '약간' || unit === '적당량') {
      confidence = 0.8;
      lowConfidenceReason = null;
    } else if (amount !== null || unit !== null) {
      confidence = 0.85;
      lowConfidenceReason = null;
    } else {
      confidence = 0.65;
      lowConfidenceReason = 'No numeric amount detected';
    }
  }

  if (normalized_name.length > 25) {
    confidence -= 0.2;
    lowConfidenceReason = lowConfidenceReason ? `${lowConfidenceReason}, Name too long` : 'Name too long';
  }
  if (!/[가-힣]/.test(normalized_name)) {
    confidence -= 0.3;
    lowConfidenceReason = lowConfidenceReason ? `${lowConfidenceReason}, No Korean characters` : 'No Korean characters';
  }

  return {
    raw_text,
    raw_name,
    normalized_name,
    canonical_name,
    amount,
    unit,
    confidence,
    lowConfidenceReason
  };
}

function normalizeIngredientName(rawName) {
  if (!rawName) return null;
  let name = rawName.trim();
  name = name.replace(/^저염\s*/, '');
  name = name.replace(/[)\]:·,]+$/, '').trim();
  return name || null;
}

function parseIngredientsText(ingredientsText, recipeName) {
  if (!ingredientsText) return { chunks: [], skipped: [] };

  const lines = normalizeIngredientsText(ingredientsText).split(/\n+/);
  const chunks = [];
  const skipped = [];

  for (const line of lines) {
    const check = isHeaderLine(line, recipeName);
    if (check.skip) {
      skipped.push({ line, reason: check.reason });
      continue;
    }

    const parts = splitRespectingParens(line);
    for (const part of parts) {
      const parsed = parseIngredientChunk(part);
      if (!parsed) continue;
      
      if (parsed.skip) {
        skipped.push({ line: part, reason: parsed.reason });
      } else if (parsed.normalized_name) {
        chunks.push(parsed);
      }
    }
  }

  return { chunks, skipped };
}

async function run() {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const isDryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = isAll ? 0 : (limitArg ? parseInt(limitArg.split('=')[1], 10) : 10);

  let supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (supabaseUrl.endsWith('/rest/v1/')) {
    supabaseUrl = supabaseUrl.replace('/rest/v1/', '');
  } else if (supabaseUrl.endsWith('/rest/v1')) {
    supabaseUrl = supabaseUrl.replace('/rest/v1', '');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  console.log('=== Recipe Ingredients Parser ===');
  console.log(`Mode: ${isDryRun ? 'dry-run' : 'upsert'}${isAll ? ' (all)' : (limit > 0 ? ` (limit: ${limit})` : '')}`);

  let allRecipes = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from('recipes')
      .select('id, name, ingredients_text')
      .not('ingredients_text', 'is', null)
      .neq('ingredients_text', '')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    
    if (limit > 0 && from + PAGE_SIZE > limit) {
      query = query.range(from, limit - 1);
    }

    const { data: recipes, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!recipes || recipes.length === 0) break;

    allRecipes = allRecipes.concat(recipes);
    console.log(`Fetched ${allRecipes.length} recipes...`);

    if (recipes.length < PAGE_SIZE) break;
    if (limit > 0 && allRecipes.length >= limit) break;
    
    from += PAGE_SIZE;
  }

  let totalProcessedCount = 0;
  let totalChunksCount = 0;
  let upsertedCount = 0;
  let skippedTotal = 0;
  const skippedStats = {};
  let lowConfidenceCount = 0;
  const ingredientStats = {};
  const failureExamples = [];

  for (const recipe of allRecipes) {
    const { chunks: parsedIngredients, skipped } = parseIngredientsText(recipe.ingredients_text, recipe.name);
    totalProcessedCount++;
    
    skippedTotal += skipped.length;
    skipped.forEach(s => {
      skippedStats[s.reason] = (skippedStats[s.reason] || 0) + 1;
    });

    totalChunksCount += parsedIngredients.length;
    for (const ing of parsedIngredients) {
      if (ing.confidence < 0.7) {
          lowConfidenceCount++;
          if (failureExamples.length < 50) {
              failureExamples.push({
                recipe: recipe.name,
                ...ing
              });
          }
      }
      if (ing.normalized_name) {
        ingredientStats[ing.normalized_name] = (ingredientStats[ing.normalized_name] || 0) + 1;
      }
    }

    if (isDryRun) {
      upsertedCount += parsedIngredients.length;
      continue;
    }

    const rowsToUpsert = parsedIngredients.map(ing => ({
      recipe_id: recipe.id,
      raw_text: ing.raw_text,
      raw_name: ing.raw_name,
      normalized_name: ing.normalized_name,
      canonical_name: ing.canonical_name,
      amount: ing.amount,
      unit: ing.unit,
      confidence: ing.confidence,
      source: SOURCE,
      updated_at: new Date().toISOString()
    }));

    const { error: upsertError } = await supabase
      .from('recipe_ingredients')
      .upsert(rowsToUpsert, {
        onConflict: 'recipe_id, raw_text'
      });

    if (upsertError) {
      console.error(`Error upserting for recipe ${recipe.id}:`, upsertError.message);
      continue;
    }

    upsertedCount += rowsToUpsert.length;
  }

  console.log('\n--- Processing Summary ---');
  console.log(`Recipes processed: ${totalProcessedCount}`);
  console.log(`Total chunks parsed: ${totalChunksCount}`);
  console.log(`${isDryRun ? 'Dry run (simulated upsert)' : 'Inserted/updated'}: ${upsertedCount}`);
  console.log(`Total skipped: ${skippedTotal}`);
  Object.entries(skippedStats).forEach(([reason, count]) => {
    console.log(`  - ${reason}: ${count}`);
  });
  console.log(`Low confidence (< 0.7): ${lowConfidenceCount} (${((lowConfidenceCount/totalChunksCount)*100).toFixed(1)}%)`);

  console.log('\n--- Top 10 Normalized Ingredients ---');
  Object.entries(ingredientStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([name, count], i) => {
      console.log(`${i + 1}. ${name} (${count}회)`);
    });

  if (failureExamples.length > 0) {
      console.log('\n--- Low Confidence Examples (First 50) ---');
      console.log('Format: [Recipe] RawText | Name | Canonical | Amount | Unit | Conf | Reason');
      failureExamples.forEach((ex, i) => {
        console.log(`${i+1}. [${ex.recipe}] ${ex.raw_text} | ${ex.raw_name} | ${ex.canonical_name} | ${ex.amount} | ${ex.unit} | ${ex.confidence.toFixed(2)} | ${ex.lowConfidenceReason}`);
      });
  }
}

export {
  extractQuantity,
  isHeaderLine,
  normalizeIngredientName,
  parseFraction,
  parseIngredientChunk,
  parseIngredientsText
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
