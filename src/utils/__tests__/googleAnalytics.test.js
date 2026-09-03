import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setAnalyticsConsent } from '../analyticsConsent';
import {
  disableGoogleAnalytics,
  initializeGoogleAnalytics,
  normalizeGoogleAnalyticsRoute,
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
        client_event_id: 'private-event-id',
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
    expect(eventCall[2]).not.toHaveProperty('client_event_id');
    expect(eventCall[2]).not.toHaveProperty('session_id');
    expect(eventCall[2]).not.toHaveProperty('email');
  });

  it('stops future event delivery after consent is denied', () => {
    setAnalyticsConsent('granted');
    initializeGoogleAnalytics();
    document.cookie = '_ga=private-client-id; Path=/';
    setAnalyticsConsent('denied');
    disableGoogleAnalytics();

    expect(trackGoogleAnalyticsEvent({ event_name: 'page_view', route: '/' })).toBe(false);
    expect(document.head.querySelector('script[data-fridgemate-ga]')).toBeNull();
    expect(document.cookie).not.toContain('_ga=');
    expect(window.dataLayer).toEqual([]);
    expect(window.gtag).toBeUndefined();
  });

  it.each([
    ['/ingredients/550e8400-e29b-41d4-a716-446655440000/edit?from=home#private', '/ingredients/:id/edit'],
    ['/recipes/removed-recipe#instructions', '/other'],
    ['/guides/removed-guide?draft=true', '/other'],
    ['/recipes?query=private', '/recipes'],
    ['/private/person@example.com?token=secret', '/other']
  ])('reduces %s to the non-identifying route template %s', (route, expected) => {
    expect(normalizeGoogleAnalyticsRoute(route)).toBe(expected);
  });

  it('ignores caller page metadata and sends only the normalized page path', () => {
    setAnalyticsConsent('granted');

    expect(
      trackGoogleAnalyticsEvent({
        event_name: 'page_view',
        route: '/ingredients/private-record-id/edit?from=home#details',
        page_path: '/private/path?token=secret',
        page_title: 'Private ingredient title',
        page_location: 'https://example.test/private?token=secret',
        page_referrer: 'https://example.test/private-referrer'
      })
    ).toBe(true);

    const eventParameters = Array.from(window.dataLayer.at(-1))[2];
    expect(eventParameters).toEqual({ page_path: '/ingredients/:id/edit' });
  });

  it('normalizes route-valued event properties before sending them', () => {
    setAnalyticsConsent('granted');

    trackGoogleAnalyticsEvent({
      event_name: 'session_started',
      route: '/recipes',
      entry_route: '/ingredients/private-record-id/edit?from=home#details',
      has_existing_local_data: true
    });

    const eventParameters = Array.from(window.dataLayer.at(-1))[2];
    expect(eventParameters).toEqual({
      page_path: '/recipes',
      entry_route: '/ingredients/:id/edit',
      has_existing_local_data: true
    });
  });

  it('drops identifiers, objects, and email-like values from event parameters', () => {
    expect(
      sanitizeGoogleAnalyticsParameters({
        event_name: 'recommendation_clicked',
        user_id: 'user-1',
        contact_email: 'person@example.com',
        free_text: 'person@example.com',
        page_path: '/private/path',
        page_title: 'Private title',
        recipe_name: 'Private family recipe',
        ingredient_name: 'Private ingredient',
        group: 'local',
        missing_core_count: 2,
        nested: { unsafe: true }
      })
    ).toEqual({ group: 'local', missing_core_count: 2 });
  });

  it('fails closed for an event that has not been privacy-reviewed', () => {
    setAnalyticsConsent('granted');

    expect(
      trackGoogleAnalyticsEvent({
        event_name: 'unreviewed_event',
        route: '/',
        free_text: 'private ingredient'
      })
    ).toBe(false);
    expect(document.head.querySelector('script[data-fridgemate-ga]')).toBeNull();
  });
});
