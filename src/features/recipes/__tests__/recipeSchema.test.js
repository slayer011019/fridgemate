import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const schemaText = readFileSync('prisma/schema.prisma', 'utf8');

describe('recipe schema design', () => {
  it('includes recipe catalog tables without recipe step storage', () => {
    expect(schemaText).toContain('@@map("raw_recipes")');
    expect(schemaText).toContain('@@map("recipes")');
    expect(schemaText).toContain('@@map("recipe_ingredients")');
    expect(schemaText).toContain('@@map("ingredients")');
    expect(schemaText).toContain('@@map("ingredient_aliases")');
    expect(schemaText).not.toContain('recipe_steps');
    expect(schemaText).not.toContain('RecipeStep');
  });

  it('does not define recipe manual fields in the Prisma schema', () => {
    expect(schemaText).not.toContain('MANUAL01');
    expect(schemaText).not.toContain('manualImage');
  });

  it('stores recipe embedding metadata and ingredient confidence without recipe body storage', () => {
    expect(schemaText).toContain('embeddingText');
    expect(schemaText).toContain('Unsupported("vector")');
    expect(schemaText).toContain('embeddingStatus');
    expect(schemaText).toContain('confidence');
    expect(schemaText).toContain('rawPayload');
  });
});
