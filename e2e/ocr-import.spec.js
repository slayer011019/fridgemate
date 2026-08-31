import { expect, test } from '@playwright/test';
import { gotoAndWait, seedBrowserState } from './support/testApp';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6OZsAAAAASUVORK5CYII=',
  'base64'
);

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
