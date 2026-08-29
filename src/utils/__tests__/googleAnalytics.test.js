import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setAnalyticsConsent } from '../analyticsConsent';
import {
  disableGoogleAnalytics,
  initializeGoogleAnalytics,
  sanitizeGoogleAnalyticsParameters,
  trackGoogleAnalyticsEvent
} from '../googleAnalytics';

describe('googleAnalytics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.querySelectorAll('script[data-fridgemate-ga]').forEach((script) => script.remove());
    delete window.dataLayer;
    delete window.gtag;
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
  });

  it('does not load Google Analytics before explicit consent', () => {
    expect(initializeGoogleAnalytics()).toBe(false);
    expect(document.head.querySelector('script[data-fridgemate-ga]')).toBeNull();
  });

  it('loads once after consent and sends safe event parameters', () => {
    setAnalyticsConsent('granted');

    expect(initializeGoogleAnalytics()).toBe(true);
    expect(initializeGoogleAnalytics()).toBe(true);
    expect(document.head.querySelectorAll('script[data-fridgemate-ga]')).toHaveLength(1);

    expect(
      trackGoogleAnalyticsEvent({
        event_name: 'signup_completed',
        route: '/signup',
        user_id: 'private-user-id',
        analytics_id: 'private-analytics-id',
        session_id: 'private-session-id',
        email: 'person@example.com',
        source_screen: 'header'
      })
    ).toBe(true);

    const eventCall = Array.from(window.dataLayer.at(-1));
    expect(eventCall[0]).toBe('event');
    expect(eventCall[1]).toBe('signup_completed');
    expect(eventCall[2]).toMatchObject({ page_path: '/signup', source_screen: 'header' });
    expect(eventCall[2]).not.toHaveProperty('user_id');
    expect(eventCall[2]).not.toHaveProperty('analytics_id');
    expect(eventCall[2]).not.toHaveProperty('session_id');
    expect(eventCall[2]).not.toHaveProperty('email');
  });

  it('stops future event delivery after consent is denied', () => {
    setAnalyticsConsent('granted');
    initializeGoogleAnalytics();
    setAnalyticsConsent('denied');
    disableGoogleAnalytics();

    expect(trackGoogleAnalyticsEvent({ event_name: 'page_view', route: '/' })).toBe(false);
    expect(Array.from(window.dataLayer.at(-1))).toEqual([
      'consent',
      'update',
      { analytics_storage: 'denied' }
    ]);
  });

  it('drops identifiers, objects, and email-like values from event parameters', () => {
    expect(
      sanitizeGoogleAnalyticsParameters({
        user_id: 'user-1',
        contact_email: 'person@example.com',
        free_text: 'person@example.com',
        safe_value: 'manual',
        count: 2,
        nested: { unsafe: true }
      })
    ).toEqual({ safe_value: 'manual', count: 2 });
  });
});
