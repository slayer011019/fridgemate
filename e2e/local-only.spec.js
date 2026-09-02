import { expect, test } from '@playwright/test';
import { gotoAndWait, seedBrowserState } from './support/testApp';

test('local-only mode keeps CRUD data in IndexedDB across reloads', async ({ page }) => {
  await seedBrowserState(page);
  await gotoAndWait(page, '/ingredients/new');

  await page.getByLabel('이름').fill('우유');
  await page.getByLabel('수량').fill('1통');
  await page.getByLabel('카테고리').selectOption('유제품');
  await page.getByLabel('보관 방식').selectOption('냉장');
  await page.getByLabel('구매일').fill('2026-04-14');
  await page.getByRole('button', { name: '재료 추가' }).click();

  await expect(page).toHaveURL(/\/ingredients$/);
  await expect(page.getByText('우유')).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('우유')).toBeVisible();

  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('우유')).toHaveCount(0);
});

test('guest menu selection survives a reload without a server account', async ({ page }) => {
  await seedBrowserState(page, {
    ingredients: [
      {
        id: 'egg-1',
        name: '계란',
        category: '기타',
        storageType: '냉장',
        quantity: '4개',
        purchaseDate: '2026-08-30',
        expiryDate: '2026-09-02',
        consumed: false
      }
    ]
  });
  await gotoAndWait(page, '/recipes');

  const firstCard = page.locator('article').filter({ has: page.getByRole('button', { name: '오늘 먹기' }) }).first();
  const recipeName = (await firstCard.getByRole('heading').textContent())?.trim();
  await firstCard.getByRole('button', { name: '오늘 먹기' }).click();
  await expect(page.getByRole('button', { name: '선택됨' }).first()).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: '선택됨' }).first()).toBeVisible();
  await gotoAndWait(page, '/');
  await expect(page.getByRole('heading', { name: recipeName, exact: true })).toBeVisible();
});
