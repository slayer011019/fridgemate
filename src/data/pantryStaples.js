export const PANTRY_STATUS = {
  OWNED: 'owned',
  MISSING: 'missing',
  UNKNOWN: 'unknown'
};

export const PANTRY_STATUS_ORDER = [PANTRY_STATUS.OWNED, PANTRY_STATUS.MISSING, PANTRY_STATUS.UNKNOWN];

const PANTRY_STAPLE_DETAILS = {
  '소금': { id: 'salt', category: 'basic', aliases: ['소금', 'salt'] },
  '설탕': { id: 'sugar', category: 'basic', aliases: ['설탕', 'sugar'] },
  '후추': { id: 'pepper', category: 'basic', aliases: ['후추', 'pepper', 'black pepper'] },
  '식초': { id: 'vinegar', category: 'basic', aliases: ['식초', 'vinegar'] },
  '진간장': { id: 'soy-sauce', category: 'sauce', aliases: ['진간장', '간장', 'soy sauce'] },
  '국간장': { id: 'soup-soy-sauce', category: 'sauce', aliases: ['국간장', 'soup soy sauce'] },
  '된장': { id: 'doenjang', category: 'sauce', aliases: ['된장', 'doenjang'] },
  '고추장': { id: 'gochujang', category: 'sauce', aliases: ['고추장', 'gochujang'] },
  '고춧가루': { id: 'red-pepper-powder', category: 'spice', aliases: ['고춧가루', '고추가루', 'red pepper powder'] },
  '다진 마늘': { id: 'minced-garlic', category: 'basic', aliases: ['다진 마늘', 'minced garlic'] },
  '부침가루': { id: 'frying-mix', category: 'powder', aliases: ['부침가루', 'pancake mix'] },
  '전분': { id: 'starch', category: 'powder', aliases: ['전분', 'starch'] },
  '참깨': { id: 'sesame-seeds', category: 'topping', aliases: ['참깨', 'sesame seeds'] },
  '식용유': { id: 'cooking-oil', category: 'oil', aliases: ['식용유', 'cooking oil'] },
  '참기름': { id: 'sesame-oil', category: 'oil', aliases: ['참기름', 'sesame oil'] },
  '맛술': { id: 'mirin', category: 'sauce', aliases: ['맛술', 'mirin', 'cooking wine'] },
  '물엿': { id: 'starch-syrup', category: 'sweetener', aliases: ['물엿', 'corn syrup'] },
  '올리고당': { id: 'oligosaccharide', category: 'sweetener', aliases: ['올리고당'] },
  '멸치액젓': { id: 'fish-sauce', category: 'sauce', aliases: ['멸치액젓', '액젓', 'fish sauce'] },
  '참치액': { id: 'tuna-sauce', category: 'sauce', aliases: ['참치액'] },
  '쌈장': { id: 'ssamjang', category: 'sauce', aliases: ['쌈장', 'ssamjang'] },
  '새우젓': { id: 'salted-shrimp', category: 'sauce', aliases: ['새우젓'] },
  '들기름': { id: 'perilla-oil', category: 'oil', aliases: ['들기름', 'perilla oil'] },
  '올리브유': { id: 'olive-oil', category: 'oil', aliases: ['올리브유', 'olive oil'] },
  '버터': { id: 'butter', category: 'dairy', aliases: ['버터', 'butter'] },
  '다시다': { id: 'dashida', category: 'stock', aliases: ['다시다'] },
  '다시마': { id: 'kelp', category: 'stock', aliases: ['다시마', 'kelp'] },
  '국물용 멸치': { id: 'stock-anchovy', category: 'stock', aliases: ['국물용 멸치', '멸치'] },
  '치킨스톡': { id: 'stock', category: 'stock', aliases: ['치킨스톡', 'stock', 'chicken stock'] },
  '굴소스': { id: 'oyster-sauce', category: 'sauce', aliases: ['굴소스', 'oyster sauce'] },
  '마요네즈': { id: 'mayonnaise', category: 'sauce', aliases: ['마요네즈', 'mayonnaise'] },
  '케첩': { id: 'ketchup', category: 'sauce', aliases: ['케첩', '케찹', 'ketchup'] },
  '파스타 소스': { id: 'tomato-sauce', category: 'sauce', aliases: ['파스타 소스', '토마토 소스', 'pasta sauce'] },
  '밀가루': { id: 'flour', category: 'powder', aliases: ['밀가루', 'flour'] },
  '카레가루': { id: 'curry-powder', category: 'spice', aliases: ['카레가루', 'curry powder'] },
  '꿀': { id: 'honey', category: 'sweetener', aliases: ['꿀', 'honey'] },
  '다진 생강': { id: 'minced-ginger', category: 'spice', aliases: ['다진 생강', 'minced ginger'] },
  '깨소금': { id: 'sesame-salt', category: 'topping', aliases: ['깨소금'] }
};

export const BASIC_PANTRY_CATEGORIES = [
  {
    title: '기본 양념',
    items: ['소금', '설탕', '후추', '식초']
  },
  {
    title: '장류',
    items: ['진간장', '국간장', '된장', '고추장']
  },
  {
    title: '가루/향미',
    items: ['고춧가루', '다진 마늘', '부침가루', '전분', '참깨']
  },
  {
    title: '기름류',
    items: ['식용유', '참기름']
  },
  {
    title: '단맛/조림',
    items: ['맛술', '물엿', '올리고당']
  },
  {
    title: '액젓/감칠맛',
    items: ['멸치액젓', '참치액']
  }
];

export const EXTRA_PANTRY_CATEGORIES = [
  {
    title: '장류',
    items: ['쌈장', '새우젓']
  },
  {
    title: '기름류',
    items: ['들기름', '올리브유', '버터']
  },
  {
    title: '국물 베이스',
    items: ['다시다', '다시마', '국물용 멸치', '치킨스톡']
  },
  {
    title: '소스류',
    items: ['굴소스', '마요네즈', '케첩', '파스타 소스']
  },
  {
    title: '가루류',
    items: ['밀가루', '카레가루']
  },
  {
    title: '단맛/조림',
    items: ['꿀']
  },
  {
    title: '향신료/향미',
    items: ['다진 생강', '깨소금']
  }
];

function buildPantryStaple(name) {
  const detail = PANTRY_STAPLE_DETAILS[name];

  if (!detail) {
    throw new Error(`Missing pantry staple details for ${name}`);
  }

  return {
    ...detail,
    name
  };
}

function buildCategory(category) {
  return {
    ...category,
    items: category.items.map(buildPantryStaple)
  };
}

export const pantryStapleCategories = [
  ...BASIC_PANTRY_CATEGORIES.map(buildCategory),
  ...EXTRA_PANTRY_CATEGORIES.map(buildCategory)
];

export const basicPantryStapleCategories = BASIC_PANTRY_CATEGORIES.map(buildCategory);
export const extraPantryStapleCategories = EXTRA_PANTRY_CATEGORIES.map(buildCategory);

export const pantryStaples = pantryStapleCategories.flatMap((category) => category.items);

const pantryNameMap = pantryStaples.reduce((map, staple) => {
  staple.aliases.forEach((alias) => {
    map.set(String(alias).trim().toLowerCase(), staple);
  });

  map.set(staple.name.trim().toLowerCase(), staple);
  return map;
}, new Map());

export function getPantryStapleByName(name) {
  return pantryNameMap.get(String(name || '').trim().toLowerCase()) || null;
}

export function getPantryStapleLabel(id) {
  return pantryStaples.find((staple) => staple.id === id)?.name || id;
}
