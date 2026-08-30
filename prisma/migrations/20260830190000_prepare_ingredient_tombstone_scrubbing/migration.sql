-- Add the replacement invariant without scanning existing rows or changing any
-- tombstone payload. Validation and column relaxation are separate migrations so
-- an ACCESS EXCLUSIVE lock is never held during the table scan.
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
