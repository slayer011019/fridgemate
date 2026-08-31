export function redirectHttpRequest(request) {
  const url = new URL(request.url);

  if (url.protocol === 'https:') {
    return null;
  }

  if (url.protocol !== 'http:') {
    return new Response('Unsupported URL scheme.', { status: 400 });
  }

  url.protocol = 'https:';
  return Response.redirect(url, 308);
}
