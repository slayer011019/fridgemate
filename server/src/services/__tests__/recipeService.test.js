import { afterEach, describe, expect, it } from 'vitest';
import { serverConfig } from '../../config.js';
import { getRecipeRecommendations } from '../recipeService.js';

const originalSemanticFlag = serverConfig.semanticRecipeApiEnabled;

describe('recipeService semantic rollout flag', () => {
  afterEach(() => {
    serverConfig.semanticRecipeApiEnabled = originalSemanticFlag;
  });

  it('keeps the existing endpoint on rule recommendations while the flag is disabled', async () => {
    serverConfig.semanticRecipeApiEnabled = false;

    const recommendations = await getRecipeRecommendations({
      userId: 'user-1',
      ingredients: [{ name: '계란' }],
      limit: 2
    });

    expect(recommendations).toHaveLength(2);
    expect(recommendations.every((recipe) => recipe._recommendationSource === 'rule')).toBe(true);
  });

  it('rejects the explicit semantic endpoint while the rollout flag is disabled', async () => {
    serverConfig.semanticRecipeApiEnabled = false;

    await expect(
      getRecipeRecommendations({
        userId: 'user-1',
        ingredients: [{ name: '계란' }],
        requireSemantic: true
      })
    ).rejects.toMatchObject({
      status: 503,
      message: 'Semantic recipe recommendations are not enabled.'
    });
  });
});
