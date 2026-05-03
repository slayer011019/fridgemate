import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gotoAndWait, seedBrowserState } from './support/testApp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockReceiptPath = path.join(__dirname, 'fixtures', 'mock-receipt.svg');

test('OCR review flow lets the user edit detected items before saving them', async ({ page }) => {
  await seedBrowserState(page, {
    ocrResult: {
      text: '두부 1모\n우유 1L'
    }
  });
  await gotoAndWait(page, '/import');

  await page.getByLabel('사진 고르기').setInputFiles(mockReceiptPath);
  await page.getByRole('button', { name: '사진에서 재료 찾기' }).click();

  await expect(page.getByText('두부', { exact: true })).toBeVisible();
  await page.getByLabel('이름').first().fill('손두부');
  await page.getByRole('button', { name: '선택 항목 저장' }).click();

  await expect(page).toHaveURL(/\/ingredients$/);
  await expect(page.getByText('손두부')).toBeVisible();
});
