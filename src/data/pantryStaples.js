export const PANTRY_STATUS = {
  OWNED: 'owned',
  MISSING: 'missing',
  UNKNOWN: 'unknown'
};

export const PANTRY_STATUS_ORDER = [PANTRY_STATUS.OWNED, PANTRY_STATUS.MISSING, PANTRY_STATUS.UNKNOWN];

export const pantryStaples = [
  { id: 'salt', name: '\uC18C\uAE08', category: 'basic', aliases: ['\uC18C\uAE08', 'salt'] },
  { id: 'sugar', name: '\uC124\uD0D5', category: 'basic', aliases: ['\uC124\uD0D5', 'sugar'] },
  { id: 'soy-sauce', name: '\uAC04\uC7A5', category: 'sauce', aliases: ['\uAC04\uC7A5', 'soy sauce'] },
  { id: 'soup-soy-sauce', name: '\uAD6D\uAC04\uC7A5', category: 'sauce', aliases: ['\uAD6D\uAC04\uC7A5', 'soup soy sauce'] },
  { id: 'cooking-oil', name: '\uC2DD\uC6A9\uC720', category: 'oil', aliases: ['\uC2DD\uC6A9\uC720', 'cooking oil'] },
  { id: 'sesame-oil', name: '\uCC38\uAE30\uB984', category: 'oil', aliases: ['\uCC38\uAE30\uB984', 'sesame oil'] },
  { id: 'pepper', name: '\uD6C4\uCD94', category: 'basic', aliases: ['\uD6C4\uCD94', 'pepper', 'black pepper'] },
  { id: 'vinegar', name: '\uC2DD\uCD08', category: 'basic', aliases: ['\uC2DD\uCD08', 'vinegar'] },
  { id: 'red-pepper-powder', name: '\uACE0\uCD27\uAC00\uB8E8', category: 'spice', aliases: ['\uACE0\uCD27\uAC00\uB8E8', 'red pepper powder'] },
  { id: 'doenjang', name: '\uB41C\uC7A5', category: 'sauce', aliases: ['\uB41C\uC7A5', 'doenjang'] },
  { id: 'gochujang', name: '\uACE0\uCD94\uC7A5', category: 'sauce', aliases: ['\uACE0\uCD94\uC7A5', 'gochujang'] },
  { id: 'minced-garlic', name: '\uB2E4\uC9C4 \uB9C8\uB298', category: 'basic', aliases: ['\uB2E4\uC9C4 \uB9C8\uB298', 'minced garlic'] },
  { id: 'olive-oil', name: '\uC62C\uB9AC\uBE0C\uC720', category: 'oil', aliases: ['\uC62C\uB9AC\uBE0C\uC720', 'olive oil'] },
  { id: 'oyster-sauce', name: '\uAD74\uC18C\uC2A4', category: 'sauce', aliases: ['\uAD74\uC18C\uC2A4', 'oyster sauce'] },
  { id: 'mirin', name: '\uB9DB\uC220', category: 'sauce', aliases: ['\uB9DB\uC220', 'mirin', 'cooking wine'] },
  { id: 'stock', name: '\uCE58\uD0A8\uC2A4\uD1A1', category: 'stock', aliases: ['\uCE58\uD0A8\uC2A4\uD1A1', '\uB2E4\uC2DC\uB2E4', 'stock', 'chicken stock'] },
  { id: 'ketchup', name: '\uCF00\uCC29', category: 'sauce', aliases: ['\uCF00\uCC29', 'ketchup'] },
  { id: 'mayonnaise', name: '\uB9C8\uC694\uB124\uC988', category: 'sauce', aliases: ['\uB9C8\uC694\uB124\uC988', 'mayonnaise'] },
  { id: 'ssamjang', name: '\uC30C\uC7A5', category: 'sauce', aliases: ['\uC30C\uC7A5', 'ssamjang'] },
  { id: 'fish-sauce', name: '\uC561\uC82F', category: 'sauce', aliases: ['\uC561\uC82F', 'fish sauce'] },
  { id: 'tuna-sauce', name: '\uCC38\uCE58\uC561', category: 'sauce', aliases: ['\uCC38\uCE58\uC561'] },
  { id: 'starch-syrup', name: '\uBB3C\uC5FF', category: 'sweetener', aliases: ['\uBB3C\uC5FF', 'corn syrup'] },
  { id: 'oligosaccharide', name: '\uC62C\uB9AC\uACE0\uB2F9', category: 'sweetener', aliases: ['\uC62C\uB9AC\uACE0\uB2F9'] },
  { id: 'sesame-seeds', name: '\uCC38\uAE68', category: 'topping', aliases: ['\uCC38\uAE68', 'sesame seeds'] },
  { id: 'sesame-salt', name: '\uAE68\uC18C\uAE08', category: 'topping', aliases: ['\uAE68\uC18C\uAE08'] },
  { id: 'butter', name: '\uBC84\uD130', category: 'dairy', aliases: ['\uBC84\uD130', 'butter'] },
  { id: 'flour', name: '\uBC00\uAC00\uB8E8', category: 'powder', aliases: ['\uBC00\uAC00\uB8E8', 'flour'] },
  { id: 'frying-mix', name: '\uBD80\uCE68\uAC00\uB8E8', category: 'powder', aliases: ['\uBD80\uCE68\uAC00\uB8E8', 'pancake mix'] },
  { id: 'starch', name: '\uC804\uBD84', category: 'powder', aliases: ['\uC804\uBD84', 'starch'] },
  { id: 'curry-powder', name: '\uCE74\uB808\uAC00\uB8E8', category: 'spice', aliases: ['\uCE74\uB808\uAC00\uB8E8', 'curry powder'] },
  { id: 'jjajang-powder', name: '\uC9DC\uC7A5\uAC00\uB8E8', category: 'sauce', aliases: ['\uC9DC\uC7A5\uAC00\uB8E8', 'black bean powder'] },
  { id: 'tomato-sauce', name: '\uD30C\uC2A4\uD0C0 \uC18C\uC2A4', category: 'sauce', aliases: ['\uD30C\uC2A4\uD0C0 \uC18C\uC2A4', '\uD1A0\uB9C8\uD1A0 \uC18C\uC2A4', 'pasta sauce'] },
  { id: 'chili-sauce', name: '\uCE60\uB9AC\uC18C\uC2A4', category: 'sauce', aliases: ['\uCE60\uB9AC\uC18C\uC2A4', 'chili sauce'] },
  { id: 'mustard', name: '\uBA38\uC2A4\uD0C0\uB4DC', category: 'sauce', aliases: ['\uBA38\uC2A4\uD0C0\uB4DC', 'mustard'] },
  { id: 'honey', name: '\uAFC0', category: 'sweetener', aliases: ['\uAFC0', 'honey'] },
  { id: 'parsley', name: '\uD30C\uC2AC\uB9AC', category: 'herb', aliases: ['\uD30C\uC2AC\uB9AC', 'parsley'] }
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
