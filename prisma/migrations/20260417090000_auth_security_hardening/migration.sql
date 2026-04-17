ALTER TABLE "User"
ADD COLUMN "emailNormalized" TEXT;

UPDATE "User"
SET "emailNormalized" = lower(btrim("email"));

ALTER TABLE "User"
ALTER COLUMN "emailNormalized" SET NOT NULL;

CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

ALTER TABLE "User"
ADD CONSTRAINT "User_email_normalized_check"
CHECK ("emailNormalized" = lower(btrim("email")));
