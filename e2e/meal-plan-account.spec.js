import { expect, test } from '@playwright/test';
import { DEFAULT_USER, gotoAndWait, mockApiSession, seedBrowserState } from './support/testApp';

test('guest and signed-in meal plans stay separate through login and logout', async ({ page }) => {
  await seedBrowserState(page);
  const api = await mockApiSession(page, { user: DEFAULT_USER });
  await gotoAndWait(page, '/meal-plan');
  await page.getByLabel('피하고 싶은 재료').fill('버섯');
  await page.getByRole('button', { name: '한 주 식단 만들기' }).click();
  await expect(page.getByRole('article')).toHaveCount(7);
  await expect(page.getByRole('button', { name: '고정하지 않은 메뉴 다시 추천' })).toBeEnabled();
  const guestTitles = await page.getByRole('article').getByRole('heading', { level: 3 }).allTextContents();

  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await page.getByLabel('이메일').fill(DEFAULT_USER.email);
  await page.getByLabel('비밀번호').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('link', { name: '주간 식단' }).click();
  await expect(page.getByRole('button', { name: '한 주 식단 만들기' })).toBeEnabled();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByLabel('피하고 싶은 재료')).toHaveValue('');
  await page.getByLabel('피하고 싶은 재료').fill('두부');
  await page.getByLabel('식사 인원').selectOption('2');
  await page.getByRole('button', { name: '한 주 식단 만들기' }).click();
  await expect(page.getByRole('button', { name: '고정하지 않은 메뉴 다시 추천' })).toBeEnabled();

  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByLabel('피하고 싶은 재료')).toHaveValue('버섯');
  await expect(page.getByLabel('식사 인원')).toHaveValue('1');
  await expect(page.getByRole('article').getByRole('heading', { level: 3 })).toHaveText(guestTitles);
  expect(api.ingredients).toEqual([]);
});
