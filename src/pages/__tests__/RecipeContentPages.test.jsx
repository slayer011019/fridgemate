import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GuidePage from '../GuidePage';
import IngredientHubPage from '../IngredientHubPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderContent(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/guides/:guideSlug" element={<GuidePage />} />
        <Route path="/recipes/ingredients/:ingredientSlug" element={<IngredientHubPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('public recipe decision pages', () => {
  it.each(['fridge-cleanout', 'use-expiring-ingredients'])('opens %s without an account and links the complete example to a recipe', (slug) => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    renderContent(`/guides/${slug}`);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const example = screen.getByRole('region', { name: /예시$/ });
    expect(within(example).getByRole('heading', { name: '선택한 메뉴의 추가 준비 목록' })).toBeInTheDocument();
    const link = within(example).getByRole('link', { name: '예시 재료로 선택한 조리법 보기' });
    expect(link.getAttribute('href')).toMatch(/^\/recipes\/\d+-.+\?have=/u);
    expect(within(example).getByText(/내 냉장고에 저장하지 않습니다/)).toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: '식약처 소비기한·보관방법 안내' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dusgGQikgGc');
  });

  it.each(['tofu', 'mushroom'])('renders the %s comparison with amounts, tools and three internal detail links', (slug) => {
    renderContent(`/recipes/ingredients/${slug}`);
    const comparison = screen.getByRole('region', { name: '같은 재료, 어떤 메뉴를 고를까요?' });
    expect(within(comparison).getAllByText('원문 사용량')).toHaveLength(3);
    expect(within(comparison).getAllByText('조리 도구')).toHaveLength(3);
    expect(within(comparison).getAllByRole('link', { name: '전체 재료와 조리법 확인' })).toHaveLength(3);
  });
});
