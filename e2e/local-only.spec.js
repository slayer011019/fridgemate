import { expect, test } from '@playwright/test';
import { createIngredient, gotoAndWait, readBrowserIngredients, seedBrowserState } from './support/testApp';

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

test('shopping edits survive a local write failure and persist after automatic retry', async ({ page }) => {
  const ingredient = createIngredient('shopping-milk', {
    clientId: 'shopping-milk', name: '우유', category: '유제품', quantity: '1통', memo: '기존 메모', consumed: true
  });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await seedBrowserState(page, { ingredients: [ingredient] });
  await gotoAndWait(page, '/ingredients');
  const quantity = page.getByRole('textbox', { name: '다음 구매 수량' });
  const memo = page.getByRole('textbox', { name: '장보기 메모', exact: true });
  await expect(quantity).toHaveValue('1통');

  // Abort only this fixture's ingredient write; reads, seed data and other stores stay real.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, ...args) {
      if (this.name === 'ingredients' && this.transaction.db.name === 'fridgemate-db__guest'
        && value.id === 'shopping-milk') {
        throw new DOMException('Fixture storage is full', 'QuotaExceededError');
      }
      return original.call(this, value, ...args);
    };
    window.__FRIDGEMATE_TEST__.restoreShoppingWrite = () => {
      IDBObjectStore.prototype.put = original;
      delete window.__FRIDGEMATE_TEST__.restoreShoppingWrite;
    };
  });

  await quantity.fill('2통');
  await memo.fill('작은 팩으로 구매');
  await expect(page.getByText('저장 실패', { exact: true })).toBeVisible();
  await expect(page.getByText('저장됨', { exact: true })).toHaveCount(0);
  await expect(quantity).toHaveValue('2통');
  await expect(memo).toHaveValue('작은 팩으로 구매');
  expect(await readBrowserIngredients(page, 'guest')).toEqual([ingredient]);

  await page.evaluate(() => window.__FRIDGEMATE_TEST__.restoreShoppingWrite());
  await expect(page.getByText('저장됨', { exact: true })).toBeVisible();
  await expect(page.getByText('저장 실패', { exact: true })).toHaveCount(0);
  expect(await readBrowserIngredients(page, 'guest')).toEqual([
    { ...ingredient, quantity: '2통', memo: '작은 팩으로 구매' }
  ]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(quantity).toHaveValue('2통');
  await expect(memo).toHaveValue('작은 팩으로 구매');
  expect(pageErrors).toEqual([]);
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
