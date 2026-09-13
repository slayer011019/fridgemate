// These are composition labels, not KDRI amounts or a nutritional assessment.
export const FOOD_GROUPS = [
  { id: 'grains', label: '곡류' },
  { id: 'proteinFoods', label: '고기·생선·달걀·콩류' },
  { id: 'vegetables', label: '채소류' },
  { id: 'fruit', label: '과일류' },
  { id: 'dairy', label: '우유·유제품' },
  { id: 'oilsAndSugars', label: '유지·당류' },
];

export const FOOD_GROUP_RULE_VERSION = 'composition-v1';

export function getMealFoodGroups(components = []) {
  const included = new Set(components.flatMap((component) =>
    (component.ingredients || [])
      .filter((ingredient) => ingredient.selected)
      .flatMap((ingredient) => ingredient.foodGroups || []),
  ));
  return FOOD_GROUPS.filter((group) => included.has(group.id)).map((group) => ({ ...group }));
}

export function getCompositionHint(foodGroups = []) {
  const included = new Set(foodGroups.map((group) => typeof group === 'string' ? group : group.id));
  if (!included.size) {
    return '메뉴를 정하면 식품군 구성을 함께 살펴볼 수 있어요.';
  }
  if (!included.has('vegetables')) {
    return '채소 반찬을 곁들이는 구성을 생각해 보세요. 식품군 표시는 섭취량 평가가 아니에요.';
  }
  if (!included.has('proteinFoods')) {
    return '달걀·두부·생선 등을 곁들이는 구성을 생각해 보세요. 식품군 표시는 섭취량 평가가 아니에요.';
  }
  return '여러 식품군을 조합한 메뉴예요. 양과 하루 전체의 영양 균형을 평가한 결과는 아니에요.';
}
