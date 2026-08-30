-- VALIDATE CONSTRAINT uses SHARE UPDATE EXCLUSIVE rather than ACCESS EXCLUSIVE,
-- so normal Ingredient reads and writes can continue during the bounded scan.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "Ingredient"
  VALIDATE CONSTRAINT "Ingredient_active_payload_required";

RESET statement_timeout;
RESET lock_timeout;
