-- Expand the schema before deploying scrub-aware server code.
-- No existing tombstone payload is changed in this compatibility step.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "Ingredient"
  ALTER COLUMN "name" DROP NOT NULL,
  ALTER COLUMN "category" DROP NOT NULL,
  ALTER COLUMN "storageType" DROP NOT NULL,
  ALTER COLUMN "quantity" DROP NOT NULL,
  ALTER COLUMN "consumed" DROP NOT NULL,
  ALTER COLUMN "createdAt" DROP NOT NULL;

ALTER TABLE "Ingredient"
  ADD CONSTRAINT "Ingredient_active_payload_required"
  CHECK (
    "deletedAt" IS NOT NULL
    OR (
      "name" IS NOT NULL
      AND "category" IS NOT NULL
      AND "storageType" IS NOT NULL
      AND "quantity" IS NOT NULL
      AND "consumed" IS NOT NULL
      AND "createdAt" IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE "Ingredient"
  VALIDATE CONSTRAINT "Ingredient_active_payload_required";

RESET statement_timeout;
RESET lock_timeout;
