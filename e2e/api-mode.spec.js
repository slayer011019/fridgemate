import { expect, test } from '@playwright/test';
import {
  createIngredient,
  DEFAULT_USER,
  gotoAndWait,
  mockApiSession,
  seedBrowserState,
  waitForIngredientNames
} from './support/testApp';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6OZsAAAAASUVORK5CYII=',
  'base64'
);

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
    {
      id: expect.any(String),
      clientId: expect.any(String),
      updatedAt: expect.any(String),
      deletedAt: expect.any(String)
    }
  ]);
});

test('menu selection keeps a pending copy after 5xx and succeeds on explicit retry', async ({ page }) => {
  await seedBrowserState(page, {
    session: { token: 'test-token', user: DEFAULT_USER },
    scope: 'user:user-1',
    ingredients: [createIngredient('egg-1', { name: '계란', expiryDate: '2026-09-02' })]
  });
  const apiState = await mockApiSession(page, { user: DEFAULT_USER, restoreSession: true });
  apiState.backend.menuDecisionFailureStatus = 503;
  await gotoAndWait(page, '/recipes');

  const firstCard = page.locator('article').filter({ has: page.getByRole('button', { name: '오늘 먹기' }) }).first();
  await firstCard.getByRole('button', { name: '오늘 먹기' }).click();
  await gotoAndWait(page, '/');
  await expect(page.getByRole('button', { name: '서버 저장 다시 시도' })).toBeVisible();

  apiState.backend.menuDecisionFailureStatus = null;
  await page.getByRole('button', { name: '서버 저장 다시 시도' }).click();
  await expect(page.getByRole('button', { name: '서버 저장 다시 시도' })).toHaveCount(0);
  expect(apiState.backend.menuDecision).toMatchObject({ status: 'selected', userId: 'user-1' });
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

test('temporary session verification failure locks the user cache instead of restoring stale identity', async ({ page }) => {
  await seedBrowserState(page, {
    session: {
      token: 'test-token',
      user: DEFAULT_USER
    },
    scope: 'user:user-1',
    ingredients: [createIngredient('cached-private-1', { name: '개인용 김치', syncState: 'clean' })]
  });

  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Temporary outage.' })
    })
  );

  await gotoAndWait(page, '/account');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/안전을 위해 로그아웃했습니다/)).toBeVisible();
  await expect(page.evaluate(() => window.localStorage.getItem('fridgemate-auth-session'))).resolves.toBeNull();

  await gotoAndWait(page, '/ingredients');
  await expect(page.getByRole('heading', { name: '개인용 김치' })).toHaveCount(0);
});

test('failed server logout stays fenced across a reload and never refreshes the old session', async ({ page }) => {
  await page.addInitScript((session) => {
    const seedKey = '__fridgemate-auth-fence-seeded__';

    if (window.sessionStorage.getItem(seedKey) === 'done') {
      return;
    }

    window.localStorage.clear();
    window.localStorage.setItem('fridgemate-auth-session', JSON.stringify(session));
    window.sessionStorage.setItem(seedKey, 'done');
  }, { token: 'test-token', user: DEFAULT_USER });

  let refreshRequestCount = 0;
  await page.route('**/api/auth/refresh', (route) => {
    refreshRequestCount += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: DEFAULT_USER })
    });
  });
  await page.route('**/api/auth/logout', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Temporary outage.' })
    })
  );

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: DEFAULT_USER.email })).toBeVisible();
  expect(refreshRequestCount).toBeGreaterThan(0);
  const refreshCountBeforeLogout = refreshRequestCount;

  await page.getByRole('banner').getByRole('button', { name: '로그아웃' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/로그아웃 상태를 다시 확인합니다/)).toBeVisible();
  await expect(
    page.evaluate(() => window.localStorage.getItem('fridgemate-auth-logout-pending:v1'))
  ).resolves.toBe('1');

  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/로그아웃 상태를 다시 확인합니다/)).toBeVisible();
  expect(refreshRequestCount).toBe(refreshCountBeforeLogout);
});

test('import review and local save still work when correction embedding budget is exhausted', async ({ page }) => {
  await seedBrowserState(page, {
    session: {
      token: 'test-token',
      user: DEFAULT_USER
    },
    ocrResult: {
      text: '두부 1모\n우유 1L'
    }
  });
  await mockApiSession(page, { user: DEFAULT_USER, restoreSession: true });
  let limitedRequestCount = 0;

  const returnRateLimit = (route) => {
    limitedRequestCount += 1;
    return route.fulfill({
      status: 429,
      headers: { 'Retry-After': '60' },
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Too many import analysis requests. Please try again later.' })
    });
  };

  await page.route('**/api/import/corrections/suggestions', returnRateLimit);
  await page.route('**/api/import/corrections', returnRateLimit);
  await gotoAndWait(page, '/import');

  await page.getByLabel('사진 고르기').setInputFiles({
    name: 'mock-receipt.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG
  });
  await page.getByRole('button', { name: '사진에서 재료 찾기' }).click();

  await expect(page.getByText('두부', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '선택 항목 저장' }).click();

  await expect(page).toHaveURL(/\/ingredients$/);
  await expect(page.getByRole('heading', { name: '두부' })).toBeVisible();
  expect(limitedRequestCount).toBeGreaterThanOrEqual(1);
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
