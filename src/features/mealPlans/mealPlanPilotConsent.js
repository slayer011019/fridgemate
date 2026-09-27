import { runMealPlanPilotTransaction } from '../../db/indexedDB';
import { validateLocalMealPlanPilotExport } from './mealPlanPilotExport';

const POLICY = 'local-pilot-35d-v1';
const PERIOD = 35 * 24 * 60 * 60 * 1000;
const ERROR = '파일럿 설정을 확인하거나 저장하지 못했어요. 새로 확인한 뒤 다시 시도해주세요.';
const CLOSED_KEYS = ['id', 'schemaVersion', 'scope', 'status', 'version'];
const ACTIVE_KEYS = [...CLOSED_KEYS, 'policyVersion', 'startedAt', 'expiresAt', 'subjectId', 'kind',
  'observedThrough', 'firstGenerationKnown', 'gaps', 'events'];

function check(condition) {
  if (!condition) throw new Error(ERROR);
}

function exact(value, fields) {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
    && Reflect.ownKeys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)));
}

function scopeValue(scope) {
  check(typeof scope === 'string' && (scope === 'guest' || /^user:[A-Za-z0-9_-]+$/.test(scope)));
  return scope;
}

function instant(value) {
  check(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value));
  const time = Date.parse(value);
  check(Number.isFinite(time) && new Date(time).toISOString() === value);
  return time;
}

function newVersion() {
  // No deterministic account hashing and no fallback to Math.random.
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function envelope(row, exportedAt) {
  return validateLocalMealPlanPilotExport({ schemaVersion: 1,
    exportKind: 'fridgemate-local-meal-plan-pilot', measurementUnit: 'browser-scope', policyVersion: row.policyVersion,
    startedAt: row.startedAt, expiresAt: row.expiresAt,
    dataset: { schemaVersion: 1, exportedAt, subjects: [{ id: row.subjectId, kind: row.kind,
      observedFrom: row.startedAt, observedThrough: row.observedThrough,
      firstGenerationKnown: row.firstGenerationKnown, gaps: row.gaps }], events: row.events },
  });
}

function view(row) {
  if (!row) return { status: 'off', version: null };
  if (row.status !== 'active') return { status: row.status, version: row.version };
  // A consent record is not proof that the application collector is connected.
  // No personal aliases or event payloads are needed for the settings display.
  return { status: 'active', version: row.version, policyVersion: row.policyVersion,
    startedAt: row.startedAt, expiresAt: row.expiresAt,
    eventCount: row.events.length, observedThrough: row.observedThrough };
}

function close(store, scope, status) {
  const row = { id: 'session', schemaVersion: 1, scope, status, version: newVersion() };
  // Clear the whole dedicated store, including malformed/unexpected rows. Keep
  // only a fresh generation barrier so delayed pre-withdrawal writes cannot win.
  store.clear();
  store.put(row);
  return row;
}

function current(rows, store, scope, now) {
  const row = rows.find(item => item.id === 'session');
  if (!row) {
    check(rows.length === 0);
    return undefined;
  }
  check(row.id === 'session' && row.schemaVersion === 1 && row.scope === scope
    && typeof row.version === 'string' && /^[a-f0-9]{32}$/.test(row.version));
  if (row.status !== 'active') {
    check(rows.length === 1);
    exact(row, CLOSED_KEYS);
    check(['expired', 'withdrawn'].includes(row.status));
    return row;
  }
  const started = instant(row.startedAt);
  const expiry = instant(row.expiresAt);
  check(expiry === started + PERIOD);
  // Expire all event/alias material together, never prune an original away from
  // a later reversal. An expired malformed payload must not prolong retention.
  if (instant(now) >= expiry) return close(store, scope, 'expired');
  check(rows.length === 1);
  exact(row, ACTIVE_KEYS);
  check(row.policyVersion === POLICY && row.kind === (scope === 'guest' ? 'guest' : 'account'));
  envelope(row, now);
  return row;
}

async function access(scope, action, { allowCorrupt = false } = {}) {
  scopeValue(scope);
  try {
    return await runMealPlanPilotTransaction('readwrite', (store, transaction) => {
      const output = { result: undefined };
      const request = store.getAll();
      request.onsuccess = () => {
        try {
          // Opening/queuing an IDB transaction may cross the expiry boundary.
          const now = new Date().toISOString();
          instant(now);
          const row = allowCorrupt ? undefined : current(request.result, store, scope, now);
          output.result = action(row, store, now);
        } catch {
          transaction.abort();
        }
      };
      return output;
    }, scope);
  } catch {
    // Never forward IndexedDB/provider messages or malformed private values.
    throw new Error(ERROR);
  }
}

/** Consent storage only: never enables GA, emits a product event, reads the
 * operational ledger, or infers that the first observed generation is first use. */
export function getMealPlanPilotConsent(scope = 'guest') {
  return access(scope, row => view(row));
}

export async function grantMealPlanPilotConsent(input) {
  exact(input, ['scope', 'expectedVersion', 'policyVersion', 'accepted']);
  const { scope, expectedVersion, policyVersion, accepted } = input;
  scopeValue(scope);
  // Do not promise next-startup cleanup on browsers that cannot enumerate the
  // existing account databases. Reading/withdrawing old consent remains possible.
  check(typeof window !== 'undefined' && typeof window.indexedDB?.databases === 'function');
  check(accepted === true && policyVersion === POLICY
    && (expectedVersion === null || (typeof expectedVersion === 'string' && /^[a-f0-9]{32}$/.test(expectedVersion))));
  const result = await access(scope, (previous, store, now) => {
    // A stale grant must not roll back a just-completed expiry purge.
    if (previous?.status === 'active' || (previous?.version ?? null) !== expectedVersion) return null;
    const expiresAt = new Date(instant(now) + PERIOD).toISOString();
    instant(expiresAt);
    const row = { id: 'session', schemaVersion: 1, scope, status: 'active', version: newVersion(), policyVersion: POLICY,
      startedAt: now, expiresAt, subjectId: `sub_${newVersion()}`, kind: scope === 'guest' ? 'guest' : 'account',
      observedThrough: now, firstGenerationKnown: false, gaps: [], events: [] };
    envelope(row, now);
    store.put(row);
    return view(row);
  });
  check(result !== null);
  return result;
}

/** Explicit withdrawal does not depend on being able to parse a damaged row. */
export function withdrawMealPlanPilotConsent(scope = 'guest') {
  return access(scope, (_row, store) => view(close(store, scope, 'withdrawn')), { allowCorrupt: true });
}

export async function prepareMealPlanPilotExport(input) {
  exact(input, ['scope', 'expectedVersion']);
  const { scope, expectedVersion } = input;
  scopeValue(scope);
  // Return an unavailable marker from the transaction, then reject outside it.
  // Throwing while purging an expired session would roll its deletion back.
  const result = await access(scope, (row, _store, now) => row?.status === 'active' && row.version === expectedVersion
    ? envelope(row, now) : null);
  check(result !== null);
  return result;
}
