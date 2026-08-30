import { describe, expect, it } from 'vitest';
import { redirectHttpRequest } from '../httpsRedirect.js';

describe('redirectHttpRequest', () => {
  it('redirects HTTP requests to the same HTTPS URL', () => {
    const response = redirectHttpRequest(
      new Request('http://api.example.com/api/health?source=probe')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://api.example.com/api/health?source=probe'
    );
  });

  it('does not intercept HTTPS requests', () => {
    expect(
      redirectHttpRequest(new Request('https://api.example.com/api/health'))
    ).toBeNull();
  });
});
