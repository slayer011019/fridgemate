import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import PublicRecipeExplorer from '../PublicRecipeExplorer';

const recipes = vi.hoisted(() => [
  { externalId: '1001', name: '오이 사과 무침', ingredientsText: '오이, 사과, 소금' },
  { externalId: '1002', name: '오이 사과 샐러드', ingredientsText: '오이, 사과' },
  { externalId: '1003', name: '오이 냉국', ingredientsText: '오이' },
  { externalId: '1004', name: '달걀찜', ingredientsText: '달걀' },
  { externalId: '1005', name: '시금치 무침', ingredientsText: '시금치' },
  ...Array.from({ length: 9 }, (_, index) => ({
    externalId: String(1010 + index), name: `감자 요리 ${index + 1}`, ingredientsText: '감자'
  }))
].map((recipe) => ({ ...recipe, source: 'mfds', cookingMethod: '기타', steps: ['조리 순서'] })));

vi.mock('../../features/recipes/publicRecipeCatalog', async (importOriginal) => ({
  ...await importOriginal(),
  publicRecipeCatalog: recipes
}));
vi.mock('../../features/recipes/recipeContentHubs', () => ({ ingredientHubs: [], guidePages: [] }));
vi.mock('../../features/recipes/recipeEditorialContent', () => ({ getRecipeEditorial: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function NavigationProbe() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return <>
    <output aria-label="테스트 현재 주소">{pathname}{search}</output>
    <button type="button" onClick={() => navigate('/recipes?have=시금치&view=public')}>다른 탐색으로 이동</button>
    <button type="button" onClick={() => navigate(-1)}>이전 탐색으로 이동</button>
  </>;
}

function renderExplorer(path = '/recipes', compact = false) {
  return render(<MemoryRouter initialEntries={[path]}>
    <PublicRecipeExplorer compact={compact} />
    <NavigationProbe />
  </MemoryRouter>);
}

function quickPick() {
  return within(screen.getByRole('region', { name: '메뉴 하나 골라보기' }));
}

function pickedLink() {
  return quickPick().getByRole('link', { name: '골라본 메뉴의 재료와 조리법 보기' });
}

function expectedPath(recipe, have = '') {
  const path = `/recipes/${recipe.externalId}-${recipe.name.replaceAll(' ', '-')}`;
  return have ? `${path}?have=${encodeURIComponent(have)}` : path;
}

describe('PublicRecipeExplorer quick pick', () => {
  it('waits for an explicit choice and leaves the existing compact list visible', () => {
    const random = vi.spyOn(Math, 'random');
    renderExplorer('/recipes', true);

    expect(quickPick().getByRole('button', { name: '메뉴 하나 골라보기' })).toBeEnabled();
    expect(quickPick().queryByRole('link', { name: '골라본 메뉴의 재료와 조리법 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '오이 사과 무침' })).toBeVisible();
    const detailLinks = screen.getAllByRole('link').filter((link) => /^\/recipes\/\d+-/u.test(link.getAttribute('href')));
    expect(detailLinks).toHaveLength(6);
    expect(random).not.toHaveBeenCalled();
  });

  it('can pick from the full catalog when no ingredients are selected, beyond the visible preview', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    renderExplorer('/recipes', true);
    const last = recipes.at(-1);
    expect(screen.queryByRole('heading', { name: last.name })).not.toBeInTheDocument();

    await user.click(quickPick().getByRole('button', { name: '메뉴 하나 골라보기' }));

    expect(pickedLink()).toHaveAttribute('href', expectedPath(last));
    const announcement = quickPick().getByText((content, element) => element.tagName === 'P'
      && element.getAttribute('aria-live') === 'polite' && content.includes(last.name));
    expect(announcement).toBeVisible();
    const explorer = within(screen.getByRole('region', { name: '남은 재료로 무엇을 만들까요?' }));
    expect(explorer.getAllByRole('status')).toHaveLength(1);
  });

  it('picks only among recipes matching the most selected ingredients and preserves exact planning names', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    renderExplorer('/recipes?have=오이,사과&view=public');

    await user.click(quickPick().getByRole('button', { name: '메뉴 하나 골라보기' }));

    expect(pickedLink()).toHaveAttribute('href', expectedPath(recipes[1], '오이,사과'));
    expect(pickedLink()).not.toHaveAttribute('href', expectedPath(recipes[2], '오이,사과'));
    expect(screen.getByLabelText('테스트 현재 주소')).toHaveTextContent('/recipes?have=오이,사과&view=public');
  });

  it('does not repeat the immediately previous result when another equally relevant recipe exists', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderExplorer('/recipes?have=오이,사과');

    await user.click(quickPick().getByRole('button', { name: '메뉴 하나 골라보기' }));
    expect(pickedLink()).toHaveAttribute('href', expectedPath(recipes[0], '오이,사과'));
    await user.click(quickPick().getByRole('button', { name: '다른 메뉴 골라보기' }));
    expect(pickedLink()).toHaveAttribute('href', expectedPath(recipes[1], '오이,사과'));
    await user.click(quickPick().getByRole('button', { name: '다른 메뉴 골라보기' }));
    expect(pickedLink()).toHaveAttribute('href', expectedPath(recipes[0], '오이,사과'));
  });

  it('supports keyboard choice without navigation or persistent writes until the detail link is activated', async () => {
    const user = userEvent.setup();
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const databaseWrites = ['add', 'put', 'delete', 'clear'].map((method) => vi.spyOn(IDBObjectStore.prototype, method));
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderExplorer('/recipes?have=오이,사과&view=public');

    quickPick().getByRole('button', { name: '메뉴 하나 골라보기' }).focus();
    await user.keyboard('{Enter}');

    expect(pickedLink()).toHaveAttribute('href', expectedPath(recipes[0], '오이,사과'));
    expect(screen.getByLabelText('테스트 현재 주소')).toHaveTextContent('/recipes?have=오이,사과&view=public');
    expect(storageWrite).not.toHaveBeenCalled();
    databaseWrites.forEach((write) => expect(write).not.toHaveBeenCalled());

    await user.click(pickedLink());
    expect(screen.getByLabelText('테스트 현재 주소')).toHaveTextContent(expectedPath(recipes[0], '오이,사과'));
  });

  it('does not offer a pick when no recipe matches', () => {
    renderExplorer('/recipes?have=없는재료');
    expect(screen.queryByRole('region', { name: '메뉴 하나 골라보기' })).not.toBeInTheDocument();
    expect(screen.getByText(/일치하는 메뉴가 아직 없어요/u)).toBeVisible();
    expect(screen.queryByRole('link', { name: '골라본 메뉴의 재료와 조리법 보기' })).not.toBeInTheDocument();
  });

  it('explains a single candidate without offering a repeat pick', async () => {
    const user = userEvent.setup();
    renderExplorer('/recipes?have=시금치');

    await user.click(quickPick().getByRole('button', { name: '메뉴 하나 골라보기' }));

    expect(pickedLink()).toHaveAttribute('href', expectedPath(recipes[4], '시금치'));
    expect(quickPick().getByText('현재 조건에 가장 가까운 후보는 이 메뉴 한 개예요.')).toBeVisible();
    expect(quickPick().queryByRole('button', { name: '다른 메뉴 골라보기' })).not.toBeInTheDocument();
  });

  it('keeps a unique best match even when less relevant results remain in the list', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    renderExplorer('/recipes?have=오이,사과,소금');
    expect(screen.getByRole('heading', { name: '오이 냉국' })).toBeVisible();

    await user.click(quickPick().getByRole('button', { name: '메뉴 하나 골라보기' }));

    expect(pickedLink()).toHaveAttribute('href', expectedPath(recipes[0], '오이,사과,소금'));
    expect(quickPick().getByText('현재 조건에 가장 가까운 후보는 이 메뉴 한 개예요.')).toBeVisible();
    expect(quickPick().queryByRole('button', { name: '다른 메뉴 골라보기' })).not.toBeInTheDocument();
  });

  it('clears the picked result after a query change and browser history navigation', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderExplorer('/recipes?have=오이,사과');

    await user.click(quickPick().getByRole('button', { name: '메뉴 하나 골라보기' }));
    expect(pickedLink()).toHaveAttribute('href', expectedPath(recipes[0], '오이,사과'));
    await user.click(screen.getByRole('button', { name: '다른 탐색으로 이동' }));
    expect(quickPick().queryByRole('link', { name: '골라본 메뉴의 재료와 조리법 보기' })).not.toBeInTheDocument();
    await user.click(quickPick().getByRole('button', { name: '메뉴 하나 골라보기' }));
    expect(pickedLink()).toHaveAttribute('href', expectedPath(recipes[4], '시금치'));

    await user.click(screen.getByRole('button', { name: '이전 탐색으로 이동' }));
    expect(screen.getByLabelText('테스트 현재 주소')).toHaveTextContent('/recipes?have=오이,사과');
    expect(quickPick().queryByRole('link', { name: '골라본 메뉴의 재료와 조리법 보기' })).not.toBeInTheDocument();
    expect(quickPick().getByRole('button', { name: '메뉴 하나 골라보기' })).toBeEnabled();
  });
});
