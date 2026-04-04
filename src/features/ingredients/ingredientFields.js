export const ingredientCategories = [
  '채소',
  '과일',
  '육류',
  '해산물',
  '유제품',
  '달걀',
  '음료',
  '소스',
  '냉동식품',
  '상온식품',
  '간편식',
  '기타'
];

export const storageTypes = ['냉장', '냉동', '팬트리', '실온'];

export const defaultIngredientForm = {
  name: '',
  category: ingredientCategories[0],
  storageType: storageTypes[0],
  quantity: '',
  purchaseDate: '',
  expiryDate: '',
  memo: '',
  consumed: false
};
