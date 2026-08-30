import { requestJson } from './apiClient';
import { getAnalyticsConsent } from '../utils/analyticsConsent';
import { isBackendEnabled } from '../utils/backendConfig';

let eventQueue = Promise.resolve();

const EVENT_PROPERTY_KEYS = Object.freeze({
  activation_completed: ['activation_path'],
  ingredient_consumed: ['days_to_expiry_bucket', 'source'],
  ingredient_created: [
    'creation_method',
    'category',
    'storage_type',
    'has_expiry_date',
    'has_purchase_date',
    'quantity_present'
  ],
  ingredient_duplicates_cleaned: ['duplicate_group_count', 'removed_count'],
  ingredient_restored: ['days_to_expiry_bucket'],
  login_completed: ['restored_session', 'source_screen'],
  ocr_import_saved: ['saved_item_count', 'edited_before_save_count', 'session_first_import'],
  ocr_parse_completed: [
    'raw_text_length',
    'parsed_item_count',
    'template_type',
    'confidence_bucket'
  ],
  ocr_review_completed: [
    'parsed_item_count',
    'selected_item_count',
    'edited_item_count',
    'deleted_item_count'
  ],
  ocr_upload_started: ['file_type', 'source_screen'],
  page_view: [],
  recommendation_clicked: ['screen', 'group', 'score', 'missing_core_count'],
  recommendations_viewed: [
    'screen',
    'available_ingredient_count',
    'expiring_soon_count',
    'ready_count',
    'buy_one_more_count',
    'use_soon_count'
  ],
  session_started: ['entry_route', 'has_existing_local_data', 'has_restored_session'],
  signup_completed: ['source_screen']
});

const STATIC_ROUTES = new Set([
  '/',
  '/about',
  '/account',
  '/contact',
  '/import',
  '/ingredients',
  '/ingredients/new',
  '/login',
  '/privacy',
  '/recipes',
  '/signup'
]);

export function normalizeProductEventRoute(value) {
  const pathname = String(value || '').split(/[?#]/u, 1)[0] || '/';

  if (STATIC_ROUTES.has(pathname)) return pathname;
  if (/^\/ingredients\/[^/]+\/edit$/u.test(pathname)) return '/ingredients/:id/edit';
  if (/^\/recipes\/ingredients\/[^/]+$/u.test(pathname)) return '/recipes/ingredients/:slug';
  if (/^\/recipes\/[^/]+$/u.test(pathname)) return '/recipes/:slug';
  if (/^\/guides\/[^/]+$/u.test(pathname)) return '/guides/:slug';
  return '/other';
}

function primitiveProperties(payload) {
  const commonKeys = new Set([
    'event_name', 'occurred_at', 'session_id', 'analytics_id', 'user_mode', 'user_id',
    'route', 'device_type', 'api_mode', 'network_state', 'app_version', 'client_event_id'
  ]);
  const allowedKeys = new Set(EVENT_PROPERTY_KEYS[payload.event_name] || []);
  return Object.entries(payload).reduce((result, [key, value]) => {
    if (
      !commonKeys.has(key) &&
      allowedKeys.has(key) &&
      ['string', 'number', 'boolean'].includes(typeof value)
    ) {
      result[key] = key === 'entry_route' ? normalizeProductEventRoute(value) : value;
    }
    return result;
  }, {});
}

export function buildProductEventPayload(payload) {
  return {
    clientEventId: payload.client_event_id,
    eventName: payload.event_name,
    route: normalizeProductEventRoute(payload.route),
    properties: {
      device_type: payload.device_type,
      network_state: payload.network_state,
      ...primitiveProperties(payload)
    },
    occurredAt: payload.occurred_at
  };
}

export function saveProductEvent(payload) {
  if (
    !isBackendEnabled() ||
    getAnalyticsConsent() !== 'granted' ||
    !payload ||
    payload.user_mode !== 'authenticated'
  ) {
    return Promise.resolve(null);
  }

  const request = () => requestJson('/product-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildProductEventPayload(payload))
  }, { authMode: 'required' });
  const queued = eventQueue.then(request, request);
  eventQueue = queued.catch(() => null);
  return queued;
}
