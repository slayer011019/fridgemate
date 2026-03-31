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
      `  ${index + 1}. displayName=${candidate.displayName} | specText=${candidate.specText} | normalizedName=${candidate.normalizedName}`
    );
  });
});
