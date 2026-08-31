import { describe, expect, it } from 'vitest';
import { buildLocalOcrAssetPaths } from '../ocr.js';

describe('buildLocalOcrAssetPaths', () => {
  it('keeps every executable OCR asset on the application origin', () => {
    expect(buildLocalOcrAssetPaths('/', 'https://app.example.com')).toEqual({
      workerPath: 'https://app.example.com/ocr/tesseract/worker.min.js',
      corePath: 'https://app.example.com/ocr/tesseract/core/',
      langPath: 'https://app.example.com/ocr/tesseract/lang/'
    });
  });

  it('respects a sub-path deployment base', () => {
    expect(buildLocalOcrAssetPaths('/fridgemate/', 'https://app.example.com').workerPath).toBe(
      'https://app.example.com/fridgemate/ocr/tesseract/worker.min.js'
    );
  });
});
