const categoryLabels = {
  Vegetable: '\uCC44\uC18C',
  Fruit: '\uACFC\uC77C',
  Meat: '\uC721\uB958',
  Seafood: '\uD574\uC0B0\uBB3C',
  Dairy: '\uC720\uC81C\uD488',
  Egg: '\uB2EC\uAC40',
  Drink: '\uC74C\uB8CC',
  Sauce: '\uC18C\uC2A4',
  Frozen: '\uB0C9\uB3D9\uC2DD\uD488',
  Pantry: '\uC0C1\uC628\uC2DD\uD488',
  'Instant Food': '\uAC04\uD3B8\uC2DD',
  Other: '\uAE30\uD0C0',
  '\uCC44\uC18C': '\uCC44\uC18C',
  '\uACFC\uC77C': '\uACFC\uC77C',
  '\uC721\uB958': '\uC721\uB958',
  '\uC721\uB958/\uAC00\uACF5\uC721': '\uC721\uB958/\uAC00\uACF5\uC721',
  '\uD574\uC0B0\uBB3C': '\uD574\uC0B0\uBB3C',
  '\uC720\uC81C\uD488': '\uC720\uC81C\uD488',
  '\uB2EC\uAC40': '\uB2EC\uAC40',
  '\uB450\uBD80/\uCF69\uB958': '\uB450\uBD80/\uCF69\uB958',
  '\uC74C\uB8CC': '\uC74C\uB8CC',
  '\uC18C\uC2A4': '\uC18C\uC2A4',
  '\uC591\uB150/\uC18C\uC2A4': '\uC591\uB150/\uC18C\uC2A4',
  '\uB0C9\uB3D9\uC2DD\uD488': '\uB0C9\uB3D9\uC2DD\uD488',
  '\uC0C1\uC628\uC2DD\uD488': '\uC0C1\uC628\uC2DD\uD488',
  '\uB77C\uBA74/\uBA74\uB958': '\uB77C\uBA74/\uBA74\uB958',
  '\uAC04\uD3B8\uC2DD': '\uAC04\uD3B8\uC2DD',
  '\uAC04\uC2DD': '\uAC04\uC2DD',
  '\uAE30\uD0C0': '\uAE30\uD0C0'
};

const storageLabels = {
  Fridge: '\uB0C9\uC7A5',
  Freezer: '\uB0C9\uB3D9',
  Pantry: '\uD32C\uD2B8\uB9AC',
  'Room Temperature': '\uC2E4\uC628',
  '\uB0C9\uC7A5': '\uB0C9\uC7A5',
  '\uB0C9\uB3D9': '\uB0C9\uB3D9',
  '\uD32C\uD2B8\uB9AC': '\uD32C\uD2B8\uB9AC',
  '\uC2E4\uC628': '\uC2E4\uC628',
  '\uC0C1\uC628': '\uC0C1\uC628'
};

const ingredientLabels = {
  Rice: '\uBC25',
  Kimchi: '\uAE40\uCE58',
  Egg: '\uB2EC\uAC40',
  'Green Onion': '\uB300\uD30C',
  Spam: '\uC2A4\uD338',
  'Sesame Oil': '\uCC38\uAE30\uB984',
  Pasta: '\uD30C\uC2A4\uD0C0',
  Butter: '\uBC84\uD130',
  Garlic: '\uB9C8\uB298',
  'Soy Sauce': '\uAC04\uC7A5',
  Mushroom: '\uBC84\uC12F',
  Parmesan: '\uD30C\uB9C8\uC0B0 \uCE58\uC988',
  Tomato: '\uD1A0\uB9C8\uD1A0',
  Sugar: '\uC124\uD0D5',
  'Canned Tuna': '\uCC38\uCE58\uCEA4',
  Mayonnaise: '\uB9C8\uC694\uB124\uC988',
  Seaweed: '\uAE40',
  Corn: '\uC625\uC218\uC218',
  Onion: '\uC591\uD30C',
  Carrot: '\uB2F9\uADFC',
  Cheese: '\uCE58\uC988',
  Spinach: '\uC2DC\uAE08\uCE58',
  Doenjang: '\uB41C\uC7A5',
  Tofu: '\uB450\uBD80',
  Zucchini: '\uC560\uD638\uBC15',
  'Chili Pepper': '\uACE0\uCD94',
  Chicken: '\uB2ED\uACE0\uAE30',
  Broccoli: '\uBE0C\uB85C\uCF5C\uB9AC',
  'Bell Pepper': '\uD30C\uD504\uB9AC\uCE74',
  Potato: '\uAC10\uC790',
  Milk: '\uC6B0\uC720',
  Bacon: '\uBCA0\uC774\uCEE8',
  Udon: '\uC6B0\uB3D9\uBA74',
  Miso: '\uBBF8\uC18C',
  Cabbage: '\uC591\uBC30\uCD94',
  Flour: '\uBC00\uAC00\uB8E8',
  Pork: '\uB3FC\uC9C0\uACE0\uAE30',
  Yogurt: '\uC694\uAC70\uD2B8',
  Banana: '\uBC14\uB098\uB098',
  Apple: '\uC0AC\uACFC',
  Granola: '\uADF8\uB798\uB180\uB77C',
  Honey: '\uAFC0',
  Bread: '\uC2DD\uBE75',
  Parsley: '\uD30C\uC2AC\uB9AC'
};

export function getCategoryLabel(value) {
  return categoryLabels[value] || value;
}

export function getStorageLabel(value) {
  return storageLabels[value] || value;
}

export function getIngredientLabel(value) {
  return ingredientLabels[value] || value;
}

export function joinIngredientLabels(values = []) {
  return values.map((value) => getIngredientLabel(value)).join(', ');
}
