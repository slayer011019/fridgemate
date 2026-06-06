CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS recipe_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  embedding_text text NOT NULL,
  embedding vector(1536) NOT NULL,
  embedding_model text NOT NULL,
  embedding_dimensions integer NOT NULL DEFAULT 1536,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT recipe_embeddings_model_dimensions_check
    CHECK (embedding_dimensions = 1536)
);

CREATE UNIQUE INDEX IF NOT EXISTS recipe_embeddings_recipe_model_dim_idx
  ON recipe_embeddings (recipe_id, embedding_model, embedding_dimensions);

CREATE INDEX IF NOT EXISTS recipe_embeddings_recipe_id_idx
  ON recipe_embeddings (recipe_id);

CREATE INDEX IF NOT EXISTS recipe_embeddings_content_hash_idx
  ON recipe_embeddings (content_hash);

CREATE INDEX IF NOT EXISTS recipe_embeddings_embedding_hnsw_idx
  ON recipe_embeddings
  USING hnsw (embedding vector_cosine_ops);
