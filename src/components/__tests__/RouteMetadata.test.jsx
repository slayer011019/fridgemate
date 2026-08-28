import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RouteMetadata from '../RouteMetadata';

function installBaseHead() {
  document.head.innerHTML = `
    <title>Base title</title>
    <meta name="description" content="Base description" />
    <meta name="robots" content="index,follow" />
    <meta property="og:title" content="Base title" />
    <meta property="og:description" content="Base description" />
    <meta property="og:url" content="https://example.com" />
    <link rel="canonical" href="https://example.com" />
  `;
}

describe('RouteMetadata', () => {
  beforeEach(installBaseHead);

  it('keeps client-side metadata and structured data aligned on public routes', async () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <RouteMetadata />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.title).toBe('서비스 소개 | 오늘뭐먹지');
    });

    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://xn--wh1bs8l5xa003adme.com/about'
    );
    const schemas = [...document.head.querySelectorAll('[data-seo-structured-data]')].map((script) =>
      JSON.parse(script.textContent)
    );
    expect(schemas).toHaveLength(1);
    expect(schemas[0]['@type']).toBe('AboutPage');
  });

  it('removes public structured data and sets noindex on functional routes', async () => {
    const staleSchema = document.createElement('script');
    staleSchema.dataset.seoStructuredData = '';
    staleSchema.textContent = '{}';
    document.head.appendChild(staleSchema);

    render(
      <MemoryRouter initialEntries={['/account']}>
        <RouteMetadata />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    });

    expect(document.head.querySelectorAll('[data-seo-structured-data]')).toHaveLength(0);
  });
});
