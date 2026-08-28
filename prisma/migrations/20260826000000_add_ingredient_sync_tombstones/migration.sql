ALTER TABLE "Ingredient"
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Ingredient_userId_deletedAt_idx"
ON "Ingredient"("userId", "deletedAt");
