import { describe, expect, it, vi } from 'vitest';
import {
  MAX_RECOMMENDATION_EXPORT_DAYS,
  buildTrainingRows,
  buildEventAudit,
  formatCsv,
  formatJsonl,
  loadRecommendationTrainingEvents,
  neutralizeSpreadsheetFormula,
  parseRecommendationExportWindow,
  toCsvValue
} from '../export-recommendation-training.js';

describe('recommendation training CSV export', () => {
  it('defaults to a bounded 180-day server-created-time window', () => {
    const window = parseRecommendationExportWindow([], new Date('2026-08-30T12:00:00.000Z'));

    expect(MAX_RECOMMENDATION_EXPORT_DAYS).toBe(180);
    expect(window).toEqual({
      since: new Date('2026-03-03T12:00:00.000Z'),
      until: new Date('2026-08-30T12:00:00.000Z')
    });
  });

  it('accepts explicit bounded dates and rejects unbounded, reversed, or future windows', () => {
    const now = new Date('2026-08-30T12:00:00.000Z');
    expect(
      parseRecommendationExportWindow(
        ['--since=2026-08-01T00:00:00.000Z', '--until=2026-08-30T00:00:00.000Z'],
        now
      )
    ).toEqual({
      since: new Date('2026-08-01T00:00:00.000Z'),
      until: new Date('2026-08-30T00:00:00.000Z')
    });
    expect(() =>
      parseRecommendationExportWindow(
        ['--since=2026-01-01T00:00:00.000Z', '--until=2026-08-01T00:00:00.000Z'],
        now
      )
    ).toThrow(/cannot exceed 180 days/u);
    expect(() =>
      parseRecommendationExportWindow(
        ['--since=2026-08-30T00:00:00.000Z', '--until=2026-08-01T00:00:00.000Z'],
        now
      )
    ).toThrow(/earlier than --until/u);
    expect(() =>
      parseRecommendationExportWindow(['--until=2026-09-01T00:00:00.000Z'], now)
    ).toThrow(/future/u);
  });

  it('applies the same createdAt window to impression and action reads', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const window = {
      since: new Date('2026-08-01T00:00:00.000Z'),
      until: new Date('2026-08-30T00:00:00.000Z')
    };

    await loadRecommendationTrainingEvents({ recommendationEvent: { findMany } }, window);

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0][0].where.createdAt).toEqual({ gte: window.since, lt: window.until });
    expect(findMany.mock.calls[1][0].where.createdAt).toEqual({ gte: window.since, lt: window.until });
  });

  it.each([
    ['=WEBSERVICE("https://attacker.invalid")', "'=WEBSERVICE(\"https://attacker.invalid\")"],
    ['+cmd', "'+cmd"],
    ['-cmd', "'-cmd"],
    ['@SUM(1,1)', "'@SUM(1,1)"],
    ['   =1+1', "'   =1+1"],
    ['\t+1+1', "'\t+1+1"],
    ['\r-1+1', "'\r-1+1"],
    ['\n@SUM(1,1)', "'\n@SUM(1,1)"],
    ['\u200b=1+1', "'\u200b=1+1"]
  ])('neutralizes a spreadsheet formula hidden in %j', (input, expected) => {
    expect(neutralizeSpreadsheetFormula(input)).toBe(expected);
  });

  it('preserves ordinary strings and non-string numeric values', () => {
    expect(toCsvValue('local:recipe-1')).toBe('local:recipe-1');
    expect(toCsvValue(-12.5)).toBe('-12.5');
    expect(toCsvValue(false)).toBe('false');
  });

  it('neutralizes formulas before applying CSV quote escaping', () => {
    expect(toCsvValue('=HYPERLINK("https://attacker.invalid","open")')).toBe(
      '"\'=HYPERLINK(""https://attacker.invalid"",""open"")"'
    );
    expect(toCsvValue('\r=1+1')).toBe('"\'\r=1+1"');
    expect(toCsvValue('\n+1+1')).toBe('"\'\n+1+1"');
  });

  it('routes every exported row cell through the safe CSV formatter', () => {
    const csv = formatCsv([
      {
        recipeId: '@RECIPE()',
        rank: 1,
        score: -0.5,
        matchRate: 80,
        missingIngredientCount: 1,
        urgentMatchCount: 0,
        canMakeNow: false,
        source: 'rule',
        clicked: 0,
        createdAt: '2026-08-30T00:00:00.000Z'
      }
    ]);

    const [header, row] = csv.split('\n');
    expect(header).not.toContain('userId');
    expect(header).not.toContain('sessionId');
    expect(row).toContain("'@RECIPE()");
  });

  it('uses raw identifiers only for in-memory joins and omits them from every export format', () => {
    const impression = {
      userId: 'raw-user-id',
      sessionId: 'raw-session-id',
      recipeId: 'local:recipe-1',
      eventType: 'impression',
      createdAt: new Date('2026-08-30T00:00:00.000Z')
    };
    const rows = buildTrainingRows([
      impression
    ], [{ ...impression, eventType: 'click' }]);

    expect(rows[0]).not.toHaveProperty('userId');
    expect(rows[0]).not.toHaveProperty('sessionId');
    expect(rows[0].clicked).toBe(1);
    expect(formatCsv(rows)).not.toMatch(/raw-(?:user|session)-id/u);
    expect(formatJsonl(rows)).not.toMatch(/raw-(?:user|session)-id/u);
  });

  it('reports aggregate recipe-key join quality and funnel counts without row data', () => {
    const audit = buildEventAudit([
      { recipeId: 'catalog:11111111-1111-4111-8111-111111111111', catalogRecipeId: '11111111-1111-4111-8111-111111111111', eventType: 'impression' },
      { recipeId: '22222222-2222-4222-8222-222222222222', catalogRecipeId: '22222222-2222-4222-8222-222222222222', eventType: 'select' },
      { recipeId: 'local:recipe-1', catalogRecipeId: null, eventType: 'complete' },
      { recipeId: 'legacy-value', catalogRecipeId: null, eventType: 'external_open' }
    ]);

    expect(audit).toEqual({
      total: 4,
      catalogNamespaced: 1,
      bareUuid: 1,
      local: 1,
      unmatched: 1,
      catalogJoined: 2,
      byType: { impression: 1, select: 1, complete: 1, external_open: 1 }
    });
  });
});
