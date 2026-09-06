import { expect, test } from '@playwright/test';
import { createIngredient, gotoAndWait, readBrowserIngredients, seedBrowserState } from './support/testApp';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

function explorer(page) {
  return page.getByRole('region', { name: '남은 재료로 무엇을 만들까요?' });
}

function checklist(page) {
  return page.getByRole('region', { name: '있는 재료를 체크하고 준비할 것을 확인하세요' });
}

async function expectGuestStorage(page, expectedIngredients = []) {
  expect(await readBrowserIngredients(page, 'guest')).toEqual(expectedIngredients);
  expect(await page.evaluate(() => localStorage.getItem('fridgemate-auth-session'))).toBeNull();
}

async function expectNoHorizontalOverflow(page) {
  const { contentWidth, viewportWidth } = await page.evaluate(() => ({
    contentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth
  }));
  expect(contentWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

for (const viewport of VIEWPORTS) {
  test.describe(`public recipes on ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // These journeys verify the application's real catalog and navigation.
      // A third-party image server must not delay the page load under test.
      await page.route('https://www.foodsafetykorea.go.kr/uploadimg/**', (route) => route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=', 'base64')
      }));
    });

    test('a fresh visitor finds a recipe, confirms ingredients and reads all cooking steps without saving', async ({ page }) => {
      await seedBrowserState(page);
      await gotoAndWait(page, '/');
      await expect(explorer(page)).toBeVisible();
      await expect(explorer(page).getByRole('link', { name: /^새우 두부 계란찜/u })).toBeVisible();
      await expectGuestStorage(page);

      await explorer(page).getByRole('textbox', { name: '다른 재료도 찾아보기' }).fill('오이, 사과');
      await explorer(page).getByRole('button', { name: '재료로 찾기' }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('have')).toBe('오이,사과');
      const recipeLink = explorer(page).getByRole('link', { name: /^순두부 사과 소스 오이무침/u });
      await expect(recipeLink).toBeVisible();
      await recipeLink.click();

      await expect(page.getByRole('heading', { level: 1, name: '순두부 사과 소스 오이무침' })).toBeVisible();
      expect(decodeURIComponent(new URL(page.url()).pathname)).toBe('/recipes/32-순두부-사과-소스-오이무침');
      expect(new URL(page.url()).searchParams.get('have')).toBe('오이,사과');
      await expect(checklist(page).getByRole('checkbox', { name: '오이 70g' })).toBeChecked();
      await expect(checklist(page).getByRole('checkbox', { name: '사과 50g' })).toBeChecked();
      await expect(checklist(page).getByRole('checkbox', { name: '순두부 40g' })).not.toBeChecked();
      await expect(checklist(page).getByRole('heading', { name: '추가 확인·준비 목록 3개' })).toBeVisible();

      await checklist(page).getByRole('checkbox', { name: '순두부 40g' }).check();
      await expect(checklist(page).getByRole('heading', { name: '추가 확인·준비 목록 2개' })).toBeVisible();
      const steps = page.locator('section').filter({ has: page.getByRole('heading', { name: '3단계 조리 순서' }) });
      await expect(steps.getByRole('listitem')).toHaveCount(3);
      await expect(steps.getByText(/사과, 순두부를 믹서에 넣고/u)).toBeVisible();
      await expectGuestStorage(page);
      await expectNoHorizontalOverflow(page);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(checklist(page).getByRole('checkbox', { name: '순두부 40g' })).not.toBeChecked();
      await expect(checklist(page).getByRole('checkbox', { name: '오이 70g' })).toBeChecked();
      await expectGuestStorage(page);
    });

    test('a guide example reaches its selected recipe and preserves guest inventory', async ({ page }) => {
      await seedBrowserState(page);
      await gotoAndWait(page, '/');
      await explorer(page).getByRole('link', { name: '예시 냉장고로 메뉴 고르기' }).click();
      await expect(page).toHaveURL(/\/guides\/fridge-cleanout$/u);
      const example = page.getByRole('region', { name: '순두부·오이·사과로 무침을 고르는 예시' });
      await expect(example.getByRole('heading', { name: '선택한 메뉴의 추가 준비 목록' })).toBeVisible();
      await expect(example.getByRole('listitem').filter({ hasText: /^다진 땅콩 10g$/u })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await example.getByRole('link', { name: '예시 재료로 선택한 조리법 보기' }).click();

      await expect(page.getByRole('heading', { level: 1, name: '순두부 사과 소스 오이무침' })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('have')).toBe('순두부,오이,사과,소금');
      await expect(checklist(page).getByRole('heading', { name: '추가 확인·준비 목록 1개' })).toBeVisible();
      await expect(checklist(page).getByRole('checkbox', { name: '다진 땅콩 10g' })).not.toBeChecked();
      await expect(checklist(page).getByRole('checkbox', { name: '순두부 40g' })).toBeChecked();
      await expect(page.getByRole('heading', { name: '3단계 조리 순서' })).toBeVisible();
      await expectGuestStorage(page);
      await expectNoHorizontalOverflow(page);
    });

    test('a returning guest sees saved priorities and can still browse public recipes', async ({ page }) => {
      await seedBrowserState(page, {
        ingredients: [
          createIngredient('tofu-priority', { name: '순두부', quantity: '100g', expiryDate: '2026-09-07' }),
          createIngredient('cucumber-later', { name: '오이', quantity: '100g', expiryDate: '2026-09-10' })
        ]
      });
      await gotoAndWait(page, '/');
      await expect(page.getByRole('heading', { level: 1, name: '먼저 쓸 재료와 오늘 메뉴를 확인하세요' })).toBeVisible();
      const priorities = page.locator('section').filter({ has: page.getByRole('heading', { name: '유통기한 임박 리스트' }) });
      await expect(priorities.getByText('순두부', { exact: true })).toBeVisible();
      await expect(priorities.getByText('오이', { exact: true })).toBeVisible();
      const before = await readBrowserIngredients(page, 'guest');
      expect(before.map((item) => item.name).sort()).toEqual(['순두부', '오이']);
      const priorityBeforeExplorer = await priorities.evaluate((node) =>
        Boolean(node.compareDocumentPosition(document.querySelector('[aria-labelledby="public-explorer-title"]')) & Node.DOCUMENT_POSITION_FOLLOWING));
      expect(priorityBeforeExplorer).toBe(true);

      await expect(explorer(page)).toBeVisible();
      await explorer(page).getByRole('button', { name: '두부', exact: true }).click();
      await explorer(page).getByRole('link', { name: /^순두부 사과 소스 오이무침/u }).click();
      await expect(page.getByRole('heading', { level: 1, name: '순두부 사과 소스 오이무침' })).toBeVisible();
      // The broad "두부" exploration filter must not claim exact source ownership.
      await expect(checklist(page).getByRole('checkbox', { name: '순두부 40g' })).not.toBeChecked();
      await expect(checklist(page).getByRole('checkbox', { name: '오이 70g' })).not.toBeChecked();
      await checklist(page).getByRole('checkbox', { name: '내 냉장고와 보유 양념도 반영하기' }).check();
      await expect(checklist(page).getByRole('checkbox', { name: '순두부 40g' })).toBeChecked();
      await expect(checklist(page).getByRole('checkbox', { name: '오이 70g' })).toBeChecked();
      await expectGuestStorage(page, before);
      await expectNoHorizontalOverflow(page);
    });
  });
}
