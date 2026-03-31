const NORMALIZE_RULES = [
  { keywords: ['\uD2B9\uB780', '\uB300\uB780', '\uB2EC\uAC40', '\uACC4\uB780'], normalizedName: '\uACC4\uB780' },
  { keywords: ['\uCD0C\uB450\uBD80', '\uC21C\uB450\uBD80', '\uC5F0\uB450\uBD80', '\uCC0C\uAC1C\uC6A9 \uB450\uBD80', '\uBD80\uCE68\uC6A9 \uB450\uBD80', '\uB450\uBD80'], normalizedName: '\uB450\uBD80' },
  { keywords: ['\uBD80\uCD94'], normalizedName: '\uBD80\uCD94' },
  { keywords: ['\uAC10\uC790'], normalizedName: '\uAC10\uC790' },
  { keywords: ['\uBC31\uC624\uC774', '\uC624\uC774'], normalizedName: '\uC624\uC774' },
  { keywords: ['\uB290\uD0C0\uB9AC\uBC84\uC12F', '\uD45C\uACE0\uBC84\uC12F', '\uC0C8\uC1A1\uC774\uBC84\uC12F', '\uBC84\uC12F'], normalizedName: '\uBC84\uC12F' },
  { keywords: ['\uD06C\uB798\uBBF8'], normalizedName: '\uD06C\uB798\uBBF8' },
  { keywords: ['\uC5B4\uBB35', '\uBD80\uC0B0\uC5B4\uBB35'], normalizedName: '\uC5B4\uBB35' },
  { keywords: ['\uC0AC\uACFC'], normalizedName: '\uC0AC\uACFC' },
  { keywords: ['\uBC30'], normalizedName: '\uBC30' },
  { keywords: ['\uC591\uD30C'], normalizedName: '\uC591\uD30C' },
  { keywords: ['\uB2F9\uADFC'], normalizedName: '\uB2F9\uADFC' },
  { keywords: ['\uC6B0\uC720'], normalizedName: '\uC6B0\uC720' }
];

export function normalizeIngredientName(displayName) {
  const normalizedText = String(displayName || '').trim();
  const matchedRule = NORMALIZE_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalizedText.includes(keyword))
  );

  return matchedRule?.normalizedName || normalizedText;
}
