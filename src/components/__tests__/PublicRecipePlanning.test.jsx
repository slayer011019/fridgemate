import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import PublicRecipeExplorer from '../PublicRecipeExplorer';
import RecipePreparationChecklist from '../RecipePreparationChecklist';
import { useIngredients } from '../../hooks/useIngredients';
import { usePantryStaples } from '../../hooks/usePantryStaples';
import { publicRecipeCatalog } from '../../features/recipes/publicRecipeCatalog';

vi.mock('../../hooks/useIngredients', () => ({ useIngredients: vi.fn() }));
vi.mock('../../hooks/usePantryStaples', () => ({ usePantryStaples: vi.fn() }));

let ingredientState;
let pantryState;

beforeEach(() => {
  ingredientState = {
    ingredients: [],
    addIngredient: vi.fn(), addIngredients: vi.fn(), updateIngredient: vi.fn(), removeIngredient: vi.fn()
  };
  pantryState = { pantryStaples: [], pantryOwnership: {}, setPantryStatus: vi.fn(), cyclePantryStatus: vi.fn() };
  vi.mocked(useIngredients).mockImplementation(() => ingredientState);
  vi.mocked(usePantryStaples).mockImplementation(() => pantryState);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output aria-label="테스트 현재 주소">{pathname}{search}</output>;
}

function renderPlanning(ui, path = '/recipes') {
  return render(<MemoryRouter initialEntries={[path]}>{ui}<LocationProbe /></MemoryRouter>);
}

function recipeById(id) {
  return publicRecipeCatalog.find((recipe) => recipe.externalId === id);
}

function recipeLinks() {
  return screen.getAllByRole('link').filter((link) => /^\/recipes\/\d+-/u.test(link.getAttribute('href')));
}

function explorerStatus() {
  return within(screen.getByRole('region', { name: '남은 재료로 무엇을 만들까요?' })).getByRole('status');
}

function remainingPanel() {
  return screen.getByRole('heading', { name: /^추가 확인·준비 목록/u }).parentElement;
}

function expectNoPersistentChanges() {
  expect(ingredientState.addIngredient).not.toHaveBeenCalled();
  expect(ingredientState.addIngredients).not.toHaveBeenCalled();
  expect(ingredientState.updateIngredient).not.toHaveBeenCalled();
  expect(ingredientState.removeIngredient).not.toHaveBeenCalled();
  expect(pantryState.setPantryStatus).not.toHaveBeenCalled();
  expect(pantryState.cyclePantryStatus).not.toHaveBeenCalled();
}

describe('PublicRecipeExplorer', () => {
  it('offers public detail pages and guides with no saved or selected ingredients', () => {
    renderPlanning(<PublicRecipeExplorer compact />);
    expect(recipeLinks()).toHaveLength(6);
    expect(explorerStatus()).toHaveTextContent('조리법과 활용 설명을 함께 살펴보세요');
    expect(screen.getByRole('link', { name: /^새우 두부 계란찜/u })).toHaveAttribute('href', '/recipes/28-새우-두부-계란찜');
    expect(screen.getByRole('link', { name: '예시 냉장고로 메뉴 고르기' })).toHaveAttribute('href', '/guides/fridge-cleanout');
    expect(screen.getByRole('link', { name: '전체 메뉴 살펴보기' })).toHaveAttribute('href', '/recipes');
    expect(screen.queryByRole('button', { name: '선택 지우기' })).not.toBeInTheDocument();
    expectNoPersistentChanges();
  });

  it('ranks both selected ingredients first and carries exact selection into public recipe links', () => {
    renderPlanning(<PublicRecipeExplorer compact />, '/recipes?have=오이,사과');
    const first = recipeLinks()[0];
    expect(within(first).getByRole('heading', { name: '순두부 사과 소스 오이무침' })).toBeInTheDocument();
    expect(first).toHaveAttribute('href', `/recipes/32-순두부-사과-소스-오이무침?have=${encodeURIComponent('오이,사과')}`);
    expect(within(first).getByText('관련 재료: 오이, 사과')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^새우 두부 계란찜/u })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전체 메뉴 살펴보기' })).toHaveAttribute('href', `/recipes?have=${encodeURIComponent('오이,사과')}`);
    expectNoPersistentChanges();
  });

  it('toggles a broad ingredient hub and clears only the planning query', async () => {
    const user = userEvent.setup();
    renderPlanning(<PublicRecipeExplorer />, '/recipes?view=public');
    await user.click(screen.getByRole('button', { name: '두부', exact: true }));
    expect(screen.getByRole('button', { name: '두부', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /^새우 두부 계란찜/u })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^순두부 사과 소스 오이무침/u })).toBeInTheDocument();
    expect(screen.getByText(/두부·버섯 등은 비슷한 종류를 함께 찾으며/u)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '선택 지우기' }));
    expect(screen.getByRole('button', { name: '두부', exact: true })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('테스트 현재 주소')).toHaveTextContent('/recipes?view=public');
    expect(explorerStatus()).toHaveTextContent('조리법과 활용 설명을 함께 살펴보세요');
  });

  it('handles no results and recovers by clearing the search without saving the typed ingredient', async () => {
    const user = userEvent.setup();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    renderPlanning(<PublicRecipeExplorer />);
    const input = screen.getByRole('textbox', { name: '다른 재료도 찾아보기' });
    expect(screen.getByRole('button', { name: '재료로 찾기' })).toBeDisabled();
    await user.type(input, '카탈로그에없는재료');
    await user.click(screen.getByRole('button', { name: '재료로 찾기' }));
    expect(input).toHaveValue('');
    expect(explorerStatus()).toHaveTextContent('선택한 재료와 관련된 메뉴 0개');
    expect(screen.getByText(/일치하는 메뉴가 아직 없어요/u)).toBeInTheDocument();
    expect(recipeLinks()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '선택 지우기' }));
    expect(recipeLinks()).toHaveLength(12);
    expect(writes).not.toHaveBeenCalled();
    expectNoPersistentChanges();
  });

  it('shows all 25 related tofu recipes in batches while preserving selection, then resets after filtering', async () => {
    const user = userEvent.setup();
    renderPlanning(<PublicRecipeExplorer />, '/recipes?have=두부&view=public');
    expect(explorerStatus()).toHaveTextContent('선택한 재료와 관련된 메뉴 25개');
    expect(recipeLinks()).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: '메뉴 12개 더 보기' }));
    expect(recipeLinks()).toHaveLength(24);
    await user.click(screen.getByRole('button', { name: '메뉴 1개 더 보기' }));
    expect(recipeLinks()).toHaveLength(25);
    expect(new Set(recipeLinks().map((link) => link.getAttribute('href'))).size).toBe(25);
    expect(screen.queryByRole('button', { name: /메뉴 \d+개 더 보기/u })).not.toBeInTheDocument();
    expect(screen.getByText('25개 중 25개 표시')).toBeInTheDocument();
    recipeLinks().forEach((link) => {
      expect(new URL(link.getAttribute('href'), 'https://example.test').searchParams.get('have')).toBe('두부');
    });
    expect(screen.getByLabelText('테스트 현재 주소')).toHaveTextContent('/recipes?have=두부&view=public');
    await user.click(screen.getByRole('button', { name: '선택 지우기' }));
    expect(recipeLinks()).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: '두부', exact: true }));
    expect(recipeLinks()).toHaveLength(12);
    expect(screen.getByText('25개 중 12개 표시')).toBeInTheDocument();
    expectNoPersistentChanges();
  });
});

describe('RecipePreparationChecklist', () => {
  it('checks only exact source ingredient types, while recognizing the egg spelling alias', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    renderPlanning(<RecipePreparationChecklist recipe={recipeById('28')} />, '/recipes/28-새우-두부-계란찜?have=두부,순두부,계란');
    expect(screen.getByRole('checkbox', { name: '달걀 30g' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '연두부 75g' })).not.toBeChecked();
    expect(screen.getByRole('heading', { name: '추가 확인·준비 목록 6개' })).toBeInTheDocument();
    expect(within(remainingPanel()).getByText('연두부 75g')).toBeInTheDocument();
    expect(within(remainingPanel()).queryByText('달걀 30g')).not.toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
    expectNoPersistentChanges();
  });

  it('updates remaining preparation immediately when a seeded checkbox is cleared or restored', async () => {
    const user = userEvent.setup();
    renderPlanning(<RecipePreparationChecklist recipe={recipeById('32')} />, '/recipes/32-순두부-사과-소스-오이무침?have=순두부,오이,사과,소금');
    expect(screen.getByRole('heading', { name: '추가 확인·준비 목록 1개' })).toBeInTheDocument();
    expect(within(remainingPanel()).getByText('다진 땅콩 10g')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: '오이 70g' }));
    expect(screen.getByRole('heading', { name: '추가 확인·준비 목록 2개' })).toBeInTheDocument();
    expect(within(remainingPanel()).getByText('오이 70g')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: '오이 70g' }));
    await user.click(screen.getByRole('checkbox', { name: '다진 땅콩 10g' }));
    expect(screen.getByRole('heading', { name: '추가 확인·준비 목록 0개' })).toBeInTheDocument();
    expect(within(remainingPanel()).getByText(/각 재료의 필요한 분량도 확인/u)).toBeInTheDocument();
    expectNoPersistentChanges();
  });

  it('uses saved ingredients and only owned pantry items after explicit opt in', async () => {
    const user = userEvent.setup();
    ingredientState.ingredients = [
      { id: 'tofu', name: '연두부', consumed: false },
      { id: 'shrimp', name: '칵테일새우', consumed: true }
    ];
    pantryState.pantryStaples = [
      { id: 'sugar', name: '설탕' }, { id: 'butter', name: '무염버터' }, { id: 'cream', name: '생크림' }
    ];
    pantryState.pantryOwnership = { sugar: 'owned', butter: 'missing', cream: 'unknown' };
    const inventoryBefore = JSON.stringify(ingredientState.ingredients);
    const pantryBefore = JSON.stringify(pantryState.pantryOwnership);
    renderPlanning(<RecipePreparationChecklist recipe={recipeById('28')} />, '/recipes/28-새우-두부-계란찜?have=계란');
    expect(screen.getByRole('checkbox', { name: '연두부 75g' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '설탕 5g' })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: '내 냉장고와 보유 양념도 반영하기' }));
    expect(screen.getByRole('checkbox', { name: '연두부 75g' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '설탕 5g' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '달걀 30g' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '칵테일새우 20g' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '무염버터 5g' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '생크림 13g' })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: '내 냉장고와 보유 양념도 반영하기' }));
    expect(screen.getByRole('checkbox', { name: '연두부 75g' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '설탕 5g' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '달걀 30g' })).toBeChecked();
    expect(JSON.stringify(ingredientState.ingredients)).toBe(inventoryBefore);
    expect(JSON.stringify(pantryState.pantryOwnership)).toBe(pantryBefore);
    expectNoPersistentChanges();
  });

  it('keeps cooking water visible but out of the additional purchase list', () => {
    renderPlanning(<RecipePreparationChecklist recipe={recipeById('674')} />);
    expect(screen.getByRole('checkbox', { name: '물 300g · 조리용 물' })).not.toBeChecked();
    expect(within(remainingPanel()).queryByText('물 300g')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '추가 확인·준비 목록 9개' })).toBeInTheDocument();
  });

  it('requires manual confirmation of every complete unreviewed source line', async () => {
    const user = userEvent.setup();
    const recipe = recipeById('137');
    renderPlanning(<RecipePreparationChecklist recipe={recipe} />, '/recipes/137-된장-두부찌개?have=두부,돼지고기,김치,된장');
    expect(screen.getByText(/한 줄에 여러 재료가 있으면 모두 갖고 있을 때 체크/u)).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    checkboxes.forEach((checkbox) => expect(checkbox).not.toBeChecked());
    expect(screen.getByRole('checkbox', { name: /^두부 320g.+돼지고기 100g/u })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '추가 확인·준비 목록 2개' })).toBeInTheDocument();
    await user.click(checkboxes[0]);
    expect(screen.getByRole('heading', { name: '추가 확인·준비 목록 1개' })).toBeInTheDocument();
    expect(within(remainingPanel()).getByText('대파 10g(2cm), 고춧가루 5g(1작은술)')).toBeInTheDocument();
    expectNoPersistentChanges();
  });
});
