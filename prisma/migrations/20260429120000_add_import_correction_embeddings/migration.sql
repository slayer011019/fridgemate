CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "ImportCorrection" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "correctedName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "storageType" TEXT NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 1,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "embeddingText" TEXT,
  "embeddingModel" TEXT,
  "embeddingDimensions" INTEGER,
  "embedding" vector(512),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,

  CONSTRAINT "ImportCorrection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportCorrection_userId_sourceKey_key" ON "ImportCorrection"("userId", "sourceKey");
CREATE INDEX "ImportCorrection_userId_updatedAt_idx" ON "ImportCorrection"("userId", "updatedAt");
CREATE INDEX "ImportCorrection_userId_lastUsedAt_idx" ON "ImportCorrection"("userId", "lastUsedAt");
CREATE INDEX "ImportCorrection_embedding_idx" ON "ImportCorrection" USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "ImportCorrection"
ADD CONSTRAINT "ImportCorrection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
