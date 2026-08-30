import { describe, expect, it } from 'vitest';
import {
  buildMenuDecision,
  getKoreanDate,
  mergeMenuDecision,
  updateMenuDecisionStatus
} from '../menuDecisionDomain';

describe('menu decision domain', () => {
  it('uses the Korean calendar date at the UTC day boundary', () => {
    expect(getKoreanDate(new Date('2026-08-30T15:30:00.000Z'))).toBe('2026-08-31');
  });

  it('builds a pending catalog decision and keeps its client id when replacing it', () => {
    const first = buildMenuDecision(
      { id: '11111111-1111-4111-8111-111111111111', name: '김치볶음밥', _recommendationSource: 'hybrid' },
      null,
      new Date('2026-08-30T01:00:00.000Z')
    );
    const replacement = buildMenuDecision(
      { id: 'local-recipe', title: '계란찜' },
      first,
      new Date('2026-08-30T02:00:00.000Z')
    );

    expect(first).toMatchObject({
      decisionDate: '2026-08-30',
      recipeKey: 'catalog:11111111-1111-4111-8111-111111111111',
      recommendationSource: 'hybrid',
      syncState: 'pending'
    });
    expect(replacement.clientId).toBe(first.clientId);
    expect(replacement.recipeKey).toBe('local:local-recipe');
  });

  it('marks completion and cancellation without losing the selected menu', () => {
    const selected = buildMenuDecision({ id: 'recipe-1', title: '된장찌개' }, null, new Date('2026-08-30T01:00:00.000Z'));
    const completed = updateMenuDecisionStatus(selected, 'completed', new Date('2026-08-30T02:00:00.000Z'));
    const cancelled = updateMenuDecisionStatus(completed, 'cancelled', new Date('2026-08-30T03:00:00.000Z'));

    expect(completed.completedAt).toBe('2026-08-30T02:00:00.000Z');
    expect(cancelled).toMatchObject({ status: 'cancelled', completedAt: null, syncState: 'pending' });
  });

  it('preserves a newer pending local change but accepts a newer server change', () => {
    const local = { clientId: 'client-1', updatedAt: '2026-08-30T02:00:00.000Z', syncState: 'pending' };
    const olderServer = { clientId: 'client-1', updatedAt: '2026-08-30T01:00:00.000Z' };
    const newerServer = { clientId: 'client-2', updatedAt: '2026-08-30T03:00:00.000Z' };

    expect(mergeMenuDecision(local, olderServer)).toBe(local);
    expect(mergeMenuDecision(local, newerServer)).toEqual({ ...newerServer, syncState: 'clean' });
    expect(mergeMenuDecision(local, null)).toBe(local);
  });
});
