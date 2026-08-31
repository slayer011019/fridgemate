import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  formatBackupPreflightReport,
  runBackupPreflight
} from './lib/backupPreflight.js';

async function main() {
  try {
    const result = await runBackupPreflight();
    console.log(formatBackupPreflightReport(result));
    if (!result.ready) process.exitCode = 1;
  } catch (error) {
    console.error(`[backup:preflight] ${error instanceof Error ? error.message : 'Preflight failed.'}`);
    process.exitCode = 1;
  }
}

const isMainModule =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMainModule) await main();
