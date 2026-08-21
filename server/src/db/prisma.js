import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { serverConfig } from '../config.js';

const requestClients = new AsyncLocalStorage();

function createPrismaClient() {
  const adapter = serverConfig.databaseUrl ? new PrismaPg({ connectionString: serverConfig.databaseUrl }) : null;
  return adapter ? new PrismaClient({ adapter }) : new PrismaClient();
}

const sharedClient = serverConfig.runtime === 'node' ? createPrismaClient() : null;

function getActiveClient() {
  const client = requestClients.getStore() || sharedClient;

  if (!client) {
    throw new Error('Prisma client is unavailable outside a Cloudflare request scope.');
  }

  return client;
}

export const prisma = new Proxy(
  {},
  {
    get(_target, property) {
      const client = getActiveClient();
      const value = client[property];
      return typeof value === 'function' ? value.bind(client) : value;
    }
  }
);

export function prismaRequestScope(_request, response, next) {
  if (serverConfig.runtime !== 'cloudflare') {
    next();
    return;
  }

  const client = createPrismaClient();
  let disconnected = false;
  const disconnect = () => {
    if (disconnected) return;
    disconnected = true;
    void client.$disconnect();
  };

  response.once('finish', disconnect);
  response.once('close', disconnect);
  requestClients.run(client, next);
}

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
