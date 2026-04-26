import { PANTRY_STATUS, pantryStaples } from '../../data/pantryStaples.js';

export const ingredientAliases = {
  대파: ['파', '쪽파'],
  김치: ['배추김치', '묵은지'],
  밥: ['쌀밥', '공깃밥', '남은밥', '즉석밥'],
  계란: ['달걀', '계란 1판', '계란 10구', '특란', '대란'],
  돼지고기: ['삼겹살', '목살', '앞다리살', '뒷다리살', '제육용 돼지고기', '돼지고기 삼겹살', '돼지고기 목살'],
  닭고기: ['닭다리살', '닭안심', '닭봉', '닭정육', '닭가슴살'],
  참치캔: ['참치', '통조림 참치'],
  어묵: ['오뎅'],
  버섯: ['양송이버섯', '느타리버섯', '새송이버섯', '팽이버섯', '표고버섯'],
  파스타면: ['스파게티면', '파스타'],
  우동면: ['냉동우동', '사누키우동', '우동'],
  식빵: ['토스트 식빵', '빵'],
  마요네즈: ['마요'],
  '다진 마늘': ['마늘', '간마늘'],
  식용유: ['포도씨유', '카놀라유', '해바라기유', 'cooking oil'],
  올리브유: ['엑스트라버진 올리브유', 'olive oil'],
  카레가루: ['카레', '고형카레', 'curry powder'],
  국간장: ['조선간장', 'soup soy sauce'],
  요거트: ['그릭요거트', '플레인요거트'],
  떡: ['떡볶이떡'],
  브로콜리: ['브로커리'],
  오이: ['백오이', '오이 1개'],
  감자: ['알감자'],
  애호박: ['호박'],
  파프리카: ['빨간 파프리카', '노란 파프리카'],
  양배추: ['양배추잎'],
  당근: ['당근 1개'],
  양파: ['양파 1개', '적양파'],
  두부: ['부침두부', '찌개두부', '연두부', '순두부', '촌두부'],
  치킨스톡: ['치킨 스톡', 'stock', 'chicken stock', '다시다'],
  '파마산 치즈': ['파르미지아노', '파르메산 치즈'],
  간장: ['soy sauce'],
  소금: ['salt'],
  설탕: ['sugar'],
  후추: ['pepper', 'black pepper'],
  식초: ['vinegar'],
  참기름: ['sesame oil'],
  굴소스: ['oyster sauce'],
  된장: ['doenjang'],
  고추장: ['gochujang'],
  파스타소스: ['파스타 소스', '토마토 소스', 'pasta sauce'],
  꿀: ['honey'],
  버터: ['butter'],
  밀가루: ['flour']
};

function normalizeIngredientKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()[\],./]/g, '');
}

const aliasToCanonical = Object.entries(ingredientAliases).reduce((map, [canonical, aliases]) => {
  map.set(normalizeIngredientKey(canonical), canonical);

  aliases.forEach((alias) => {
    map.set(normalizeIngredientKey(alias), canonical);
  });

  return map;
}, new Map());

pantryStaples.forEach((staple) => {
  aliasToCanonical.set(normalizeIngredientKey(staple.name), staple.name);

  staple.aliases.forEach((alias) => {
    aliasToCanonical.set(normalizeIngredientKey(alias), staple.name);
  });
});

export function normalizeIngredientName(name) {
  const key = normalizeIngredientKey(name);
  return aliasToCanonical.get(key) || String(name || '').trim();
}

export function getItemName(item) {
  if (typeof item === 'string') {
    return item;
  }

  if (item && typeof item === 'object') {
    return item.name || item.normalizedName || '';
  }

  return item;
}

export function uniqueNormalizedIngredients(items = []) {
  const seen = new Set();
  const result = [];

  items.forEach((item) => {
    const normalized = normalizeIngredientName(getItemName(item));

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

export function getOwnedPantryItems(pantryOwnership = {}) {
  return pantryStaples
    .filter((staple) => pantryOwnership[staple.id] === PANTRY_STATUS.OWNED)
    .map((staple) => staple.name);
}

export function resolvePantryItems(options = {}) {
  if (Array.isArray(options)) {
    return options;
  }

  if (Object.prototype.hasOwnProperty.call(options, 'pantryItems')) {
    return Array.isArray(options.pantryItems) ? options.pantryItems : [];
  }

  if (options.pantryOwnership && typeof options.pantryOwnership === 'object') {
    return getOwnedPantryItems(options.pantryOwnership);
  }

  return [];
}
