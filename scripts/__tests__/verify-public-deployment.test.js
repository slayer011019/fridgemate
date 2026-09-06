// @vitest-environment node
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkRoute,
  checkSitemap,
  getResponse,
  optionsFromArguments,
  pageSnapshot,
  writeReport
} from '../verify-public-deployment.js';
import { SITE_ORIGIN } from '../../src/utils/routeMetadata.js';

const PREVIEW_ORIGIN = 'https://preview.example.test';
const REMOTE_SECRET = 'REMOTE_VALUE_MUST_NOT_BE_SAVED_810239';
const tempDirectories = [];
const sourceHtml = `<!doctype html><html><head>
  <title>서비스 소개</title>
  <link rel="canonical" href="${SITE_ORIGIN}/about">
  <meta name="robots" content="index,follow">
  <script type="application/ld+json">{"@type":"WebPage"}</script>
  </head><body><!--seo-prerender-start-->
  <main><h1>서비스 소개</h1><p>공개 레시피와 냉장고 활용 안내</p><a href="/recipes">메뉴 보기</a></main>
  <!--seo-prerender-end--></body></html>`;

function response(overrides = {}) {
  return {
    status: 200,
    finalUrl: `${PREVIEW_ORIGIN}/about`,
    contentType: 'text/html; charset=utf-8',
    robots: '',
    body: sourceHtml,
    ...overrides
  };
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'fridgemate-public-check-'));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  vi.restoreAllMocks();
});

describe('public deployment verification summaries', () => {
  it('accepts a complete current snapshot on a preview while retaining the production canonical', () => {
    const baseline = pageSnapshot(sourceHtml, `${SITE_ORIGIN}/about`);
    expect(baseline).toMatchObject({
      title: '서비스 소개',
      canonical: `${SITE_ORIGIN}/about`,
      h1: '서비스 소개',
      prerendered: true,
      noindex: false
    });
    expect(checkRoute('/about', response(), baseline, PREVIEW_ORIGIN)).toEqual({
      pathname: '/about', status: 200, errors: [], missingLinkCount: 0, unknownLinkCount: 0
    });
  });

  it('reports malicious remote links and redirects without copying any remote URL into the result', () => {
    const baseline = pageSnapshot(sourceHtml, `${SITE_ORIGIN}/about`);
    const unsafeBody = sourceHtml.replace('</main>', `<a href="/unexpected/${REMOTE_SECRET}">unexpected</a></main>`);
    const result = checkRoute('/about', response({
      finalUrl: `https://attacker.example.test/private/${REMOTE_SECRET}?credential=${REMOTE_SECRET}`,
      body: unsafeBody
    }), baseline, PREVIEW_ORIGIN);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.pathname).toBe('/about');
    expect(result.status).toBe(200);
    expect(Object.keys(result).sort()).toEqual(['errors', 'missingLinkCount', 'pathname', 'status', 'unknownLinkCount']);
    expect(JSON.stringify(result)).not.toContain(REMOTE_SECRET);
    expect(JSON.stringify(result)).not.toContain('attacker.example.test');
  });

  it('keeps same-origin unknown-link failures without persisting their paths or remote body', () => {
    const baseline = pageSnapshot(sourceHtml, `${SITE_ORIGIN}/about`);
    const result = checkRoute('/about', response({
      body: sourceHtml.replace('</main>', `<a href="/unexpected/${REMOTE_SECRET}">${REMOTE_SECRET}</a></main>`)
    }), baseline, PREVIEW_ORIGIN);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain(REMOTE_SECRET);
    expect(JSON.stringify(result)).not.toContain('/unexpected/');
  });

  it('does not forward remote query values or nonnumeric status strings into the report', () => {
    const baseline = pageSnapshot(sourceHtml, `${SITE_ORIGIN}/about`);
    const result = checkRoute('/about', response({
      finalUrl: `${PREVIEW_ORIGIN}/about?credential=${REMOTE_SECRET}`, status: REMOTE_SECRET
    }), baseline, PREVIEW_ORIGIN);
    expect(result.status).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain(REMOTE_SECRET);
  });

  it('detects an HTML fallback whose body or indexing metadata differs from the built route', () => {
    const baseline = pageSnapshot(sourceHtml, `${SITE_ORIGIN}/about`);
    const result = checkRoute('/about', response({
      robots: 'noindex',
      body: sourceHtml.replace('서비스 소개</h1>', '다른 화면</h1>').replace('공개 레시피와 냉장고 활용 안내', '')
    }), baseline, PREVIEW_ORIGIN);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('accepts the expected sitemap and summarizes unexpected entries without saving them', () => {
    const expected = [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/recipes`];
    const valid = checkSitemap(response({
      finalUrl: `${PREVIEW_ORIGIN}/sitemap.xml`, contentType: 'application/xml',
      body: `<urlset>${expected.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>`
    }), expected, PREVIEW_ORIGIN);
    expect(valid.errors).toEqual([]);
    expect(valid.urlCount).toBe(2);

    const result = checkSitemap(response({
      finalUrl: `${PREVIEW_ORIGIN}/sitemap.xml`, contentType: 'application/xml',
      body: `<urlset><url><loc>${SITE_ORIGIN}/</loc></url><url><loc>${SITE_ORIGIN}/</loc></url><url><loc>https://attacker.example.test/${REMOTE_SECRET}</loc></url></urlset>`
    }), expected, PREVIEW_ORIGIN);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.urlCount).toBe(3);
    expect(result.missing).toEqual([`${SITE_ORIGIN}/recipes`]);
    expect(result.unexpectedCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain(REMOTE_SECRET);
    expect(JSON.stringify(result)).not.toContain('attacker.example.test');
    expect(result).not.toHaveProperty('unexpected');
  });
});

describe('bounded public response fetching', () => {
  it('refuses a cross-origin redirect before making any request to the redirect target', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: `https://attacker.example.test/${REMOTE_SECRET}` }
    }));
    await expect(getResponse(`${PREVIEW_ORIGIN}/about`, 1000, { fetchImpl })).rejects.toMatchObject({ code: 'CROSS_ORIGIN', message: 'CROSS_ORIGIN' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].redirect).toBe('manual');
    expect(String(fetchImpl.mock.calls[0][0])).toBe(`${PREVIEW_ORIGIN}/about`);
  });

  it('follows a same-origin redirect manually and reads the final bounded response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/about' } }))
      .mockResolvedValueOnce(new Response('public body', { status: 200, headers: { 'content-type': 'text/html' } }));
    const result = await getResponse(`${PREVIEW_ORIGIN}/old-about`, 1000, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1][0])).toBe(`${PREVIEW_ORIGIN}/about`);
    expect(result).toMatchObject({ status: 200, finalUrl: `${PREVIEW_ORIGIN}/about`, contentType: 'text/html', body: 'public body' });
  });

  it('cancels the stream when the body exceeds its byte limit even without a Content-Length header', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(33)); },
      cancel
    });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/html' } }));
    await expect(getResponse(`${PREVIEW_ORIGIN}/about`, 1000, { fetchImpl, maxBytes: 32 })).rejects.toMatchObject({ code: 'BODY_TOO_LARGE' });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('stops a same-origin redirect loop after five followed redirects', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: '/loop' } }));
    await expect(getResponse(`${PREVIEW_ORIGIN}/loop`, 1000, { fetchImpl })).rejects.toMatchObject({ code: 'REDIRECT_LIMIT' });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });
});

describe('exclusive public verification report writes', () => {
  it('creates a new JSON report in an existing directory', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'report.json');
    const report = { passed: false, routes: [{ pathname: '/about', status: 404, errors: ['Unexpected HTTP status'] }] };
    await writeReport(path, report);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(report);
  });

  it('never overwrites an existing regular file', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'existing.json');
    await writeFile(path, 'keep this original content');
    await expect(writeReport(path, { passed: true })).rejects.toThrow();
    expect(await readFile(path, 'utf8')).toBe('keep this original content');
  });

  it('never follows an existing report symlink or modifies its target', async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, 'target.txt');
    const link = join(directory, 'report.json');
    await writeFile(target, 'keep the symlink target');
    await symlink(target, link);
    await expect(writeReport(link, { passed: true })).rejects.toThrow();
    expect(await readFile(target, 'utf8')).toBe('keep the symlink target');
  });

  it('rejects non-JSON output and does not create a missing parent directory', async () => {
    const directory = await temporaryDirectory();
    const nonJson = join(directory, 'app.js');
    const missingParent = join(directory, 'missing', 'report.json');
    await expect(writeReport(nonJson, {})).rejects.toThrow();
    await expect(readFile(nonJson)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(writeReport(missingParent, {})).rejects.toThrow();
    await expect(readFile(missingParent)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('public checker arguments', () => {
  it('accepts a clean HTTP origin and bounded concurrency and timeout values', () => {
    expect(optionsFromArguments(['--origin', PREVIEW_ORIGIN, '--concurrency', '2', '--timeout', '3000']))
      .toMatchObject({ origin: PREVIEW_ORIGIN, concurrency: 2, timeout: 3000 });
  });

  it.each([
    ['--origin', 'https://user:password@example.test'],
    ['--origin', 'https://example.test/private'],
    ['--concurrency', '13'],
    ['--timeout', '999']
  ])('rejects invalid arguments %s %s', (...args) => {
    expect(() => optionsFromArguments(args)).toThrow();
  });
});
