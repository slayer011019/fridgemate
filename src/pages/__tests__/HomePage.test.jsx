import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../HomePage.jsx';

const mocks = vi.hoisted(() => ({ recipes: [], trackEvent: vi.fn() }));

vi.mock('../../hooks/useHomePageModel', () => ({
  useHomePageModel: () => ({
    loading: false, summary: { total: 2 }, topRecommendations: mocks.recipes,
    upcomingItems: [{ id: 'tofu', name: '두부' }], urgentCount: 0
  })
}));
vi.mock('../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackEvent: mocks.trackEvent }) }));
vi.mock('../../hooks/useMenuDecision', () => ({ useMenuDecision: () => ({ decision: null }) }));
vi.mock('../../components/PublicRecipeExplorer', () => ({ default: () => <p>공개 레시피 탐색</p> }));
vi.mock('../../components/ads/AdSenseSlot', () => ({ default: () => null }));

afterEach(cleanup);
beforeEach(() => {
  mocks.recipes = [];
  mocks.trackEvent.mockClear();
});

function renderHome() {
  render(<MemoryRouter><HomePage /></MemoryRouter>);
}

function preview(name) {
  return within(screen.getByText(name).closest('article'));
}

describe('home recommendation previews', () => {
  it('only promises one addition when groups and seasonings are satisfied, and shows every missing condition', () => {
    const base = { isPersonalized: true, hasKnownRequirements: true, totalRequiredIngredients: 2, matchedCore: ['두부'], missingCore: ['계란'], matchRate: 0.4 };
    mocks.recipes = [
      { ...base, id: 'extra', title: '추가 조건 메뉴', canMakeWithOneMore: false, missingGroups: ['채소 1가지'], missingSeasonings: ['소금'] },
      { ...base, id: 'one', title: '한 가지 추가 메뉴', canMakeWithOneMore: true },
      { ...base, id: 'seasoning', title: '양념 준비 메뉴', missingCore: [], matchedCore: ['두부', '계란'], missingSeasonings: ['소금'], needsSeasonings: true, canMakeNow: true }
    ];

    renderHome();
    expect(preview('추가 조건 메뉴').getByText('추가 재료 확인')).toBeInTheDocument();
    expect(preview('추가 조건 메뉴').getByText('핵심 재료: 계란')).toBeInTheDocument();
    expect(preview('추가 조건 메뉴').getByText('필수 조합: 채소 1가지')).toBeInTheDocument();
    expect(preview('추가 조건 메뉴').getByText('양념: 소금')).toBeInTheDocument();
    expect(preview('추가 조건 메뉴').queryByText('한 가지만 더 준비')).not.toBeInTheDocument();
    expect(preview('한 가지 추가 메뉴').getByText('한 가지만 더 준비')).toBeInTheDocument();
    expect(preview('한 가지 추가 메뉴').getByText('원문 분량과 재료 상태도 확인하세요.')).toBeInTheDocument();
    expect(preview('양념 준비 메뉴').getByText('양념 추가 필요')).toBeInTheDocument();
    expect(preview('양념 준비 메뉴').queryByText('재료 종류 확인됨')).not.toBeInTheDocument();
  });

  it('suppresses unsupported matching percentages and keeps unclassified items from a ready claim', () => {
    mocks.recipes = [
      { id: 'incomplete', title: '핵심 정보 누락', isPersonalized: true, hasKnownRequirements: false, totalRequiredIngredients: 0, canMakeNow: true, matchRate: 1 },
      { id: 'browse', title: '둘러보기 메뉴', isPersonalized: false, totalRequiredIngredients: 1, matchRateLabel: '100%', canMakeNow: true, matchedCore: ['두부'] },
      { id: 'unknown', title: '분류 확인 메뉴', isPersonalized: true, hasKnownRequirements: true, totalRequiredIngredients: 1, matchedCore: ['두부'], missingUnknownIngredients: ['새싹채소'], canMakeNow: true, matchRateLabel: '', matchRate: 0.8 }
    ];

    renderHome();
    expect(preview('핵심 정보 누락').getByText('원문 재료 확인 필요')).toBeInTheDocument();
    expect(preview('둘러보기 메뉴').getByText('메뉴 둘러보기')).toBeInTheDocument();
    expect(preview('둘러보기 메뉴').queryByText(/보유 재료/)).not.toBeInTheDocument();
    expect(preview('분류 확인 메뉴').getByText('재료 분류 확인 필요')).toBeInTheDocument();
    expect(preview('분류 확인 메뉴').getByText('분류 확인: 새싹채소')).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(screen.queryByText('재료 종류 확인됨')).not.toBeInTheDocument();
    expect(screen.queryByText('지금 가능')).not.toBeInTheDocument();
  });
});
