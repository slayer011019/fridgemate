import { describe, expect, it } from 'vitest';
import { annotateDuplicateImportItems, toImportableItems } from '../importSelection';

describe('importSelection', () => {
  it('marks duplicate import candidates and deselects lower priority duplicates', () => {
    const items = annotateDuplicateImportItems([
      {
        id: 'low',
        name: '양파',
        normalizedName: '양파',
        quantity: null,
        confidence: 0.5,
        selected: true
      },
      {
        id: 'high',
        name: '양파',
        normalizedName: '양파',
        quantity: '1kg',
        confidence: 0.8,
        selected: true
      }
    ]);

    expect(items).toMatchObject([
      {
        duplicateInImport: true,
        duplicateCandidateCount: 2,
        selected: false
      },
      {
        duplicateInImport: true,
        duplicateCandidateCount: 2,
        selected: true
      }
    ]);
  });

  it('marks candidates that duplicate existing ingredients', () => {
    const items = annotateDuplicateImportItems(
      [
        {
          id: 'candidate',
          name: '달걀',
          normalizedName: '계란',
          quantity: '10구',
          selected: true
        }
      ],
      [
        {
          id: 'existing',
          name: '계란',
          quantity: '4개'
        }
      ]
    );

    expect(items[0].duplicateExistingItems).toEqual([
      {
        id: 'existing',
        name: '계란',
        quantity: '4개'
      }
    ]);
  });

  it('removes duplicate review metadata from import payloads', () => {
    const [item] = toImportableItems([
      {
        id: 'candidate',
        name: '양파',
        quantity: '1kg',
        selected: true,
        rawLine: '양파 1kg',
        confidence: 0.95,
        needsReview: false,
        duplicateInImport: true,
        duplicateExistingItems: [{ id: 'existing' }],
        replaceExisting: true
      }
    ]);

    expect(item).toEqual({
      id: 'candidate',
      name: '양파',
      quantity: '1kg'
    });
  });
});
