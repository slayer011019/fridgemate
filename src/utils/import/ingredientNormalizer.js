const CATEGORY_OTHER = '기타';
const STORAGE_FRIDGE = '냉장';
const STORAGE_FREEZER = '냉동';
const STORAGE_PANTRY = '팬트리';

const BRAND_STOPWORDS = [
  '곰곰',
  '쿠팡',
  '로켓프레시',
  '로켓배송',
  '판매자배송',
  '무료배송',
  '비비고',
  '청정원',
  '백설',
  '오뚜기',
  '농심',
  '팔도',
  '삼양',
  '해태',
  '롯데',
  '서울우유',
  '매일우유',
  '남양',
  '빙그레',
  '풀무원',
  '종가집',
  '동원',
  'CJ',
  '씨제이',
  '노브랜드',
  '피코크',
  '하림',
  '목우촌',
  '다향',
  '국내산',
  '수입산',
  '친환경',
  '유기농',
  '무항생제',
  '대용량',
  '소포장',
  '신선한',
  '신선',
  '프리미엄',
  '맛있는',
  '아삭한',
  '간편한',
  '냉장',
  '냉동',
  '실온',
  '보관',
  '용기',
  '절단',
  '슬라이스',
  '구이용',
  '찌개용',
  '볶음용',
  '캠핑용',
  '간편식',
  'HACCP',
  '정품',
  '행사',
  '특가',
  '기획',
  '묶음',
  '세트',
  '추천',
  '오늘출발',
  '새벽배송',
  '당일배송',
  '바로배송'
];

const CANONICAL_RULES = [
  { keywords: ['특란', '대란', '달걀', '계란'], normalizedName: '계란', category: '달걀', storageType: STORAGE_FRIDGE },
  { keywords: ['촌두부', '순두부', '연두부', '찌개용 두부', '부침용 두부', '두부'], normalizedName: '두부', category: CATEGORY_OTHER, storageType: STORAGE_FRIDGE },
  { keywords: ['콩나물'], normalizedName: '콩나물', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['숙주'], normalizedName: '숙주', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['시금치'], normalizedName: '시금치', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['미나리'], normalizedName: '미나리', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['샐러리'], normalizedName: '샐러리', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['청경채'], normalizedName: '청경채', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['로메인'], normalizedName: '로메인', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['양상추'], normalizedName: '양상추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['쌈채소'], normalizedName: '쌈채소', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['무', '조선무'], normalizedName: '무', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['고구마'], normalizedName: '고구마', category: '채소', storageType: STORAGE_PANTRY },
  { keywords: ['단호박'], normalizedName: '단호박', category: '채소', storageType: STORAGE_PANTRY },
  { keywords: ['오징어'], normalizedName: '오징어', category: '해산물', storageType: STORAGE_FRIDGE },
  { keywords: ['문어'], normalizedName: '문어', category: '해산물', storageType: STORAGE_FRIDGE },
  { keywords: ['조개', '바지락', '홍합', '가리비'], normalizedName: '조개류', category: '해산물', storageType: STORAGE_FRIDGE },
  { keywords: ['꽃게', '대게', '킹크랩'], normalizedName: '게', category: '해산물', storageType: STORAGE_FRIDGE },
  { keywords: ['낙지'], normalizedName: '낙지', category: '해산물', storageType: STORAGE_FRIDGE },
  { keywords: ['돼지고기 삼겹살', '삼겹살'], normalizedName: '돼지고기 삼겹살', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['불고기 양념', '불고기양념', '불고기 소스'], normalizedName: '불고기 양념', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['갈비 양념', '갈비양념', '갈비 소스'], normalizedName: '갈비 양념', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['목살'], normalizedName: '돼지고기 목살', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['앞다리', '앞다리살'], normalizedName: '돼지고기 앞다리', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['뒷다리', '뒷다리살'], normalizedName: '돼지고기 뒷다리', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['항정살'], normalizedName: '돼지고기 항정살', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['등갈비'], normalizedName: '돼지고기 등갈비', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['갈비'], normalizedName: '돼지고기 갈비', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['안심'], normalizedName: '돼지고기 안심', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['등심'], normalizedName: '돼지고기 등심', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['돼지'], normalizedName: '돼지고기', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['채끝'], normalizedName: '소고기 채끝', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['부채살'], normalizedName: '소고기 부채살', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['국거리'], normalizedName: '소고기 국거리', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['불고기'], normalizedName: '소고기 불고기', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['소고기', '쇠고기', '한우'], normalizedName: '소고기', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['닭가슴살', '닭안심', '닭다리살', '닭고기', '닭'], normalizedName: '닭고기', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['오리'], normalizedName: '오리고기', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['부추'], normalizedName: '부추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['감자'], normalizedName: '감자', category: '채소', storageType: STORAGE_PANTRY },
  { keywords: ['오이고추'], normalizedName: '오이고추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['아삭이고추'], normalizedName: '아삭이고추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['꽈리고추'], normalizedName: '꽈리고추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['백오이', '오이'], normalizedName: '오이', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['대파'], normalizedName: '대파', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['쪽파'], normalizedName: '쪽파', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['마늘'], normalizedName: '마늘', category: '채소', storageType: STORAGE_PANTRY },
  { keywords: ['양배추'], normalizedName: '양배추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['적양파', '자색양파', '레드어니언'], normalizedName: '적양파', category: '채소', storageType: STORAGE_PANTRY },
  { keywords: ['양파'], normalizedName: '양파', category: '채소', storageType: STORAGE_PANTRY },
  { keywords: ['당근'], normalizedName: '당근', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['배추'], normalizedName: '배추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['상추'], normalizedName: '상추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['깻잎'], normalizedName: '깻잎', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['파스타 소스', '토마토 소스', '크림 소스'], normalizedName: '파스타 소스', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['토마토'], normalizedName: '토마토', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['방울토마토'], normalizedName: '토마토', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['애호박', '주키니'], normalizedName: '애호박', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['브로콜리'], normalizedName: '브로콜리', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['파프리카'], normalizedName: '파프리카', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['청양고추'], normalizedName: '청양고추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['홍고추'], normalizedName: '홍고추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['풋고추'], normalizedName: '풋고추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['고추'], normalizedName: '고추', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['양송이버섯', '양송이'], normalizedName: '양송이버섯', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['느타리버섯', '느타리'], normalizedName: '느타리버섯', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['표고버섯', '표고'], normalizedName: '표고버섯', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['새송이버섯', '새송이'], normalizedName: '새송이버섯', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['팽이버섯', '팽이'], normalizedName: '팽이버섯', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['버섯'], normalizedName: '버섯', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['사과'], normalizedName: '사과', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['바나나'], normalizedName: '바나나', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['배'], normalizedName: '배', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['딸기'], normalizedName: '딸기', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['오렌지'], normalizedName: '오렌지', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['포도'], normalizedName: '포도', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['블루베리'], normalizedName: '블루베리', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['레몬'], normalizedName: '레몬', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['귤', '감귤'], normalizedName: '귤', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['복숭아'], normalizedName: '복숭아', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['키위'], normalizedName: '키위', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['수박'], normalizedName: '수박', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['멜론'], normalizedName: '멜론', category: '과일', storageType: STORAGE_FRIDGE },
  { keywords: ['서울우유', '매일우유', '멸균우유', '우유'], normalizedName: '우유', category: '유제품', storageType: STORAGE_FRIDGE },
  { keywords: ['치즈'], normalizedName: '치즈', category: '유제품', storageType: STORAGE_FRIDGE },
  { keywords: ['요거트', '요구르트'], normalizedName: '요거트', category: '유제품', storageType: STORAGE_FRIDGE },
  { keywords: ['버터'], normalizedName: '버터', category: '유제품', storageType: STORAGE_FRIDGE },
  { keywords: ['생크림', '휘핑크림'], normalizedName: '생크림', category: '유제품', storageType: STORAGE_FRIDGE },
  { keywords: ['두유'], normalizedName: '두유', category: '음료', storageType: STORAGE_PANTRY },
  { keywords: ['주스', '쥬스'], normalizedName: '주스', category: '음료', storageType: STORAGE_PANTRY },
  { keywords: ['탄산수'], normalizedName: '탄산수', category: '음료', storageType: STORAGE_PANTRY },
  { keywords: ['생수'], normalizedName: '생수', category: '음료', storageType: STORAGE_PANTRY },
  { keywords: ['커피'], normalizedName: '커피', category: '음료', storageType: STORAGE_PANTRY },
  { keywords: ['차', '티백'], normalizedName: '차', category: '음료', storageType: STORAGE_PANTRY },
  { keywords: ['김치'], normalizedName: '김치', category: '채소', storageType: STORAGE_FRIDGE },
  { keywords: ['어묵'], normalizedName: '어묵', category: '해산물', storageType: STORAGE_FRIDGE },
  { keywords: ['크래미'], normalizedName: '크래미', category: '해산물', storageType: STORAGE_FRIDGE },
  { keywords: ['새우'], normalizedName: '새우', category: '해산물', storageType: STORAGE_FRIDGE },
  { keywords: ['참치캔'], normalizedName: '참치캔', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['고등어', '연어', '참치', '생선'], normalizedName: '생선', category: '해산물', storageType: STORAGE_FRIDGE },
  { keywords: ['냉동 새우', '냉동생선'], normalizedName: '냉동 해산물', category: '냉동식품', storageType: STORAGE_FREEZER },
  { keywords: ['왕교자', '군만두', '물만두', '만두'], normalizedName: '만두', category: '냉동식품', storageType: STORAGE_FREEZER },
  { keywords: ['볶음밥'], normalizedName: '볶음밥', category: '냉동식품', storageType: STORAGE_FREEZER },
  { keywords: ['피자'], normalizedName: '피자', category: '냉동식품', storageType: STORAGE_FREEZER },
  { keywords: ['핫도그'], normalizedName: '핫도그', category: '냉동식품', storageType: STORAGE_FREEZER },
  { keywords: ['돈까스'], normalizedName: '돈까스', category: '냉동식품', storageType: STORAGE_FREEZER },
  { keywords: ['너겟'], normalizedName: '너겟', category: '냉동식품', storageType: STORAGE_FREEZER },
  { keywords: ['아이스크림'], normalizedName: '아이스크림', category: '냉동식품', storageType: STORAGE_FREEZER },
  { keywords: ['냉동식품'], normalizedName: '냉동식품', category: '냉동식품', storageType: STORAGE_FREEZER },
  { keywords: ['햄', '베이컨', '소시지'], normalizedName: '가공육', category: '육류', storageType: STORAGE_FRIDGE },
  { keywords: ['스팸'], normalizedName: '스팸', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['옥수수캔'], normalizedName: '옥수수캔', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['복숭아캔', '황도캔'], normalizedName: '과일통조림', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['통조림'], normalizedName: '통조림', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['라면'], normalizedName: '라면', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['우동'], normalizedName: '우동면', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['파스타', '스파게티'], normalizedName: '파스타면', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['국수', '소면'], normalizedName: '국수', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['면'], normalizedName: '면', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['즉석밥', '햇반'], normalizedName: '즉석밥', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['식빵', '빵'], normalizedName: '빵', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['쌀'], normalizedName: '쌀', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['밀가루', '부침가루', '튀김가루'], normalizedName: '가루류', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['설탕'], normalizedName: '설탕', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['소금'], normalizedName: '소금', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['후추'], normalizedName: '후추', category: '상온식품', storageType: STORAGE_PANTRY },
  { keywords: ['참기름'], normalizedName: '참기름', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['식용유', '올리브유', '카놀라유'], normalizedName: '식용유', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['식초'], normalizedName: '식초', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['굴소스'], normalizedName: '굴소스', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['쌈장'], normalizedName: '쌈장', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['간장'], normalizedName: '간장', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['부대찌개 양념', '부대찌개양념', '부대찌개 소스'], normalizedName: '부대찌개 양념', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['된장찌개 양념', '된장찌개양념', '된장찌개 소스', '된장찌개소스'], normalizedName: '된장찌개 양념', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['제육볶음 양념', '제육볶음양념', '제육 양념'], normalizedName: '제육볶음 양념', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['떡볶이 양념', '떡볶이양념', '떡볶이 소스'], normalizedName: '떡볶이 양념', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['샤브샤브 육수', '샤브 육수', '샤브샤브용 육수'], normalizedName: '샤브샤브 육수', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['짜장 소스', '짜장소스'], normalizedName: '짜장 소스', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['멸치육수', '사골육수', '육수'], normalizedName: '육수', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['된장'], normalizedName: '된장', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['고추장'], normalizedName: '고추장', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['케찹', '케첩'], normalizedName: '케첩', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['마요네즈', '마요'], normalizedName: '마요네즈', category: '소스', storageType: STORAGE_PANTRY },
  { keywords: ['카레'], normalizedName: '카레', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['즉석탕'], normalizedName: '즉석탕', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['사골곰탕', '곰탕'], normalizedName: '곰탕', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['즉석국'], normalizedName: '즉석국', category: '간편식', storageType: STORAGE_PANTRY },
  { keywords: ['도시락김', '김자반', '조미김', '김'], normalizedName: '김', category: '상온식품', storageType: STORAGE_PANTRY }
];

function normalizeSpaces(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripStopwords(text) {
  return BRAND_STOPWORDS.reduce((current, stopword) => current.replaceAll(stopword, ' '), text);
}

function normalizeProductTitle(displayName) {
  return normalizeSpaces(
    stripStopwords(String(displayName || ''))
      .replace(/[\/,]+/g, ' ')
      .replace(/\b(?:대용량|행사|특가|묶음|세트)\b/gi, ' ')
  );
}

function findRule(text) {
  return CANONICAL_RULES.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
}

function inferStorageFromText(text) {
  const normalizedText = String(text || '');

  if (normalizedText.includes('냉동')) {
    return STORAGE_FREEZER;
  }

  if (normalizedText.includes('상온') || normalizedText.includes('실온')) {
    return STORAGE_PANTRY;
  }

  if (normalizedText.includes('냉장')) {
    return STORAGE_FRIDGE;
  }

  return '';
}

function dedupeSpecs(specTokens = []) {
  const seen = new Set();

  return specTokens.filter((token) => {
    const nextToken = normalizeSpaces(token).replace(/\s+/g, '');

    if (!nextToken || seen.has(nextToken)) {
      return false;
    }

    seen.add(nextToken);
    return true;
  });
}

export function buildQuantityText(specTokens = []) {
  const tokens = dedupeSpecs(specTokens);
  return tokens.join(' / ') || '1개';
}

export function normalizeIngredientName(displayName) {
  return normalizeImportedIngredient(displayName).normalizedName;
}

export function normalizeImportedIngredient(displayName, specTokens = []) {
  const storageFromTitle = inferStorageFromText(displayName);
  const rawTitle = normalizeSpaces(displayName);
  const cleanedTitle = normalizeProductTitle(displayName);
  const matchedRule = findRule(rawTitle) || findRule(cleanedTitle);
  const normalizedName = matchedRule?.normalizedName || cleanedTitle || rawTitle;

  return {
    originalName: rawTitle,
    displayName: normalizedName,
    normalizedName,
    category: matchedRule?.category || CATEGORY_OTHER,
    storageType: storageFromTitle || matchedRule?.storageType || STORAGE_FRIDGE,
    quantity: buildQuantityText(specTokens)
  };
}
