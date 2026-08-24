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

export async function withUserDatabaseScope(userId, operation) {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    throw new Error('A user ID is required for a tenant-scoped database operation.');
  }

  return prisma.$transaction(async (transaction) => {
    const [context] = await transaction.$queryRaw`
      SELECT
        set_config('app.current_user_id', ${normalizedUserId}, true) AS "userId",
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
