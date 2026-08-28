import { expect, test } from '@playwright/test';
import {
  createIngredient,
  createMockApiBackend,
  DEFAULT_USER,
  gotoAndWait,
  mockApiSession,
  readBrowserIngredients,
  seedBrowserState,
  writeBrowserIngredients
} from './support/testApp.js';

const API_BASE_URL = 'http://127.0.0.1:4174';
const USER_SCOPE = 'user:user-1';

function timestamp(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function createDevice(browser, backend, user = DEFAULT_USER) {
  const context = await browser.newContext({ baseURL: API_BASE_URL });
  const page = await context.newPage();
  await seedBrowserState(page, {
    session: { token: 'test-token', user },
    scope: `user:${user.id}`
  });
  await mockApiSession(page, { user, restoreSession: true, backend });
  await gotoAndWait(page, '/account');
  return { context, page };
}

async function confirmAccountAction(page, name) {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name }).click();
}

async function backup(page) {
  await gotoAndWait(page, '/account');
  await confirmAccountAction(page, '서버에 백업하기');
  await expect(page.getByText('로컬 변경사항을 서버와 병합했습니다.')).toBeVisible();
}

async function pull(page) {
  await gotoAndWait(page, '/account');
  await confirmAccountAction(page, '서버에서 가져오기');
  await expect(page.getByText('로컬 변경사항을 서버와 병합했습니다.')).toBeVisible();
}

test('propagates one clientId from device A to B without duplicates', async ({ browser }) => {
  const backend = createMockApiBackend();
  const deviceA = await createDevice(browser, backend);
  const deviceB = await createDevice(browser, backend);

  try {
    await gotoAndWait(deviceA.page, '/ingredients/new');
    await deviceA.page.getByLabel('이름').fill('두부');
    await deviceA.page.getByLabel('수량').fill('1모');
    await deviceA.page.getByLabel('카테고리').selectOption('간편식');
    await deviceA.page.getByLabel('보관 방식').selectOption('냉장');
    await deviceA.page.getByRole('button', { name: '재료 추가' }).click();

    const [created] = await readBrowserIngredients(deviceA.page, USER_SCOPE);
    await backup(deviceA.page);
    await pull(deviceB.page);

    const deviceBRecords = await readBrowserIngredients(deviceB.page, USER_SCOPE);
    expect(deviceBRecords.filter((ingredient) => ingredient.clientId === created.clientId)).toHaveLength(1);
    expect(backend.ingredients.filter((ingredient) => ingredient.clientId === created.clientId)).toHaveLength(1);

    await backup(deviceA.page);
    await pull(deviceB.page);
    expect(backend.ingredients.filter((ingredient) => ingredient.clientId === created.clientId)).toHaveLength(1);
  } finally {
    await Promise.all([deviceA.context.close(), deviceB.context.close()]);
  }
});

test('keeps the newest device edit and rejects an older retry', async ({ browser }) => {
  const initial = createIngredient('server-record', {
    clientId: 'shared-edit',
    name: '초기값',
    updatedAt: timestamp(-60_000),
    deletedAt: null
  });
  const backend = createMockApiBackend({ ingredients: [initial] });
  const deviceA = await createDevice(browser, backend);
  const deviceB = await createDevice(browser, backend);

  try {
    await Promise.all([pull(deviceA.page), pull(deviceB.page)]);
    const editA = { ...initial, name: '기기 A 수정', updatedAt: timestamp(-20_000), syncState: 'pendingUpdate' };
    const editB = { ...initial, name: '기기 B 최신 수정', updatedAt: timestamp(-10_000), syncState: 'pendingUpdate' };
    await writeBrowserIngredients(deviceA.page, USER_SCOPE, [editA]);
    await writeBrowserIngredients(deviceB.page, USER_SCOPE, [editB]);
    await deviceA.page.reload();
    await deviceB.page.reload();

    await backup(deviceA.page);
    await backup(deviceB.page);
    expect(backend.ingredients).toEqual([expect.objectContaining({ clientId: 'shared-edit', name: '기기 B 최신 수정' })]);

    await writeBrowserIngredients(deviceA.page, USER_SCOPE, [editA]);
    await deviceA.page.reload();
    await backup(deviceA.page);

    expect(backend.ingredients).toEqual([expect.objectContaining({ clientId: 'shared-edit', name: '기기 B 최신 수정' })]);
    expect(await readBrowserIngredients(deviceA.page, USER_SCOPE)).toEqual([
      expect.objectContaining({ clientId: 'shared-edit', name: '기기 B 최신 수정', syncState: 'clean' })
    ]);
  } finally {
    await Promise.all([deviceA.context.close(), deviceB.context.close()]);
  }
});

test('persists pending changes across a 5xx, reload, and later recovery', async ({ browser }) => {
  const backend = createMockApiBackend();
  const device = await createDevice(browser, backend);
  const pending = createIngredient('offline-create', {
    clientId: 'offline-create',
    name: '오프라인 감자',
    createdAt: timestamp(-2_000),
    updatedAt: timestamp(-1_000),
    syncState: 'pendingCreate',
    lastSyncedAt: null
  });

  try {
    await writeBrowserIngredients(device.page, USER_SCOPE, [pending]);
    backend.syncFailureStatus = 500;
    await device.page.reload();
    await gotoAndWait(device.page, '/account');
    await confirmAccountAction(device.page, '서버에 백업하기');
    await expect(device.page.getByRole('main').getByText('Temporary sync failure.')).toBeVisible();

    await device.page.reload();
    expect(await readBrowserIngredients(device.page, USER_SCOPE)).toEqual([
      expect.objectContaining({ clientId: 'offline-create', syncState: 'pendingCreate' })
    ]);

    backend.syncFailureStatus = null;
    await backup(device.page);
    expect(await readBrowserIngredients(device.page, USER_SCOPE)).toEqual([
      expect.objectContaining({ clientId: 'offline-create', syncState: 'clean' })
    ]);
  } finally {
    await device.context.close();
  }
});

test('keeps a tombstone when an older device retries an active record', async ({ browser }) => {
  const initial = createIngredient('server-delete', {
    clientId: 'shared-delete',
    name: '삭제 대상',
    updatedAt: timestamp(-60_000),
    deletedAt: null
  });
  const backend = createMockApiBackend({ ingredients: [initial] });
  const deviceA = await createDevice(browser, backend);
  const deviceB = await createDevice(browser, backend);

  try {
    await Promise.all([pull(deviceA.page), pull(deviceB.page)]);
    const staleActive = { ...initial, updatedAt: timestamp(-20_000), syncState: 'pendingUpdate' };
    const deletedAt = timestamp(-10_000);
    const tombstone = {
      ...initial,
      updatedAt: deletedAt,
      deletedAt,
      syncState: 'pendingDelete'
    };

    await writeBrowserIngredients(deviceA.page, USER_SCOPE, [tombstone]);
    await deviceA.page.reload();
    await backup(deviceA.page);

    await writeBrowserIngredients(deviceB.page, USER_SCOPE, [staleActive]);
    await deviceB.page.reload();
    await backup(deviceB.page);
    await pull(deviceB.page);

    expect(backend.ingredients).toEqual([
      expect.objectContaining({ clientId: 'shared-delete', deletedAt, name: '삭제 대상' })
    ]);
    expect((await readBrowserIngredients(deviceB.page, USER_SCOPE))[0]).toMatchObject({
      clientId: 'shared-delete',
      deletedAt,
      syncState: 'clean'
    });
    await gotoAndWait(deviceB.page, '/ingredients');
    await expect(deviceB.page.getByRole('heading', { name: '삭제 대상' })).toHaveCount(0);

    await writeBrowserIngredients(deviceA.page, USER_SCOPE, [tombstone]);
    await deviceA.page.reload();
    await backup(deviceA.page);
    expect(backend.ingredients).toHaveLength(1);
  } finally {
    await Promise.all([deviceA.context.close(), deviceB.context.close()]);
  }
});

test('isolates two accounts even when they use the same clientId', async ({ browser }) => {
  const userA = { id: 'user-a', email: 'a@example.com' };
  const userB = { id: 'user-b', email: 'b@example.com' };
  const backendA = createMockApiBackend();
  const backendB = createMockApiBackend();
  const deviceA = await createDevice(browser, backendA, userA);
  const deviceB = await createDevice(browser, backendB, userB);
  const sharedClientId = 'same-client-id';
  const updatedAt = timestamp(-1_000);
  const ingredientA = createIngredient('server-a-secret', {
    clientId: sharedClientId,
    name: '사용자 A 재료',
    createdAt: updatedAt,
    updatedAt,
    syncState: 'pendingCreate'
  });
  const ingredientB = createIngredient('server-b-own', {
    clientId: sharedClientId,
    name: '사용자 B 재료',
    createdAt: updatedAt,
    updatedAt,
    syncState: 'pendingCreate'
  });

  try {
    await writeBrowserIngredients(deviceA.page, 'user:user-a', [ingredientA]);
    await writeBrowserIngredients(deviceB.page, 'user:user-b', [ingredientB]);
    await deviceA.page.reload();
    await deviceB.page.reload();
    await backup(deviceA.page);
    await backup(deviceB.page);

    expect(backendA.ingredients).toEqual([
      expect.objectContaining({ id: 'server-a-secret', clientId: sharedClientId, name: '사용자 A 재료' })
    ]);
    expect(backendB.ingredients).toEqual([
      expect.objectContaining({ id: 'server-b-own', clientId: sharedClientId, name: '사용자 B 재료' })
    ]);

    const attackStatuses = await deviceB.page.evaluate(async () => {
      const requests = [
        fetch('/api/ingredients/server-a-secret'),
        fetch('/api/ingredients/server-a-secret', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '공격 수정' })
        }),
        fetch('/api/ingredients/server-a-secret', { method: 'DELETE' })
      ];
      return Promise.all(requests).then((responses) => responses.map((response) => response.status));
    });
    expect(attackStatuses).toEqual([404, 404, 404]);
    expect(backendA.ingredients[0]).toMatchObject({ name: '사용자 A 재료' });

    const forged = createIngredient('forged-b-row', {
      clientId: 'forged-owner',
      name: '사용자 B 소유',
      updatedAt: timestamp(-500),
      userId: 'user-a'
    });
    const forgedStatus = await deviceB.page.evaluate(async (change) => {
      const response = await fetch('/api/ingredients/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: [change], userId: 'user-a' })
      });
      return response.status;
    }, forged);

    expect(forgedStatus).toBe(200);
    expect(backendB.ingredients.find((ingredient) => ingredient.clientId === 'forged-owner')).not.toHaveProperty(
      'userId'
    );
    expect(backendA.ingredients).toHaveLength(1);
  } finally {
    await Promise.all([deviceA.context.close(), deviceB.context.close()]);
  }
});
