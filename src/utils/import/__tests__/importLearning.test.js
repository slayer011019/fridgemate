import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyImportCorrections,
  clearImportCorrections,
  getImportCorrectionKey,
  saveImportCorrections
} from '../importLearning.js';

const STORAGE_KEY = 'fridgemate-import-corrections:v2:guest';

function createImportItem(overrides = {}) {
  return {
    id: 'item-1',
    name: '우유',
    displayName: '우유',
    normalizedName: '우유',
    category: '유제품',
    storageType: '냉장',
    sourceLine: '서울우유 1L',
    ...overrides
  };
}

describe('importLearning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00.000Z'));
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  describe('getImportCorrectionKey', () => {
    it('builds the correction key from normalizedName first', () => {
      const item = createImportItem({
        normalizedName: '  우유  ',
        displayName: '서울우유',
        sourceLine: '서울우유 1L'
      });

      expect(getImportCorrectionKey(item)).toBe('우유');
    });
  });

  describe('saveImportCorrections', () => {
    it('stores corrected name, category, and storage type in localStorage', () => {
      saveImportCorrections([
        createImportItem({
          name: '두부',
          normalizedName: '두부',
          category: '기타',
          storageType: '냉장'
        })
      ]);

      const savedMap = JSON.parse(window.localStorage.getItem(STORAGE_KEY));

      expect(savedMap).toMatchObject({
        두부: {
          name: '두부',
          category: '기타',
          storageType: '냉장',
          updatedAt: '2026-03-18T12:00:00.000Z'
        }
      });
    });

    it('overwrites learning data for the same product key', () => {
      saveImportCorrections([
        createImportItem({
          name: '양파',
          normalizedName: '양파',
          category: '채소',
          storageType: '실온'
        })
      ]);

      vi.setSystemTime(new Date('2026-03-19T09:30:00.000Z'));

      saveImportCorrections([
        createImportItem({
          name: '깐양파',
          normalizedName: '양파',
          category: '기타',
          storageType: '냉장'
        })
      ]);

      const savedMap = JSON.parse(window.localStorage.getItem(STORAGE_KEY));

      expect(Object.keys(savedMap)).toEqual(['양파']);
      expect(savedMap['양파']).toMatchObject({
        name: '깐양파',
        category: '기타',
        storageType: '냉장',
        updatedAt: '2026-03-19T09:30:00.000Z'
      });
    });
  });

  describe('applyImportCorrections', () => {
    it('reapplies learned corrections on the next import', () => {
      saveImportCorrections([
        createImportItem({
          name: '깐양파',
          normalizedName: '양파',
          category: '기타',
          storageType: '냉장'
        })
      ]);

      const correctedItems = applyImportCorrections([
        createImportItem({
          id: 'item-2',
          name: '양파',
          displayName: '양파',
          normalizedName: '양파',
          category: '채소',
          storageType: '실온'
        })
      ]);

      expect(correctedItems[0]).toMatchObject({
        name: '깐양파',
        displayName: '깐양파',
        normalizedName: '깐양파',
        category: '기타',
        storageType: '냉장',
        learnedCorrection: true
      });
    });

    it('returns the original items when localStorage is empty', () => {
      const items = [
        createImportItem({
          id: 'item-3',
          name: '오이',
          displayName: '오이',
          normalizedName: '오이',
          category: '채소',
          storageType: '냉장'
        })
      ];

      const correctedItems = applyImportCorrections(items);

      expect(correctedItems).toEqual(items);
    });

    it('keeps learned corrections isolated between signed-in users', () => {
      saveImportCorrections(
        [createImportItem({ name: '사용자1 우유', normalizedName: '우유' })],
        'user:user-1'
      );

      const userOneItems = applyImportCorrections(
        [createImportItem({ normalizedName: '우유' })],
        'user:user-1'
      );
      const userTwoItems = applyImportCorrections(
        [createImportItem({ normalizedName: '우유' })],
        'user:user-2'
      );

      expect(userOneItems[0].name).toBe('사용자1 우유');
      expect(userTwoItems[0].name).toBe('우유');
    });
  });

  describe('clearImportCorrections', () => {
    it('removes only the requested authenticated scope', () => {
      saveImportCorrections(
        [createImportItem({ name: '사용자1 우유', normalizedName: '우유' })],
        'user:user-1'
      );
      saveImportCorrections(
        [createImportItem({ name: '사용자2 우유', normalizedName: '우유' })],
        'user:user-2'
      );

      expect(clearImportCorrections('user:user-1')).toBe(true);
      expect(window.localStorage.getItem('fridgemate-import-corrections:v2:user:user-1')).toBeNull();
      expect(window.localStorage.getItem('fridgemate-import-corrections:v2:user:user-2')).not.toBeNull();
    });

    it('removes both current and legacy guest correction keys', () => {
      window.localStorage.setItem(STORAGE_KEY, '{}');
      window.localStorage.setItem('fridgemate-import-corrections', '{}');

      expect(clearImportCorrections()).toBe(true);
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(window.localStorage.getItem('fridgemate-import-corrections')).toBeNull();
    });
  });
});
