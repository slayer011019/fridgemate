import { createServer } from 'vite';

async function createTestServer(port, apiUrl) {
  const server = await createServer({
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_ENABLE_OCR': JSON.stringify('true'),
      'import.meta.env.VITE_GA_MEASUREMENT_ID': JSON.stringify('G-E2ETEST')
    },
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true
    }
  });
  await server.listen();
  return server;
}

export default async function globalSetup() {
  const servers = [];

  try {
    servers.push(await createTestServer(4173, ''));
    servers.push(await createTestServer(4174, '/api'));
  } catch (error) {
    await Promise.allSettled(servers.map((server) => server.close()));
    throw error;
  }

  return async () => {
    await Promise.allSettled(servers.map((server) => server.close()));
  };
}
