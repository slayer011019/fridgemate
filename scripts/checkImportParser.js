import { parseImportText } from '../src/utils/importParser.js';

const fixtures = [
  {
    name: 'basic-coupang-rows',
    rawText: `
2026. 3. 18 주문
배송완료 · 3/19(목) 도착
로켓프레시
맑은물에 촌두부 찌개용
2,990원 · 1개
장바구니 담기
로켓프레시
국내산 부추
1,280원 · 1봉
장바구니 담기
곰곰 신선한 특란
11,300원 · 10구
장바구니 담기
    `
  },
  {
    name: 'collapsed-ocr-text',
    rawText:
      '2026. 3. 18 주문 배송완료 · 3/19(목) 도착 로켓프레시 맑은물에 촌두부 찌개용 2,990원 · 1개 장바구니 담기 판매자로켓 국내산 백오이 1,990원 · 2개입 장바구니 담기'
  }
];

fixtures.forEach((fixture) => {
  const result = parseImportText(fixture.rawText);
  console.log(`\n[${fixture.name}]`);
  console.log(`template=${result.template.id}`);
  console.log(`candidates=${result.candidates.length}`);
  result.candidates.forEach((candidate, index) => {
    console.log(
      `  ${index + 1}. displayName=${candidate.displayName} | quantity=${candidate.quantity} | category=${candidate.category} | storage=${candidate.storageType} | normalizedName=${candidate.normalizedName}`
    );
  });
});

const manualSamples = [
  '곰곰 국내산 냉장 돼지고기 삼겹살 500g',
  '곰곰 무항생제 대란 30구',
  '서울우유 1L',
  '냉동 비비고 왕교자 1.05kg',
  '상온 농심 신라면 5개입',
  '국내산 양파 대 1kg',
  '냉장 닭가슴살 2팩',
  '깻잎 30g',
  '오뚜기 카레 순한맛 100g',
  '청정원 양조간장 500ml',
  '냉장 종가집 맛김치 500g',
  '상온 동원 참치캔 150g',
  '친환경 방울토마토 750g',
  '냉동 새우살 300g',
  '유기농 바나나 1손',
  '풀무원 국산콩나물 300g',
  '노브랜드 스파게티 면 500g'
];

console.log('\n[manual-samples]');
manualSamples.forEach((sample, index) => {
  const result = parseImportText({
    text: sample,
    lineItems: [
      {
        id: `manual-${index}`,
        text: sample
      }
    ]
  });

  const candidate = result.candidates[0];

  if (!candidate) {
    console.log(`  ${index + 1}. ${sample} -> no candidate`);
    return;
  }

  console.log(
    `  ${index + 1}. ${sample} -> name=${candidate.displayName} | quantity=${candidate.quantity} | category=${candidate.category} | storage=${candidate.storageType}`
  );
});
