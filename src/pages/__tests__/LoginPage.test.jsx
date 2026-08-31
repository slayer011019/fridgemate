import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../LoginPage';

const authState = vi.hoisted(() => ({
  backendEnabled: true,
  error: '',
  isAuthenticated: false,
  loading: false,
  login: vi.fn()
}));

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => authState
}));

vi.mock('../../hooks/useAnalytics.js', () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() })
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.backendEnabled = true;
    authState.error = '';
    authState.isAuthenticated = false;
    authState.loading = false;
    authState.login.mockResolvedValue(null);
  });

  it('shows an auth cleanup warning after account deletion redirects to login', () => {
    authState.error =
      '계정은 삭제됐지만 이 기기의 로컬 캐시를 모두 지우지 못했습니다. 브라우저 사이트 데이터를 삭제해주세요.';

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText(authState.error)).toBeInTheDocument();
  });

  it('shows a login form error in place of an existing auth warning', async () => {
    authState.error = '이전 인증 경고';
    authState.login.mockRejectedValue(new Error('현재 로그인 오류'));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { name: 'email', value: 'user@example.com' }
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { name: 'password', value: 'StrongPassphrase123!' }
    });
    fireEvent.submit(screen.getByRole('button', { name: '로그인' }).closest('form'));

    await waitFor(() => {
      expect(screen.getByText('현재 로그인 오류')).toBeInTheDocument();
    });
    expect(screen.queryByText('이전 인증 경고')).not.toBeInTheDocument();
  });
});
