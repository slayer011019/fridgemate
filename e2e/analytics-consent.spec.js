import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { validateLocalMealPlanPilotExport } from '../src/features/mealPlans/mealPlanPilotExport.js';
import { gotoAndWait, seedBrowserState } from './support/testApp';
import { GOOGLE_ANALYTICS_REQUEST_PATTERN } from './support/analyticsRequestPattern.js';

async function pilotBrowserState(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('fridgemate-db__guest');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['mealPlanPilot', 'mealPlans'], 'readonly');
      const pilot = tx.objectStore('mealPlanPilot').get('session');
      const plans = tx.objectStore('mealPlans').getAll();
      tx.oncomplete = () => {
        const row = pilot.result;
        db.close();
        resolve({ status: row?.status, version: row?.version, subjectId: row?.subjectId,
          startedAt: row?.startedAt, expiresAt: row?.expiresAt, events: row?.events || [], gaps: row?.gaps || [],
          plans: plans.result.map(plan => ({ revision: plan.revision, hasDraft: Boolean(plan.draft),
            hasConfirmed: Boolean(plan.confirmed) })) });
      };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
}

async function startLocalPilot(page) {
  await gotoAndWait(page, '/pilot');
  await expect(page.getByRole('heading', { name: '식단 파일럿 참여', exact: true })).toBeVisible();
  const checkbox = page.getByRole('checkbox', { name: '이 기기에 식단 파일럿 기록을 저장하는 데 동의해요' });
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.getByRole('button', { name: '동의하고 기록 시작' }).click();
  await expect(page.getByRole('button', { name: '파일럿 기록 내려받기' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '앞으로 기록 재개' })).toHaveCount(0);
}

test('local pilot records only opted-in outcomes and manually exports without enabling general analytics', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-09-28T08:00:00.000Z'));
  await page.setViewportSize({ width: 390, height: 844 });
  await seedBrowserState(page);
  let analyticsRequests = 0;
  await page.route(GOOGLE_ANALYTICS_REQUEST_PATTERN, async route => {
    analyticsRequests += 1;
    await route.abort();
  });
  await startLocalPilot(page);
  const initial = await pilotBrowserState(page);
  expect(initial.events).toEqual([]);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^noindex(?:,|$)/);
  await page.getByRole('link', { name: '주간 식단', exact: true }).click();
  await page.getByRole('button', { name: '한 주 식단 만들기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이 식단 확정', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '이 식단 확정', exact: true }).click();
  await expect(page.getByText('식단을 확정했어요.', { exact: true })).toBeVisible();
  await expect.poll(async () => (await pilotBrowserState(page)).events.map(event => event.name).sort()).toEqual([
    'meal_plan_confirmed', 'meal_plan_generated', 'meal_plan_generation_started',
  ]);
  await page.getByRole('link', { name: '식단 파일럿', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: '파일럿 기록 내려받기' }).click(),
  ]);
  const exported = validateLocalMealPlanPilotExport(JSON.parse(await readFile(await download.path(), 'utf8')));
  expect(exported.measurementUnit).toBe('browser-scope');
  expect(exported.dataset.subjects[0].firstGenerationKnown).toBe(false);
  expect(exported.dataset.events).toHaveLength(3);
  expect(JSON.stringify(exported)).not.toMatch(/aliasSecret|"scope"|week:|:dinner|requestKey|sourceToken|recipeId|ingredientId/);
  expect(await page.evaluate(() => localStorage.getItem('fridgemate-analytics-consent'))).toBe('denied');
  expect(analyticsRequests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('main').screenshot({ path: testInfo.outputPath('pilot-mobile-active.png') });
  const before = await pilotBrowserState(page);
  await page.getByRole('button', { name: '참여 철회 및 기록 삭제' }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  expect((await pilotBrowserState(page)).version).toBe(before.version);
  await page.getByRole('button', { name: '참여 철회 및 기록 삭제' }).click();
  await page.getByRole('button', { name: '철회 및 삭제 확인' }).click();
  await expect.poll(async () => (await pilotBrowserState(page)).status).toBe('withdrawn');
  const after = await pilotBrowserState(page);
  expect(after.events).toEqual([]);
  expect(after.subjectId).toBeUndefined();
  expect(after.plans).toEqual(before.plans);
});

test('local pilot write failure preserves a saved plan and requires explicit observation recovery', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-09-28T08:00:00.000Z'));
  await seedBrowserState(page);
  await startLocalPilot(page);
  await page.clock.setFixedTime(new Date('2026-09-28T08:00:01.000Z'));
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    window.__restorePilotWrites = () => { IDBObjectStore.prototype.put = put; };
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'mealPlanPilot') throw new DOMException('synthetic pilot quota', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await page.getByRole('link', { name: '주간 식단', exact: true }).click();
  await page.getByRole('button', { name: '한 주 식단 만들기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이 식단 확정', exact: true })).toBeEnabled();
  const afterBusiness = await pilotBrowserState(page);
  expect(afterBusiness.plans).toEqual([{ revision: 1, hasDraft: true, hasConfirmed: false }]);
  expect(afterBusiness.events).toEqual([]);
  await expect(page.getByRole('link', { name: '파일럿 상태 확인' })).toBeVisible();
  await page.evaluate(() => window.__restorePilotWrites());
  await page.getByRole('link', { name: '파일럿 상태 확인' }).click();
  await expect(page.getByRole('button', { name: '앞으로 기록 재개' })).toBeEnabled();
  await page.clock.setFixedTime(new Date('2026-09-28T08:00:02.000Z'));
  await page.getByRole('button', { name: '앞으로 기록 재개' }).click();
  await expect(page.getByRole('button', { name: '앞으로 기록 재개' })).toHaveCount(0);
  const resumed = await pilotBrowserState(page);
  expect(resumed.events).toEqual([]);
  expect(resumed.gaps).toEqual([{ from: '2026-09-28T08:00:00.000Z', through: '2026-09-28T08:00:02.000Z', reason: 'missing' }]);
  expect(resumed.plans).toEqual(afterBusiness.plans);
  await page.locator('main').screenshot({ path: testInfo.outputPath('pilot-missing-observation.png') });
});

test('local pilot reload does not fabricate continuous observation or renew the consent period', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-28T08:00:00.000Z'));
  await seedBrowserState(page);
  await startLocalPilot(page);
  const initial = await pilotBrowserState(page);
  await page.clock.setFixedTime(new Date('2026-09-28T09:00:00.000Z'));
  await page.reload();
  await expect(page.getByRole('button', { name: '앞으로 기록 재개' })).toBeEnabled();
  const beforeResume = await pilotBrowserState(page);
  expect(beforeResume.events).toEqual([]);
  expect(beforeResume.expiresAt).toBe(initial.expiresAt);
  await page.getByRole('button', { name: '앞으로 기록 재개' }).click();
  await expect(page.getByRole('button', { name: '앞으로 기록 재개' })).toHaveCount(0);
  const resumed = await pilotBrowserState(page);
  expect(resumed.version).toBe(initial.version);
  expect(resumed.subjectId).toBe(initial.subjectId);
  expect(resumed.expiresAt).toBe(initial.expiresAt);
  expect(resumed.gaps).toEqual([{ from: '2026-09-28T08:00:00.000Z', through: '2026-09-28T09:00:00.000Z', reason: 'missing' }]);
  expect(resumed.events).toEqual([]);
});

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

  await expect(page.getByRole('heading', { name: '이번 주 저녁부터 정해볼까요?' })).toBeVisible();
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
