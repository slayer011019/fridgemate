import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import { configureServerRuntime, validateServerConfig } from './config.js';

configureServerRuntime(env);

const errors = validateServerConfig({ exitOnError: false });

if (errors.length) {
  throw new Error(`Cloudflare Worker configuration is invalid: ${errors.join(' ')}`);
}

const [{ createApp }, { initializeAuthSecurityStore }] = await Promise.all([
  import('./app.js'),
  import('./services/authSecurityStore.js')
]);

await initializeAuthSecurityStore({ kv: env.AUTH_KV });
createApp().listen(3000);

export default httpServerHandler({ port: 3000 });
