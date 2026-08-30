const VERIFICATION_TOKEN_PATTERN = /^[A-Za-z0-9._-]+$/;

export const WEBMASTER_VERIFICATION_PROVIDERS = Object.freeze([
  Object.freeze({
    envName: 'VITE_GOOGLE_SITE_VERIFICATION',
    metaName: 'google-site-verification',
    provider: 'Google'
  }),
  Object.freeze({
    envName: 'VITE_NAVER_SITE_VERIFICATION',
    metaName: 'naver-site-verification',
    provider: 'Naver'
  }),
  Object.freeze({
    envName: 'VITE_BING_SITE_VERIFICATION',
    metaName: 'msvalidate.01',
    provider: 'Bing'
  })
]);

export function getWebmasterVerificationTags(env = {}) {
  return WEBMASTER_VERIFICATION_PROVIDERS.flatMap(({ envName, metaName, provider }) => {
    const content = String(env[envName] || '').trim();
    if (!content) return [];

    if (!VERIFICATION_TOKEN_PATTERN.test(content)) {
      throw new Error(
        `${envName} must contain only the content value from the ${provider} verification meta tag.`
      );
    }

    return [{ envName, metaName, provider, content }];
  });
}
