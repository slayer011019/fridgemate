import { pathToFileURL } from 'node:url';

export const PRODUCT_EVENT_RETENTION_DAYS = 90;
export const RECOMMENDATION_EVENT_RETENTION_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 1_000;
const DEFAULT_MAX_DELETE = 5_000;
const MAX_DELETE_LIMIT = 50_000;
const DEFAULT_MAX_RUNTIME_MS = 30_000;
const MAX_RUNTIME_MS = 120_000;

const TARGETS = Object.freeze([
  {
    key: 'legacyOwnerlessRecommendationEvents',
    retentionDays: 0,
    countSql: `
      SELECT COUNT(*)::bigint AS "eligibleCount"
      FROM (
        SELECT "id"
        FROM "RecommendationEvent"
        WHERE "userId" IS NULL
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT $1
      ) AS candidates
    `,
    deleteSql: `
      WITH candidates AS (
        SELECT "id"
        FROM "RecommendationEvent"
        WHERE "userId" IS NULL
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "RecommendationEvent" AS target
      USING candidates
      WHERE target."id" = candidates."id"
    `
  },
  {
    key: 'productEvents',
    retentionDays: PRODUCT_EVENT_RETENTION_DAYS,
    countSql: `
      SELECT COUNT(*)::bigint AS "eligibleCount"
      FROM (
        SELECT "id"
        FROM "ProductEvent"
        WHERE "createdAt" < $1
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT $2
      ) AS candidates
    `,
    deleteSql: `
      WITH candidates AS (
        SELECT "id"
        FROM "ProductEvent"
        WHERE "createdAt" < $1
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "ProductEvent" AS target
      USING candidates
      WHERE target."id" = candidates."id"
    `
  },
  {
    key: 'recommendationEvents',
    retentionDays: RECOMMENDATION_EVENT_RETENTION_DAYS,
    countSql: `
      SELECT COUNT(*)::bigint AS "eligibleCount"
      FROM (
        SELECT "id"
        FROM "RecommendationEvent"
        WHERE "userId" IS NOT NULL
          AND "createdAt" < $1
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT $2
      ) AS candidates
    `,
    deleteSql: `
      WITH candidates AS (
        SELECT "id"
        FROM "RecommendationEvent"
        WHERE "userId" IS NOT NULL
          AND "createdAt" < $1
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "RecommendationEvent" AS target
      USING candidates
      WHERE target."id" = candidates."id"
    `
  }
]);

export class EventRetentionSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EventRetentionSafetyError';
  }
}

function getSingleArgValue(args, name) {
  const prefix = `${name}=`;
  const matches = args.filter((argument) => argument.startsWith(prefix));

  if (matches.length > 1) {
    throw new EventRetentionSafetyError(`${name} may be provided only once.`);
  }

  return matches.length ? matches[0].slice(prefix.length) : null;
}

function parseBoundedInteger(args, name, { fallback, minimum, maximum }) {
  const rawValue = getSingleArgValue(args, name);
  if (rawValue === null) return fallback;
  if (!/^\d+$/u.test(rawValue)) {
    throw new EventRetentionSafetyError(`${name} must be an integer.`);
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new EventRetentionSafetyError(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function resolveEventRetentionDatabaseUrl(environment = process.env) {
  const databaseUrl = environment.EVENT_RETENTION_DATABASE_URL || environment.DIRECT_URL || '';
  if (!databaseUrl) {
    throw new EventRetentionSafetyError(
      'EVENT_RETENTION_DATABASE_URL or DIRECT_URL is required; runtime DATABASE_URL is not accepted.'
    );
  }
  return databaseUrl;
}

export function getEventRetentionDatabaseHost(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) throw new Error();
    return parsed.hostname.toLowerCase();
  } catch {
    throw new EventRetentionSafetyError('A valid PostgreSQL maintenance database URL is required.');
  }
}

export function parseEventRetentionOptions({ args = [], databaseUrl }) {
  const knownValuePrefixes = [
    '--batch-size=',
    '--max-delete=',
    '--max-runtime-ms=',
    '--confirm-database-host='
  ];
  const unknownArgument = args.find(
    (argument) =>
      !['--apply', '--dry-run'].includes(argument)
      && !knownValuePrefixes.some((prefix) => argument.startsWith(prefix))
  );
  if (unknownArgument) {
    throw new EventRetentionSafetyError(`Unsupported argument: ${unknownArgument}`);
  }

  const apply = args.includes('--apply');
  if (apply && args.includes('--dry-run')) {
    throw new EventRetentionSafetyError('--apply and --dry-run cannot be combined.');
  }

  const databaseHost = getEventRetentionDatabaseHost(databaseUrl);
  const confirmedHost = getSingleArgValue(args, '--confirm-database-host')?.trim().toLowerCase() || null;
  if (apply && confirmedHost !== databaseHost) {
    throw new EventRetentionSafetyError(
      `Applying retention requires --confirm-database-host=${databaseHost} for the exact target database.`
    );
  }

  return {
    apply,
    databaseHost,
    batchSize: parseBoundedInteger(args, '--batch-size', {
      fallback: DEFAULT_BATCH_SIZE,
      minimum: 1,
      maximum: MAX_BATCH_SIZE
    }),
    maxDelete: parseBoundedInteger(args, '--max-delete', {
      fallback: DEFAULT_MAX_DELETE,
      minimum: 1,
      maximum: MAX_DELETE_LIMIT
    }),
    maxRuntimeMs: parseBoundedInteger(args, '--max-runtime-ms', {
      fallback: DEFAULT_MAX_RUNTIME_MS,
      minimum: 1_000,
      maximum: MAX_RUNTIME_MS
    })
  };
}

export function getEventRetentionCutoffs(now = new Date()) {
  const currentTime = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(currentTime.getTime())) {
    throw new EventRetentionSafetyError('Retention time must be a valid date.');
  }

  return {
    productEvents: new Date(currentTime.getTime() - PRODUCT_EVENT_RETENTION_DAYS * DAY_MS),
    recommendationEvents: new Date(
      currentTime.getTime() - RECOMMENDATION_EVENT_RETENTION_DAYS * DAY_MS
    )
  };
}

export async function assertEventRetentionMaintenanceAccess(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(
      (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user),
      false
    ) AS "canBypassRls"
  `);

  if (rows?.[0]?.canBypassRls !== true) {
    throw new EventRetentionSafetyError(
      'Event retention requires a trusted maintenance database role that can bypass forced tenant RLS.'
    );
  }
}

function getTargetCutoff(target, cutoffs) {
  return target.retentionDays ? cutoffs[target.key] : null;
}

function getQueryArguments(target, cutoff, limit) {
  return cutoff ? [cutoff, limit] : [limit];
}

function normalizeDatabaseCount(value) {
  const count = Number(value || 0);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('The database returned an invalid aggregate count.');
  }
  return count;
}

export async function readEligibleEventCount({ prisma, target, cutoff, limit }) {
  const rows = await prisma.$queryRawUnsafe(
    target.countSql,
    ...getQueryArguments(target, cutoff, limit)
  );
  return normalizeDatabaseCount(rows?.[0]?.eligibleCount);
}

export async function deleteEventRetentionBatch({ prisma, target, cutoff, limit }) {
  const deletedCount = await prisma.$executeRawUnsafe(
    target.deleteSql,
    ...getQueryArguments(target, cutoff, limit)
  );
  return normalizeDatabaseCount(deletedCount);
}

function createTargetState(target, cutoff) {
  return {
    key: target.key,
    retentionDays: target.retentionDays,
    cutoff: cutoff?.toISOString() || null,
    deletedCount: 0,
    complete: false,
    mayHaveMore: false
  };
}

async function previewEventRetention({ prisma, options, cutoffs, clock }) {
  const startedAt = clock();
  const targets = [];
  let runtimeLimitReached = false;

  for (const target of TARGETS) {
    if (clock() - startedAt >= options.maxRuntimeMs) {
      runtimeLimitReached = true;
      break;
    }
    const cutoff = getTargetCutoff(target, cutoffs);
    const observedCount = await readEligibleEventCount({
      prisma,
      target,
      cutoff,
      limit: options.maxDelete + 1
    });
    targets.push({
      key: target.key,
      retentionDays: target.retentionDays,
      cutoff: cutoff?.toISOString() || null,
      eligibleCount: Math.min(observedCount, options.maxDelete),
      hasMore: observedCount > options.maxDelete
    });
    if (clock() - startedAt >= options.maxRuntimeMs) {
      runtimeLimitReached = true;
      break;
    }
  }

  return {
    mode: 'dry-run',
    deletedTotal: 0,
    runtimeLimitReached,
    targets
  };
}

async function applyEventRetention({ prisma, options, cutoffs, clock }) {
  const startedAt = clock();
  const states = TARGETS.map((target) => createTargetState(target, getTargetCutoff(target, cutoffs)));
  let deletedTotal = 0;
  let runtimeLimitReached = false;

  while (deletedTotal < options.maxDelete) {
    let madeProgress = false;

    for (let index = 0; index < TARGETS.length; index += 1) {
      const target = TARGETS[index];
      const state = states[index];
      if (state.complete) continue;
      if (clock() - startedAt >= options.maxRuntimeMs) {
        runtimeLimitReached = true;
        break;
      }

      const limit = Math.min(options.batchSize, options.maxDelete - deletedTotal);
      const deletedCount = await deleteEventRetentionBatch({
        prisma,
        target,
        cutoff: getTargetCutoff(target, cutoffs),
        limit
      });
      state.deletedCount += deletedCount;
      deletedTotal += deletedCount;
      madeProgress ||= deletedCount > 0;
      state.complete = deletedCount < limit;
      state.mayHaveMore = deletedCount === limit;

      if (clock() - startedAt >= options.maxRuntimeMs) {
        runtimeLimitReached = true;
        break;
      }
      if (deletedTotal >= options.maxDelete) break;
    }

    if (runtimeLimitReached || !madeProgress) break;
  }

  return {
    mode: 'apply',
    deletedTotal,
    maxDeleteReached: deletedTotal >= options.maxDelete,
    runtimeLimitReached,
    targets: states.map(({ complete: _complete, ...state }) => state)
  };
}

export async function runEventRetention({
  prisma,
  options,
  now = new Date(),
  clock = Date.now
}) {
  const cutoffs = getEventRetentionCutoffs(now);
  const operationResult = options.apply
    ? await applyEventRetention({ prisma, options, cutoffs, clock })
    : await previewEventRetention({ prisma, options, cutoffs, clock });

  return {
    ...operationResult,
    policy: {
      productEventRetentionDays: PRODUCT_EVENT_RETENTION_DAYS,
      recommendationEventRetentionDays: RECOMMENDATION_EVENT_RETENTION_DAYS,
      batchSize: options.batchSize,
      maxDelete: options.maxDelete,
      maxRuntimeMs: options.maxRuntimeMs
    }
  };
}

export function toAggregateRetentionLog(result, databaseHost) {
  return {
    operation: 'event_retention',
    databaseHost,
    mode: result.mode,
    policy: result.policy,
    deletedTotal: result.deletedTotal,
    maxDeleteReached: Boolean(result.maxDeleteReached),
    runtimeLimitReached: Boolean(result.runtimeLimitReached),
    targets: result.targets.map((target) => ({
      key: target.key,
      retentionDays: target.retentionDays,
      cutoff: target.cutoff,
      eligibleCount: target.eligibleCount,
      deletedCount: target.deletedCount,
      hasMore: target.hasMore,
      mayHaveMore: target.mayHaveMore
    }))
  };
}

async function createMaintenancePrisma(databaseUrl, statementTimeoutMs) {
  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('@prisma/client')
  ]);
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: statementTimeoutMs
  });
  return new PrismaClient({ adapter });
}

async function main() {
  const args = process.argv.slice(2);
  const databaseUrl = resolveEventRetentionDatabaseUrl();
  const options = parseEventRetentionOptions({ args, databaseUrl });
  const prisma = await createMaintenancePrisma(databaseUrl, options.maxRuntimeMs);

  try {
    await assertEventRetentionMaintenanceAccess(prisma);
    const result = await runEventRetention({ prisma, options });
    console.log(JSON.stringify(toAggregateRetentionLog(result, options.databaseHost)));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error instanceof EventRetentionSafetyError) {
      console.error(error.message);
    } else {
      console.error('Event retention failed. Review the private database operations log.');
    }
    process.exitCode = 1;
  });
}
