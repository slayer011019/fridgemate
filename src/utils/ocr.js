import { assertOcrImageDimensions } from './ocr/imageValidation.js';

const DEFAULT_OCR_MODE = 'contrast';
const MAX_PREPROCESS_DIMENSION = 8192;
const MAX_PREPROCESS_PIXELS = 16_000_000;

export function buildLocalOcrAssetPaths(baseUrl = import.meta.env.BASE_URL, origin = window.location.origin) {
  const appBaseUrl = new URL(String(baseUrl || '/'), origin);
  const assetBaseUrl = new URL('ocr/tesseract/', appBaseUrl);

  return {
    workerPath: new URL('worker.min.js', assetBaseUrl).href,
    corePath: new URL('core/', assetBaseUrl).href,
    langPath: new URL('lang/', assetBaseUrl).href
  };
}

function getTestOcrOverride() {
  if (typeof window === 'undefined' || !import.meta.env.DEV) {
    return null;
  }

  const override = window.__FRIDGEMATE_TEST__?.extractTextFromImage;
  return typeof override === 'function' ? override : null;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('\uC774\uBBF8\uC9C0\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.'));
    };

    image.src = imageUrl;
  });
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

function drawScaledImage(image, scale) {
  const canvas = createCanvas(Math.round(image.width * scale), Math.round(image.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('\uC774\uBBF8\uC9C0 \uC804\uCC98\uB9AC\uB97C \uC2DC\uC791\uD560 \uC218 \uC5C6\uC5B4\uC694.');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

function applyPreprocessMode(image, mode) {
  const preferredScale = image.width < 1400 ? 2 : 1.4;
  const pixelScale = Math.sqrt(MAX_PREPROCESS_PIXELS / Math.max(1, image.width * image.height));
  const dimensionScale = MAX_PREPROCESS_DIMENSION / Math.max(1, image.width, image.height);
  const scale = Math.min(preferredScale, pixelScale, dimensionScale);
  const { canvas, context } = drawScaledImage(image, scale);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const grayscale = red * 0.299 + green * 0.587 + blue * 0.114;

    let nextValue = grayscale;

    if (mode === DEFAULT_OCR_MODE) {
      nextValue = grayscale > 185 ? 255 : grayscale < 110 ? 0 : Math.round(grayscale);
    }

    data[index] = nextValue;
    data[index + 1] = nextValue;
    data[index + 2] = nextValue;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function scoreRecognizedText(text) {
  const normalized = String(text || '').trim();

  if (!normalized) {
    return 0;
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const koreanChunks = normalized.match(/[\uAC00-\uD7A3]{2,}/g) || [];
  const quantityMatches = normalized.match(/\d+(?:\uAC1C\uC785|\uAC1C|\uBD09|\uD329|\uAD6C|g|kg|ml|l)/gi) || [];
  const priceMatches = normalized.match(/\d{1,3}(?:,\d{3})*\uC6D0/g) || [];

  return lines.length * 2 + koreanChunks.length * 3 + quantityMatches.length * 2 + priceMatches.length;
}

function normalizeLineText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function extractLineItems(data) {
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const lineItems = [];

  blocks.forEach((block, blockIndex) => {
    (block.paragraphs || []).forEach((paragraph, paragraphIndex) => {
      (paragraph.lines || []).forEach((line, lineIndex) => {
        const text = normalizeLineText(line.text);

        if (!text) {
          return;
        }

        lineItems.push({
          id: `block-${blockIndex}-paragraph-${paragraphIndex}-line-${lineIndex}`,
          text,
          bbox: line.bbox || null,
          confidence: line.confidence || 0,
          words: (line.words || []).map((word, wordIndex) => ({
            id: `word-${blockIndex}-${paragraphIndex}-${lineIndex}-${wordIndex}`,
            text: normalizeLineText(word.text),
            bbox: word.bbox || null,
            confidence: word.confidence || 0
          })),
          source: 'ocr-block'
        });
      });
    });
  });

  return lineItems.sort((left, right) => {
    if (left.bbox && right.bbox) {
      if (left.bbox.y0 !== right.bbox.y0) {
        return left.bbox.y0 - right.bbox.y0;
      }

      return left.bbox.x0 - right.bbox.x0;
    }

    return 0;
  });
}

async function recognizeVariant(worker, source) {
  const result = await worker.recognize(source, {}, { text: true, blocks: true });
  const data = result?.data || {};
  const lineItems = extractLineItems(data);
  const text = data.text || lineItems.map((line) => line.text).join('\n');

  return {
    text,
    lineItems
  };
}

function buildVariantList(image) {
  return [
    {
      key: DEFAULT_OCR_MODE,
      source: applyPreprocessMode(image, DEFAULT_OCR_MODE)
    }
  ];
}

export async function extractTextFromImage(file, options = {}) {
  if (!file) {
    throw new Error('\uC120\uD0DD\uD55C \uC774\uBBF8\uC9C0\uAC00 \uC5C6\uC5B4\uC694.');
  }

  const testOverride = getTestOcrOverride();

  if (testOverride) {
    return testOverride(file, options);
  }

  const { onProgress } = options;
  const { createWorker, PSM } = await import('tesseract.js');
  const image = await loadImageFromFile(file);
  assertOcrImageDimensions(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const variants = buildVariantList(image);
  const assetPaths = buildLocalOcrAssetPaths();

  const worker = await createWorker('kor+eng', 1, {
    ...assetPaths,
    logger: (message) => {
      if (message.status === 'recognizing text' && typeof onProgress === 'function') {
        onProgress(message.progress || 0);
      }
    }
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1'
    });

    let best = {
      mode: '',
      label: '',
      text: '',
      score: -1
    };

    for (const variant of variants) {
      const recognized = await recognizeVariant(worker, variant.source);
      const text = recognized.text || '';
      const score = scoreRecognizedText(text) + recognized.lineItems.length * 2;

      if (score > best.score) {
        best = {
          mode: variant.key,
          text,
          score,
          lineItems: recognized.lineItems
        };
      }
    }

    return best;
  } finally {
    await worker.terminate();
  }
}
