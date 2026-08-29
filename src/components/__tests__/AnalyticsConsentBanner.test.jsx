import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsConsentBanner from '../AnalyticsConsentBanner';
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  getAnalyticsConsent,
  openAnalyticsConsentSettings
} from '../../utils/analyticsConsent';

describe('AnalyticsConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.querySelectorAll('script[data-fridgemate-ga]').forEach((script) => script.remove());
    delete window.dataLayer;
    delete window.gtag;
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
  });

  it('offers equally accessible allow and deny actions when no choice exists', async () => {
    render(
      <MemoryRouter>
        <AnalyticsConsentBanner />
      </MemoryRouter>
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '필수 기능만' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '분석 허용' })).toHaveClass('min-h-11');
    expect(document.head.querySelector('script[data-fridgemate-ga]')).toBeNull();
  });

  it('persists consent, loads GA only after approval, and supports later withdrawal', async () => {
    render(
      <MemoryRouter>
        <AnalyticsConsentBanner />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: '분석 허용' }));
    expect(getAnalyticsConsent()).toBe('granted');
    expect(document.head.querySelector('script[data-fridgemate-ga]')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    openAnalyticsConsentSettings();
    expect(await screen.findByText('현재 설정: 이용 분석 허용')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '필수 기능만' }));

    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe('denied');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
