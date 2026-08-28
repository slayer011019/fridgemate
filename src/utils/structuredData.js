import { SITE_ORIGIN } from './routeMetadata';

const SITE_NAME = '오늘뭐먹지';

function webPageSchema(pathname, metadata, type = 'WebPage') {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: metadata.title,
    description: metadata.description,
    url: metadata.canonical,
    inLanguage: 'ko-KR',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_ORIGIN
    },
    ...(pathname === '/privacy' ? { dateModified: '2026-08-22' } : {})
  };
}

export function getRouteStructuredData(pathname, metadata) {
  if (!metadata?.indexable) {
    return [];
  }

  if (pathname === '/') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        alternateName: 'FridgeMate',
        url: SITE_ORIGIN,
        inLanguage: 'ko-KR',
        description: metadata.description
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        alternateName: 'FridgeMate',
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        url: metadata.canonical,
        inLanguage: 'ko-KR',
        description: metadata.description
      }
    ];
  }

  const schemaTypes = {
    '/recipes': 'CollectionPage',
    '/about': 'AboutPage',
    '/contact': 'ContactPage',
    '/privacy': 'WebPage'
  };

  return [webPageSchema(pathname, metadata, schemaTypes[pathname] || 'WebPage')];
}
