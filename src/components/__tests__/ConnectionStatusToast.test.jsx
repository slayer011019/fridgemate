import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConnectionStatusToast from '../ConnectionStatusToast';

const authState = vi.hoisted(() => ({
  error: '',
  isAuthenticated: false
}));

const ingredientsState = vi.hoisted(() => ({
  dataSource: 'api',
  error: '',
  isSyncing: false
}));

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => authState
}));

vi.mock('../../hooks/useIngredients.js', () => ({
  useIngredients: () => ingredientsState
}));

vi.mock('../../hooks/useNetworkStatus.js', () => ({
  useNetworkStatus: () => ({ isOnline: true })
}));

vi.mock('../../utils/backendConfig.js', () => ({
  isBackendEnabled: () => true
}));

describe('ConnectionStatusToast', () => {
  beforeEach(() => {
    authState.error = '';
    authState.isAuthenticated = false;
    ingredientsState.dataSource = 'api';
    ingredientsState.error = '';
    ingredientsState.isSyncing = false;
  });

  it('keeps a fail-closed auth warning visible after local logout', () => {
    authState.error = '서버 처리 결과를 확인하지 못했습니다.';

    render(
      <MemoryRouter>
        <ConnectionStatusToast />
      </MemoryRouter>
    );

    expect(screen.getByText('인증 상태를 확인해주세요')).toBeInTheDocument();
    expect(screen.getByText(authState.error)).toBeInTheDocument();
  });

  it('does not duplicate an auth warning on pages that render it inline', () => {
    authState.error = '서버 처리 결과를 확인하지 못했습니다.';

    render(
      <MemoryRouter initialEntries={['/login']}>
        <ConnectionStatusToast />
      </MemoryRouter>
    );

    expect(screen.queryByText('인증 상태를 확인해주세요')).not.toBeInTheDocument();
    expect(screen.queryByText(authState.error)).not.toBeInTheDocument();
  });
});
