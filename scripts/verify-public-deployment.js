import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { PUBLIC_ROUTES, SITE_ORIGIN, getRouteMetadata } from '../src/utils/routeMetadata.js';

const HELP = `Verify deployed public pages against this checkout and its built HTML.

Usage: node scripts/verify-public-deployment.js [options]
  --origin URL       Target origin (default: ${SITE_ORIGIN})
  --dist PATH        Built output directory (default: dist)
  --concurrency N    Concurrent GET requests, 1–12 (default: 6)
  --timeout N        Per-request timeout in milliseconds, 1000–60000 (default: 12000)
  --report PATH      Save a JSON report, including every failed route
  --help             Show this help

Run npm run build first. The checker only reads public URLs; it never deploys,
logs in, writes user data, or submits a sitemap/review request. A nonzero exit
means a mismatch or incomplete verification. Canonicals remain on SITE_ORIGIN,
even when --origin points to a preview or local server. Redirects to another
origin fail so a preview cannot accidentally pass by serving production.`;

function optionsFromArguments(args) {
  const options = { origin: SITE_ORIGIN, dist: 'dist', concurrency: 6, timeout: 12000, report: '' };
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === '--help') return { help: true };
    if (!['--origin', '--dist', '--concurrency', '--timeout', '--report'].includes(key)) {
      throw new Error(`Unknown option: ${key}`);
    }
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    options[key.slice(2)] = value;
  }
  const origin = new URL(options.origin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password
    || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('--origin must be an HTTP(S) origin without credentials, a path, query, or fragment.');
  }
  options.origin = origin.origin;
  for (const [key, min, max] of [['concurrency', 1, 12], ['timeout', 1000, 60000]]) {
    options[key] = Number(options[key]);
    if (!Number.isInteger(options[key]) || options[key] < min || options[key] > max) {
      throw new Error(`--${key} must be an integer from ${min} to ${max}.`);
    }
  }
  return options;
}

function outputFile(pathname) {
  return pathname === '/' ? 'index.html' : `_seo${pathname}.html`;
}

function normalizedText(value) {
  return String(value || '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function normalizedUrl(value, base = SITE_ORIGIN) {
  const url = new URL(value, base);
  url.hash = '';
  return url.href;
}

function decodeProtectedEmail(encoded) {
  if (!/^(?:[0-9a-f]{2}){2,1024}$/i.test(encoded || '')) return null;
  const bytes = Buffer.from(encoded, 'hex');
  return Buffer.from(bytes.subarray(1).map((byte) => byte ^ bytes[0])).toString('utf8');
}

function pageSnapshot(html, base) {
  // JSDOM does not execute scripts or fetch resources with these default options.
  const { window } = new JSDOM(html, { url: base });
  const { document } = window;
  // Cloudflare rewrites public mailto links and visible email text at the edge.
  // Decode that reversible wrapper without executing its injected JavaScript.
  for (const node of document.querySelectorAll('[data-cfemail]')) {
    const email = decodeProtectedEmail(node.getAttribute('data-cfemail'));
    if (email) node.textContent = email;
  }
  for (const anchor of document.querySelectorAll('a[href^="/cdn-cgi/l/email-protection#"]')) {
    const email = decodeProtectedEmail(anchor.getAttribute('href').split('#')[1]);
    if (email) anchor.setAttribute('href', `mailto:${email}`);
  }
  const main = document.querySelector('main');
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  const internalPaths = new Set();
  for (const anchor of document.querySelectorAll('a[href]')) {
    const url = new URL(anchor.getAttribute('href'), base);
    if ([new URL(base).origin, SITE_ORIGIN].includes(url.origin)) {
      internalPaths.add(decodeURIComponent(url.pathname));
    }
  }
  const snapshot = {
    title: normalizedText(document.title),
    canonical: canonical ? normalizedUrl(canonical, base) : '',
    canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
    noindex: [...document.querySelectorAll('meta[name="robots"], meta[name="googlebot"]')]
      .some((node) => /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/i.test(node.content)),
    h1: normalizedText(document.querySelector('h1')?.textContent),
    mainText: normalizedText(main?.textContent),
    internalPaths: [...internalPaths].sort(),
    structuredData: document.querySelectorAll('script[type="application/ld+json"]').length,
    prerendered: html.includes('<!--seo-prerender-start-->') && html.includes('<!--seo-prerender-end-->'),
  };
  window.close();
  return snapshot;
}

async function getResponse(url, timeout) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
    headers: { 'User-Agent': 'FridgeMate-Public-Deployment-Check/1.0', Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
  });
  return {
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get('content-type') || '',
    robots: response.headers.get('x-robots-tag') || '',
    body: await response.text(),
  };
}

function sitemapUrls(xml) {
  const { window } = new JSDOM(xml, { contentType: 'application/xml' });
  const result = [...window.document.querySelectorAll('url > loc')].map((node) => normalizedUrl(node.textContent));
  window.close();
  return result;
}

async function parallelMap(items, concurrency, operation) {
  const results = new Array(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await operation(items[current]);
    }
  }));
  return results;
}

function gitRevision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const options = optionsFromArguments(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  const expected = new Map();
  for (const pathname of PUBLIC_ROUTES) {
    const html = await readFile(resolve(options.dist, outputFile(pathname)), 'utf8');
    const snapshot = pageSnapshot(html, new URL(pathname, SITE_ORIGIN).href);
    const metadata = getRouteMetadata(pathname);
    if (!snapshot.prerendered || !snapshot.h1 || !snapshot.mainText || snapshot.noindex
      || snapshot.title !== normalizedText(metadata.title)
      || snapshot.canonicalCount !== 1 || snapshot.canonical !== normalizedUrl(metadata.canonical)) {
      throw new Error(`Local build is missing current public content/metadata for ${pathname}. Run npm run build first.`);
    }
    expected.set(pathname, snapshot);
  }
  const expectedSitemap = PUBLIC_ROUTES.map((pathname) => normalizedUrl(getRouteMetadata(pathname).canonical)).sort();
  const builtSitemap = sitemapUrls(await readFile(resolve(options.dist, 'sitemap.xml'), 'utf8')).sort();
  if (JSON.stringify(expectedSitemap) !== JSON.stringify(builtSitemap)) {
    throw new Error('Local sitemap does not match PUBLIC_ROUTES. Run npm run build first.');
  }

  console.log(`Checking ${expected.size} public pages on ${options.origin} against ${resolve(options.dist)} ...`);
  const routes = await parallelMap(PUBLIC_ROUTES, options.concurrency, async (pathname) => {
    const errors = [];
    const result = { pathname, status: null, errors };
    try {
      const response = await getResponse(new URL(pathname, options.origin), options.timeout);
      result.status = response.status;
      result.finalUrl = response.finalUrl;
      if (response.status !== 200) errors.push(`HTTP ${response.status}, expected 200`);
      if (new URL(response.finalUrl).origin !== options.origin) errors.push('Redirected to another origin');
      if (decodeURIComponent(new URL(response.finalUrl).pathname) !== pathname) errors.push('Redirected to another path');
      if (!response.contentType.includes('text/html')) errors.push('Response is not HTML');
      if (/(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/i.test(response.robots)) errors.push('X-Robots-Tag prevents indexing');
      if (response.status === 200 && response.contentType.includes('text/html')) {
        const actual = pageSnapshot(response.body, response.finalUrl);
        const baseline = expected.get(pathname);
        if (actual.title !== baseline.title) errors.push('Title does not match current route');
        if (actual.canonicalCount !== 1 || actual.canonical !== baseline.canonical) errors.push('Canonical does not match current route');
        if (actual.noindex) errors.push('Robots meta prevents indexing');
        if (!actual.prerendered) errors.push('Prerendered body markers are missing');
        if (!actual.h1 || actual.h1 !== baseline.h1) errors.push('H1 does not match built route');
        if (!actual.mainText || actual.mainText !== baseline.mainText) errors.push('Main body does not match built public content');
        if (!actual.structuredData) errors.push('Structured data is missing');
        const missingLinks = baseline.internalPaths.filter((path) => !actual.internalPaths.includes(path));
        if (missingLinks.length) errors.push(`Missing ${missingLinks.length} built internal links: ${missingLinks.slice(0, 3).join(', ')}`);
        const unknownLinks = actual.internalPaths.filter((path) => getRouteMetadata(path).notFound);
        if (unknownLinks.length) errors.push(`Unknown internal links: ${unknownLinks.join(', ')}`);
      }
    } catch (error) {
      errors.push(`Request or parsing failed: ${error.message}`);
    }
    return result;
  });

  const sitemap = { errors: [] };
  try {
    const response = await getResponse(`${options.origin}/sitemap.xml`, options.timeout);
    sitemap.status = response.status;
    if (response.status !== 200) sitemap.errors.push(`HTTP ${response.status}, expected 200`);
    if (new URL(response.finalUrl).origin !== options.origin) sitemap.errors.push('Redirected to another origin');
    const actual = sitemapUrls(response.body);
    sitemap.urlCount = actual.length;
    sitemap.missing = expectedSitemap.filter((url) => !actual.includes(url));
    sitemap.unexpected = actual.filter((url) => !expectedSitemap.includes(url));
    if (sitemap.missing.length) sitemap.errors.push(`Missing ${sitemap.missing.length} expected URLs`);
    if (sitemap.unexpected.length) sitemap.errors.push(`Contains ${sitemap.unexpected.length} unexpected URLs`);
    if (new Set(actual).size !== actual.length) sitemap.errors.push('Contains duplicate URLs');
  } catch (error) {
    sitemap.errors.push(`Request or parsing failed: ${error.message}`);
  }

  // Probe both generic and dynamic namespaces; an SPA fallback returning 200 is a failure.
  const missingPaths = await parallelMap([
    '/__fridgemate-public-check-missing__',
    '/recipes/__fridgemate-public-check-missing__',
    '/recipes/ingredients/__fridgemate-public-check-missing__',
    '/guides/__fridgemate-public-check-missing__',
  ], options.concurrency, async (pathname) => {
    try {
      const response = await getResponse(new URL(pathname, options.origin), options.timeout);
      return { pathname, status: response.status, errors: response.status === 404 ? [] : [`HTTP ${response.status}, expected 404`] };
    } catch (error) {
      return { pathname, status: null, errors: [`Request failed: ${error.message}`] };
    }
  });
  const failed = routes.filter((route) => route.errors.length);
  const passed = failed.length === 0 && sitemap.errors.length === 0 && missingPaths.every((item) => !item.errors.length);
  const report = {
    checkedAt: new Date().toISOString(),
    origin: options.origin,
    sourceCommit: gitRevision(),
    buildDirectory: resolve(options.dist),
    note: 'Source commit identifies the checker checkout; local edits may exist. This is not proof of the deployed commit. Main body comparison normalizes whitespace and reversibly decodes Cloudflare email protection. Browser rendering, auth, Search Console, and AdSense review are separate checks.',
    publicRouteCount: PUBLIC_ROUTES.length,
    passed,
    passedRouteCount: routes.length - failed.length,
    failedRouteCount: failed.length,
    sitemap,
    missingPaths,
    routes,
  };
  if (options.report) {
    const file = resolve(options.report);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Report: ${file}`);
  }
  console.log(`Public pages: ${routes.length - failed.length}/${routes.length} passed; sitemap: ${sitemap.errors.length ? 'FAIL' : 'PASS'}; missing paths: ${missingPaths.every((item) => !item.errors.length) ? 'PASS' : 'FAIL'}.`);
  for (const route of failed.slice(0, 12)) console.error(`${route.pathname}: ${route.errors.join('; ')}`);
  if (failed.length > 12) console.error(`... ${failed.length - 12} more failed routes. Use --report for the full list.`);
  for (const error of sitemap.errors) console.error(`sitemap.xml: ${error}`);
  for (const item of missingPaths.filter((item) => item.errors.length)) console.error(`${item.pathname}: ${item.errors.join('; ')}`);
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Public deployment verification failed: ${error.message}`);
  process.exitCode = 1;
});
