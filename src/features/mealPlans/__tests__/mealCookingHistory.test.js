import { describe, expect, it } from 'vitest';
import * as events from '../mealCookingEvents';

const base = { schemaVersion: 1, scope: 'guest', weekStart: '2026-09-14', slotId: '2026-09-16:dinner',
  createdAt: '2026-09-19T08:00:00.000Z' };
const line = (inventoryId = 'chicken') => ({ inventoryId, name: '닭고기', ingredientKey: 'food:닭고기',
  amount: 150, unit: 'g', preparationState: 'raw' });
function measured(operationId = 'one', slotId = base.slotId) {
  const common = { ...base, operationId, slotId, requestKey: '{"action":"cook"}' };
  return [
    { ...common, kind: 'cooking', id: `cooking:${operationId}`, inventoryStatus: 'applied', consumptionId: `consumption:${operationId}` },
    { ...common, kind: 'consumption', id: `consumption:${operationId}`, cookingId: `cooking:${operationId}`, lines: [line(), line('second-batch')] },
  ];
}
function unmeasured(operationId = 'unknown') {
  return { ...base, operationId, requestKey: '{"action":"unknown"}', kind: 'cooking', id: `cooking:${operationId}`,
    inventoryStatus: 'needs-review', consumptionId: null };
}
function inverse(operationId = 'undo', originalId = 'one') {
  return { ...base, operationId, requestKey: '{"action":"undo"}', kind: 'consumption-reversal', id: `consumption-reversal:${operationId}`,
    cookingId: `cooking:${originalId}`, reversesId: `consumption:${originalId}`, lines: [line(), line('second-batch')] };
}
function cancel(operationId = 'cancel', originalId = 'one') {
  return { ...base, operationId, requestKey: '{"action":"cancel"}', kind: 'cooking-reversal', id: `cooking-reversal:${operationId}`,
    reversesId: `cooking:${originalId}` };
}

describe('linked immutable cooking history', () => {
  it.each(['guest/other', undefined])('rejects invalid scope %s even when no events have been stored', scope => {
    let failure;
    try { events.assertMealCookingHistory?.([], scope); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
  });

  it.each([
    ['empty history', () => []],
    ['measured cooking', () => measured()],
    ['unmeasured cooking', () => [unmeasured()]],
    ['consumption reversal retaining cooking', () => [...measured(), inverse()]],
    ['cancelled measured cooking', () => [...measured(), inverse(), cancel()]],
    ['cancelled unmeasured cooking', () => [unmeasured(), cancel('cancel', 'unknown')]],
    ['new cooking after cancellation', () => [...measured(), inverse(), cancel(), ...measured('later')]],
    ['independent dinner slots', () => [...measured(), ...measured('tomorrow', '2026-09-17:dinner')]],
  ])('accepts %s without changing event history', (_label, make) => {
    const history = make();
    const before = structuredClone(history);
    expect(events.assertMealCookingHistory?.(history, 'guest')).toEqual(before);
    expect(history).toEqual(before);
  });

  it('does not depend on event, line or object-property insertion order', () => {
    const undo = inverse();
    undo.lines = undo.lines.reverse().map(item => Object.fromEntries(Object.entries(item).reverse()));
    const history = [cancel(), undo, ...measured().reverse()];
    const before = structuredClone(history);
    expect(events.assertMealCookingHistory?.(history, 'guest')).toEqual(before);
    expect(history).toEqual(before);
  });

  it('accepts account-scoped history without requiring original and reversal requests to match', () => {
    const history = [...measured(), inverse(), cancel()].map(item => ({ ...item, scope: 'user:alice' }));
    expect(events.assertMealCookingHistory?.(history, 'user:alice')).toEqual(history);
  });

  it.each([
    ['non-array input', () => ({})],
    ['sparse array', () => new Array(1)],
    ['receipt namespace', () => [{ ...unmeasured(), id: 'receipt:one', kind: 'receipt' }]],
    ['foreign scope', () => measured().map(item => ({ ...item, scope: 'user:alice' }))],
    ['duplicate event id', () => [...measured(), measured()[0]]],
    ['applied cooking without consumption', () => [measured()[0]]],
    ['consumption without cooking', () => [measured()[1]]],
    ['unmeasured cooking with consumption', () => [unmeasured('one'), measured()[1]]],
    ['different consumption slot', () => { const result = measured(); result[1].slotId = '2026-09-17:dinner'; return result; }],
    ['different consumption week', () => { const result = measured(); result[1].weekStart = '2026-09-21'; result[1].slotId = '2026-09-22:dinner'; return result; }],
    ['different consumption request', () => { const result = measured(); result[1].requestKey = '{"action":"changed"}'; return result; }],
    ['reversal without original consumption', () => [inverse()]],
    ['reversal for another cooking', () => [...measured(), inverse('undo', 'other')]],
    ['reversal on another slot', () => [...measured(), { ...inverse(), slotId: '2026-09-17:dinner' }]],
    ['reversal on another week', () => [...measured(), { ...inverse(), weekStart: '2026-09-21', slotId: '2026-09-22:dinner' }]],
    ['changed inverse amount', () => [...measured(), { ...inverse(), lines: [{ ...line(), amount: 100 }, line('second-batch')] }]],
    ['changed inverse batch', () => [...measured(), { ...inverse(), lines: [line('other-batch'), line('second-batch')] }]],
    ['changed inverse identity', () => [...measured(), { ...inverse(), lines: [{ ...line(), name: '두부', ingredientKey: 'food:두부' }, line('second-batch')] }]],
    ['changed inverse metadata', () => [...measured(), { ...inverse(), lines: [{ ...line(), note: 'changed payload' }, line('second-batch')] }]],
    ['missing inverse line', () => [...measured(), { ...inverse(), lines: [line()] }]],
    ['two reversals of one consumption', () => [...measured(), inverse(), inverse('another-undo')]],
    ['cancellation without cooking', () => [cancel()]],
    ['cancellation before consumption reversal', () => [...measured(), cancel()]],
    ['cancellation on another slot', () => [unmeasured(), { ...cancel('cancel', 'unknown'), slotId: '2026-09-17:dinner' }]],
    ['two cancellations of one cooking', () => [unmeasured(), cancel('cancel', 'unknown'), cancel('again', 'unknown')]],
    ['two active measured cookings of one slot', () => [...measured(), ...measured('two')]],
    ['two active unknown cookings of one slot', () => [unmeasured(), unmeasured('two')]],
    ['second cooking while the first has only consumption reversed', () => [...measured(), inverse(), ...measured('two')]],
  ])('rejects %s rather than acknowledging inconsistent history', (_label, make) => {
    let failure;
    try { events.assertMealCookingHistory?.(make(), 'guest'); } catch (error) { failure = error; }
    // Missing functionality is an assertion failure, never a throwing import/function false positive.
    expect(failure).toBeInstanceOf(Error);
  });
});
