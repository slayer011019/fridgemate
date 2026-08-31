-- Keep this migration to one statement so PostgreSQL can build the index without
-- blocking normal ProductEvent writes.
CREATE INDEX CONCURRENTLY "ProductEvent_createdAt_id_idx"
  ON "ProductEvent"("createdAt", "id");
