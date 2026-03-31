export const PANTRY_STATUS = {
  OWNED: 'owned',
  MISSING: 'missing',
  UNKNOWN: 'unknown'
};

export const PANTRY_STATUS_ORDER = [PANTRY_STATUS.OWNED, PANTRY_STATUS.MISSING, PANTRY_STATUS.UNKNOWN];

export const pantryStaples = [
  { id: 'salt', name: '소금', category: 'basic', aliases: ['소금', 'salt'] },
  { id: 'sugar', name: '설탕', category: 'basic', aliases: ['설탕', 'sugar'] },
  { id: 'soy-sauce', name: '간장', category: 'sauce', aliases: ['간장', 'soy sauce'] },
  { id: 'soup-soy-sauce', name: '국간장', category: 'sauce', aliases: ['국간장', 'soup soy sauce'] },
  { id: 'cooking-oil', name: '식용유', category: 'oil', aliases: ['식용유', 'cooking oil'] },
  { id: 'sesame-oil', name: '참기름', category: 'oil', aliases: ['참기름', 'sesame oil'] },
  { id: 'pepper', name: '후추', category: 'basic', aliases: ['후추', 'pepper', 'black pepper'] },
  { id: 'vinegar', name: '식초', category: 'basic', aliases: ['식초', 'vinegar'] },
  { id: 'red-pepper-powder', name: '고춧가루', category: 'spice', aliases: ['고춧가루', 'red pepper powder'] },
  { id: 'doenjang', name: '된장', category: 'sauce', aliases: ['된장', 'doenjang'] },
  { id: 'gochujang', name: '고추장', category: 'sauce', aliases: ['고추장', 'gochujang'] },
  { id: 'minced-garlic', name: '다진 마늘', category: 'basic', aliases: ['다진 마늘', 'minced garlic'] },
  { id: 'olive-oil', name: '올리브유', category: 'oil', aliases: ['올리브유', 'olive oil'] },
  { id: 'oyster-sauce', name: '굴소스', category: 'sauce', aliases: ['굴소스', 'oyster sauce'] },
  { id: 'mirin', name: '맛술', category: 'sauce', aliases: ['맛술', 'mirin', 'cooking wine'] },
  { id: 'stock', name: '치킨스톡', category: 'stock', aliases: ['치킨스톡', '다시다', 'stock', 'chicken stock'] },
  { id: 'ketchup', name: '케첩', category: 'sauce', aliases: ['케첩', 'ketchup'] },
  { id: 'mayonnaise', name: '마요네즈', category: 'sauce', aliases: ['마요네즈', 'mayonnaise'] },
  { id: 'ssamjang', name: '쌈장', category: 'sauce', aliases: ['쌈장', 'ssamjang'] },
  { id: 'fish-sauce', name: '액젓', category: 'sauce', aliases: ['액젓', 'fish sauce'] },
  { id: 'tuna-sauce', name: '참치액', category: 'sauce', aliases: ['참치액'] },
  { id: 'starch-syrup', name: '물엿', category: 'sweetener', aliases: ['물엿', 'corn syrup'] },
  { id: 'oligosaccharide', name: '올리고당', category: 'sweetener', aliases: ['올리고당'] },
  { id: 'sesame-seeds', name: '참깨', category: 'topping', aliases: ['참깨', 'sesame seeds'] },
  { id: 'sesame-salt', name: '깨소금', category: 'topping', aliases: ['깨소금'] },
  { id: 'butter', name: '버터', category: 'dairy', aliases: ['버터', 'butter'] },
  { id: 'flour', name: '밀가루', category: 'powder', aliases: ['밀가루', 'flour'] },
  { id: 'frying-mix', name: '부침가루', category: 'powder', aliases: ['부침가루', 'pancake mix'] },
  { id: 'starch', name: '전분', category: 'powder', aliases: ['전분', 'starch'] },
  { id: 'curry-powder', name: '카레가루', category: 'spice', aliases: ['카레가루', 'curry powder'] },
  { id: 'jjajang-powder', name: '짜장가루', category: 'sauce', aliases: ['짜장가루', 'black bean powder'] },
  { id: 'tomato-sauce', name: '파스타 소스', category: 'sauce', aliases: ['파스타 소스', '토마토 소스', 'pasta sauce'] },
  { id: 'chili-sauce', name: '칠리소스', category: 'sauce', aliases: ['칠리소스', 'chili sauce'] },
  { id: 'mustard', name: '머스타드', category: 'sauce', aliases: ['머스타드', 'mustard'] },
  { id: 'honey', name: '꿀', category: 'sweetener', aliases: ['꿀', 'honey'] },
  { id: 'parsley', name: '파슬리', category: 'herb', aliases: ['파슬리', 'parsley'] }
];

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
