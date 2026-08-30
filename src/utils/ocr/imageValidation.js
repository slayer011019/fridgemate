export const OCR_IMAGE_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxDimension: 8192,
  maxPixels: 12_000_000
});

export const OCR_IMAGE_ERROR_MESSAGES = Object.freeze({
  empty: '선택한 이미지 파일이 비어 있어요.',
  invalid: '손상되었거나 지원하지 않는 이미지예요. PNG, JPG 또는 WEBP 파일을 선택해주세요.',
  size: '이미지는 8MB 이하만 사용할 수 있어요.',
  dimensions: '이미지 해상도가 너무 커요. 가로·세로 8,192px, 총 1,200만 픽셀 이하로 줄여주세요.',
  type: 'PNG, JPG 또는 WEBP 이미지만 사용할 수 있어요.'
});

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf
]);

function readAscii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readUint24LittleEndian(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function parsePngDimensions(bytes, view) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  if (readAscii(bytes, 12, 4) !== 'IHDR') return null;

  return {
    type: 'image/png',
    width: view.getUint32(16, false),
    height: view.getUint32(20, false)
  };
}

function parseJpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 1 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 1 >= bytes.length) return null;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      return {
        type: 'image/jpeg',
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6]
      };
    }

    offset += segmentLength;
  }

  return null;
}

function parseWebpDimensions(bytes, view) {
  if (bytes.length < 30 || readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WEBP') {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    const dataEnd = dataOffset + chunkSize;
    if (dataEnd > bytes.length) return null;

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        type: 'image/webp',
        width: readUint24LittleEndian(bytes, dataOffset + 4) + 1,
        height: readUint24LittleEndian(bytes, dataOffset + 7) + 1
      };
    }

    if (
      chunkType === 'VP8 ' &&
      chunkSize >= 10 &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        type: 'image/webp',
        width: view.getUint16(dataOffset + 6, true) & 0x3fff,
        height: view.getUint16(dataOffset + 8, true) & 0x3fff
      };
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      const first = bytes[dataOffset + 1];
      const second = bytes[dataOffset + 2];
      const third = bytes[dataOffset + 3];
      const fourth = bytes[dataOffset + 4];

      return {
        type: 'image/webp',
        width: 1 + first + ((second & 0x3f) << 8),
        height: 1 + (second >> 6) + (third << 2) + ((fourth & 0x0f) << 10)
      };
    }

    offset = dataEnd + (chunkSize % 2);
  }

  return null;
}

function parseImageMetadata(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  return parsePngDimensions(bytes, view) || parseJpegDimensions(bytes) || parseWebpDimensions(bytes, view);
}

function normalizeDeclaredType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

async function readFileBuffer(file) {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(OCR_IMAGE_ERROR_MESSAGES.invalid));
    reader.readAsArrayBuffer(file);
  });
}

export async function validateOcrImageFile(file, limits = OCR_IMAGE_LIMITS) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) {
    throw new Error(OCR_IMAGE_ERROR_MESSAGES.empty);
  }

  const declaredType = normalizeDeclaredType(file.type);
  if (declaredType && declaredType !== 'application/octet-stream' && !SUPPORTED_TYPES.has(declaredType)) {
    throw new Error(OCR_IMAGE_ERROR_MESSAGES.type);
  }

  if (file.size > limits.maxBytes) {
    throw new Error(OCR_IMAGE_ERROR_MESSAGES.size);
  }

  let metadata;
  try {
    metadata = parseImageMetadata(await readFileBuffer(file));
  } catch {
    throw new Error(OCR_IMAGE_ERROR_MESSAGES.invalid);
  }

  if (!metadata || (declaredType && declaredType !== 'application/octet-stream' && declaredType !== metadata.type)) {
    throw new Error(OCR_IMAGE_ERROR_MESSAGES.invalid);
  }

  assertOcrImageDimensions(metadata.width, metadata.height, limits);

  return { ...metadata, size: file.size };
}

export function assertOcrImageDimensions(width, height, limits = OCR_IMAGE_LIMITS) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(OCR_IMAGE_ERROR_MESSAGES.invalid);
  }

  if (width > limits.maxDimension || height > limits.maxDimension || width * height > limits.maxPixels) {
    throw new Error(OCR_IMAGE_ERROR_MESSAGES.dimensions);
  }
}
