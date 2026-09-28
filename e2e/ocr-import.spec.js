import { expect, test } from '@playwright/test';
import { gotoAndWait, readBrowserIngredients, seedBrowserState } from './support/testApp';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6OZsAAAAASUVORK5CYII=',
  'base64'
);

async function reviewReceipt(page) {
  await page.getByLabel('사진 고르기').setInputFiles({
    name: 'mock-receipt.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG
  });
  await page.getByRole('button', { name: '사진에서 재료 찾기' }).click();
  await expect(page.getByRole('textbox', { name: '이름', exact: true })).toHaveValue('두부');
}

async function readPlanningStores(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('fridgemate-db__guest');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['mealPlans', 'inventoryQuantities', 'inventoryEvents'], 'readonly');
      const plans = tx.objectStore('mealPlans').getAll();
      const quantities = tx.objectStore('inventoryQuantities').getAll();
      const events = tx.objectStore('inventoryEvents').getAll();
      tx.oncomplete = () => { db.close(); resolve({ plans: plans.result, quantities: quantities.result, events: events.result }); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
}

test('AT-00 two packs stay unmeasured and unsaved until the user reviews and saves them', async ({ page }) => {
  await seedBrowserState(page, { ocrResult: { text: '두부 2팩' } });
  await gotoAndWait(page, '/import');
  await reviewReceipt(page);
  await expect(page.getByText('두부 2팩', { exact: true })).toBeVisible();
  const quantity = page.getByRole('textbox', { name: '수량', exact: true });
  await expect(quantity).not.toHaveValue(/\d+\s*(?:g|kg|ml)/i);
  expect(await readBrowserIngredients(page, 'guest')).toEqual([]);
  expect(await readPlanningStores(page)).toEqual({ plans: [], quantities: [], events: [] });
  // The user confirms only package count, never an invented package weight.
  await quantity.fill('2팩');
  await page.getByRole('button', { name: '선택 항목 저장', exact: true }).click();
  await expect(page).toHaveURL(/\/ingredients$/);
  const saved = await readBrowserIngredients(page, 'guest');
  expect(saved).toEqual([expect.objectContaining({ name: '두부', quantity: '2팩' })]);
  expect(await readPlanningStores(page)).toEqual({
    plans: [],
    quantities: [{ id: saved[0].id, revision: 1, schemaVersion: 1, scope: 'guest', status: 'unverified' }],
    events: [],
  });
  await page.reload();
  await expect(page.getByText('두부', { exact: true })).toBeVisible();
  expect((await readBrowserIngredients(page, 'guest'))[0].quantity).toBe('2팩');
});

test('AT-00 a failed image read leaves direct entry and the existing weekly plan available', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-14T08:00:00.000Z'));
  await seedBrowserState(page);
  await gotoAndWait(page, '/');
  await page.getByRole('link', { name: '이번 주 식단 만들기', exact: true }).click();
  await page.getByRole('button', { name: '한 주 식단 만들기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이 식단 확정', exact: true })).toBeEnabled();
  const before = await readPlanningStores(page);
  await gotoAndWait(page, '/import');
  await page.evaluate(() => {
    window.__FRIDGEMATE_TEST__.extractTextFromImage = async () => { throw new Error('테스트 이미지 읽기 실패'); };
  });
  await page.getByLabel('사진 고르기').setInputFiles({ name: 'failed-receipt.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });
  await page.getByRole('button', { name: '사진에서 재료 찾기', exact: true }).click();
  await expect(page.getByText(/사진을 읽는 데 실패했어요/)).toBeVisible();
  expect(await readBrowserIngredients(page, 'guest')).toEqual([]);
  expect(await readPlanningStores(page)).toEqual(before);
  await page.getByRole('link', { name: '추가', exact: true }).click();
  await page.getByLabel('이름').fill('두부');
  await page.getByLabel('수량').fill('2팩');
  await page.getByRole('button', { name: '재료 추가', exact: true }).click();
  await expect(page).toHaveURL(/\/ingredients$/);
  await page.getByRole('link', { name: /주간 식단/ }).click();
  const board = page.getByRole('region', { name: '한 주 저녁 식단표' });
  await expect(board.getByRole('article')).toHaveCount(7);
  const saved = await readBrowserIngredients(page, 'guest');
  expect(saved).toEqual([expect.objectContaining({ name: '두부', quantity: '2팩' })]);
  expect(await readPlanningStores(page)).toEqual({
    plans: before.plans,
    quantities: [{ id: saved[0].id, revision: 1, schemaVersion: 1, scope: 'guest', status: 'unverified' }],
    events: before.events,
  });
});

test('OCR review flow lets the user edit detected items before saving them', async ({ page }) => {
  await seedBrowserState(page, {
    ocrResult: {
      text: '두부 1모\n우유 1L'
    }
  });
  await gotoAndWait(page, '/import');

  await page.getByLabel('사진 고르기').setInputFiles({
    name: 'mock-receipt.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG
  });
  await page.getByRole('button', { name: '사진에서 재료 찾기' }).click();

  await expect(page.getByText('두부', { exact: true })).toBeVisible();
  await page.getByLabel('이름').first().fill('손두부');
  await page.getByRole('button', { name: '선택 항목 저장' }).click();

  await expect(page).toHaveURL(/\/ingredients$/);
  await expect(page.getByText('손두부')).toBeVisible();
});

test('OCR upload rejects spoofed or unsupported image bytes before processing', async ({ page }) => {
  await seedBrowserState(page);
  await gotoAndWait(page, '/import');

  await page.getByLabel('사진 고르기').setInputFiles({
    name: 'spoofed-receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
  });

  await expect(page.getByText('손상되었거나 지원하지 않는 이미지예요. PNG, JPG 또는 WEBP 파일을 선택해주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '사진에서 재료 찾기' })).toBeDisabled();
});

test('OCR import preserves a damaged learning map while saving reviewed inventory', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await seedBrowserState(page, { ocrResult: { text: '두부 1모' } });
  await gotoAndWait(page, '/import');
  await page.evaluate(() => localStorage.setItem('fridgemate-import-corrections:v2:guest', 'null'));

  // Recognition is stubbed by the existing helper; parsing, review and inventory persistence stay real.
  await reviewReceipt(page);
  await page.getByRole('textbox', { name: '수량', exact: true }).fill('1모');
  await page.getByRole('button', { name: '선택 항목 저장' }).click();

  const notice = page.getByRole('status').filter({ hasText: '보정 학습' });
  await expect(notice).toContainText('1개 재료를 냉장고에 저장했어요.');
  await expect(notice).toContainText('보정 학습은 저장하지 못했어요.');
  expect(await page.evaluate(() => localStorage.getItem('fridgemate-import-corrections:v2:guest'))).toBe('null');
  expect(await readBrowserIngredients(page, 'guest')).toEqual([
    expect.objectContaining({ name: '두부', quantity: '1모' })
  ]);
  await expect(page.getByRole('button', { name: '선택 항목 저장' })).toHaveCount(0);
  await page.getByRole('link', { name: '냉장고 보기', exact: true }).click();
  await expect(page).toHaveURL(/\/ingredients$/);
  await expect(page.getByText('두부', { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('OCR import retains manual edits in inventory when learning storage exceeds quota', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await seedBrowserState(page, { ocrResult: { text: '두부 1모' } });
  await gotoAndWait(page, '/import');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'fridgemate-import-corrections:v2:guest') {
        throw new DOMException('private fixture quota detail', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  });

  await reviewReceipt(page);
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('손두부');
  await page.getByRole('textbox', { name: '수량', exact: true }).fill('3모');
  await page.getByRole('button', { name: '선택 항목 저장' }).click();

  const notice = page.getByRole('status').filter({ hasText: '보정 학습' });
  await expect(notice).toContainText('1개 재료를 냉장고에 저장했어요.');
  await expect(notice).toContainText('보정 학습은 저장하지 못했어요.');
  await expect(page.getByText('private fixture quota detail')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('fridgemate-import-corrections:v2:guest'))).toBeNull();
  expect(await readBrowserIngredients(page, 'guest')).toEqual([
    expect.objectContaining({ name: '손두부', quantity: '3모' })
  ]);
  await expect(page.getByRole('button', { name: '선택 항목 저장' })).toHaveCount(0);
  await page.getByRole('link', { name: '냉장고 보기', exact: true }).click();
  await expect(page).toHaveURL(/\/ingredients$/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('손두부', { exact: true })).toBeVisible();
  expect(await readBrowserIngredients(page, 'guest')).toEqual([
    expect.objectContaining({ name: '손두부', quantity: '3모' })
  ]);
  expect(pageErrors).toEqual([]);
});
