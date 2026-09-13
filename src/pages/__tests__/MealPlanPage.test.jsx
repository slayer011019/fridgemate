import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MealPlanPage from '../MealPlanPage';

const authState = { storageScope: 'guest', loading: false };
const repository = { getMealPlan: vi.fn(), saveMealPlan: vi.fn() };
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../../hooks/useIngredients', () => ({
  useIngredients: () => ({ ingredients: [], loading: false, error: '' })
}));
vi.mock('../../hooks/usePantryStaples', () => ({
  usePantryStaples: () => ({ pantryStaples: [], pantryOwnership: {} })
}));
vi.mock('../../features/mealPlans/mealPlanRepository', () => ({
  getMealPlan: (...args) => repository.getMealPlan(...args),
  saveMealPlan: (...args) => repository.saveMealPlan(...args)
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function page() {
  return <MemoryRouter><MealPlanPage /></MemoryRouter>;
}

describe('MealPlanPage storage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.storageScope = 'guest';
    authState.loading = false;
    repository.getMealPlan.mockResolvedValue(null);
    repository.saveMealPlan.mockImplementation(async (nextPlan) => nextPlan);
  });
  afterEach(cleanup);

  it('keeps the first draft after save failure and saves the same choices on retry', async () => {
    const save = deferred();
    repository.saveMealPlan.mockReturnValueOnce(save.promise);
    render(page());
    await screen.findByRole('button', { name: '한 주 식단 만들기' });
    fireEvent.change(screen.getByLabelText('식사 인원'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('피하고 싶은 재료'), { target: { value: '버섯, 가지' } });
    fireEvent.click(screen.getByRole('button', { name: '한 주 식단 만들기' }));
    expect(screen.getByRole('button', { name: '다음 주' })).toBeDisabled();
    await act(async () => { save.reject(new Error('저장 공간 부족')); });
    await screen.findByText('저장 공간 부족');
    expect(screen.getByLabelText('식사 인원')).toHaveValue('2');
    expect(screen.getByLabelText('피하고 싶은 재료')).toHaveValue('버섯, 가지');
    expect(screen.getByLabelText('피하고 싶은 재료').closest('details')).toHaveAttribute('open');
    expect(screen.queryByRole('region', { name: '한 주 저녁 식단표' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '한 주 식단 만들기' }));
    await screen.findByRole('region', { name: '한 주 저녁 식단표' });
    expect(repository.saveMealPlan).toHaveBeenLastCalledWith(expect.objectContaining({
      scope: 'guest', preferences: expect.objectContaining({ servings: 2, excludedIngredients: ['버섯', '가지'] })
    }), 'guest');
  });

  it('blocks generation on a failed read and unlocks it only after successful retry', async () => {
    repository.getMealPlan.mockRejectedValueOnce(new Error('저장된 식단 형식을 확인할 수 없습니다.'));
    render(page());
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: '한 주 식단 만들기' })).not.toBeInTheDocument();
    expect(repository.saveMealPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '저장된 식단 다시 불러오기' }));
    await screen.findByRole('button', { name: '한 주 식단 만들기' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show or apply an earlier account’s draft when its save completes late', async () => {
    const save = deferred();
    repository.saveMealPlan.mockReturnValueOnce(save.promise);
    const view = render(page());
    await screen.findByRole('button', { name: '한 주 식단 만들기' });
    fireEvent.change(screen.getByLabelText('피하고 싶은 재료'), { target: { value: '게스트 취향' } });
    fireEvent.click(screen.getByRole('button', { name: '한 주 식단 만들기' }));
    const guestDraft = repository.saveMealPlan.mock.calls[0][0];
    authState.storageScope = 'user:alice';
    view.rerender(page());
    await screen.findByRole('button', { name: '한 주 식단 만들기' });
    expect(screen.getByLabelText('피하고 싶은 재료')).toHaveValue('');
    await act(async () => { save.resolve(guestDraft); });
    expect(screen.queryByRole('region', { name: '한 주 저녁 식단표' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('피하고 싶은 재료')).toHaveValue('');
    await waitFor(() => expect(repository.getMealPlan).toHaveBeenLastCalledWith(expect.any(String), 'user:alice'));
  });
});
