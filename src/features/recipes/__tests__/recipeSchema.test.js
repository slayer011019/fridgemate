import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const schemaText = readFileSync('prisma/schema.prisma', 'utf8');

describe('recipe schema design', () => {
  it('matches the production UUID recipe catalog tables', () => {
    expect(schemaText).toContain('@@map("recipes")');
    expect(schemaText).toContain('@@map("recipe_ingredients")');
    expect(schemaText).toContain('@@map("recipe_embeddings")');
    expect(schemaText).toContain('@map("external_id")');
    expect(schemaText).toContain('@db.Uuid');
    expect(schemaText).not.toContain('@@map("raw_recipes")');
    expect(schemaText).not.toContain('recipe_steps');
    expect(schemaText).not.toContain('RecipeStep');
  });

  it('does not define recipe manual fields in the Prisma schema', () => {
    expect(schemaText).not.toContain('MANUAL01');
    expect(schemaText).not.toContain('manualImage');
  });

  it('stores recipe embeddings in the sidecar table with matching metadata', () => {
    expect(schemaText).toContain('model RecipeEmbedding');
    expect(schemaText).toContain('embeddingText');
    expect(schemaText).toContain('Unsupported("vector(1536)")');
    expect(schemaText).toContain('embeddingModel');
    expect(schemaText).toContain('embeddingDimensions');
    expect(schemaText).toContain('contentHash');
    expect(schemaText).toContain('confidence');
    expect(schemaText).toContain('raw             Json?');
    expect(schemaText).not.toContain('embeddingStatus');
  });
});
