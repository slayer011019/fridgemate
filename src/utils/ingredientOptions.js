export const ingredientCategories = [
  '\uCC44\uC18C',
  '\uACFC\uC77C',
  '\uC721\uB958',
  '\uD574\uC0B0\uBB3C',
  '\uC720\uC81C\uD488',
  '\uB2EC\uAC40',
  '\uC74C\uB8CC',
  '\uC18C\uC2A4',
  '\uB0C9\uB3D9\uC2DD\uD488',
  '\uC0C1\uC628\uC2DD\uD488',
  '\uAC04\uD3B8\uC2DD',
  '\uAE30\uD0C0'
];

export const storageTypes = ['\uB0C9\uC7A5', '\uB0C9\uB3D9', '\uD32C\uD2B8\uB9AC', '\uC2E4\uC628'];

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
