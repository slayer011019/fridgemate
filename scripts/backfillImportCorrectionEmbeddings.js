import { pathToFileURL } from 'node:url';

const DEFAULT_BATCH_SIZE = 25;

function parseBatchSize() {
  const value = Number(process.env.BACKFILL_BATCH_SIZE || DEFAULT_BATCH_SIZE);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 100) : DEFAULT_BATCH_SIZE;
}

export function getDatabaseHost(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    throw new Error('A valid BACKFILL_DATABASE_URL, DIRECT_URL, or DATABASE_URL is required.');
  }
}

export function assertBackfillSafety({ args = [], databaseUrl, serverConfig }) {
  if (!serverConfig.importCorrectionLearningEnabled) {
    throw new Error('IMPORT_CORRECTION_LEARNING_ENABLED must be explicitly set to true.');
  }

  if (!serverConfig.importCorrectionEmbeddingEnabled) {
    throw new Error('IMPORT_CORRECTION_EMBEDDING_ENABLED must be explicitly set to true.');
  }

  const execute = args.includes('--execute');
  const databaseHost = getDatabaseHost(databaseUrl);

  if (!execute) {
    return { databaseHost, execute: false };
  }

  throw new Error(
    'Import correction embedding backfill execution is disabled because legacy rows do not contain per-record external AI consent evidence. Dry-run inspection is allowed.'
  );
}

export async function readPendingCorrections(prisma, batchSize) {
  return prisma.$queryRaw`
    SELECT "id", "sourceText", "correctedName", "category", "storageType"
    FROM "ImportCorrection"
    WHERE "embedding" IS NULL
    ORDER BY "updatedAt" DESC
    LIMIT ${batchSize}
  `;
}

export async function updateCorrectionEmbedding({
  correction,
  embedding,
  embeddingText,
  prisma,
  serverConfig,
  toVectorLiteral
}) {
  const vectorLiteral = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    UPDATE "ImportCorrection"
    SET
      "embedding" = ${vectorLiteral}::vector,
      "embeddingText" = ${embeddingText},
      "embeddingModel" = ${serverConfig.embeddingModel},
      "embeddingDimensions" = ${serverConfig.embeddingDimensions},
      "updatedAt" = now()
    WHERE "id" = ${correction.id}
  `;
}

export async function runImportCorrectionEmbeddingBackfill({
  buildSafeEmbeddingText,
  createEmbedding,
  execute,
  prisma,
  serverConfig,
  toVectorLiteral
}) {
  if (execute) {
    throw new Error(
      'Import correction embedding backfill execution is disabled because legacy rows do not contain per-record external AI consent evidence.'
    );
  }

  const batchSize = parseBatchSize();
  const pendingCorrections = await readPendingCorrections(prisma, batchSize);
  let eligibleCount = 0;
  let rejectedCount = 0;
  let updatedCount = 0;

  for (const correction of pendingCorrections) {
    let embeddingText;

    try {
      embeddingText = buildSafeEmbeddingText(correction);
      eligibleCount += 1;
    } catch {
      rejectedCount += 1;
      continue;
    }

    if (!execute) continue;

    const embedding = await createEmbedding(embeddingText);

    if (!embedding?.length) {
      continue;
    }

    await updateCorrectionEmbedding({
      correction,
      embedding,
      embeddingText,
      prisma,
      serverConfig,
      toVectorLiteral
    });
    updatedCount += 1;
  }

  return {
    scannedCount: pendingCorrections.length,
    eligibleCount,
    rejectedCount,
    updatedCount,
    dryRun: !execute,
    embeddingModel: serverConfig.embeddingModel,
    embeddingDimensions: serverConfig.embeddingDimensions
  };
}

async function main() {
  const databaseUrl =
    process.env.BACKFILL_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  getDatabaseHost(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;

  const { serverConfig } = await import('../server/src/config.js');
  const { createEmbedding, isEmbeddingEnabled, toVectorLiteral } = await import(
    '../server/src/services/embeddingService.js'
  );
  const { buildSafeImportCorrectionEmbeddingText } = await import(
    '../server/src/services/importCorrectionService.js'
  );
  const safety = assertBackfillSafety({
    args: process.argv.slice(2),
    databaseUrl,
    serverConfig,
    isEmbeddingEnabled
  });
  const { prisma } = await import('../server/src/db/prisma.js');

  try {
    const result = await runImportCorrectionEmbeddingBackfill({
      buildSafeEmbeddingText: buildSafeImportCorrectionEmbeddingText,
      createEmbedding,
      execute: safety.execute,
      prisma,
      serverConfig,
      toVectorLiteral
    });

    console.log(JSON.stringify({ ...result, databaseHost: safety.databaseHost }));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
