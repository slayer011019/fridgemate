import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { serverConfig } from './config.js';

const app = createApp();

const server = app.listen(serverConfig.port, serverConfig.host, () => {
  console.log(`FridgeMate API listening on ${serverConfig.host}:${serverConfig.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down FridgeMate API...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
