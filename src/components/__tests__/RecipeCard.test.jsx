import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RecipeCard from '../RecipeCard';

const baseRecipe = {
  title: '계란 볶음밥',
  category: '한 그릇',
  matchRate: 0.94,
  matchedIngredients: ['계란', '밥'],
  coreIngredients: ['계란', '밥', '대파'],
  matchedCount: 2,
  totalRequiredIngredients: 3,
  searchLinks: {
    manRecipe: 'https://example.com/recipe',
    youtube: 'https://example.com/video',
    naver: 'https://example.com/search'
  }
};

describe('RecipeCard', () => {
  it('hides empty missing ingredient sections', () => {
    render(<RecipeCard recipe={{ ...baseRecipe, canMakeNow: true }} />);

    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText('계란, 밥')).toBeInTheDocument();
    expect(screen.queryByText('추가로 필요한 재료')).not.toBeInTheDocument();
  });

  it('combines missing ingredients and seasonings into one compact warning', () => {
    render(
      <RecipeCard
        recipe={{
          ...baseRecipe,
          missingIngredients: ['대파'],
          missingSeasonings: ['간장']
        }}
      />
    );

    expect(screen.getByText('추가로 필요한 재료')).toBeInTheDocument();
    expect(screen.getByText('대파')).toBeInTheDocument();
    expect(screen.getByText('양념: 간장')).toBeInTheDocument();
  });
});
