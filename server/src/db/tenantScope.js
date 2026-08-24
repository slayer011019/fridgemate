import { prisma } from './prisma.js';
import { serverConfig } from '../config.js';

export function assertSafeTenantDatabaseContext(context, { production = false } = {}) {
  if (!production) {
    return;
  }

  if (!context?.isAppRoleMember || context?.bypassRls || context?.ownsTenantTables) {
    throw new Error(
      'Tenant database access requires a non-owner runtime role with fridgemate_app membership and NOBYPASSRLS.'
    );
  }
}

function normalizeContextValue(value) {
  return String(value || '').trim();
}

export async function withDatabaseScope(
  { userId = '', authEmail = '', refreshTokenHash = '' } = {},
  operation
) {
  const normalizedUserId = normalizeContextValue(userId);
  const normalizedAuthEmail = normalizeContextValue(authEmail);
  const normalizedRefreshTokenHash = normalizeContextValue(refreshTokenHash);

  if (typeof operation !== 'function') {
    throw new Error('A database scope operation is required.');
  }

  return prisma.$transaction(async (transaction) => {
    const [context] = await transaction.$queryRaw`
      SELECT
        set_config('app.current_user_id', ${normalizedUserId}, true) AS "userId",
        set_config('app.current_auth_email', ${normalizedAuthEmail}, true) AS "authEmail",
        set_config('app.current_refresh_token_hash', ${normalizedRefreshTokenHash}, true) AS "refreshTokenHash",
        current_user AS "currentUser",
        COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), true) AS "bypassRls",
        pg_has_role(current_user, 'fridgemate_app', 'member') AS "isAppRoleMember",
        EXISTS (
          SELECT 1
          FROM pg_class AS tenant_table
          INNER JOIN pg_namespace AS tenant_schema
            ON tenant_schema.oid = tenant_table.relnamespace
          WHERE tenant_schema.nspname = 'public'
            AND tenant_table.relname IN ('Ingredient', 'ImportCorrection')
            AND pg_get_userbyid(tenant_table.relowner) = current_user
        ) AS "ownsTenantTables"
    `;

    assertSafeTenantDatabaseContext(context, {
      production: serverConfig.nodeEnv === 'production'
    });
    return operation(transaction);
  });
}

export async function setTransactionUserId(transaction, userId) {
  const normalizedUserId = normalizeContextValue(userId);

  if (!normalizedUserId) {
    throw new Error('A user ID is required for a tenant-scoped database operation.');
  }

  await transaction.$queryRaw`
    SELECT set_config('app.current_user_id', ${normalizedUserId}, true)
  `;
}

export async function withUserDatabaseScope(userId, operation) {
  const normalizedUserId = normalizeContextValue(userId);

  if (!normalizedUserId) {
    throw new Error('A user ID is required for a tenant-scoped database operation.');
  }

  return withDatabaseScope({ userId: normalizedUserId }, operation);
}
