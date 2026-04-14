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

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('우유')).toBeVisible();

  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('우유')).toHaveCount(0);
});
