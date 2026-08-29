import { expect, test } from '@playwright/test';
import { gotoAndWait, seedBrowserState } from './support/testApp';

test('analytics stays blocked until consent and stops after withdrawal', async ({ page }) => {
  let googleAnalyticsRequests = 0;
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    googleAnalyticsRequests += 1;
    await route.abort();
  });
  await seedBrowserState(page, { analyticsConsent: null });

  await gotoAndWait(page, '/');

  await expect(page.getByRole('dialog', { name: /서비스 개선을 위한 이용 분석/u })).toBeVisible();
  expect(googleAnalyticsRequests).toBe(0);

  await page.getByRole('button', { name: '분석 허용' }).click();
  await expect.poll(() => googleAnalyticsRequests).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('fridgemate-analytics-consent'))).toBe(
    'granted'
  );

  await page.getByRole('button', { name: '분석 설정' }).click();
  await expect(page.getByText('현재 설정: 이용 분석 허용')).toBeVisible();
  await page.getByRole('button', { name: '필수 기능만' }).click();

  const dataLayerLengthAfterWithdrawal = await page.evaluate(() => window.dataLayer.length);
  await page.getByRole('link', { name: '서비스 소개' }).click();
  await expect(page).toHaveURL(/\/about$/u);
  await expect.poll(() => page.evaluate(() => window.dataLayer.length)).toBe(dataLayerLengthAfterWithdrawal);
  expect(googleAnalyticsRequests).toBe(1);
});
