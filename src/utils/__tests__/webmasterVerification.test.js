import { describe, expect, it } from 'vitest';
import {
  WEBMASTER_VERIFICATION_PROVIDERS,
  getWebmasterVerificationTags
} from '../webmasterVerification';

describe('webmasterVerification', () => {
  it('returns no tags when no provider is configured', () => {
    expect(getWebmasterVerificationTags()).toEqual([]);
  });

  it('builds trimmed verification tags for Google, Naver, and Bing', () => {
    expect(
      getWebmasterVerificationTags({
        VITE_GOOGLE_SITE_VERIFICATION: ' google-token ',
        VITE_NAVER_SITE_VERIFICATION: 'naver.token',
        VITE_BING_SITE_VERIFICATION: 'BING_TOKEN-01'
      })
    ).toEqual([
      {
        envName: 'VITE_GOOGLE_SITE_VERIFICATION',
        metaName: 'google-site-verification',
        provider: 'Google',
        content: 'google-token'
      },
      {
        envName: 'VITE_NAVER_SITE_VERIFICATION',
        metaName: 'naver-site-verification',
        provider: 'Naver',
        content: 'naver.token'
      },
      {
        envName: 'VITE_BING_SITE_VERIFICATION',
        metaName: 'msvalidate.01',
        provider: 'Bing',
        content: 'BING_TOKEN-01'
      }
    ]);
    expect(WEBMASTER_VERIFICATION_PROVIDERS).toHaveLength(3);
  });

  it('rejects full tags and unsafe attribute content', () => {
    expect(() =>
      getWebmasterVerificationTags({
        VITE_NAVER_SITE_VERIFICATION: '<meta name="naver-site-verification">'
      })
    ).toThrow('VITE_NAVER_SITE_VERIFICATION');
  });
});
