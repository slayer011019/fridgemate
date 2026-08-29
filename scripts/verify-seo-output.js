import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PUBLIC_ROUTES, getRouteMetadata } from '../src/utils/routeMetadata.js';

const outputDirectory = resolve(process.cwd(), 'dist');
const routeOutputFiles = {
  '/': 'index.html',
  '/recipes': '_seo/recipes.html',
  '/about': '_seo/about.html',
  '/contact': '_seo/contact.html',
  '/privacy': '_seo/privacy.html'
};

function getRouteOutputFile(pathname) {
  if (routeOutputFiles[pathname]) return routeOutputFiles[pathname];
  if (pathname.startsWith('/recipes/')) return `_seo${pathname}.html`;
  return '';
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const pathname of PUBLIC_ROUTES) {
  const metadata = getRouteMetadata(pathname);
  const outputFile = getRouteOutputFile(pathname);
  const html = await readFile(resolve(outputDirectory, outputFile), 'utf8');

  assert(html.includes(`<title>${metadata.title}</title>`), `${pathname} is missing its route title`);
  assert(html.includes(`href="${metadata.canonical}"`), `${pathname} is missing its canonical URL`);
  assert(html.includes('content="index,follow"'), `${pathname} is not indexable`);
  assert(/<h1(?:\s|>)/i.test(html), `${pathname} has no prerendered h1`);
  assert(html.includes('<!--seo-prerender-start-->'), `${pathname} has no prerendered body marker`);
  assert(html.includes('application/ld+json'), `${pathname} has no structured data`);
}

const sitemap = await readFile(resolve(outputDirectory, 'sitemap.xml'), 'utf8');
for (const pathname of PUBLIC_ROUTES) {
  const canonical = getRouteMetadata(pathname).canonical.replaceAll('&', '&amp;');
  assert(sitemap.includes(`<loc>${canonical}</loc>`), `${pathname} is missing from sitemap.xml`);
}

const appShell = await readFile(resolve(outputDirectory, '_seo/app.html'), 'utf8');
assert(appShell.includes('content="noindex,nofollow,noarchive"'), 'Functional app shell is indexable');
assert(appShell.includes('<div id="root"></div>'), 'Functional app shell must not contain public page content');
assert(!appShell.includes('rel="canonical"'), 'Functional app shell must not emit a shared canonical URL');
assert(!appShell.includes('application/ld+json'), 'Functional app shell must not emit public structured data');

const searchConsoleVerification = process.env.VITE_GOOGLE_SITE_VERIFICATION?.trim();
if (searchConsoleVerification) {
  const homeHtml = await readFile(resolve(outputDirectory, 'index.html'), 'utf8');
  assert(
    homeHtml.includes(`name="google-site-verification" content="${searchConsoleVerification}"`),
    'Search Console verification meta tag is missing from the built home page'
  );
}

console.log(`Verified SEO output for ${PUBLIC_ROUTES.length} public routes, sitemap.xml, and the noindex app shell.`);
