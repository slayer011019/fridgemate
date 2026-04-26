import { expect, test } from '@playwright/test';
import { createIngredient, DEFAULT_USER, gotoAndWait, mockApiSession, seedBrowserState } from './support/testApp';

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

test('authenticated API mode saves a new ingredient through the API flow', async ({ page }) => {
  await seedBrowserState(page, {
    session: {
      token: 'test-token',
      user: DEFAULT_USER
    }
  });
  await mockApiSession(page, { user: DEFAULT_USER });
  await gotoAndWait(page, '/ingredients/new');

  await page.getByLabel('이름').fill('두부');
  await page.getByLabel('수량').fill('1모');
  await page.getByLabel('카테고리').selectOption('간편식');
  await page.getByLabel('보관 방식').selectOption('냉장');
  await page.getByRole('button', { name: '재료 추가' }).click();

  await expect(page).toHaveURL(/\/ingredients$/);
  await expect(page.getByText('두부')).toBeVisible();

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('두부')).toBeVisible();
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
  await page.route('**/api/ingredients', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Temporary outage.' })
    })
  );

  await gotoAndWait(page, '/ingredients');

  await expect(page.getByText('김치')).toBeVisible();
  await expect(page.getByRole('main').locator('.card').filter({ hasText: 'The API connection is unstable' })).toBeVisible();
});
