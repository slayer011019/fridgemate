import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import { configureServerRuntime, validateServerConfig } from './config.js';

export { AuthRateLimiter } from './durableObjects/authRateLimiter.js';

configureServerRuntime(env);

const errors = validateServerConfig({ exitOnError: false });

if (errors.length) {
  throw new Error(`Cloudflare Worker configuration is invalid: ${errors.join(' ')}`);
}

const [{ createApp }, { initializeAuthSecurityStore }] = await Promise.all([
  import('./app.js'),
  import('./services/authSecurityStore.js')
]);

createApp().listen(3000);

const handler = httpServerHandler({ port: 3000 });

export default {
  async fetch(request, runtimeEnv, context) {
    await initializeAuthSecurityStore({
      kv: runtimeEnv.AUTH_KV,
      rateLimiter: runtimeEnv.AUTH_RATE_LIMITER
    });

    return handler.fetch(request, runtimeEnv, context);
  }
};
