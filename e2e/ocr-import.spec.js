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
