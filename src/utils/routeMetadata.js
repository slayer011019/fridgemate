const SITE_ORIGIN = 'https://xn--wh1bs8l5xa003adme.com';

const PUBLIC_PAGE_METADATA = {
  '/': {
    title: '오늘뭐먹지 | 냉장고 재료 기반 메뉴 추천',
    description: '냉장고 재료와 유통기한을 관리하고, 지금 만들 수 있는 메뉴를 빠르게 추천받아 보세요.'
  },
  '/recipes': {
    title: '냉장고 재료로 찾는 메뉴 추천 | 오늘뭐먹지',
    description: '보유 재료와 팬트리 기본 재료를 바탕으로 지금 만들기 좋은 메뉴와 필요한 재료를 확인하세요.'
  },
  '/about': {
    title: '서비스 소개 | 오늘뭐먹지',
    description: '오늘뭐먹지가 냉장고 속 재료와 유통기한을 메뉴 선택으로 이어주는 방식과 운영 원칙을 소개합니다.'
  },
  '/contact': {
    title: '문의 | 오늘뭐먹지',
    description: '오늘뭐먹지 서비스 이용, 오류 제보, 계정 및 개인정보 관련 문의 방법을 확인하세요.'
  },
  '/privacy': {
    title: '개인정보 처리 안내 | 오늘뭐먹지',
    description: '오늘뭐먹지의 저장 정보, 서비스 분석, 광고와 쿠키, 개인정보 관련 선택 사항을 안내합니다.'
  }
};

const FUNCTIONAL_PATH_PATTERNS = [
  /^\/ingredients(?:\/.*)?$/,
  /^\/import$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/account$/
];

export function getRouteMetadata(pathname = '/') {
  const publicMetadata = PUBLIC_PAGE_METADATA[pathname];

  if (publicMetadata) {
    return {
      ...publicMetadata,
      canonical: `${SITE_ORIGIN}${pathname === '/' ? '/' : pathname}`,
      indexable: true,
      notFound: false
    };
  }

  if (FUNCTIONAL_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return {
      title: '오늘뭐먹지',
      description: '오늘뭐먹지의 냉장고 관리 기능 화면입니다.',
      canonical: `${SITE_ORIGIN}${pathname}`,
      indexable: false,
      notFound: false
    };
  }

  return {
    title: '페이지를 찾을 수 없습니다 | 오늘뭐먹지',
    description: '요청한 페이지를 찾을 수 없습니다.',
    canonical: `${SITE_ORIGIN}${pathname}`,
    indexable: false,
    notFound: true
  };
}

export { SITE_ORIGIN };
