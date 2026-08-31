import { describe, expect, it } from 'vitest';
import {
  assertIngredientBatch,
  normalizeIngredientInput,
  normalizeIngredientSyncInput
} from '../ingredientValidation.js';

function createInput(overrides = {}) {
  return {
    id: 'local-1700000000:abc',
    clientId: 'device-item_1',
    name: '양파',
    category: '채소',
    storageType: '냉장',
    quantity: '1개',
    purchaseDate: '2026-08-01',
    expiryDate: '2026-08-31',
    memo: '',
    consumed: false,
    ...overrides
  };
}

describe('ingredientValidation', () => {
  it('keeps the existing printable local-first id and clientId contract', () => {
    expect(normalizeIngredientInput(createInput())).toMatchObject({
      id: 'local-1700000000:abc',
      clientId: 'device-item_1'
    });
    expect(normalizeIngredientInput(createInput({ clientId: '  ' }))).toMatchObject({
      id: 'local-1700000000:abc',
      clientId: 'local-1700000000:abc'
    });
  });

  it.each([null, [], new Date()])('rejects a non-plain ingredient body: %s', (input) => {
    expect(() => normalizeIngredientInput(input)).toThrowError(
      expect.objectContaining({ status: 400, message: 'Ingredient must be an object.' })
    );
  });

  it.each([
    ['id', 'x'.repeat(129), 'Ingredient id must be at most 128 characters.'],
    ['clientId', 'x'.repeat(129), 'Ingredient client id must be at most 128 characters.'],
    ['name', 'x'.repeat(61), 'Ingredient name must be at most 60 characters.'],
    ['quantity', 'x'.repeat(31), 'Ingredient quantity must be at most 30 characters.'],
    ['memo', 'x'.repeat(301), 'Ingredient memo must be at most 300 characters.']
  ])('rejects an oversized %s instead of silently truncating it', (field, value, message) => {
    expect(() => normalizeIngredientInput(createInput({ [field]: value }))).toThrowError(
      expect.objectContaining({ status: 400, message })
    );
  });

  it.each([
    ['id', 'local\u0000id', 'Ingredient id must not contain control characters.'],
    ['clientId', 'client\nid', 'Ingredient client id must not contain control characters.'],
    ['name', 'onion\rname', 'Ingredient name must not contain control characters.'],
    ['memo', 'memo\u007fvalue', 'Ingredient memo must not contain control characters.']
  ])('rejects control characters in %s', (field, value, message) => {
    expect(() => normalizeIngredientInput(createInput({ [field]: value }))).toThrowError(
      expect.objectContaining({ status: 400, message })
    );
  });

  it('requires string and boolean field types', () => {
    expect(() => normalizeIngredientInput(createInput({ quantity: 1 }))).toThrowError(
      expect.objectContaining({ status: 400, message: 'Ingredient quantity must be a string.' })
    );
    expect(() => normalizeIngredientInput(createInput({ consumed: 'false' }))).toThrowError(
      expect.objectContaining({ status: 400, message: 'Ingredient consumed must be a boolean.' })
    );
  });

  it('applies the same string boundary to sync timestamps', () => {
    expect(() =>
      normalizeIngredientSyncInput(createInput({ updatedAt: '2026-08-30T00:00:00.000Z\n' }))
    ).toThrowError(
      expect.objectContaining({ status: 400, message: 'Ingredient updatedAt must not contain control characters.' })
    );
    expect(() => normalizeIngredientSyncInput(createInput({ updatedAt: 123 }))).toThrowError(
      expect.objectContaining({ status: 400, message: 'Ingredient updatedAt must be a string.' })
    );
  });

  it('accepts a minimal deletion tombstone and removes any supplied business payload', () => {
    expect(normalizeIngredientSyncInput(createInput({
      name: 'must-not-survive',
      memo: 'private memo',
      updatedAt: '2026-08-30T00:00:00.000Z',
      deletedAt: '2026-08-30T00:00:00.000Z'
    }))).toEqual({
      id: 'local-1700000000:abc',
      clientId: 'device-item_1',
      name: null,
      category: null,
      storageType: null,
      quantity: null,
      purchaseDate: null,
      expiryDate: null,
      memo: null,
      consumed: null,
      createdAt: null,
      updatedAt: '2026-08-30T00:00:00.000Z',
      deletedAt: '2026-08-30T00:00:00.000Z'
    });

    expect(normalizeIngredientSyncInput({
      clientId: 'minimal-delete',
      updatedAt: '2026-08-30T00:00:00.000Z',
      deletedAt: '2026-08-30T00:00:00.000Z'
    })).toMatchObject({
      id: undefined,
      clientId: 'minimal-delete',
      name: null,
      deletedAt: '2026-08-30T00:00:00.000Z'
    });
  });

  it('rejects an unidentifiable or malformed deletion tombstone', () => {
    expect(() => normalizeIngredientSyncInput({
      updatedAt: '2026-08-30T00:00:00.000Z',
      deletedAt: '2026-08-30T00:00:00.000Z'
    })).toThrowError(expect.objectContaining({
      status: 400,
      message: 'Ingredient client id is required for a deletion tombstone.'
    }));

    expect(() => normalizeIngredientSyncInput(createInput({
      updatedAt: '2026-08-30T00:00:00.000Z',
      deletedAt: 'not-a-timestamp'
    }))).toThrowError(expect.objectContaining({
      status: 400,
      message: 'Ingredient deletedAt must be a valid timestamp.'
    }));
  });

  it('allows at most 50 items in bulk and sync arrays', () => {
    expect(() => assertIngredientBatch(Array.from({ length: 50 }), 'Ingredient items')).not.toThrow();
    expect(() => assertIngredientBatch(Array.from({ length: 51 }), 'Ingredient items')).toThrowError(
      expect.objectContaining({ status: 400, message: 'Ingredient items must contain at most 50 items.' })
    );
    expect(() => assertIngredientBatch(null, 'Ingredient changes', { allowEmpty: true })).toThrowError(
      expect.objectContaining({ status: 400, message: 'Ingredient changes must be an array.' })
    );
  });
});
