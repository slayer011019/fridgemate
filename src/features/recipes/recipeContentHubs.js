import { getPublicRecipePath, publicRecipeCatalog } from './publicRecipeCatalog.js';

const INGREDIENT_HUB_DEFINITIONS = [
  {
    slug: 'tofu',
    name: '두부',
    keywords: ['두부', '연두부', '순두부'],
    title: '두부로 만드는 메뉴와 레시피 | 오늘뭐먹지',
    heading: '두부로 만들기 좋은 메뉴를 모아봤어요',
    description: '두부, 연두부, 순두부가 들어가는 식약처 공개 레시피의 재료와 만드는 법을 한곳에서 확인하세요.'
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
    description: '버섯, 표고버섯, 느타리버섯과 양송이를 활용하는 식약처 공개 레시피를 한곳에서 확인하세요.'
  }
];

const GUIDE_DEFINITIONS = [
  {
    slug: 'fridge-cleanout',
    title: '냉장고 파먹기 순서와 메뉴 찾는 법 | 오늘뭐먹지',
    heading: '냉장고 파먹기, 무엇부터 확인할까요?',
    description: '냉장고 재료를 확인하고 먼저 쓸 재료를 정한 뒤 만들 수 있는 메뉴로 연결하는 순서를 안내합니다.',
    intro: '새로 장보기 전에 냉장고에 남은 재료를 확인하면 버려지는 식재료와 중복 구매를 줄이는 데 도움이 됩니다.',
    steps: [
      {
        title: '보관 상태부터 확인하세요',
        body: '포장 손상, 이상한 냄새나 색, 보관 온도처럼 실제 상태를 먼저 확인합니다. 날짜 표시만으로 안전 여부를 단정하지 않습니다.'
      },
      {
        title: '가지고 있는 재료를 적어보세요',
        body: '냉장·냉동·실온 재료를 구분해 오늘뭐먹지에 등록하고 날짜를 아는 재료에는 유통기한이나 소비기한을 함께 기록합니다.'
      },
      {
        title: '먼저 쓸 재료를 고르세요',
        body: '상태가 양호한 재료 중 날짜가 가까운 것과 이미 개봉한 것을 우선 후보로 정합니다.'
      },
      {
        title: '여러 재료가 겹치는 메뉴를 찾으세요',
        body: '메뉴 추천과 재료별 레시피 모음에서 보유 재료가 많이 겹치는 메뉴를 확인합니다.'
      },
      {
        title: '부족한 재료만 장보기 목록에 남기세요',
        body: '선택한 메뉴에 꼭 필요한 부족 재료만 정리하고, 다음 식사에서도 쓸 수 있는지 확인한 뒤 구매합니다.'
      }
    ],
    relatedHubSlugs: ['tofu', 'egg', 'kimchi', 'potato']
  },
  {
    slug: 'use-expiring-ingredients',
    title: '유통기한 임박 재료 확인과 활용 순서 | 오늘뭐먹지',
    heading: '유통기한이 가까운 재료, 안전하게 확인하고 활용하세요',
    description: '유통기한이나 소비기한이 가까운 재료의 보관 상태를 확인하고 메뉴를 정하는 기본 순서를 안내합니다.',
    intro: '날짜가 가까운 재료는 무조건 먹거나 버리기보다 표시 종류, 보관 방법과 실제 상태를 함께 확인해야 합니다.',
    steps: [
      {
        title: '날짜 표시의 종류를 확인하세요',
        body: '제품에 적힌 날짜가 유통기한인지 소비기한인지 확인하고 제조사의 보관 방법을 함께 살펴봅니다.'
      },
      {
        title: '보관 이력과 현재 상태를 확인하세요',
        body: '권장 온도에서 보관했는지 확인하고, 포장이 부풀었거나 누수·곰팡이·이상한 냄새가 있으면 사용하지 않습니다.'
      },
      {
        title: '사용 우선순위를 나누세요',
        body: '상태가 양호한 재료를 오늘, 1~3일, 4~7일처럼 나누면 다음 식사에 먼저 쓸 재료가 분명해집니다.'
      },
      {
        title: '재료가 겹치는 레시피를 선택하세요',
        body: '한 가지 재료만 소진하는 것보다 여러 임박 재료를 함께 활용할 수 있는 메뉴를 우선 확인합니다.'
      },
      {
        title: '조리 후에도 안전하게 보관하세요',
        body: '조리한 음식은 오래 실온에 두지 말고 적절히 식혀 밀폐 보관하며, 의심스러운 경우 섭취하지 않습니다.'
      }
    ],
    relatedHubSlugs: ['chicken', 'mushroom', 'tofu', 'potato']
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
    recipes: Object.freeze(recipes)
  });
}

export const ingredientHubs = Object.freeze(INGREDIENT_HUB_DEFINITIONS.map(enrichIngredientHub));
export const guidePages = Object.freeze(
  GUIDE_DEFINITIONS.map((guide) => Object.freeze({ ...guide, path: `/guides/${guide.slug}` }))
);

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
