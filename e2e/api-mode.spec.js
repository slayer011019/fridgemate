import { expect, test } from '@playwright/test';
import {
  createIngredient,
  DEFAULT_USER,
  gotoAndWait,
  mockApiSession,
  seedBrowserState,
  waitForIngredientNames
} from './support/testApp';

async function clickServerBackupButton(page) {
  const backupButton = page.getByRole('button', { name: '서버에 백업하기' });
  await expect(backupButton).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await backupButton.click();
}

test('protected account route redirects to login and returns after successful login', async ({ page }) => {
  await seedBrowserState(page);
  await mockApiSession(page, { user: DEFAULT_USER });
  await gotoAndWait(page, '/account');

  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('이메일').fill('user@example.com');
  await page.getByLabel('비밀번호').fill('password123');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'user@example.com' })).toBeVisible();
});

test('authenticated API mode saves a new ingredient locally until manual sync', async ({ page }) => {
  await seedBrowserState(page, {
    session: {
      token: 'test-token',
      user: DEFAULT_USER
    }
  });
  await mockApiSession(page, { user: DEFAULT_USER, restoreSession: true });
  await gotoAndWait(page, '/ingredients/new');

  await page.getByLabel('이름').fill('두부');
  await page.getByLabel('수량').fill('1모');
  await page.getByLabel('카테고리').selectOption('간편식');
  await page.getByLabel('보관 방식').selectOption('냉장');
  await page.getByRole('button', { name: '재료 추가' }).click();

  await expect(page).toHaveURL(/\/ingredients$/);
  await expect(page.getByRole('heading', { name: '두부' })).toBeVisible();

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: '두부' })).toBeVisible();
});

test('guest ingredients can be imported after login and synced manually', async ({ page }) => {
  const apiState = await mockApiSession(page, { user: DEFAULT_USER });

  await seedBrowserState(page);
  await gotoAndWait(page, '/ingredients/new');

  await page.getByLabel('이름').fill('감자');
  await page.getByLabel('수량').fill('3개');
  await page.getByLabel('카테고리').selectOption('채소');
  await page.getByLabel('보관 방식').selectOption('상온');
  await page.getByRole('button', { name: '재료 추가' }).click();

  await expect(page).toHaveURL(/\/ingredients$/);
  await expect(page.getByRole('heading', { name: '감자' })).toBeVisible();
  expect(apiState.ingredients).toEqual([]);

  await gotoAndWait(page, '/login');
  await page.getByLabel('이메일').fill('user@example.com');
  await page.getByLabel('비밀번호').fill('password123');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('게스트 모드에서 1개의 재료를 찾았어요.')).toBeVisible();
  await page.getByRole('button', { name: '게스트 재료 가져오기' }).click();
  await expect(page.getByText('동기화되지 않은 변경사항').locator('..').getByText('있습니다')).toBeVisible();
  await waitForIngredientNames(page, 'user:user-1', ['감자']);

  await clickServerBackupButton(page);
  await expect(page.getByText('로컬 변경사항을 서버와 병합했습니다.')).toBeVisible();
  expect(apiState.ingredients.map((ingredient) => ingredient.name)).toContain('감자');

  await page.reload();
  await page.waitForLoadState('networkidle');
  await gotoAndWait(page, '/ingredients');
  await expect(page.getByRole('heading', { name: '감자' })).toBeVisible();

  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByRole('heading', { name: '감자' })).toHaveCount(0);
  await waitForIngredientNames(page, 'user:user-1', []);
  expect(apiState.ingredients.map((ingredient) => ingredient.name)).toContain('감자');

  await gotoAndWait(page, '/account');
  await clickServerBackupButton(page);
  await expect(page.getByText('로컬 변경사항을 서버와 병합했습니다.')).toBeVisible();
  expect(apiState.ingredients.filter((ingredient) => !ingredient.deletedAt).map((ingredient) => ingredient.name)).not.toContain(
    '감자'
  );
  expect(apiState.ingredients).toEqual([
    expect.objectContaining({ name: '감자', deletedAt: expect.any(String) })
  ]);
});

test('expired session clears stored auth and returns to login', async ({ page }) => {
  await seedBrowserState(page, {
    session: {
      token: 'test-token',
      user: DEFAULT_USER
    }
  });

  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'The current session is no longer valid.' })
    })
  );

  await gotoAndWait(page, '/account');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.evaluate(() => window.localStorage.getItem('fridgemate-auth-session'))).resolves.toBeNull();
});

test('authenticated API mode falls back to the user cache when the ingredient API returns a server error', async ({ page }) => {
  await seedBrowserState(page, {
    session: {
      token: 'test-token',
      user: DEFAULT_USER
    },
    scope: 'user:user-1',
    ingredients: [createIngredient('cached-1', { name: '김치', syncState: 'clean' })]
  });

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_USER)
    })
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: DEFAULT_USER })
    })
  );
  await page.route('**/api/ingredients', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Temporary outage.' })
    })
  );

  await gotoAndWait(page, '/ingredients');

  await expect(page.getByText('김치')).toBeVisible();
});
