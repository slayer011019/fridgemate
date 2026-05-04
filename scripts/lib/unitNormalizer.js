export const UNIT_NORMALIZE_MAP = {
  Ts: '큰술',
  ts: '작은술',
  T: '큰술',
  t: '작은술',
  cc: 'ml',
  '㎖': 'ml',
  '㎗': 'dl',
  '㎘': 'L',
  '㎎': 'mg',
  '㎏': 'kg',
  '㎝': 'cm',
  '㎞': 'km',
  종: '개',
  토막: '개',
  조각: '개',
  꼬집: '약간',
  한줌: '약간',
  조금: '약간',
  다수: '약간'
};

export const BASE_UNIT_TOKENS = [
  'g', 'kg', 'ml', 'L', 'l', '개', '알', '마리', '장', '줄기', '뿌리', '쪽', '포기', '모', '컵',
  '큰술', '작은술', '숟가락', '스푼', '티스푼', '약간', '적당량', '봉', '팩', '통', '캔', '병', '묶음', '단', '인분'
];

export const ALL_UNIT_TOKENS = [...new Set([...BASE_UNIT_TOKENS, ...Object.keys(UNIT_NORMALIZE_MAP)])].sort(
  (left, right) => right.length - left.length
);

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildUnitAlternation() {
  return ALL_UNIT_TOKENS.map(escapeRegExp).join('|');
}

export function normalizeUnit(unit) {
  return UNIT_NORMALIZE_MAP[unit] || unit || null;
}
