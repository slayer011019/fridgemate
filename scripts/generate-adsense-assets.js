import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { getAdSenseConfig, isValidAdSenseClient } from '../src/utils/adsenseConfig.js';

const productionEnv = loadEnv('production', process.cwd(), 'VITE_');
const config = getAdSenseConfig({ ...productionEnv, ...process.env });

if (config.requested && !isValidAdSenseClient(config.client)) {
  throw new Error('VITE_ADSENSE_CLIENT must use the ca-pub-XXXXXXXXXXXXXXXX format when AdSense is enabled.');
}

if (config.enabled) {
  const outputDirectory = resolve(process.cwd(), 'dist');
  const publisherId = config.client.replace(/^ca-/, '');
  const content = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, 'ads.txt'), content, 'utf8');
  console.log('Generated dist/ads.txt for the configured AdSense publisher.');
} else {
  console.log('AdSense is disabled; dist/ads.txt was not generated.');
}
