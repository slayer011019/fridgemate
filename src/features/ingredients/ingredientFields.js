export const ingredientCategories = [
  '채소',
  '과일',
  '육류',
  '육류/가공육',
  '해산물',
  '유제품',
  '달걀',
  '두부/콩류',
  '음료',
  '소스',
  '양념/소스',
  '냉동식품',
  '상온식품',
  '라면/면류',
  '간편식',
  '간식',
  '기타'
];

export const storageTypes = ['냉장', '냉동', '팬트리', '실온', '상온'];

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
