import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import { configureServerRuntime, validateServerConfig } from './config.js';
import { redirectHttpRequest } from './lib/httpsRedirect.js';

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

await initializeAuthSecurityStore({
  rateLimiter: env.AUTH_RATE_LIMITER,
  requireDistributed: true
});

createApp().listen(3000);

const handler = httpServerHandler({ port: 3000 });

export default {
  async fetch(request, runtimeEnv, context) {
    const redirectResponse = redirectHttpRequest(request);

    if (redirectResponse) {
      return redirectResponse;
    }

    return handler.fetch(request, runtimeEnv, context);
  }
};
