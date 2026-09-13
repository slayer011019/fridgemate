import { expect, test } from '@playwright/test';
import { createIngredient, gotoAndWait, readBrowserIngredients, seedBrowserState } from './support/testApp';

const weekStart = '2026-09-14';

async function openPlanner(page, ingredients = []) {
  await seedBrowserState(page, { ingredients });
  await gotoAndWait(page, '/meal-plan');
  await expect(page.getByRole('heading', { name: '이번 주 저녁, 미리 골라두세요' })).toBeVisible();
  await page.getByLabel('주 시작일').fill(weekStart);
  await expect(page.getByRole('button', { name: '한 주 식단 만들기' })).toBeEnabled();
}

async function waitForSave(page) {
  await expect(page.getByRole('button', { name: '고정하지 않은 메뉴 다시 추천' })).toBeEnabled();
}

test('weekly dinners can be replaced, locked and reloaded without changing inventory', async ({ page }, testInfo) => {
  const ingredients = [
    createIngredient('rice', { name: '밥', quantity: '2공기', expiryDate: '2026-09-21' }),
    createIngredient('egg', { name: '계란', quantity: '6개', expiryDate: '2026-09-21' })
  ];
  await openPlanner(page, ingredients);
  const originalInventory = await readBrowserIngredients(page, 'guest');
  await page.getByLabel('식사 인원').selectOption('2');
  await page.getByLabel('피하고 싶은 재료').fill('버섯, 가지');
  await page.getByRole('button', { name: '한 주 식단 만들기' }).click();
  await expect(page.getByRole('article')).toHaveCount(7);
  await waitForSave(page);

  const monday = page.getByRole('article', { name: '2026-09-14 저녁 식단' });
  const before = await monday.getByRole('heading', { level: 3 }).textContent();
  await monday.getByRole('button', { name: '메뉴 교체' }).click();
  await expect(monday.getByRole('heading', { level: 3 })).not.toHaveText(before);
  await waitForSave(page);
  const replaced = await monday.getByRole('heading', { level: 3 }).textContent();
  await monday.getByRole('button', { name: '메뉴 고정' }).click();
  await expect(monday.getByRole('button', { name: '고정 해제' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '고정하지 않은 메뉴 다시 추천' }).click();
  await waitForSave(page);
  await expect(monday.getByRole('heading', { level: 3 })).toHaveText(replaced);

  const sunday = page.getByRole('article', { name: '2026-09-20 저녁 식단' });
  await sunday.getByRole('button', { name: '외식·건너뛰기' }).click();
  await expect(sunday.getByRole('heading', { level: 3 })).toHaveText('외식하거나 쉬는 날');
  await waitForSave(page);
  expect(await readBrowserIngredients(page, 'guest')).toEqual(originalInventory);

  await page.reload();
  await page.getByLabel('주 시작일').fill(weekStart);
  await expect(monday.getByRole('heading', { level: 3 })).toHaveText(replaced);
  await expect(sunday.getByRole('heading', { level: 3 })).toHaveText('외식하거나 쉬는 날');
  await expect(page.getByLabel('식사 인원')).toHaveValue('2');
  await expect(page.getByLabel('피하고 싶은 재료')).toHaveValue('버섯, 가지');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^noindex(?:,|$)/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  expect(await readBrowserIngredients(page, 'guest')).toEqual(originalInventory);

  await page.getByRole('button', { name: '다음 주' }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '한 주 식단 만들기' })).toBeVisible();
  await page.getByRole('button', { name: '이전 주' }).click();
  await expect(monday.getByRole('heading', { level: 3 })).toHaveText(replaced);
  await page.screenshot({ path: testInfo.outputPath('meal-plan-desktop.png') });
});

test('mobile dinner days, ingredient disclosure and empty candidates stay usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPlanner(page);
  await page.getByLabel('일요일 저녁').uncheck();
  await page.getByRole('button', { name: '한 주 식단 만들기' }).click();
  await expect(page.getByRole('article')).toHaveCount(7);
  await waitForSave(page);
  await expect(page.getByRole('article', { name: '2026-09-20 저녁 식단' }).getByRole('heading')).toHaveText('외식하거나 쉬는 날');
  const monday = page.getByRole('article', { name: '2026-09-14 저녁 식단' });
  await monday.locator('summary').click();
  await expect(monday.getByText(/재료별 필요량과 실제 분량은 확인되지 않았어요/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const buttonBox = await monday.getByRole('button', { name: '메뉴 교체' }).boundingBox();
  expect(buttonBox.height).toBeGreaterThanOrEqual(44);
  await monday.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('meal-plan-mobile.png') });

  await page.locator('summary').filter({ hasText: '식단 조건' }).click();
  await page.getByLabel('피하고 싶은 재료').fill('밥, 파스타면, 식빵, 우동면, 밀가루, 계란, 두부, 닭고기, 감자, 김치, 참치캔');
  await page.getByRole('button', { name: '고정하지 않은 메뉴 다시 추천' }).click();
  await waitForSave(page);
  await expect(page.getByRole('heading', { name: '조건에 맞는 메뉴가 없어요' })).toHaveCount(6);
  await expect(page.getByRole('heading', { name: '외식하거나 쉬는 날' })).toHaveCount(1);
});
