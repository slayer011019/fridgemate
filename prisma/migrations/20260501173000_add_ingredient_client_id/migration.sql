ALTER TABLE "Ingredient" ADD COLUMN "clientId" TEXT;

UPDATE "Ingredient"
SET "clientId" = "id"
WHERE "clientId" IS NULL;

ALTER TABLE "Ingredient" ALTER COLUMN "clientId" SET NOT NULL;

CREATE UNIQUE INDEX "Ingredient_userId_clientId_key" ON "Ingredient"("userId", "clientId");
