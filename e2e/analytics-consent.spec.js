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

  await expect
    .poll(() =>
      page.evaluate(() => ({
        analyticsId: window.localStorage.getItem('fridgemate-analytics-id'),
        dataLayerLength: window.dataLayer.length,
        eventCount: window.__FRIDGEMATE_ANALYTICS_EVENTS__?.length || 0,
        gtagType: typeof window.gtag,
        scriptCount: document.querySelectorAll('script[data-fridgemate-ga]').length,
        sessionId: window.sessionStorage.getItem('fridgemate-analytics-session-id')
      }))
    )
    .toEqual({
      analyticsId: null,
      dataLayerLength: 0,
      eventCount: 0,
      gtagType: 'undefined',
      scriptCount: 0,
      sessionId: null
    });
  await page.getByRole('link', { name: '서비스 소개' }).click();
  await expect(page).toHaveURL(/\/about$/u);
  await expect.poll(() => page.evaluate(() => window.dataLayer.length)).toBe(0);
  expect(googleAnalyticsRequests).toBe(1);
});

test('a blocked consent read does not break the app or enable analytics', async ({ page }) => {
  let googleAnalyticsRequests = 0;
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    googleAnalyticsRequests += 1;
    await route.abort();
  });
  await seedBrowserState(page, { analyticsConsent: null });
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'fridgemate-analytics-consent') {
        throw new DOMException('synthetic blocked storage', 'SecurityError');
      }
      return getItem.call(this, key);
    };
  });

  await gotoAndWait(page, '/');

  await expect(page.getByRole('heading', { name: '남은 재료로 오늘 메뉴를 골라보세요' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: /서비스 개선을 위한 이용 분석/u })).toBeVisible();
  await page.getByRole('button', { name: '분석 허용' }).click();
  await expect(page.getByRole('alert')).toContainText('현재 탭에서는 분석을 중지');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('link', { name: '서비스 소개' }).click();
  await expect(page).toHaveURL(/\/about$/u);
  expect(await page.evaluate(() => ({
    events: window.__FRIDGEMATE_ANALYTICS_EVENTS__?.length || 0,
    scripts: document.querySelectorAll('script[data-fridgemate-ga]').length
  }))).toEqual({ events: 0, scripts: 0 });
  expect(googleAnalyticsRequests).toBe(0);
});

test('failed withdrawal stops analytics in this page without claiming the saved approval was removed', async ({ page }) => {
  let googleAnalyticsRequests = 0;
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    googleAnalyticsRequests += 1;
    await route.abort();
  });
  await seedBrowserState(page, { analyticsConsent: 'granted' });
  await gotoAndWait(page, '/');
  await expect.poll(() => googleAnalyticsRequests).toBe(1);
  await page.getByRole('button', { name: '분석 설정' }).click();
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'fridgemate-analytics-consent') {
        throw new DOMException('synthetic blocked storage', 'SecurityError');
      }
      return setItem.call(this, key, value);
    };
  });

  await page.getByRole('button', { name: '필수 기능만' }).click();
  await expect(page.getByRole('alert')).toContainText('다른 탭이나 다시 연 페이지');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('fridgemate-analytics-consent'))).toBe('granted');
  await page.getByRole('link', { name: '서비스 소개' }).click();
  await expect(page).toHaveURL(/\/about$/u);
  expect(await page.evaluate(() => ({
    events: window.__FRIDGEMATE_ANALYTICS_EVENTS__?.length || 0,
    scripts: document.querySelectorAll('script[data-fridgemate-ga]').length,
    dataLayer: window.dataLayer,
    gtagType: typeof window.gtag
  }))).toEqual({ events: 0, scripts: 0, dataLayer: [], gtagType: 'undefined' });
  expect(googleAnalyticsRequests).toBe(1);
});

for (const change of ['denied', 'removed', 'clear']) {
  test(`another tab's ${change} consent change stops this tab without a reload`, async ({ page, context }) => {
    await context.route('https://www.googletagmanager.com/**', route => route.abort());
    await seedBrowserState(page, { analyticsConsent: 'granted' });
    await gotoAndWait(page, '/');
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('script[data-fridgemate-ga]').length)).toBe(1);
    const other = await context.newPage();
    // Do not seed the second tab: it must share the existing same-origin storage.
    await gotoAndWait(other, '/about');
    if (change === 'denied') {
      await other.getByRole('button', { name: '분석 설정' }).click();
      await other.getByRole('button', { name: '필수 기능만' }).click();
    } else {
      await other.evaluate((operation) => {
        if (operation === 'clear') window.localStorage.clear();
        else window.localStorage.removeItem('fridgemate-analytics-consent');
      }, change);
    }
    await expect.poll(() => page.evaluate(() => ({
      events: window.__FRIDGEMATE_ANALYTICS_EVENTS__?.length || 0,
      scripts: document.querySelectorAll('script[data-fridgemate-ga]').length,
      session: window.sessionStorage.getItem('fridgemate-analytics-session-id'),
      gtagType: typeof window.gtag
    }))).toEqual({ events: 0, scripts: 0, session: null, gtagType: 'undefined' });
    if (change !== 'denied') await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('link', { name: '서비스 소개' }).click();
    await expect(page).toHaveURL(/\/about$/u);
    expect(await page.evaluate(() => window.__FRIDGEMATE_ANALYTICS_EVENTS__?.length || 0)).toBe(0);
    await other.close();
  });
}

test('a grant in another tab cannot undo this tab\'s failed withdrawal', async ({ page, context }) => {
  await context.route('https://www.googletagmanager.com/**', route => route.abort());
  await seedBrowserState(page, { analyticsConsent: 'granted' });
  await gotoAndWait(page, '/');
  await page.getByRole('button', { name: '분석 설정' }).click();
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'fridgemate-analytics-consent') throw new DOMException('Synthetic failure', 'SecurityError');
      return setItem.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: '필수 기능만' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  const other = await context.newPage();
  await gotoAndWait(other, '/about');
  // Force genuine value transitions so the browser delivers storage notifications.
  await other.getByRole('button', { name: '분석 설정' }).click();
  await other.getByRole('button', { name: '필수 기능만' }).click();
  await other.getByRole('button', { name: '분석 설정' }).click();
  await other.getByRole('button', { name: '분석 허용' }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('fridgemate-analytics-consent'))).toBe('granted');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('link', { name: '서비스 소개' }).click();
  await expect(page).toHaveURL(/\/about$/u);
  expect(await page.evaluate(() => ({
    events: window.__FRIDGEMATE_ANALYTICS_EVENTS__?.length || 0,
    scripts: document.querySelectorAll('script[data-fridgemate-ga]').length,
    gtagType: typeof window.gtag
  }))).toEqual({ events: 0, scripts: 0, gtagType: 'undefined' });
  await other.close();
});
