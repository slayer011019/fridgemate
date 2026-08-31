import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountPage from '../AccountPage';

const authState = {
  deleteAccount: vi.fn(),
  dismissGuestImport: vi.fn(),
  error: '',
  guestImportPrompt: { available: false, count: 0, loading: false },
  importGuestIngredients: vi.fn(),
  logout: vi.fn(),
  user: { id: 'user-1', email: 'user@example.com' }
};

const ingredientsState = {
  hasUnsyncedChanges: true,
  lastSyncedAt: null,
  loadIngredients: vi.fn(),
  markIngredientsDirty: vi.fn(),
  pullIngredientsFromServer: vi.fn(),
  pushIngredientsToServer: vi.fn(),
  syncError: '',
  syncStatus: 'dirty'
};

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => authState
}));

vi.mock('../../hooks/useIngredients.js', () => ({
  useIngredients: () => ingredientsState
}));

vi.mock('../../hooks/useMenuDecision.js', () => ({
  useMenuDecision: () => ({ guestDecisionAvailable: false, importGuestDecision: vi.fn(), syncing: false })
}));

vi.mock('../../components/PageHeader.jsx', () => ({ default: () => null }));
vi.mock('../../components/PreferenceSettingsPanel.jsx', () => ({ default: () => null }));

describe('AccountPage shared-device logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires confirmation and requests account-scoped local cleanup', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    authState.logout.mockResolvedValue({ ok: true, pending: false, localCleanupComplete: true });

    render(<AccountPage />);

    await user.click(screen.getByRole('button', { name: '이 기기 데이터도 지우고 로그아웃' }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('아직 서버에 저장하지 않은 변경사항'));
    expect(authState.logout).toHaveBeenCalledWith({ clearLocalData: true });
  });

  it('does not delete local data when the user cancels', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<AccountPage />);

    await user.click(screen.getByRole('button', { name: '이 기기 데이터도 지우고 로그아웃' }));

    expect(authState.logout).not.toHaveBeenCalled();
  });
});
