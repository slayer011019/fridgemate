import { describe, expect, it } from 'vitest';
import { buildTrainingExamples, parseArgs } from '../export-recipe-parser-training.js';

const recipe = {
  id: 'recipe-1',
  external_id: '28',
  name: '새우 두부 계란찜',
  ingredients_text: [
    '새우 두부 계란찜',
    '재료',
    '연두부 75g(3/4모), 계란 1개, 설탕 1',
    '20g'
  ].join('\n'),
  source: 'MFDS_COOKRCP01'
};

describe('recipe parser training export', () => {
  it('builds parsed and skipped JSONL-ready examples', () => {
    const examples = buildTrainingExamples(recipe);

    expect(examples).toEqual([
      expect.objectContaining({
        schemaVersion: 1,
        task: 'recipe_ingredient_parse',
        source: 'MFDS_COOKRCP01',
        sourceKind: 'supabase_recipes.ingredients_text',
        parserVersion: 'rule-mfds-v1',
        recipe: {
          id: 'recipe-1',
          externalId: '28',
          name: '새우 두부 계란찜'
        },
        input: expect.objectContaining({ rawText: '연두부 75g(3/4모)' }),
        label: expect.objectContaining({
          action: 'parse',
          rawName: '연두부',
          normalizedName: '연두부',
          amount: 75,
          unit: 'g'
        }),
        metadata: expect.objectContaining({ confidence: 0.95, needsReview: false })
      }),
      expect.objectContaining({
        input: expect.objectContaining({ rawText: '계란 1개' }),
        label: expect.objectContaining({
          action: 'parse',
          canonicalName: '달걀',
          amount: 1,
          unit: '개'
        })
      }),
      expect.objectContaining({
        input: expect.objectContaining({ rawText: '설탕 1' }),
        label: expect.objectContaining({
          action: 'parse',
          normalizedName: '설탕',
          amount: 1,
          unit: null
        }),
        metadata: expect.objectContaining({ needsReview: false })
      }),
      expect.objectContaining({
        label: { action: 'skip', reason: 'recipe title' }
      }),
      expect.objectContaining({
        label: { action: 'skip', reason: 'header' }
      }),
      expect.objectContaining({
        label: { action: 'skip', reason: 'numeric_unit_fragment' }
      })
    ]);
  });

  it('can export only low-confidence parsed examples', () => {
    const lowConfidenceRecipe = {
      ...recipe,
      ingredients_text: '닭고기(가슴살'
    };
    const examples = buildTrainingExamples(lowConfidenceRecipe, { lowConfidenceOnly: true });

    expect(examples).toHaveLength(1);
    expect(examples[0]).toMatchObject({
      label: {
        action: 'parse',
        rawName: '닭고기(가슴살',
        normalizedName: '닭고기(가슴살',
        canonicalName: '닭고기(가슴살',
        amount: null,
        unit: null
      },
      metadata: {
        confidence: 0.65,
        needsReview: true,
        lowConfidenceReason: 'No numeric amount detected'
      }
    });
  });

  it('parses CLI options for bounded and all exports', () => {
    expect(parseArgs(['--limit=500', '--output=tmp/examples.jsonl', '--no-skipped'])).toMatchObject({
      includeSkipped: false,
      limit: 500,
      lowConfidenceOnly: false,
      minConfidence: 0.7,
      output: 'tmp/examples.jsonl'
    });
    expect(parseArgs(['--all', '--low-confidence-only', '--min-confidence=0.85'])).toMatchObject({
      includeSkipped: true,
      limit: 0,
      lowConfidenceOnly: true,
      minConfidence: 0.85
    });
  });
});
