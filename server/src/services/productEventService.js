import { withUserDatabaseScope } from '../db/tenantScope.js';
import { createHttpError } from '../lib/httpError.js';

const ROOT_FIELDS = new Set([
  'clientEventId',
  'eventName',
  'route',
  'properties',
  'occurredAt'
]);
const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/u;
const ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/u;
const TOKEN_PATTERN = /^[a-z0-9-]{1,64}$/u;
const MIME_TYPE_PATTERN = /^(?:unknown|[a-z0-9.+-]+\/[a-z0-9.+-]+)$/u;
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
const ROUTE_TEMPLATES = new Set([
  '/guides/:slug',
  '/ingredients/:id/edit',
  '/other',
  '/recipes/:slug',
  '/recipes/ingredients/:slug'
]);
const INGREDIENT_CATEGORIES = new Set([
  '채소',
  '과일',
  '육류',
  '육류/가공육',
  '해산물',
  '유제품',
  '달걀',
  '두부/콩류',
  '음료',
  '소스',
  '양념/소스',
  '냉동식품',
  '상온식품',
  '라면/면류',
  '간편식',
  '간식',
  '기타'
]);
const STORAGE_TYPES = new Set(['냉장', '냉동', '팬트리', '실온', '상온']);

const booleanRule = { type: 'boolean' };
const countRule = { type: 'integer', min: 0, max: 100_000 };
const PRODUCT_EVENT_PROPERTIES = Object.freeze({
  activation_completed: {
    activation_path: { type: 'enum', values: new Set(['manual_first_ingredient', 'ocr_first_import']) }
  },
  ingredient_consumed: {
    days_to_expiry_bucket: {
      type: 'enum',
      values: new Set(['unknown', 'expired', 'today', '1_to_3', '4_to_7', '8_plus'])
    },
    source: { type: 'enum', values: new Set(['ingredients_list']) }
  },
  ingredient_created: {
    creation_method: { type: 'enum', values: new Set(['manual', 'ocr']) },
    category: { type: 'enum', values: INGREDIENT_CATEGORIES },
    storage_type: { type: 'enum', values: STORAGE_TYPES },
    has_expiry_date: booleanRule,
    has_purchase_date: booleanRule,
    quantity_present: booleanRule
  },
  ingredient_duplicates_cleaned: {
    duplicate_group_count: countRule,
    removed_count: countRule
  },
  ingredient_restored: {
    days_to_expiry_bucket: {
      type: 'enum',
      values: new Set(['unknown', 'expired', 'today', '1_to_3', '4_to_7', '8_plus'])
    }
  },
  login_completed: {
    restored_session: booleanRule,
    source_screen: { type: 'enum', values: new Set(['login']) }
  },
  ocr_import_saved: {
    saved_item_count: countRule,
    edited_before_save_count: countRule,
    session_first_import: booleanRule
  },
  ocr_parse_completed: {
    raw_text_length: countRule,
    parsed_item_count: countRule,
    template_type: { type: 'pattern', pattern: TOKEN_PATTERN },
    confidence_bucket: { type: 'enum', values: new Set(['low', 'medium', 'high']) }
  },
  ocr_review_completed: {
    parsed_item_count: countRule,
    selected_item_count: countRule,
    edited_item_count: countRule,
    deleted_item_count: countRule
  },
  ocr_upload_started: {
    file_type: { type: 'pattern', pattern: MIME_TYPE_PATTERN },
    source_screen: { type: 'enum', values: new Set(['import']) }
  },
  page_view: {},
  recommendation_clicked: {
    screen: { type: 'enum', values: new Set(['recipes']) },
    group: { type: 'enum', values: new Set(['local', 'ai']) },
    score: { type: 'number', min: -10_000, max: 10_000 },
    missing_core_count: countRule
  },
  recommendations_viewed: {
    screen: { type: 'enum', values: new Set(['home', 'recipes']) },
    available_ingredient_count: countRule,
    expiring_soon_count: countRule,
    ready_count: countRule,
    buy_one_more_count: countRule,
    use_soon_count: countRule
  },
  session_started: {
    entry_route: { type: 'route' },
    has_existing_local_data: booleanRule,
    has_restored_session: booleanRule
  },
  signup_completed: {
    source_screen: { type: 'enum', values: new Set(['signup']) }
  }
});

const COMMON_PROPERTY_RULES = Object.freeze({
  device_type: { type: 'enum', values: new Set(['desktop', 'mobile']) },
  network_state: { type: 'enum', values: new Set(['offline', 'online']) }
});

function optionalString(value, name, maxLength, pattern) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength || (pattern && !pattern.test(normalized))) {
    throw createHttpError(400, `${name} is invalid.`);
  }
  return normalized;
}

export function normalizeProductEventRoute(value) {
  const route = optionalString(value, 'route', 200);
  if (!route) return null;

  const pathname = route.split(/[?#]/u, 1)[0];
  if (STATIC_ROUTES.has(pathname) || ROUTE_TEMPLATES.has(pathname)) return pathname;
  if (/^\/ingredients\/[^/]+\/edit$/u.test(pathname)) return '/ingredients/:id/edit';
  if (/^\/recipes\/ingredients\/[^/]+$/u.test(pathname)) return '/recipes/ingredients/:slug';
  if (/^\/recipes\/[^/]+$/u.test(pathname)) return '/recipes/:slug';
  if (/^\/guides\/[^/]+$/u.test(pathname)) return '/guides/:slug';
  return '/other';
}

function normalizeProperty(key, value, rule) {
  if (rule.type === 'boolean' && typeof value === 'boolean') return value;
  if (
    (rule.type === 'integer' || rule.type === 'number') &&
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (rule.type !== 'integer' || Number.isInteger(value)) &&
    value >= rule.min &&
    value <= rule.max
  ) {
    return value;
  }
  if (rule.type === 'enum' && typeof value === 'string' && rule.values.has(value)) return value;
  if (rule.type === 'pattern' && typeof value === 'string' && rule.pattern.test(value)) return value;
  if (rule.type === 'route' && typeof value === 'string') return normalizeProductEventRoute(value);
  throw createHttpError(400, `properties.${key} is invalid.`);
}

function normalizeProperties(value, eventName) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 20) {
    throw createHttpError(400, 'properties must be a bounded object.');
  }
  const eventRules = PRODUCT_EVENT_PROPERTIES[eventName];
  const properties = {};
  for (const [key, item] of Object.entries(value)) {
    const rule = COMMON_PROPERTY_RULES[key] || eventRules[key];
    if (!rule) {
      throw createHttpError(400, 'properties contains an unsupported key.');
    }
    properties[key] = normalizeProperty(key, item, rule);
  }
  return Object.keys(properties).length ? properties : null;
}

export function normalizeProductEvent(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(400, 'Product event payload is invalid.');
  }
  if (Object.keys(body).some((key) => !ROOT_FIELDS.has(key))) {
    throw createHttpError(400, 'Product event payload contains unsupported fields.');
  }
  const eventName = optionalString(body.eventName, 'eventName', 64, EVENT_NAME_PATTERN);
  if (!eventName || !Object.hasOwn(PRODUCT_EVENT_PROPERTIES, eventName)) {
    throw createHttpError(400, 'eventName is not supported.');
  }
  const occurredAt = new Date(body.occurredAt);
  if (Number.isNaN(occurredAt.getTime()) || Math.abs(Date.now() - occurredAt.getTime()) > 7 * 24 * 60 * 60 * 1000) {
    throw createHttpError(400, 'Product event timestamp is invalid.');
  }
  return {
    clientEventId: optionalString(body.clientEventId, 'clientEventId', 128, ID_PATTERN),
    eventName,
    route: normalizeProductEventRoute(body.route),
    properties: normalizeProperties(body.properties, eventName),
    occurredAt
  };
}

export async function createProductEvent({ userId = null, body = {} } = {}) {
  const normalizedUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;

  if (!normalizedUserId) {
    throw createHttpError(401, 'Authentication is required.');
  }

  const data = normalizeProductEvent(body);
  if (!data.clientEventId) throw createHttpError(400, 'clientEventId is required.');
  const operation = async (database) => {
    const result = await database.productEvent.createMany({
      data: [{ ...data, userId: normalizedUserId }],
      skipDuplicates: true
    });
    return {
      clientEventId: data.clientEventId,
      created: result.count === 1,
      duplicate: result.count === 0
    };
  };
  return withUserDatabaseScope(normalizedUserId, operation);
}
