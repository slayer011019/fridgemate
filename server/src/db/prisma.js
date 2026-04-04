import { PrismaClient } from '@prisma/client';
import { serverConfig } from '../config.js';

export const prisma = new PrismaClient();

export async function getDatabaseHealth() {
  if (!serverConfig.databaseUrl) {
    return 'disconnected';
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch (_error) {
    return 'disconnected';
  }
}
