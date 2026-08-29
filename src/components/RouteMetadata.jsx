import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function setMetaContent(selector, attribute, value) {
  const element = document.head.querySelector(selector);

  if (element) {
    element.setAttribute(attribute, value);
  }
}

function syncStructuredData(schemas) {
  document.head.querySelectorAll('[data-seo-structured-data]').forEach((element) => element.remove());

  schemas.forEach((schema) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.seoStructuredData = '';
    script.textContent = JSON.stringify(schema).replaceAll('<', '\\u003c');
    document.head.appendChild(script);
  });
}

function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    let active = true;

    Promise.all([import('../utils/routeMetadata'), import('../utils/structuredData')])
      .then(([metadataModule, structuredDataModule]) => {
        if (!active) return;

        const metadata = metadataModule.getRouteMetadata(pathname);
        document.title = metadata.title;
        setMetaContent('meta[name="description"]', 'content', metadata.description);
        setMetaContent('meta[name="robots"]', 'content', metadata.indexable ? 'index,follow' : 'noindex,follow');
        setMetaContent('meta[property="og:title"]', 'content', metadata.title);
        setMetaContent('meta[property="og:description"]', 'content', metadata.description);
        setMetaContent('meta[property="og:url"]', 'content', metadata.canonical);
        setMetaContent('link[rel="canonical"]', 'href', metadata.canonical);
        syncStructuredData(structuredDataModule.getRouteStructuredData(pathname, metadata));
      })
      .catch((error) => {
        console.warn('[RouteMetadata] Failed to load route metadata.', error);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}

export default RouteMetadata;
