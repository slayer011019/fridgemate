import { chromium } from '@playwright/test';

const baseUrl = process.env.CRAWLER_AUDIT_BASE_URL ?? 'https://xn--wh1bs8l5xa003adme.com';
const paths = ['/', '/recipes', '/robots.txt'];
const agents = [
  {
    name: 'Human Chrome',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  },
  { name: 'OAI-SearchBot', userAgent: 'OAI-SearchBot' },
  { name: 'PerplexityBot', userAgent: 'PerplexityBot' },
  { name: 'Claude-SearchBot', userAgent: 'Claude-SearchBot' },
  { name: 'GPTBot', userAgent: 'GPTBot' },
  { name: 'CCBot', userAgent: 'CCBot' },
  { name: 'Google-Extended', userAgent: 'Google-Extended' },
  { name: 'Google-CloudVertexBot', userAgent: 'Google-CloudVertexBot' },
];

const browser = await chromium.launch({ headless: true });
let failures = 0;

try {
  for (const agent of agents) {
    const context = await browser.newContext({ userAgent: agent.userAgent });
    const page = await context.newPage();

    for (const path of paths) {
      const url = new URL(path, baseUrl).toString();
      try {
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        const headers = response?.headers() ?? {};
        const result = {
          probe: 'chromium',
          crawler: agent.name,
          path,
          status: response?.status() ?? null,
          finalUrl: page.url(),
          server: headers.server ?? null,
          cfRay: headers['cf-ray'] ?? null,
          title: path === '/robots.txt' ? null : await page.title(),
        };
        console.log(JSON.stringify(result));
      } catch (error) {
        failures += 1;
        console.error(
          JSON.stringify({
            probe: 'chromium',
            crawler: agent.name,
            path,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (failures > 0) {
  process.exitCode = 1;
}
