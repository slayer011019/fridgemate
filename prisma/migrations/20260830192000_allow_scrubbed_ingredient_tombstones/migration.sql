-- The validated CHECK now protects active rows. Keep the ACCESS EXCLUSIVE phase
-- to this metadata-only ALTER and fail quickly if another transaction holds the
-- table lock.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "Ingredient"
  ALTER COLUMN "name" DROP NOT NULL,
  ALTER COLUMN "category" DROP NOT NULL,
  ALTER COLUMN "storageType" DROP NOT NULL,
  ALTER COLUMN "quantity" DROP NOT NULL,
  ALTER COLUMN "consumed" DROP NOT NULL,
  ALTER COLUMN "createdAt" DROP NOT NULL;

RESET statement_timeout;
RESET lock_timeout;
