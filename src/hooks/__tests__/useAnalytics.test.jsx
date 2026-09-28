import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsProvider, useAnalytics } from '../useAnalytics';
import AnalyticsConsentBanner from '../../components/AnalyticsConsentBanner';
import { setAnalyticsConsent } from '../../utils/analyticsConsent';

const { saveProductEvent, readIngredients } = vi.hoisted(() => ({
  saveProductEvent: vi.fn(),
  readIngredients: vi.fn()
}));

// Fix the auth/cache boundaries; exercise the real consent, payload and GA gates.
vi.mock('../useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false, storageScope: 'user:consent-test' })
}));
vi.mock('../../features/ingredients/ingredientRepository', () => ({
  ingredientCache: { getAll: readIngredients }
}));
vi.mock('../../utils/backendConfig', () => ({ isBackendEnabled: () => true }));
vi.mock('../../api/productEventsApi', () => ({ saveProductEvent }));

function Screen() {
  const { trackEvent } = useAnalytics();
  return <>
    <h1>식단 화면</h1>
    <button onClick={() => trackEvent('ingredient_created', { creation_method: 'manual' })}>
      정상 기능 사용
    </button>
    <AnalyticsConsentBanner />
  </>;
}

function mount() {
  return render(<MemoryRouter><AnalyticsProvider><Screen /></AnalyticsProvider></MemoryRouter>);
}

describe('AnalyticsProvider storage isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAnalyticsConsent('denied');
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.__FRIDGEMATE_ANALYTICS_EVENTS__ = [];
    document.head.querySelectorAll('script[data-fridgemate-ga]').forEach(script => script.remove());
    delete window.dataLayer;
    delete window.gtag;
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
    saveProductEvent.mockReset().mockResolvedValue(null);
    readIngredients.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(['property', 'getItem'])('mounts the app without analytics when consent %s access fails', (failure) => {
    window.localStorage.setItem('fridgemate-analytics-consent', 'granted');
    const blocked = () => { throw new DOMException('private storage detail', 'SecurityError'); };
    if (failure === 'property') vi.spyOn(window, 'localStorage', 'get').mockImplementation(blocked);
    else vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);

    expect(() => mount()).not.toThrow();
    expect(screen.getByRole('heading', { name: '식단 화면' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '정상 기능 사용' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(window.__FRIDGEMATE_ANALYTICS_EVENTS__).toEqual([]);
    expect(document.head.querySelector('script[data-fridgemate-ga]')).toBeNull();
    expect(saveProductEvent).not.toHaveBeenCalled();
    expect(readIngredients).not.toHaveBeenCalled();
  });

  it('does not enable analytics after an approval cannot be saved', () => {
    mount();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('private storage detail', 'QuotaExceededError');
    });
    fireEvent.click(screen.getByRole('button', { name: '분석 허용' }));
    fireEvent.click(screen.getByRole('button', { name: '정상 기능 사용' }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(window.__FRIDGEMATE_ANALYTICS_EVENTS__).toEqual([]);
    expect(document.head.querySelector('script[data-fridgemate-ga]')).toBeNull();
    expect(saveProductEvent).not.toHaveBeenCalled();
  });

  it.each(['property', 'getItem', 'setItem'])('keeps the app usable when sessionStorage %s fails after valid consent', async (failure) => {
    setAnalyticsConsent('granted');
    const blocked = () => { throw new DOMException('private storage detail', 'SecurityError'); };
    if (failure === 'property') {
      vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(blocked);
    } else {
      const original = Storage.prototype[failure];
      vi.spyOn(Storage.prototype, failure).mockImplementation(function (...args) {
        if (this === window.sessionStorage) return blocked();
        return original.apply(this, args);
      });
    }

    expect(() => mount()).not.toThrow();
    fireEvent.click(screen.getByRole('button', { name: '정상 기능 사용' }));
    expect(screen.getByRole('heading', { name: '식단 화면' })).toBeInTheDocument();
    await Promise.resolve();
    expect(window.__FRIDGEMATE_ANALYTICS_EVENTS__).toEqual([]);
    expect(saveProductEvent).not.toHaveBeenCalled();
  });
});
