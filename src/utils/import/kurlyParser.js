import { createFallbackCandidate } from './importCandidates.js';
import { normalizeOcrSourceText } from './ocrSourceDetector.js';

const KURLY_NOISE_PATTERN =
  /(컬리|Kurly|샛별배송|주문\s*내역\s*상세|전체\s*상품\s*다시\s*담기|컬리캐시|컬리멤버스|배송지|결제|주문번호|합계|총\s*상품|쿠폰|적립|할인)/i;
const PRICE_PATTERN = /\d{1,3}(?:,\d{3})+\s*원?/;

function splitKurlyLines(rawText = '') {
  return normalizeOcrSourceText(rawText)
    .replace(/(전체\s*상품\s*다시\s*담기|담기)/g, '\n$1\n')
    .replace(/(\d{1,3}(?:,\d{3})+\s*원?)/g, '\n$1\n')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isKurlyNoise(line) {
  return !line || KURLY_NOISE_PATTERN.test(line) || PRICE_PATTERN.test(line) || /^\d+$/.test(line);
}

export function parseKurlyOrder(rawText = '', today) {
  const lines = splitKurlyLines(rawText);
  const usefulLines = [];
  const ignoredLines = [];
  const candidates = [];
  const seen = new Set();

  lines.forEach((line, index) => {
    if (isKurlyNoise(line)) {
      ignoredLines.push(line);
      return;
    }

    const candidate = createFallbackCandidate(line, index, today);

    if (!candidate) {
      ignoredLines.push(line);
      return;
    }

    const key = String(candidate.normalizedName || candidate.name).toLowerCase().replace(/\s+/g, '');

    if (seen.has(key)) {
      ignoredLines.push(line);
      return;
    }

    seen.add(key);
    usefulLines.push(line);
    candidates.push({
      ...candidate,
      source: 'kurly_order',
      confidence: Math.max(candidate.confidence, 0.65),
      selected: Math.max(candidate.confidence, 0.65) >= 0.7,
      needsReview: candidate.needsReview || candidate.confidence < 0.7
    });
  });

  return {
    lines,
    usefulLines,
    ignoredLines,
    candidates,
    classifiedLines: [],
    rows: [],
    template: {
      id: 'kurly-order',
      confidence: candidates.length ? 'medium' : 'low'
    }
  };
}

