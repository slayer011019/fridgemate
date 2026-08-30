CREATE TABLE "PantryOwnership" (
  "id" TEXT NOT NULL,
  "stapleId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "PantryOwnership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PantryOwnership_userId_stapleId_key"
  ON "PantryOwnership"("userId", "stapleId");
CREATE INDEX "PantryOwnership_userId_updatedAt_idx"
  ON "PantryOwnership"("userId", "updatedAt");

CREATE TABLE "UserPreference" (
  "id" TEXT NOT NULL,
  "preferredIngredients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "dislikedIngredients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "spiceLevel" TEXT NOT NULL DEFAULT 'medium',
  "cookingTimePreference" TEXT NOT NULL DEFAULT 'flexible',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

CREATE TABLE "ProductEvent" (
  "id" TEXT NOT NULL,
  "clientEventId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "route" TEXT,
  "properties" JSONB,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductEvent_userId_clientEventId_key" ON "ProductEvent"("userId", "clientEventId");
CREATE INDEX "ProductEvent_userId_occurredAt_idx" ON "ProductEvent"("userId", "occurredAt");
CREATE INDEX "ProductEvent_eventName_occurredAt_idx" ON "ProductEvent"("eventName", "occurredAt");

ALTER TABLE "PantryOwnership"
  ADD CONSTRAINT "PantryOwnership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPreference"
  ADD CONSTRAINT "UserPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductEvent"
  ADD CONSTRAINT "ProductEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

REVOKE ALL ON TABLE "PantryOwnership", "UserPreference", "ProductEvent" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PantryOwnership", "UserPreference" TO fridgemate_app;
GRANT SELECT, INSERT, DELETE ON TABLE "ProductEvent" TO fridgemate_app;

ALTER TABLE "PantryOwnership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PantryOwnership" FORCE ROW LEVEL SECURITY;
CREATE POLICY pantry_ownership_tenant_isolation
  ON "PantryOwnership" FOR ALL TO fridgemate_app
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

ALTER TABLE "UserPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPreference" FORCE ROW LEVEL SECURITY;
CREATE POLICY user_preference_tenant_isolation
  ON "UserPreference" FOR ALL TO fridgemate_app
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

ALTER TABLE "ProductEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY product_event_insert_scope
  ON "ProductEvent" FOR INSERT TO fridgemate_app
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
CREATE POLICY product_event_select_scope
  ON "ProductEvent" FOR SELECT TO fridgemate_app
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
CREATE POLICY product_event_delete_scope
  ON "ProductEvent" FOR DELETE TO fridgemate_app
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
