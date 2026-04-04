import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDashboardSummary, getExpiryLabel, getRemainingDays, getStatusTone } from '../date.js';

const BASE_NOW = new Date(2026, 0, 15, 12, 0, 0, 0);

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createLocalDate(daysFromBase, hour = 12) {
  return new Date(
    BASE_NOW.getFullYear(),
    BASE_NOW.getMonth(),
    BASE_NOW.getDate() + daysFromBase,
    hour,
    0,
    0,
    0
  );
}

describe('date utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getRemainingDays', () => {
    it('calculates D-day for today', () => {
      expect(getRemainingDays(formatLocalDate(createLocalDate(0)))).toBe(0);
    });

    it('calculates D-day for tomorrow', () => {
      expect(getRemainingDays(formatLocalDate(createLocalDate(1)))).toBe(1);
    });

    it('calculates D-day for yesterday', () => {
      expect(getRemainingDays(formatLocalDate(createLocalDate(-1)))).toBe(-1);
    });

    it('calculates D-day for 7 days later', () => {
      expect(getRemainingDays(formatLocalDate(createLocalDate(7)))).toBe(7);
    });

    it('calculates D-day for 30 days later', () => {
      expect(getRemainingDays(formatLocalDate(createLocalDate(30)))).toBe(30);
    });

    it('returns a negative number for dates that already passed', () => {
      expect(getRemainingDays(formatLocalDate(createLocalDate(-10)))).toBe(-10);
    });

    it('returns null for null, undefined, and empty string inputs', () => {
      expect(getRemainingDays(null)).toBeNull();
      expect(getRemainingDays(undefined)).toBeNull();
      expect(getRemainingDays('')).toBeNull();
    });

    it('handles leap day correctly', () => {
      vi.setSystemTime(new Date(2024, 1, 28, 12, 0, 0, 0));

      expect(getRemainingDays('2024-02-29')).toBe(1);
      expect(getRemainingDays('2024-03-01')).toBe(2);
    });

    it('handles year-end to new-year boundaries correctly', () => {
      vi.setSystemTime(new Date(2026, 11, 31, 12, 0, 0, 0));

      expect(getRemainingDays('2026-12-31')).toBe(0);
      expect(getRemainingDays('2027-01-01')).toBe(1);
    });

    it('stays stable around the local midnight boundary', () => {
      vi.setSystemTime(new Date(2026, 0, 15, 0, 30, 0, 0));

      expect(getRemainingDays('2026-01-15')).toBe(0);
      expect(getRemainingDays('2026-01-16')).toBe(1);
    });
  });

  describe('getExpiryLabel', () => {
    it('formats valid remaining-day values into D-day labels', () => {
      expect(getExpiryLabel(0)).toBe('D-Day');
      expect(getExpiryLabel(1)).toBe('D-1');
      expect(getExpiryLabel(7)).toBe('D-7');
    });

    it('formats expired values into overdue labels', () => {
      expect(getExpiryLabel(-1)).toBe('1일 지남');
      expect(getExpiryLabel(-5)).toBe('5일 지남');
    });

    it('returns the empty-expiry label for null remaining days', () => {
      expect(getExpiryLabel(null)).toBe('유통기한 없음');
    });

    it('works with remaining days produced from empty or missing date input', () => {
      expect(getExpiryLabel(getRemainingDays(undefined))).toBe('유통기한 없음');
      expect(getExpiryLabel(getRemainingDays(''))).toBe('유통기한 없음');
    });
  });

  describe('getStatusTone', () => {
    it('marks dates within 3 days as urgent', () => {
      expect(getStatusTone(0)).toBe('bg-amber-100 text-amber-800');
      expect(getStatusTone(3)).toBe('bg-amber-100 text-amber-800');
    });

    it('treats 7 days and beyond as the default safe tone in the current implementation', () => {
      expect(getStatusTone(7)).toBe('bg-brand-50 text-brand-700');
      expect(getStatusTone(30)).toBe('bg-brand-50 text-brand-700');
    });

    it('marks expired dates as danger', () => {
      expect(getStatusTone(-1)).toBe('bg-rose-100 text-rose-700');
    });

    it('returns the consumed tone regardless of remaining days', () => {
      expect(getStatusTone(-3, true)).toBe('bg-slate-200 text-slate-700');
      expect(getStatusTone(2, true)).toBe('bg-slate-200 text-slate-700');
    });
  });

  describe('getDashboardSummary', () => {
    it('summarizes total, expiring-soon, and expired counts', () => {
      const ingredients = [
        { id: '1', expiryDate: formatLocalDate(createLocalDate(0)), consumed: false },
        { id: '2', expiryDate: formatLocalDate(createLocalDate(3)), consumed: false },
        { id: '3', expiryDate: formatLocalDate(createLocalDate(7)), consumed: false },
        { id: '4', expiryDate: formatLocalDate(createLocalDate(-1)), consumed: false },
        { id: '5', expiryDate: formatLocalDate(createLocalDate(-5)), consumed: true },
        { id: '6', expiryDate: '', consumed: false }
      ];

      expect(getDashboardSummary(ingredients)).toEqual({
        total: 6,
        expiringSoon: 2,
        expired: 1
      });
    });

    it('returns zeroed counts for an empty list', () => {
      expect(getDashboardSummary([])).toEqual({
        total: 0,
        expiringSoon: 0,
        expired: 0
      });
    });
  });
});
