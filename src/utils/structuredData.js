import { SITE_ORIGIN } from './routeMetadata.js';

const SITE_NAME = '오늘뭐먹지';
const SITE_ALTERNATE_NAMES = Object.freeze(['오늘 뭐 먹지', 'FridgeMate']);
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

function websiteReference() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: `${SITE_ORIGIN}/`
  };
}

function webPageSchema(pathname, metadata, type = 'WebPage') {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: metadata.title,
    description: metadata.description,
    url: metadata.canonical,
    inLanguage: 'ko-KR',
    isPartOf: websiteReference(),
    ...(pathname === '/privacy' ? { dateModified: '2026-08-30' } : {})
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
        ...websiteReference(),
        inLanguage: 'ko-KR',
        description: metadata.description
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
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
