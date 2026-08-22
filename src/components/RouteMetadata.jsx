import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getRouteMetadata } from '../utils/routeMetadata';

function setMetaContent(selector, attribute, value) {
  const element = document.head.querySelector(selector);

  if (element) {
    element.setAttribute(attribute, value);
  }
}

function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = getRouteMetadata(pathname);

    document.title = metadata.title;
    setMetaContent('meta[name="description"]', 'content', metadata.description);
    setMetaContent('meta[name="robots"]', 'content', metadata.indexable ? 'index,follow' : 'noindex,follow');
    setMetaContent('meta[property="og:title"]', 'content', metadata.title);
    setMetaContent('meta[property="og:description"]', 'content', metadata.description);
    setMetaContent('meta[property="og:url"]', 'content', metadata.canonical);
    setMetaContent('link[rel="canonical"]', 'href', metadata.canonical);
  }, [pathname]);

  return null;
}

export default RouteMetadata;
