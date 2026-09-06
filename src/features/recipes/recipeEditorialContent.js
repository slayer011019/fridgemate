import { getPublicRecipePath, publicRecipeCatalog } from './publicRecipeCatalog.js';

// Editorial annotations are kept apart from the imported MFDS catalog so an
// import cannot overwrite them. Amounts and preparation notes were checked
// against the catalog on this date; this is not a record of cooking trials.
const REVIEWED_AT = '2026-09-06';
const ingredient = (name, amount, role = 'main', aliases = []) => ({ name, amount, role, aliases });

const EDITORIAL_DEFINITIONS = [
  {
    recipeId: '28',
    selectionReason: '연두부와 달걀을 함께 쓰고 싶고, 새우와 생크림도 준비할 수 있을 때 고르세요. 연두부 75g을 달걀 30g과 갈아 찌는 방식이라 두 재료만으로 완성되는 기본 계란찜과는 준비물이 다릅니다.',
    ingredients: [
      ingredient('연두부', '75g'), ingredient('칵테일새우', '20g'), ingredient('달걀', '30g', 'main', ['계란']),
      ingredient('생크림', '13g'), ingredient('설탕', '5g', 'seasoning'), ingredient('무염버터', '5g', 'seasoning'),
      ingredient('시금치', '10g', 'garnish')
    ],
    equipment: ['믹서', '찜기', '찜기에 들어가는 그릇', '새우를 데칠 냄비'],
    preparationNotes: [
      '원문은 새우를 먼저 데친 뒤, 갈아 놓은 연두부·달걀 혼합물에 섞습니다. 모든 재료를 한꺼번에 믹서에 넣는 순서가 아닙니다.',
      '시금치는 원문에서 고명으로 구분합니다. 새우·연두부·달걀 혼합물과 별도로 잘게 다져 위에 올립니다.',
      '원문의 약 10분은 찜기에 넣은 뒤의 시간입니다. 새우 데치기와 믹서 준비까지 포함한 전체 조리 시간으로 보지 마세요.'
    ],
    substitutionNotes: [
      '일반 두부나 순두부로 바꾸는 비율은 원문에 없습니다. 연두부가 없다면 같은 분량으로 자동 대체하지 말고 해당 종류를 쓰는 다른 레시피를 비교하세요.',
      '생크림을 우유로, 무염버터를 가염버터로 바꾸는 방법은 확인되지 않았습니다. 원문대로 만들 때는 두 재료를 구매 목록에 포함하세요.'
    ],
    relatedRecipeIds: ['91', '32']
  },
  {
    recipeId: '32',
    selectionReason: '순두부가 조금 남고 오이와 사과를 함께 쓰고 싶을 때 살펴보세요. 순두부 40g은 소스에, 오이 70g은 무침에 쓰므로 순두부를 많이 소진하려는 경우에는 순두부찌개와 사용량을 비교하는 편이 좋습니다.',
    ingredients: [
      ingredient('오이', '70g'), ingredient('다진 땅콩', '10g'), ingredient('순두부', '40g'), ingredient('사과', '50g'),
      ingredient('소금', '오이 세척용 · 원문 분량 없음', 'seasoning')
    ],
    equipment: ['믹서', '칼·도마', '무침 그릇'],
    preparationNotes: [
      '사과와 순두부를 먼저 갈아 소스를 만든 다음, 씨를 제거하고 썬 오이에 버무립니다. 두부를 덩어리째 넣는 무침이 아닙니다.',
      '다진 땅콩은 마지막에 뿌리는 순서입니다. 원문 재료표에는 없는 세척용 소금이 2단계에 등장하므로 준비 목록에 함께 표시했습니다.'
    ],
    substitutionNotes: [
      '연두부와 순두부는 여기서 같은 재료로 처리하지 않습니다. 소스의 대체 비율이나 결과는 원문에 없어, 순두부를 기준으로 준비하세요.',
      '땅콩을 다른 견과로 바꾸거나 사과를 다른 과일로 바꾸는 조리법은 제공되지 않습니다. 해당 재료를 먹지 않는다면 다른 메뉴를 선택하세요.'
    ],
    relatedRecipeIds: ['282', '28']
  },
  {
    recipeId: '91',
    selectionReason: '새송이버섯과 소량의 연두부를 함께 쓰되, 국물보다 구이를 고르고 싶을 때 맞는 후보입니다. 연두부는 30g만 사용하지만 소스에 오이피클·레몬즙·머스터드 등이 들어가므로 양념 보유 여부가 선택을 좌우합니다.',
    ingredients: [
      ingredient('새송이버섯', '70g'), ingredient('올리브유', '구이 10g + 소스 2g', 'seasoning'),
      ingredient('치커리', '10g', 'garnish'), ingredient('연두부', '30g'), ingredient('다진 양파', '10g'),
      ingredient('다진 오이피클', '10g'), ingredient('식초', '5g', 'seasoning'), ingredient('레몬즙', '3g', 'seasoning'),
      ingredient('머스터드', '3g', 'seasoning'), ingredient('꿀', '2g', 'seasoning'), ingredient('흰 후추', '약간', 'seasoning', ['흰후추'])
    ],
    equipment: ['프라이팬', '칼·도마', '소스 그릇'],
    preparationNotes: [
      '원문은 다진 양파와 오이피클의 물기를 먼저 짜고 연두부 소스를 만듭니다. 소스를 준비한 뒤 버섯을 0.5cm 두께로 썰어 굽는 순서입니다.',
      '올리브유는 구이용 10g과 소스용 2g으로 나뉩니다. 전체 분량을 한쪽에 모두 넣지 않도록 나눠 준비하세요.',
      '치커리는 원문에서 곁들임으로 표시합니다. 버섯과 소스에 필요한 재료와 구분해 준비할 수 있습니다.'
    ],
    substitutionNotes: [
      '새송이버섯 대신 표고·느타리를 굽는 두께나 시간은 원문에 없습니다. 표고 또는 느타리만 남았다면 아래의 해당 버섯 국 레시피를 비교하세요.',
      '오이피클은 소스 재료이며 생오이로 바꾸는 비율은 확인되지 않았습니다. 집에 생오이만 있다는 이유로 준비된 재료로 세지 않습니다.'
    ],
    relatedRecipeIds: ['38', '674']
  },
  {
    recipeId: '38',
    selectionReason: '표고버섯과 청경채를 함께 쓰고 맑은 국을 고르고 싶을 때 비교하세요. 표고버섯 20g을 쓰며, 순두부찌개에 필요한 들깻가루·찹쌀가루 없이 멸치·다시마 육수와 국간장을 준비하는 구성입니다.',
    ingredients: [
      ingredient('국물용 멸치', '5g', 'main', ['국멸치']), ingredient('다시마', '1장 (5×1cm)'),
      ingredient('양파', '10g'), ingredient('표고버섯 기둥', '원문 분량 없음'), ingredient('국간장', '5g', 'seasoning'),
      ingredient('물', '300ml', 'water'), ingredient('청경채', '20g'), ingredient('표고버섯', '20g'),
      ingredient('다진 마늘', '2g', 'seasoning', ['다진마늘'])
    ],
    equipment: ['냄비', '육수 건더기를 건질 체 또는 국자', '칼·도마'],
    preparationNotes: [
      '표고버섯 기둥은 육수에 쓰이고, 썬 버섯과 청경채는 육수 건더기를 건진 뒤 넣습니다. 손질할 때 기둥을 먼저 버리지 않도록 순서를 확인하세요.',
      '원문의 10분 정도는 육수를 끓이는 단계의 안내입니다. 채소를 손질하고 다시 끓이는 단계가 이어집니다.'
    ],
    substitutionNotes: [
      '국간장을 일반 간장과 같은 양으로 바꾸는 안내는 원문에 없습니다. 국간장을 따로 확인해야 원문의 준비 목록과 맞습니다.',
      '청경채를 다른 잎채소로 바꾸는 조리 조건도 제공되지 않습니다. 감자와 느타리가 남았다면 감자느타리버섯국이 그 재료를 명시한 다른 선택지입니다.'
    ],
    relatedRecipeIds: ['674', '282']
  },
  {
    recipeId: '282',
    selectionReason: '순두부와 애호박·감자·양파를 조금씩 함께 쓸 때 살펴보세요. 순두부 100g에 여러 채소를 넣는 구성입니다. 표고버섯은 머리 3g과 밑동 3g을 쓰므로 버섯 한 팩을 많이 쓰는 메뉴로 보기는 어렵습니다.',
    ingredients: [
      ingredient('표고버섯', '3g'), ingredient('애호박', '10g'), ingredient('감자', '10g'), ingredient('양파', '3g'),
      ingredient('미나리', '3g'), ingredient('부추', '1g'), ingredient('대파', '1g'), ingredient('청양고추', '1g'),
      ingredient('순두부', '100g'), ingredient('다시마', '3g'), ingredient('표고버섯 밑동', '3g'), ingredient('물', '250g', 'water'),
      ingredient('저염된장', '5g', 'seasoning'), ingredient('찹쌀가루', '3g', 'seasoning'),
      ingredient('다진 마늘', '1g', 'seasoning', ['다진마늘']), ingredient('들깻가루', '7g', 'seasoning'),
      ingredient('저염국간장', '1g', 'seasoning')
    ],
    equipment: ['냄비', '육수 건더기를 건질 체 또는 국자', '칼·도마'],
    preparationNotes: [
      '표고버섯 머리와 밑동을 분리해, 밑동과 다시마로 먼저 육수를 만듭니다. 버섯 머리는 애호박과 함께 뒤에 넣습니다.',
      '감자는 저염된장·찹쌀가루를 푼 육수에 먼저 넣고, 순두부와 양파는 그 뒤에 넣는 순서입니다.',
      '미나리·부추·대파·청양고추는 마지막에 올리지만 원문 재료표에는 필수 재료로 묶여 있습니다. 자동으로 생략 가능한 고명으로 분류하지 않았습니다.'
    ],
    substitutionNotes: [
      '저염된장과 저염국간장을 일반 제품으로 바꾸는 양은 원문에 없습니다. 일반 된장·간장 보유만으로 모두 준비됐다고 판단하지 않습니다.',
      '들깻가루와 찹쌀가루를 빼는 조리법도 제공되지 않습니다. 두 재료가 없다면 멸치 육수를 쓰는 표고버섯 청경채국과 추가 구매량을 비교하세요.'
    ],
    relatedRecipeIds: ['32', '38']
  },
  {
    recipeId: '674',
    selectionReason: '감자와 느타리버섯을 함께 쓰면서 두부도 조금 곁들이고 싶을 때 고르세요. 원문에서 감자는 30g, 느타리버섯은 15g, 두부는 8g을 쓰므로 남은 재료를 전부 넣기 전에 원문 분량과 비교해야 합니다.',
    ingredients: [
      ingredient('감자', '30g'), ingredient('느타리버섯', '15g'), ingredient('두부', '8g'), ingredient('대파', '5g', 'main', ['파']),
      ingredient('물', '300g', 'water'), ingredient('국멸치', '5g', 'main', ['국물용 멸치']), ingredient('홍고추', '3g', 'main', ['붉은 고추']),
      ingredient('건다시마', '3g'), ingredient('다진 마늘', '3g', 'seasoning', ['다진마늘']), ingredient('소금', '0.5g', 'seasoning')
    ],
    equipment: ['국을 끓일 냄비', '버섯을 데칠 냄비', '칼·도마'],
    preparationNotes: [
      '느타리버섯은 끓는 물에 데친 뒤 찢는 단계가 따로 있습니다. 육수에 생버섯부터 바로 넣는 순서와 구분하세요.',
      '육수에 쓴 다시마를 채 썰어 마지막 고명으로 다시 활용합니다. 육수를 낸 뒤 버리지 않고 따로 두면 원문 순서를 이어갈 수 있습니다.',
      '재료표의 물은 300g이고, 5단계에는 만든 국물 1컵을 사용한다고 적혀 있습니다. 준비한 육수 전체를 넣는 것으로 바꾸지 말고 원문 단계를 확인하세요.'
    ],
    substitutionNotes: [
      '두부는 채 써는 단계에 들어갑니다. 연두부나 순두부로 바꿨을 때의 손질법은 원문에 없어 같은 재료로 취급하지 않습니다.',
      '멸치를 빼거나 다른 육수로 바꾸는 방법은 제공되지 않습니다. 국물 준비 재료까지 확인한 뒤 메뉴를 정하세요.'
    ],
    relatedRecipeIds: ['38', '91']
  }
];

export const featuredRecipeEditorials = Object.freeze(EDITORIAL_DEFINITIONS.map((entry) => {
  const recipe = publicRecipeCatalog.find((item) => item.externalId === entry.recipeId);
  if (!recipe) throw new Error(`Editorial recipe ${entry.recipeId} is missing from the public catalog.`);
  return Object.freeze({ ...entry, reviewedAt: REVIEWED_AT, recipe, path: getPublicRecipePath(recipe) });
}));

export function getRecipeEditorial(recipeOrId) {
  const recipeId = String(typeof recipeOrId === 'object' ? recipeOrId?.externalId : recipeOrId || '');
  return featuredRecipeEditorials.find((entry) => entry.recipeId === recipeId) || null;
}

export const editorialReviewNote = '오늘뭐먹지의 메뉴 선택 설명입니다. 식약처 원문 재료·조리 단계와 대조했으며, 직접 조리한 후기나 대체 조리 실험 결과는 아닙니다.';
