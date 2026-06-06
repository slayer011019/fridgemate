import { describe, expect, it, vi } from 'vitest';
import { embedRecipes } from '../embed-recipes.js';

describe('embed-recipes script', () => {
  it('supports dry-run without calling OpenAI or writing embeddings', async () => {
    const prismaClient = {
      $queryRawUnsafe: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Kimchi Fried Rice',
            dish_type: 'Rice',
            cooking_method: 'Stir-fry',
            ingredients_text: 'kimchi, rice',
            steps: [],
            raw: {}
          }
        ])
        .mockResolvedValueOnce([
          {
            recipe_id: '11111111-1111-1111-1111-111111111111',
            normalized_name: 'kimchi',
            canonical_name: 'kimchi',
            category: 'vegetable',
            raw_name: 'kimchi'
          }
        ]),
      $executeRawUnsafe: vi.fn(),
      $disconnect: vi.fn()
    };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const summary = await embedRecipes({
      dryRun: true,
      limit: 1,
      batchSize: 1,
      prismaClient
    });

    expect(summary).toEqual({
      processed: 1,
      generated: 0,
      skipped: 1,
      failed: 0
    });
    expect(prismaClient.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Summary: processed=1'));

    consoleSpy.mockRestore();
  });
});
