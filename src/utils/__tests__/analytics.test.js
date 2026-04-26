import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAnalyticsPayload,
  getAnonymousAnalyticsId,
  getAnalyticsSessionId,
  getDaysToExpiryBucket,
  hasTrackedSessionStarted,
  markSessionStartedTracked,
  recordAnalyticsEvent
} from '../analytics';

describe('analytics utilities', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.__FRIDGEMATE_ANALYTICS_EVENTS__ = [];
    vi.restoreAllMocks();
  });

  it('reuses stored anonymous and session ids', () => {
    const analyticsId = getAnonymousAnalyticsId();
    const sessionId = getAnalyticsSessionId();

    expect(getAnonymousAnalyticsId()).toBe(analyticsId);
    expect(getAnalyticsSessionId()).toBe(sessionId);
  });

  it('marks session_started once per browser session', () => {
    expect(hasTrackedSessionStarted()).toBe(false);

    markSessionStartedTracked();

    expect(hasTrackedSessionStarted()).toBe(true);
  });

  it('builds payloads with common analytics fields', () => {
    const payload = buildAnalyticsPayload({
      eventName: 'ingredient_created',
      route: '/ingredients/new',
      isAuthenticated: true,
      userId: 'user-123',
      properties: {
        creation_method: 'manual'
      }
    });

    expect(payload.event_name).toBe('ingredient_created');
    expect(payload.route).toBe('/ingredients/new');
    expect(payload.user_mode).toBe('authenticated');
    expect(payload.user_id).toBe('user-123');
    expect(payload.creation_method).toBe('manual');
    expect(payload.analytics_id).toBeTruthy();
    expect(payload.session_id).toBeTruthy();
    expect(payload.occurred_at).toBeTruthy();
  });

  it('stores recorded events on window for local inspection', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const payload = buildAnalyticsPayload({
      eventName: 'session_started',
      route: '/',
      isAuthenticated: false,
      userId: null
    });

    recordAnalyticsEvent(payload);

    expect(window.__FRIDGEMATE_ANALYTICS_EVENTS__).toHaveLength(1);
    expect(window.__FRIDGEMATE_ANALYTICS_EVENTS__[0].event_name).toBe('session_started');
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it('groups expiry dates into KPI-friendly buckets', () => {
    const today = new Date();
    const formatDate = (offset) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return date.toISOString().slice(0, 10);
    };

    expect(getDaysToExpiryBucket(formatDate(-1))).toBe('expired');
    expect(getDaysToExpiryBucket(formatDate(0))).toBe('today');
    expect(getDaysToExpiryBucket(formatDate(2))).toBe('1_to_3');
    expect(getDaysToExpiryBucket(formatDate(5))).toBe('4_to_7');
    expect(getDaysToExpiryBucket(formatDate(10))).toBe('8_plus');
    expect(getDaysToExpiryBucket('')).toBe('unknown');
  });
});
