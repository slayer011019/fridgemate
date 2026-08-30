import { describe, expect, it, vi } from 'vitest';
import {
  OCR_IMAGE_ERROR_MESSAGES,
  OCR_IMAGE_LIMITS,
  validateOcrImageFile
} from '../imageValidation';
import { runOcrWithProvider } from '../ocrService';

function createPngFile(width, height, type = 'image/png') {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return new File([bytes], 'receipt.png', { type });
}

function createJpegFile(width, height) {
  const bytes = new Uint8Array(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  bytes[7] = height >> 8;
  bytes[8] = height & 0xff;
  bytes[9] = width >> 8;
  bytes[10] = width & 0xff;
  return new File([bytes], 'receipt.jpg', { type: 'image/jpeg' });
}

function createWebpFile(width, height) {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(bytes.buffer).setUint32(4, 22, true);
  bytes.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 8);
  new DataView(bytes.buffer).setUint32(16, 10, true);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes.set([encodedWidth & 0xff, (encodedWidth >> 8) & 0xff, (encodedWidth >> 16) & 0xff], 24);
  bytes.set([encodedHeight & 0xff, (encodedHeight >> 8) & 0xff, (encodedHeight >> 16) & 0xff], 27);
  return new File([bytes], 'receipt.webp', { type: 'image/webp' });
}

describe('validateOcrImageFile', () => {
  it.each([
    [createPngFile(1200, 1800), 'image/png'],
    [createJpegFile(1600, 900), 'image/jpeg'],
    [createWebpFile(900, 1600), 'image/webp']
  ])('accepts supported image bytes and reports trusted metadata', async (file, expectedType) => {
    await expect(validateOcrImageFile(file)).resolves.toMatchObject({ type: expectedType });
  });

  it('rejects a declared image whose magic bytes and dimensions are not a supported image', async () => {
    const spoofedFile = new File(['<svg onload="alert(1)">'], 'receipt.png', { type: 'image/png' });

    await expect(validateOcrImageFile(spoofedFile)).rejects.toThrow(OCR_IMAGE_ERROR_MESSAGES.invalid);
  });

  it('rejects unsupported declared MIME types before reading file bytes', async () => {
    const file = {
      size: 100,
      type: 'image/svg+xml',
      arrayBuffer: vi.fn()
    };

    await expect(validateOcrImageFile(file)).rejects.toThrow(OCR_IMAGE_ERROR_MESSAGES.type);
    expect(file.arrayBuffer).not.toHaveBeenCalled();
  });

  it('rejects oversized compressed files before allocating a decode buffer', async () => {
    const file = {
      size: OCR_IMAGE_LIMITS.maxBytes + 1,
      type: 'image/png',
      arrayBuffer: vi.fn()
    };

    await expect(validateOcrImageFile(file)).rejects.toThrow(OCR_IMAGE_ERROR_MESSAGES.size);
    expect(file.arrayBuffer).not.toHaveBeenCalled();
  });

  it('rejects decompression-bomb dimensions before invoking OCR', async () => {
    const file = createPngFile(8000, 8000);
    const provider = { recognize: vi.fn() };

    await expect(runOcrWithProvider(file, {}, provider)).rejects.toThrow(OCR_IMAGE_ERROR_MESSAGES.dimensions);
    expect(provider.recognize).not.toHaveBeenCalled();
  });

  it('invokes the OCR provider only after image validation succeeds', async () => {
    const file = createPngFile(1200, 1800);
    const provider = { recognize: vi.fn().mockResolvedValue({ text: '두부 1모' }) };

    await expect(runOcrWithProvider(file, { onProgress: vi.fn() }, provider)).resolves.toEqual({ text: '두부 1모' });
    expect(provider.recognize).toHaveBeenCalledWith(file, expect.objectContaining({ onProgress: expect.any(Function) }));
  });
});
