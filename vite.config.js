import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { getAdSenseConfig, isValidAdSenseClient } from './src/utils/adsenseConfig.js';

function adsenseHeadPlugin(mode) {
  const config = getAdSenseConfig(loadEnv(mode, process.cwd(), ''));

  if (config.requested && !isValidAdSenseClient(config.client)) {
    throw new Error(
      'VITE_ADSENSE_CLIENT must use the ca-pub-XXXXXXXXXXXXXXXX format when AdSense verification is enabled.'
    );
  }

  return {
    name: 'fridgemate-adsense-head',
    transformIndexHtml() {
      if (!config.verificationEnabled) return [];

      return [
        {
          tag: 'meta',
          attrs: { name: 'google-adsense-account', content: config.client },
          injectTo: 'head'
        }
      ];
    }
  };
}

function searchConsoleHeadPlugin(mode) {
  const verification = loadEnv(mode, process.cwd(), '').VITE_GOOGLE_SITE_VERIFICATION?.trim();

  if (!verification) {
    return {
      name: 'fridgemate-search-console-verification'
    };
  }

  if (!/^[A-Za-z0-9_-]+$/.test(verification)) {
    throw new Error(
      'VITE_GOOGLE_SITE_VERIFICATION must contain only the content value from the Google verification meta tag.'
    );
  }

  return {
    name: 'fridgemate-search-console-verification',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { name: 'google-site-verification', content: verification },
          injectTo: 'head'
        }
      ];
    }
  };
}

function validateGoogleAnalyticsConfig(mode) {
  const measurementId = loadEnv(mode, process.cwd(), '').VITE_GA_MEASUREMENT_ID?.trim();

  if (measurementId && !/^G-[A-Z0-9]+$/.test(measurementId)) {
    throw new Error('VITE_GA_MEASUREMENT_ID must use the G-XXXXXXXXXX format.');
  }
}

export default defineConfig(({ mode }) => {
  validateGoogleAnalyticsConfig(mode);

  return {
    plugins: [react(), adsenseHeadPlugin(mode), searchConsoleHeadPlugin(mode)]
  };
});
