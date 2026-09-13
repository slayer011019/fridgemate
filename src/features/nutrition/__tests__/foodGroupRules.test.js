import { describe, expect, it } from 'vitest';
import { getCompositionHint, getMealFoodGroups } from '../foodGroupRules.js';

describe('composition-only food group rules', () => {
  it('collects explicit selected evidence and ignores optional garnish and unknown labels', () => {
    const groups = getMealFoodGroups([{ ingredients: [
      { selected: true, foodGroups: ['grains', 'grains'] },
      { selected: false, foodGroups: ['vegetables'] },
      { selected: true, foodGroups: ['made-up'] },
    ] }]);
    expect(groups).toEqual([{ id: 'grains', label: '곡류' }]);
  });

  it('provides composition suggestions without claiming daily sufficiency or deficiency', () => {
    expect(getCompositionHint([{ id: 'grains' }])).toContain('채소 반찬');
    expect(getCompositionHint([{ id: 'grains' }, { id: 'vegetables' }])).toContain('달걀·두부·생선');
    const complete = getCompositionHint([{ id: 'grains' }, { id: 'vegetables' }, { id: 'proteinFoods' }]);
    expect(complete).toContain('하루 전체의 영양 균형을 평가한 결과는 아니에요');
    expect(complete).not.toMatch(/충분|부족|과다|충족|건강 개선/);
  });

  it('handles no selection as an empty state', () => {
    expect(getMealFoodGroups()).toEqual([]);
    expect(getCompositionHint()).toContain('메뉴를 정하면');
  });
});
