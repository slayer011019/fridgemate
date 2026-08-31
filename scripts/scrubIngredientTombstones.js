import { pathToFileURL } from 'node:url';

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 1_000;
const DEFAULT_MAX_UPDATE = 5_000;
const MAX_UPDATE_LIMIT = 50_000;
const DEFAULT_MAX_RUNTIME_MS = 30_000;
const MAX_RUNTIME_MS = 120_000;

const COUNT_SQL = `
  SELECT COUNT(*)::bigint AS "eligibleCount"
  FROM (
    SELECT "id"
    FROM "Ingredient"
    WHERE "deletedAt" IS NOT NULL
      AND (
        "name" IS NOT NULL
        OR "category" IS NOT NULL
        OR "storageType" IS NOT NULL
        OR "quantity" IS NOT NULL
        OR "purchaseDate" IS NOT NULL
        OR "expiryDate" IS NOT NULL
        OR "memo" IS NOT NULL
        OR "consumed" IS NOT NULL
        OR "createdAt" IS NOT NULL
      )
    ORDER BY "id"
    LIMIT $1
  ) AS candidates
`;

const UPDATE_SQL = `
  WITH candidates AS (
    SELECT "id"
    FROM "Ingredient"
    WHERE "deletedAt" IS NOT NULL
      AND (
        "name" IS NOT NULL
        OR "category" IS NOT NULL
        OR "storageType" IS NOT NULL
        OR "quantity" IS NOT NULL
        OR "purchaseDate" IS NOT NULL
        OR "expiryDate" IS NOT NULL
        OR "memo" IS NOT NULL
        OR "consumed" IS NOT NULL
        OR "createdAt" IS NOT NULL
      )
    ORDER BY "id"
    LIMIT $1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE "Ingredient" AS target
  SET
    "name" = NULL,
    "category" = NULL,
    "storageType" = NULL,
    "quantity" = NULL,
    "purchaseDate" = NULL,
    "expiryDate" = NULL,
    "memo" = NULL,
    "consumed" = NULL,
    "createdAt" = NULL
  FROM candidates
  WHERE target."id" = candidates."id"
`;

export class IngredientTombstoneScrubSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IngredientTombstoneScrubSafetyError';
  }
}

function getSingleArgValue(args, name) {
  const prefix = `${name}=`;
  const matches = args.filter((argument) => argument.startsWith(prefix));
  if (matches.length > 1) {
    throw new IngredientTombstoneScrubSafetyError(`${name} may be provided only once.`);
  }
  return matches.length ? matches[0].slice(prefix.length) : null;
}

function parseBoundedInteger(args, name, { fallback, minimum, maximum }) {
  const rawValue = getSingleArgValue(args, name);
  if (rawValue === null) return fallback;
  if (!/^\d+$/u.test(rawValue)) {
    throw new IngredientTombstoneScrubSafetyError(`${name} must be an integer.`);
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new IngredientTombstoneScrubSafetyError(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function resolveIngredientTombstoneScrubDatabaseUrl(environment = process.env) {
  const databaseUrl = environment.INGREDIENT_TOMBSTONE_SCRUB_DATABASE_URL || environment.DIRECT_URL || '';
  if (!databaseUrl) {
    throw new IngredientTombstoneScrubSafetyError(
      'INGREDIENT_TOMBSTONE_SCRUB_DATABASE_URL or DIRECT_URL is required; runtime DATABASE_URL is not accepted.'
    );
  }
  return databaseUrl;
}

export function getIngredientTombstoneScrubDatabaseHost(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) throw new Error();
    return parsed.hostname.toLowerCase();
  } catch {
    throw new IngredientTombstoneScrubSafetyError('A valid PostgreSQL maintenance database URL is required.');
  }
}

export function parseIngredientTombstoneScrubOptions({ args = [], databaseUrl }) {
  const knownValuePrefixes = [
    '--batch-size=',
    '--max-update=',
    '--max-runtime-ms=',
    '--confirm-database-host='
  ];
  const unknownArgument = args.find(
    (argument) =>
      !['--apply', '--dry-run'].includes(argument)
      && !knownValuePrefixes.some((prefix) => argument.startsWith(prefix))
  );
  if (unknownArgument) {
    throw new IngredientTombstoneScrubSafetyError(`Unsupported argument: ${unknownArgument}`);
  }

  const apply = args.includes('--apply');
  if (apply && args.includes('--dry-run')) {
    throw new IngredientTombstoneScrubSafetyError('--apply and --dry-run cannot be combined.');
  }

  const databaseHost = getIngredientTombstoneScrubDatabaseHost(databaseUrl);
  const confirmedHost = getSingleArgValue(args, '--confirm-database-host')?.trim().toLowerCase() || null;
  if (apply && confirmedHost !== databaseHost) {
    throw new IngredientTombstoneScrubSafetyError(
      `Applying tombstone scrubbing requires --confirm-database-host=${databaseHost} for the exact target database.`
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
    maxUpdate: parseBoundedInteger(args, '--max-update', {
      fallback: DEFAULT_MAX_UPDATE,
      minimum: 1,
      maximum: MAX_UPDATE_LIMIT
    }),
    maxRuntimeMs: parseBoundedInteger(args, '--max-runtime-ms', {
      fallback: DEFAULT_MAX_RUNTIME_MS,
      minimum: 1_000,
      maximum: MAX_RUNTIME_MS
    })
  };
}

export async function assertIngredientTombstoneScrubAccess(prisma) {
  const [roleRows, schemaRows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COALESCE(
        (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user),
        false
      ) AS "canBypassRls"
    `),
    prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*) FILTER (WHERE is_nullable = 'YES')::integer AS "nullablePayloadColumnCount",
        EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = '"Ingredient"'::regclass
            AND conname = 'Ingredient_active_payload_required'
            AND convalidated
        ) AS "hasValidatedActiveConstraint"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'Ingredient'
        AND column_name IN (
          'name', 'category', 'storageType', 'quantity', 'purchaseDate',
          'expiryDate', 'memo', 'consumed', 'createdAt'
        )
    `)
  ]);

  if (roleRows?.[0]?.canBypassRls !== true) {
    throw new IngredientTombstoneScrubSafetyError(
      'Ingredient tombstone scrubbing requires a trusted maintenance role that can bypass forced tenant RLS.'
    );
  }
  if (
    schemaRows?.[0]?.nullablePayloadColumnCount !== 9
    || schemaRows?.[0]?.hasValidatedActiveConstraint !== true
  ) {
    throw new IngredientTombstoneScrubSafetyError(
      'Apply the nullable Ingredient payload and validated active-row constraint migration before scrubbing.'
    );
  }
}

function normalizeDatabaseCount(value) {
  const count = Number(value || 0);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('The database returned an invalid aggregate count.');
  }
  return count;
}

export async function readEligibleIngredientTombstoneCount({ prisma, limit }) {
  const rows = await prisma.$queryRawUnsafe(COUNT_SQL, limit);
  return normalizeDatabaseCount(rows?.[0]?.eligibleCount);
}

export async function scrubIngredientTombstoneBatch({ prisma, limit }) {
  const updatedCount = await prisma.$executeRawUnsafe(UPDATE_SQL, limit);
  return normalizeDatabaseCount(updatedCount);
}

export async function runIngredientTombstoneScrub({ prisma, options, clock = Date.now }) {
  const startedAt = clock();
  if (!options.apply) {
    const observedCount = await readEligibleIngredientTombstoneCount({
      prisma,
      limit: options.maxUpdate + 1
    });
    return {
      mode: 'dry-run',
      eligibleCount: Math.min(observedCount, options.maxUpdate),
      hasMore: observedCount > options.maxUpdate,
      updatedTotal: 0,
      runtimeLimitReached: clock() - startedAt >= options.maxRuntimeMs,
      policy: {
        batchSize: options.batchSize,
        maxUpdate: options.maxUpdate,
        maxRuntimeMs: options.maxRuntimeMs
      }
    };
  }

  let updatedTotal = 0;
  let runtimeLimitReached = false;
  let mayHaveMore = false;
  while (updatedTotal < options.maxUpdate) {
    if (clock() - startedAt >= options.maxRuntimeMs) {
      runtimeLimitReached = true;
      mayHaveMore = true;
      break;
    }

    const limit = Math.min(options.batchSize, options.maxUpdate - updatedTotal);
    const updatedCount = await scrubIngredientTombstoneBatch({ prisma, limit });
    updatedTotal += updatedCount;
    mayHaveMore = updatedCount === limit;
    if (updatedCount < limit) break;
  }

  let remainingEligibleCount;
  if (runtimeLimitReached || clock() - startedAt >= options.maxRuntimeMs) {
    runtimeLimitReached = true;
    mayHaveMore = true;
  } else {
    remainingEligibleCount = await readEligibleIngredientTombstoneCount({ prisma, limit: 1 });
    mayHaveMore = remainingEligibleCount > 0;
  }

  return {
    mode: 'apply',
    eligibleCount: undefined,
    hasMore: undefined,
    updatedTotal,
    maxUpdateReached: updatedTotal >= options.maxUpdate,
    runtimeLimitReached,
    mayHaveMore,
    remainingEligibleCount,
    policy: {
      batchSize: options.batchSize,
      maxUpdate: options.maxUpdate,
      maxRuntimeMs: options.maxRuntimeMs
    }
  };
}

export function toAggregateIngredientTombstoneScrubLog(result, databaseHost) {
  return {
    operation: 'ingredient_tombstone_scrub',
    databaseHost,
    mode: result.mode,
    policy: result.policy,
    eligibleCount: result.eligibleCount,
    hasMore: result.hasMore,
    updatedTotal: result.updatedTotal,
    maxUpdateReached: Boolean(result.maxUpdateReached),
    runtimeLimitReached: Boolean(result.runtimeLimitReached),
    mayHaveMore: Boolean(result.mayHaveMore),
    remainingEligibleCount: result.remainingEligibleCount
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
  const databaseUrl = resolveIngredientTombstoneScrubDatabaseUrl();
  const options = parseIngredientTombstoneScrubOptions({ args, databaseUrl });
  const prisma = await createMaintenancePrisma(databaseUrl, options.maxRuntimeMs);

  try {
    await assertIngredientTombstoneScrubAccess(prisma);
    const result = await runIngredientTombstoneScrub({ prisma, options });
    console.log(JSON.stringify(toAggregateIngredientTombstoneScrubLog(result, options.databaseHost)));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error instanceof IngredientTombstoneScrubSafetyError) {
      console.error(error.message);
    } else {
      console.error('Ingredient tombstone scrubbing failed. Review the private database operations log.');
    }
    process.exitCode = 1;
  });
}
