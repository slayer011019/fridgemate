import { describe, expect, it } from 'vitest';
import {
  cleanGeneratedSeo,
  hasOnlySameOriginExecutableScripts,
  removeCanonicalLinks
} from '../lib/seoHtmlSecurity.js';

describe('SEO HTML security helpers', () => {
  it('removes only parsed generated tags and the marked prerender body', () => {
    const html = [
      '<html><head>',
      '<meta name="description" content="keep">',
      '<meta data-seo-generated content="remove">',
      '<script type="application/ld+json" data-seo-structured-data>{"name":"remove"}</script>',
      '</head><body><div id="root"><!--seo-prerender-start--><main>remove</main><!--seo-prerender-end--></div></body></html>'
    ].join('');

    const cleaned = cleanGeneratedSeo(html);

    expect(cleaned).toContain('<meta name="description" content="keep">');
    expect(cleaned).not.toContain('data-seo-generated');
    expect(cleaned).not.toContain('data-seo-structured-data');
    expect(cleaned).toContain('<div id="root"></div>');
  });

  it('fails closed on overlapping tag text that a one-pass replacement could expose', () => {
    expect(() => cleanGeneratedSeo('<<meta data-seo-generated>>')).toThrow('invalid tag name');
  });

  it('removes canonical link elements without altering other links', () => {
    const html = '<link rel="stylesheet" href="/app.css"><link href="https://example.com" rel="canonical">';

    expect(removeCanonicalLinks(html)).toBe('<link rel="stylesheet" href="/app.css">');
  });

  it('allows JSON-LD and same-origin scripts but rejects inline and deceptive external URLs', () => {
    const documentUrl = 'https://example.com/recipes';

    expect(
      hasOnlySameOriginExecutableScripts(
        '<script type="module" src="/assets/app.js"></script><script type="application/ld+json">{}</script>',
        documentUrl
      )
    ).toBe(true);
    expect(hasOnlySameOriginExecutableScripts('<script>alert(1)</script>', documentUrl)).toBe(false);
    expect(
      hasOnlySameOriginExecutableScripts(
        '<script src="https://example.com@www.googletagmanager.com/gtag.js"></script>',
        documentUrl
      )
    ).toBe(false);
  });
});
