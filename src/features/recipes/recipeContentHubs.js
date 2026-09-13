import { getPublicRecipePath, publicRecipeCatalog } from './publicRecipeCatalog.js';
import { getRecipeEditorial } from './recipeEditorialContent.js';

const INGREDIENT_HUB_DEFINITIONS = [
  {
    slug: 'tofu',
    name: '두부',
    keywords: ['두부', '연두부', '순두부'],
    title: '두부로 만드는 메뉴와 레시피 | 오늘뭐먹지',
    heading: '두부로 만들기 좋은 메뉴를 모아봤어요',
    description: '연두부 계란찜·순두부 오이무침·두부 소스를 사용량, 추가 재료와 도구로 비교하고 실제 조리법을 확인하세요.',
    comparison: {
      intro: '포장에 적힌 두부 종류부터 확인하세요. 아래 세 메뉴는 두부 종류와 쓰는 양이 달라, 집에 있는 두부를 같은 양으로 서로 바꿔 넣는 조리법으로 볼 수 없습니다.',
      rows: [
        { recipeId: '28', usage: '연두부 75g', additionalIngredients: '칵테일새우·달걀·생크림, 설탕·무염버터, 시금치 고명', decision: '달걀도 함께 쓰고 찜기와 믹서를 꺼낼 수 있을 때' },
        { recipeId: '32', usage: '순두부 40g', additionalIngredients: '오이·사과·다진 땅콩, 세척용 소금', decision: '순두부를 소스로 쓰고 오이와 사과도 함께 활용할 때' },
        { recipeId: '91', usage: '연두부 30g', additionalIngredients: '새송이버섯·양파·오이피클과 소스 양념, 치커리 곁들임', decision: '연두부가 소량이고, 피클·레몬즙·머스터드까지 있을 때' }
      ],
      takeaway: '순두부 100g을 쓰는 버섯순두부찌개도 아래 목록에 있습니다. 더 많은 순두부를 활용할 수 있지만 들깻가루·찹쌀가루·저염 장류 등 추가 준비물이 늘어납니다.'
    }
  },
  {
    slug: 'egg',
    name: '달걀·계란',
    keywords: ['달걀', '계란'],
    title: '달걀과 계란으로 만드는 메뉴 | 오늘뭐먹지',
    heading: '달걀과 계란으로 만들기 좋은 메뉴',
    description: '달걀 또는 계란이 들어가는 식약처 공개 레시피를 모아 재료와 조리 순서를 확인할 수 있습니다.'
  },
  {
    slug: 'kimchi',
    name: '김치',
    keywords: ['김치'],
    title: '김치로 만드는 메뉴와 레시피 | 오늘뭐먹지',
    heading: '김치를 활용하는 메뉴를 찾아보세요',
    description: '김치가 들어가는 국, 찌개, 반찬과 일품요리의 재료와 만드는 법을 식약처 공개 레시피로 확인하세요.'
  },
  {
    slug: 'chicken',
    name: '닭고기',
    keywords: ['닭고기', '닭가슴살', '닭'],
    title: '닭고기로 만드는 메뉴와 레시피 | 오늘뭐먹지',
    heading: '닭고기로 만들기 좋은 메뉴',
    description: '닭고기와 닭가슴살을 활용하는 식약처 공개 레시피의 재료, 조리 순서와 영양 정보를 확인하세요.'
  },
  {
    slug: 'potato',
    name: '감자',
    keywords: ['감자'],
    title: '감자로 만드는 메뉴와 레시피 | 오늘뭐먹지',
    heading: '감자를 활용하는 메뉴를 모아봤어요',
    description: '감자가 들어가는 반찬, 국, 일품요리의 재료와 만드는 법을 식약처 공개 레시피로 확인하세요.'
  },
  {
    slug: 'mushroom',
    name: '버섯',
    keywords: ['버섯', '표고', '느타리', '양송이'],
    title: '버섯으로 만드는 메뉴와 레시피 | 오늘뭐먹지',
    heading: '버섯으로 만들기 좋은 메뉴',
    description: '표고와 느타리를 활용하는 국·찌개의 버섯 사용량, 함께 쓸 채소, 육수와 도구를 비교하고 조리법을 확인하세요.',
    comparison: {
      intro: '버섯이라는 이름만으로 고르기보다 표고인지 느타리인지 먼저 나누세요. 같은 국물 요리라도 육수와 함께 넣는 채소가 달라 추가 구매 항목이 달라집니다.',
      rows: [
        { recipeId: '38', usage: '표고버섯 20g + 육수용 기둥', additionalIngredients: '청경채·양파, 멸치·다시마, 국간장·다진 마늘', decision: '표고와 청경채가 있고 맑은 국을 원할 때' },
        { recipeId: '282', usage: '표고버섯 3g + 밑동 3g', additionalIngredients: '순두부·애호박·감자 등 채소, 들깻가루·찹쌀가루·저염 장류', decision: '버섯보다 순두부와 여러 채소를 함께 쓰려 할 때' },
        { recipeId: '674', usage: '느타리버섯 15g', additionalIngredients: '감자·두부·대파·홍고추, 국멸치·건다시마·다진 마늘·소금', decision: '느타리와 감자가 있고 멸치다시마국물을 준비할 때' }
      ],
      takeaway: '새송이버섯이 남았다면 아래 목록의 버섯구이와 두부타르타르 소스를 비교하세요. 새송이를 70g 쓰며 프라이팬 구이와 연두부 소스를 따로 준비하는 메뉴입니다.'
    }
  }
];

const GUIDE_DEFINITIONS = [
  {
    slug: 'fridge-cleanout',
    title: '냉장고 파먹기 순서와 메뉴 찾는 법 | 오늘뭐먹지',
    heading: '냉장고 파먹기, 무엇부터 확인할까요?',
    description: '냉장고 재료를 확인하고 먼저 쓸 재료를 정한 뒤 만들 수 있는 메뉴로 연결하는 순서를 안내합니다.',
    intro: '순두부·오이·사과가 조금씩 남아 있다면 무엇을 고르면 좋을까요? 아래 예시는 재료 종류와 원문 사용량을 비교한 뒤, 없는 재료만 골라내는 과정을 보여줍니다. 가입이나 재료 저장 없이 조리법까지 볼 수 있습니다.',
    steps: [
      {
        title: '보관 상태부터 확인하세요',
        body: '제품에 표시된 소비기한과 보관방법을 먼저 확인합니다. 아래 사례는 사용할 수 있는 재료를 확인한 뒤의 메뉴 선택 예시이며, 앱의 날짜나 정상적인 냄새가 식품 안전을 증명하지는 않습니다.'
      },
      {
        title: '가지고 있는 재료를 적어보세요',
        body: '두부라고만 적지 말고 순두부인지 연두부인지 구분하고, 남은 양을 원문 분량과 비교합니다. 등록은 선택 사항이며, 아래 예시를 읽거나 조리법을 열어도 내 냉장고 기록은 바뀌지 않습니다.'
      },
      {
        title: '먼저 쓸 재료를 고르세요',
        body: '이 사례의 목적은 순두부와 오이, 사과를 한 메뉴에 사용하는 것입니다. 순두부 사용량만 크게 만드는 것보다 세 재료를 함께 쓸 수 있는 후보부터 비교합니다.'
      },
      {
        title: '여러 재료가 겹치는 메뉴를 찾으세요',
        body: '순두부 사과 소스 오이무침은 세 재료가 모두 들어갑니다. 버섯순두부찌개는 순두부를 더 쓰지만 오이와 사과를 쓰지 않으며, 다른 채소와 육수·양념도 필요합니다.'
      },
      {
        title: '부족한 재료만 장보기 목록에 남기세요',
        body: '선택한 오이무침에는 다진 땅콩 10g이 더 필요합니다. 소금은 원문 2단계의 오이 세척용으로 확인합니다. 장보기 목록의 분량은 이 조리법의 사용량이며 판매 포장 단위가 아닙니다.'
      }
    ],
    relatedHubSlugs: ['tofu', 'egg', 'kimchi', 'potato'],
    example: {
      title: '순두부·오이·사과로 무침을 고르는 예시',
      summary: '세 재료를 함께 쓰고 새로 살 품목을 줄이는 선택입니다. 실제 사용자 냉장고나 직접 조리한 후기를 나타내지 않습니다.',
      inventory: [
        { name: '순두부', amount: '100g' }, { name: '오이', amount: '100g' }, { name: '사과', amount: '80g' },
        { name: '소금', amount: '보유 · 세척용 분량은 원문에 없음' }
      ],
      candidateRecipeIds: ['32', '282'],
      selectedRecipeId: '32',
      conclusion: '오이무침을 고르면 순두부 40g, 오이 70g, 사과 50g을 활용합니다. 예시 양에서 각각 60g, 30g, 30g이 남으므로 한 번에 냉장고를 비우는 메뉴는 아닙니다. 남은 재료의 보관·사용은 제품 표시를 별도로 확인하세요.'
    }
  },
  {
    slug: 'use-expiring-ingredients',
    title: '유통기한 임박 재료 확인과 활용 순서 | 오늘뭐먹지',
    heading: '먼저 쓸 재료를 정하고, 함께 쓸 메뉴를 비교하세요',
    description: '유통기한이나 소비기한이 가까운 재료의 보관 상태를 확인하고 메뉴를 정하는 기본 순서를 안내합니다.',
    intro: '느타리버섯을 먼저 쓰기로 했을 때, 냉장고의 감자와 두부까지 연결하는 예시입니다. 날짜 알림은 확인할 재료를 찾는 용도이며, 먹어도 되는지를 판정하는 기능은 아닙니다.',
    steps: [
      {
        title: '날짜 표시의 종류를 확인하세요',
        body: '제품에 적힌 날짜가 유통기한인지 소비기한인지 확인하고 제조사의 보관 방법을 함께 살펴봅니다.'
      },
      {
        title: '보관 이력과 현재 상태를 확인하세요',
        body: '제조사가 표시한 보관 조건을 지켰는지 확인합니다. 겉모습이나 냄새가 정상이더라도 안전하다는 근거가 되지 않으며, 보관 이력이 불확실한 재료를 소진 목적으로 메뉴에 넣지 않습니다.'
      },
      {
        title: '사용 우선순위를 나누세요',
        body: '사용할 수 있는 재료를 확인한 뒤 이번 식사에 활용할 재료 하나를 정합니다. 이 예시에서는 느타리버섯을 먼저 쓰기로 했습니다. 이 선택은 남은 보관 가능 일수를 뜻하지 않습니다.'
      },
      {
        title: '재료가 겹치는 레시피를 선택하세요',
        body: '감자느타리버섯국에는 느타리와 감자, 두부가 함께 들어갑니다. 표고버섯 청경채국은 다른 버섯과 청경채를, 버섯순두부찌개는 순두부와 추가 양념을 준비해야 하므로 현재 예시와 구분합니다.'
      },
      {
        title: '조리법의 사용량과 남는 양을 확인하세요',
        body: '원문은 느타리버섯 15g, 감자 30g, 두부 8g을 씁니다. 가지고 있는 양이 더 많다고 전부 넣거나 조리 후 안전한 보관 기간이 늘어났다고 해석하지 않습니다. 남은 재료는 제품 표시와 공식 보관 안내를 확인하세요.'
      }
    ],
    relatedHubSlugs: ['chicken', 'mushroom', 'tofu', 'potato'],
    example: {
      title: '느타리버섯을 먼저 쓰는 국 선택 예시',
      summary: '제품 표시와 보관 이력을 확인해 사용할 수 있다고 판단한 재료를 비교하는 가상 사례입니다. 날짜가 임박한 모든 재료를 먹어도 된다는 안내가 아닙니다.',
      inventory: [
        { name: '느타리버섯', amount: '20g · 이번 식사에 먼저 활용' }, { name: '감자', amount: '60g' },
        { name: '두부', amount: '20g' }, { name: '대파', amount: '10g' }, { name: '홍고추', amount: '5g' },
        { name: '국멸치', amount: '5g' }, { name: '건다시마', amount: '3g' }, { name: '다진 마늘', amount: '3g' }
      ],
      candidateRecipeIds: ['674', '38', '282'],
      selectedRecipeId: '674',
      conclusion: '소금 0.5g을 보완하면 예시에서 느타리버섯·감자·두부·대파·홍고추를 함께 쓰는 원문 재료 구성이 갖춰집니다. 물 300g도 준비합니다. 원문대로라면 느타리 5g, 감자 30g, 두부 12g이 남으므로 남는 양도 별도로 확인하세요.'
    }
  }
];

function normalizeSearchText(value) {
  return String(value || '').normalize('NFKC').toLowerCase();
}

function recipeMatchesHub(recipe, hub) {
  const searchText = normalizeSearchText(`${recipe?.name || ''}\n${recipe?.ingredientsText || ''}`);
  return hub.keywords.some((keyword) => searchText.includes(normalizeSearchText(keyword)));
}

function enrichIngredientHub(definition) {
  const recipes = publicRecipeCatalog.filter((recipe) => recipeMatchesHub(recipe, definition));
  return Object.freeze({
    ...definition,
    path: `/recipes/ingredients/${definition.slug}`,
    recipes: Object.freeze(recipes),
    comparison: definition.comparison ? {
      ...definition.comparison,
      reviewedAt: '2026-09-06',
      rows: definition.comparison.rows.map((row) => ({ ...row, editorial: getRecipeEditorial(row.recipeId) }))
    } : null
  });
}

export const ingredientHubs = Object.freeze(INGREDIENT_HUB_DEFINITIONS.map(enrichIngredientHub));
function enrichGuide(guide) {
  const available = new Set(guide.example.inventory.map((item) => normalizeSearchText(item.name).replace(/\s/gu, '')));
  const candidates = guide.example.candidateRecipeIds.map((recipeId) => {
    const editorial = getRecipeEditorial(recipeId);
    const missingIngredients = editorial.ingredients.filter((item) => item.role !== 'water' &&
      ![item.name, ...item.aliases].some((name) => available.has(normalizeSearchText(name).replace(/\s/gu, ''))));
    const query = new URLSearchParams({ have: guide.example.inventory.map((item) => item.name).join(',') });
    return { ...editorial, missingIngredients, examplePath: `${editorial.path}?${query}` };
  });
  return Object.freeze({
    ...guide,
    path: `/guides/${guide.slug}`,
    reviewedAt: '2026-09-06',
    example: {
      ...guide.example,
      candidates,
      selectedRecipe: candidates.find((candidate) => candidate.recipeId === guide.example.selectedRecipeId)
    }
  });
}

export const guidePages = Object.freeze(GUIDE_DEFINITIONS.map(enrichGuide));

export const INGREDIENT_HUB_PATHS = Object.freeze(ingredientHubs.map((hub) => hub.path));
export const GUIDE_PATHS = Object.freeze(guidePages.map((guide) => guide.path));

export function getIngredientHubBySlug(slug) {
  return ingredientHubs.find((hub) => hub.slug === String(slug || '')) || null;
}

export function getIngredientHubByPath(pathname) {
  return ingredientHubs.find((hub) => hub.path === pathname) || null;
}

export function getGuideBySlug(slug) {
  return guidePages.find((guide) => guide.slug === String(slug || '')) || null;
}

export function getGuideByPath(pathname) {
  return guidePages.find((guide) => guide.path === pathname) || null;
}

export function getIngredientHubsForRecipe(recipe) {
  return ingredientHubs.filter((hub) => recipeMatchesHub(recipe, hub));
}

export function getPublicRecipeLinkItems() {
  return publicRecipeCatalog.map((recipe) => ({
    id: recipe.externalId,
    name: recipe.name,
    path: getPublicRecipePath(recipe),
    dishType: recipe.dishType || '기타'
  }));
}
