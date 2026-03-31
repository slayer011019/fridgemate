const NAME_NOISE_PATTERN =
  /(\uBC30\uC1A1\uC644\uB8CC|\uBC30\uC1A1\uC911|\uBC30\uC1A1\uC608\uC815|\uB3C4\uCC29|\uC8FC\uBB38|\uC7A5\uBC14\uAD6C\uB2C8\s*\uB2F4\uAE30|\uBC14\uB85C\uAD6C\uB9E4|\uAD6C\uB9E4\uD558\uAE30|\uC7AC\uAD6C\uB9E4|\uC635\uC158\s*\uC120\uD0DD|\uC0C1\uD488\uC815\uBCF4|\uB85C\uCF13\uD504\uB808\uC2DC|\uD310\uB9E4\uC790\uB85C\uCF13|\uB85C\uCF13\s*\uB0B4\uC77C|\uB85C\uCF13\uC9C1\uAD6C|\uB85C\uCF13\uBC30\uC1A1)/g;

const SPACED_NOISE_PATTERNS = [
  /\uBC30\s*\uC1A1\s*\uC644\s*\uB8CC/g,
  /\uBC30\s*\uC1A1\s*\uC911/g,
  /\uBC30\s*\uC1A1\s*\uC608\s*\uC815/g,
  /\uB3C4\s*\uCC29/g,
  /\uC8FC\s*\uBB38/g,
  /\uC7A5\s*\uBC14\s*\uAD6C\s*\uB2C8\s*\uB2F4\s*\uAE30/g,
  /\uBC14\s*\uB85C\s*\uAD6C\s*\uB9E4/g,
  /\uB85C\s*\uCF13\s*\uD504\s*\uB808\s*\uC2DC/g,
  /\uD310\s*\uB9E4\s*\uC790\s*\uB85C\s*\uCF13/g,
  /\uB85C\s*\uCF13\s*\uB0B4\s*\uC77C/g,
  /\uB85C\s*\uCF13\s*\uBC30\s*\uC1A1/g
];

const PRICE_PATTERN = /\d{1,3}(?:,\d{3})*\uC6D0/g;
const SPEC_PATTERN = /(\d+(?:\.\d+)?\s*(?:g|kg|ml|l|L)|\d+\s*(?:\uAC1C\uC785|\uC785|\uAC1C|\uBD09|\uD329|\uBC15\uC2A4|\uAD6C|\uC190|\uC1A1\uC774))/gi;

const OCR_JUNK_PATTERNS = [
  /\b[A-Z]{1,6}\d*[A-Z0-9]*\b/g,
  /\b[A-Z0-9]{1,8}\b/g,
  /\b\d{2,}\b/g,
  /[#=※]+/g,
  /[_:\uFF1A]+/g,
  /[^\w\uAC00-\uD7A3\s()/-]/g
];

const HARD_NOISE_TOKENS = new Set([
  '\uBC30\uC1A1\uC644\uB8CC',
  '\uBC30\uC1A1\uC911',
  '\uBC30\uC1A1\uC608\uC815',
  '\uB3C4\uCC29',
  '\uC8FC\uBB38',
  '\uC7A5\uBC14\uAD6C\uB2C8',
  '\uB2F4\uAE30',
  '\uBC14\uB85C\uAD6C\uB9E4',
  '\uAD6C\uB9E4\uD558\uAE30',
  '\uC7AC\uAD6C\uB9E4',
  '\uB85C\uCF13\uD504\uB808\uC2DC',
  '\uD310\uB9E4\uC790\uB85C\uCF13',
  '\uB85C\uCF13\uB0B4\uC77C',
  '\uB85C\uCF13\uBC30\uC1A1',
  '\uC0C1\uD488\uC815\uBCF4',
  '\uC6D0',
  '\uAC1C',
  '\uC785'
]);

function normalizeSpaces(text) {
  return String(text || '')
    .replace(/[|]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function mergeSpacedHangulTokens(text) {
  const tokens = normalizeSpaces(text).split(' ').filter(Boolean);
  const mergedTokens = [];
  let hangulBuffer = [];

  tokens.forEach((token) => {
    if (/^[\uAC00-\uD7A3]$/.test(token)) {
      hangulBuffer.push(token);
      return;
    }

    if (hangulBuffer.length >= 2) {
      mergedTokens.push(hangulBuffer.join(''));
    } else if (hangulBuffer.length === 1) {
      mergedTokens.push(hangulBuffer[0]);
    }

    hangulBuffer = [];
    mergedTokens.push(token);
  });

  if (hangulBuffer.length >= 2) {
    mergedTokens.push(hangulBuffer.join(''));
  } else if (hangulBuffer.length === 1) {
    mergedTokens.push(hangulBuffer[0]);
  }

  return mergedTokens.join(' ');
}

export function extractSpecTokens(...sources) {
  const specs = sources.flatMap((source) => {
    return [...String(source || '').matchAll(SPEC_PATTERN)].map((match) => match[0].replace(/\s+/g, ''));
  });

  return [...new Set(specs.filter(Boolean))];
}

export function normalizeDisplayName(text) {
  let nextName = mergeSpacedHangulTokens(String(text || ''));

  SPACED_NOISE_PATTERNS.forEach((pattern) => {
    nextName = nextName.replace(pattern, ' ');
  });

  nextName = nextName
    .replace(NAME_NOISE_PATTERN, ' ')
    .replace(PRICE_PATTERN, ' ')
    .replace(SPEC_PATTERN, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ');

  OCR_JUNK_PATTERNS.forEach((pattern) => {
    nextName = nextName.replace(pattern, ' ');
  });

  return normalizeSpaces(nextName)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => /[\uAC00-\uD7A3]/.test(token))
    .filter((token) => !HARD_NOISE_TOKENS.has(token.replace(/\s+/g, '')))
    .filter((token) => token.length >= 2)
    .join(' ')
    .trim();
}
