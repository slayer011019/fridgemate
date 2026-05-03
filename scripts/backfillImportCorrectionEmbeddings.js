const DEFAULT_BATCH_SIZE = 25;

function parseBatchSize() {
  const value = Number(process.env.BACKFILL_BATCH_SIZE || DEFAULT_BATCH_SIZE);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 100) : DEFAULT_BATCH_SIZE;
}

async function readPendingCorrections(prisma, batchSize) {
  return prisma.$queryRaw`
    SELECT "id", "embeddingText", "sourceText"
    FROM "ImportCorrection"
    WHERE "embedding" IS NULL
    ORDER BY "updatedAt" DESC
    LIMIT ${batchSize}
  `;
}

async function updateCorrectionEmbedding({ correction, embedding, prisma, serverConfig, toVectorLiteral }) {
  const vectorLiteral = toVectorLiteral(embedding);
  const embeddingText = correction.embeddingText || correction.sourceText;

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

async function main() {
  process.env.DATABASE_URL = process.env.BACKFILL_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

  const { prisma } = await import('../server/src/db/prisma.js');
  const { serverConfig } = await import('../server/src/config.js');
  const { createEmbedding, isEmbeddingEnabled, toVectorLiteral } = await import('../server/src/services/embeddingService.js');

  if (!isEmbeddingEnabled()) {
    throw new Error('OPENAI_API_KEY is required to backfill import correction embeddings.');
  }

  const batchSize = parseBatchSize();
  const pendingCorrections = await readPendingCorrections(prisma, batchSize);
  let updatedCount = 0;

  for (const correction of pendingCorrections) {
    const embeddingText = correction.embeddingText || correction.sourceText;
    const embedding = await createEmbedding(embeddingText);

    if (!embedding?.length) {
      continue;
    }

    await updateCorrectionEmbedding({ correction, embedding, prisma, serverConfig, toVectorLiteral });
    updatedCount += 1;
  }

  console.log(
    JSON.stringify({
      scannedCount: pendingCorrections.length,
      updatedCount,
      embeddingModel: serverConfig.embeddingModel,
      embeddingDimensions: serverConfig.embeddingDimensions
    })
  );

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
