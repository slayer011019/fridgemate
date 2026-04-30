import { ingredientCategories, storageTypes } from '../ingredientOptions.js';

const CATEGORY_OTHER = '\uAE30\uD0C0';
const STORAGE_FRIDGE = '\uB0C9\uC7A5';
const STORAGE_FREEZER = '\uB0C9\uB3D9';
const STORAGE_PANTRY = '\uD32C\uD2B8\uB9AC';

const categoryRules = [
  { keywords: ['tofu', '\uB450\uBD80', '\uC21C\uB450\uBD80', '\uC5F0\uB450\uBD80'], category: CATEGORY_OTHER },
  { keywords: ['egg', 'eggs', '\uACC4\uB780', '\uB2EC\uAC40', '\uD2B9\uB780', '\uB300\uB780'], category: '\uB2EC\uAC40' },
  { keywords: ['milk', 'cheese', 'yogurt', 'butter', '\uC6B0\uC720', '\uCE58\uC988', '\uC694\uAC70\uD2B8', '\uBC84\uD130'], category: '\uC720\uC81C\uD488' },
  {
    keywords: [
      'onion',
      'carrot',
      'cabbage',
      'tomato',
      'lettuce',
      'spinach',
      'broccoli',
      'potato',
      'cucumber',
      'chive',
      'mushroom',
      '\uAC10\uC790',
      '\uC591\uD30C',
      '\uB2F9\uADFC',
      '\uBC30\uCD94',
      '\uD1A0\uB9C8\uD1A0',
      '\uC0C1\uCD94',
      '\uC2DC\uAE08\uCE58',
      '\uBE0C\uB85C\uCF5C\uB9AC',
      '\uC591\uBC30\uCD94',
      '\uBD80\uCD94',
      '\uC624\uC774',
      '\uBC84\uC12F',
      '\uB290\uD0C0\uB9AC\uBC84\uC12F',
      '\uD45C\uACE0\uBC84\uC12F',
      '\uC0C8\uC1A1\uC774'
    ],
    category: '\uCC44\uC18C'
  },
  {
    keywords: [
      'apple',
      'banana',
      'grape',
      'orange',
      'strawberry',
      'pear',
      '\uC0AC\uACFC',
      '\uBC14\uB098\uB098',
      '\uD3EC\uB3C4',
      '\uC624\uB80C\uC9C0',
      '\uB538\uAE30',
      '\uBC30'
    ],
    category: '\uACFC\uC77C'
  },
  { keywords: ['pork', 'beef', 'chicken', 'ham', 'bacon', '\uB3FC\uC9C0', '\uC18C\uACE0\uAE30', '\uC1E0\uACE0\uAE30', '\uB2ED', '\uBCA0\uC774\uCEE8'], category: '\uC721\uB958' },
  {
    keywords: [
      'shrimp',
      'fish',
      'salmon',
      'tuna',
      'crab',
      '\uC0C8\uC6B0',
      '\uC0DD\uC120',
      '\uC5F0\uC5B4',
      '\uCC38\uCE58',
      '\uACE0\uB4F1\uC5B4',
      '\uD06C\uB798\uBBF8',
      '\uC5B4\uBB35'
    ],
    category: '\uD574\uC0B0\uBB3C'
  },
  { keywords: ['cola', 'juice', 'soda', 'coffee', 'tea', '\uCF5C\uB77C', '\uC8FC\uC2A4', '\uD0C4\uC0B0\uC218', '\uCEE4\uD53C', '\uCC28', '\uC0DD\uC218'], category: '\uC74C\uB8CC' },
  {
    keywords: [
      'sauce',
      'ketchup',
      'mayo',
      'mayonnaise',
      'soy sauce',
      'doenjang',
      'gochujang',
      '\uC18C\uC2A4',
      '\uCF00\uCC29',
      '\uCF00\uCCB1',
      '\uB9C8\uC694',
      '\uAC04\uC7A5',
      '\uB41C\uC7A5',
      '\uACE0\uCD94\uC7A5'
    ],
    category: '\uC18C\uC2A4'
  },
  { keywords: ['dumpling', 'fried rice', 'ice cream', 'frozen', '\uB0C9\uB3D9', '\uB9CC\uB450', '\uBCF6\uC74C\uBC25', '\uC544\uC774\uC2A4\uD06C\uB9BC'], category: '\uB0C9\uB3D9\uC2DD\uD488' },
  { keywords: ['ramen', 'cup noodle', 'noodle', 'instant', '\uB77C\uBA74', '\uCEF5\uB77C\uBA74', '\uAD6D\uC218'], category: '\uAC04\uD3B8\uC2DD' }
];

const storageRules = [
  { keywords: ['tofu', '\uB450\uBD80', '\uC21C\uB450\uBD80', '\uC5F0\uB450\uBD80'], storageType: STORAGE_FRIDGE },
  {
    keywords: [
      'milk',
      'egg',
      'eggs',
      'yogurt',
      'cheese',
      '\uC6B0\uC720',
      '\uACC4\uB780',
      '\uB2EC\uAC40',
      '\uC694\uAC70\uD2B8',
      '\uCE58\uC988',
      '\uD06C\uB798\uBBF8',
      '\uC5B4\uBB35',
      '\uBD80\uCD94',
      '\uC624\uC774',
      '\uBC84\uC12F',
      '\uC0AC\uACFC',
      '\uBC30'
    ],
    storageType: STORAGE_FRIDGE
  },
  { keywords: ['ice cream', 'dumpling', 'frozen', '\uB0C9\uB3D9', '\uB9CC\uB450', '\uC544\uC774\uC2A4\uD06C\uB9BC'], storageType: STORAGE_FREEZER },
  { keywords: ['ramen', 'canned', 'snack', 'sauce', 'bean', 'rice', '\uB77C\uBA74', '\uD1B5\uC870\uB9BC', '\uACFC\uC790', '\uC18C\uC2A4', '\uC300'], storageType: STORAGE_PANTRY }
];

function includesKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function guessCategory(name) {
  const normalizedName = String(name || '').trim().toLowerCase();
  const rule = categoryRules.find((entry) => includesKeyword(normalizedName, entry.keywords));
  return rule?.category || ingredientCategories[ingredientCategories.length - 1];
}

export function guessStorageType(name, category) {
  const normalizedName = String(name || '').trim().toLowerCase();
  const rule = storageRules.find((entry) => includesKeyword(normalizedName, entry.keywords));

  if (rule) {
    return rule.storageType;
  }

  if (category === '\uB0C9\uB3D9\uC2DD\uD488') {
    return STORAGE_FREEZER;
  }

  if (
    category === '\uC0C1\uC628\uC2DD\uD488' ||
    category === '\uC18C\uC2A4' ||
    category === '\uC591\uB150/\uC18C\uC2A4' ||
    category === '\uAC04\uD3B8\uC2DD' ||
    category === '\uB77C\uBA74/\uBA74\uB958' ||
    category === '\uAC04\uC2DD' ||
    category === '\uC74C\uB8CC'
  ) {
    return STORAGE_PANTRY;
  }

  if (
    category === '\uC720\uC81C\uD488' ||
    category === '\uB2EC\uAC40' ||
    category === '\uB450\uBD80/\uCF69\uB958' ||
    category === '\uC721\uB958' ||
    category === '\uC721\uB958/\uAC00\uACF5\uC721' ||
    category === '\uD574\uC0B0\uBB3C' ||
    category === '\uCC44\uC18C' ||
    category === '\uACFC\uC77C'
  ) {
    return STORAGE_FRIDGE;
  }

  return storageTypes[0];
}
