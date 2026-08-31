import { describe, expect, it } from 'vitest';
import {
  createSentryPrivacyOptions,
  getSentryRouteTemplate,
  sanitizeSentryEvent
} from '../sentryPrivacy';

const APP_ORIGIN = 'https://fridgemate.example';

describe('getSentryRouteTemplate', () => {
  it('keeps only a same-site route template without query, hash, or resource identifiers', () => {
    expect(
      getSentryRouteTemplate(
        `${APP_ORIGIN}/ingredients/550e8400-e29b-41d4-a716-446655440000/edit?name=user%40example.com#details`,
        { origin: APP_ORIGIN }
      )
    ).toBe('/ingredients/:ingredientId/edit');
    expect(getSentryRouteTemplate('/recipes/secret-family-recipe?token=secret', { origin: APP_ORIGIN })).toBe(
      '/recipes/:recipeSlug'
    );
    expect(getSentryRouteTemplate('/recipes/ingredients/private-name#section', { origin: APP_ORIGIN })).toBe(
      '/recipes/ingredients/:ingredientSlug'
    );
    expect(getSentryRouteTemplate('/guides/private-note', { origin: APP_ORIGIN })).toBe(
      '/guides/:guideSlug'
    );
  });

  it('keeps known static routes and makes unknown same-site paths generic', () => {
    expect(getSentryRouteTemplate('/login?next=/account', { origin: APP_ORIGIN })).toBe('/login');
    expect(getSentryRouteTemplate('/orders/user@example.com', { origin: APP_ORIGIN })).toBe('/:route');
  });

  it('rejects cross-site and untrusted absolute URLs', () => {
    expect(getSentryRouteTemplate('https://tracker.example/collect?email=user@example.com', { origin: APP_ORIGIN })).toBeNull();
    expect(getSentryRouteTemplate(`${APP_ORIGIN}/account`, {})).toBeNull();
    expect(getSentryRouteTemplate('//tracker.example/collect', { origin: APP_ORIGIN })).toBeNull();
  });
});

describe('sanitizeSentryEvent', () => {
  it('rebuilds an allowlisted event while preserving only safe error diagnosis fields', () => {
    const stacktrace = {
      frames: [
        {
          filename: `${APP_ORIGIN}/assets/app.js?email=user@example.com&token=secret#private`,
          abs_path: `${APP_ORIGIN}/assets/app.js?token=secret`,
          function: 'loadIngredients',
          lineno: 42,
          context_line: 'throw new Error(user.email)',
          pre_context: ['const email = user.email;'],
          data: { email: 'user@example.com' },
          vars: { ingredientName: 'private ingredient name' }
        },
        {
          filename: `${APP_ORIGIN}/ingredients/token-secret-user@example.com/edit?token=secret`,
          function: 'user@example.com',
          lineno: 7
        }
      ]
    };
    const event = {
      event_id: '0123456789abcdef0123456789abcdef',
      timestamp: 1788100000.25,
      platform: 'javascript',
      environment: 'production',
      release: 'fridgemate@1.5.0',
      level: 'error',
      message: 'Failed for user@example.com',
      user: { id: 'user-1', email: 'user@example.com' },
      contexts: { browser: { name: 'Browser' }, account: { email: 'user@example.com' } },
      extra: { ingredientName: 'private ingredient name' },
      attachments: [{ filename: 'private.txt', data: 'private ingredient name' }],
      tags: { accountId: 'user-1' },
      breadcrumbs: [{ category: 'ui.click', message: 'input[name="ingredient"]' }],
      fingerprint: ['user-1'],
      transaction: '/ingredients/user-1/edit',
      sdk: { name: 'user@example.com', version: 'private' },
      arbitraryUserText: 'private ingredient name',
      request: {
        method: 'post',
        url: `${APP_ORIGIN}/ingredients/user-1/edit?email=user@example.com#private`,
        headers: { authorization: 'Bearer secret' },
        cookies: { session: 'secret' },
        data: { ingredientName: 'private ingredient name' },
        body: 'private body',
        query_string: 'email=user@example.com'
      },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'Failed for user@example.com',
            stacktrace,
            mechanism: {
              type: 'generic',
              handled: false,
              data: { originalMessage: 'Failed for user@example.com' }
            }
          }
        ]
      },
      debug_meta: {
        images: [
          {
            type: 'sourcemap',
            code_file: `${APP_ORIGIN}/assets/app.js?email=user@example.com&token=secret#private`,
            debug_id: '550e8400-e29b-41d4-a716-446655440000',
            privateField: 'user@example.com'
          }
        ]
      }
    };

    const sanitized = sanitizeSentryEvent(event, { origin: APP_ORIGIN });

    expect(sanitized).toEqual({
      event_id: '0123456789abcdef0123456789abcdef',
      timestamp: 1788100000.25,
      platform: 'javascript',
      environment: 'production',
      release: 'fridgemate@1.5.0',
      level: 'error',
      exception: {
        values: [
          {
            type: 'TypeError',
            stacktrace: {
              frames: [
                {
                  filename: '/assets/app.js',
                  abs_path: '/assets/app.js',
                  function: 'loadIngredients',
                  lineno: 42
                },
                {
                  filename: '<redacted>',
                  function: '<anonymous>',
                  lineno: 7
                }
              ]
            },
            mechanism: { type: 'generic', handled: false }
          }
        ]
      },
      request: {
        method: 'POST',
        url: '/ingredients/:ingredientId/edit'
      },
      debug_meta: {
        images: [
          {
            type: 'sourcemap',
            code_file: '/assets/app.js',
            debug_id: '550e8400-e29b-41d4-a716-446655440000'
          }
        ]
      }
    });
    expect(event.exception.values[0].value).toBe('Failed for user@example.com');
    expect(event.exception.values[0].stacktrace.frames[0].vars).toEqual({
      ingredientName: 'private ingredient name'
    });
  });

  it('drops a cross-site request URL and unsupported request data', () => {
    const sanitized = sanitizeSentryEvent(
      {
        request: {
          method: 'CUSTOM user@example.com',
          url: 'https://tracker.example/user/user@example.com',
          headers: { cookie: 'secret' }
        },
        exception: { values: [{ type: 'Error' }] }
      },
      { origin: APP_ORIGIN }
    );

    expect(sanitized).not.toHaveProperty('request');
    expect(sanitized.exception.values[0].type).toBe('Error');
  });

  it('fails closed for invalid events', () => {
    expect(sanitizeSentryEvent(null, { origin: APP_ORIGIN })).toBeNull();
    expect(
      sanitizeSentryEvent(
        {
          exception: { privateMessage: 'user@example.com' },
          stacktrace: { variables: { email: 'user@example.com' } }
        },
        { origin: APP_ORIGIN }
      )
    ).toBeNull();
    expect(
      sanitizeSentryEvent(
        {
          message: 'user@example.com',
          arbitraryUserText: 'private ingredient name'
        },
        { origin: APP_ORIGIN }
      )
    ).toBeNull();
  });
});

describe('createSentryPrivacyOptions', () => {
  it('disables default PII and all breadcrumbs and installs the sanitizer', () => {
    const options = createSentryPrivacyOptions({ origin: APP_ORIGIN });

    expect(options.sendDefaultPii).toBe(false);
    expect(options.sendClientReports).toBe(false);
    expect(options.enableLogs).toBe(false);
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
    expect(
      options.integrations([
        { name: 'GlobalHandlers' },
        { name: 'Breadcrumbs' },
        { name: 'BrowserSession' },
        { name: 'ConversationId' },
        { name: 'CultureContext' },
        { name: 'HttpContext' },
        { name: 'Replay' }
      ])
    ).toEqual([{ name: 'GlobalHandlers' }, { name: 'HttpContext' }]);
    expect(options.beforeSend).toBeTypeOf('function');
    expect(options.beforeSendTransaction({ transaction: '/private/user-1' })).toBeNull();
    const hint = { attachments: [{ filename: 'private.txt', data: 'private' }] };
    expect(
      options.beforeSend({
        user: { email: 'user@example.com' },
        exception: { values: [{ type: 'Error', value: 'private value' }] }
      }, hint)
    ).toEqual({ exception: { values: [{ type: 'Error' }] } });
    expect(hint.attachments).toEqual([]);
  });
});
