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

const ROUTE_TEMPLATES = [
  {
    pattern: /^\/ingredients\/[^/]+\/edit$/,
    template: '/ingredients/:ingredientId/edit'
  },
  {
    pattern: /^\/recipes\/ingredients\/[^/]+$/,
    template: '/recipes/ingredients/:ingredientSlug'
  },
  {
    pattern: /^\/recipes\/[^/]+$/,
    template: '/recipes/:recipeSlug'
  },
  {
    pattern: /^\/guides\/[^/]+$/,
    template: '/guides/:guideSlug'
  }
];

const SAFE_REQUEST_METHODS = new Set(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT']);
const SAFE_LEVELS = new Set(['debug', 'error', 'fatal', 'info', 'log', 'warning']);
const DISABLED_INTEGRATIONS = new Set([
  'Breadcrumbs',
  'BrowserSession',
  'BrowserTracing',
  'ConversationId',
  'CultureContext',
  'Replay'
]);

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const BUILD_LABEL_PATTERN = /^[a-z\d._/+@:-]+$/i;
const DEBUG_ID_PATTERN = /^[a-f\d-]{16,64}$/i;
const EMAIL_LIKE_PATTERN = /[a-z\d._%+-]+@[a-z\d.-]+\.[a-z]{2,}/i;
const ERROR_TYPE_PATTERN = /^[a-z_$][a-z\d_$.[\]<>:-]*$/i;
const EVENT_ID_PATTERN = /^[a-f\d]{32}$/i;
const FUNCTION_NAME_PATTERN = /^[a-z_$<>][a-z\d_$.[\]<>:/-]*$/i;
const STATIC_STACK_PATH_PATTERN = /^\/(?:assets|src|node_modules\/\.vite\/deps)\/[a-z\d_./-]+\.(?:[cm]?js|jsx|tsx?|wasm)$/i;

function normalizeOrigin(origin) {
  if (typeof origin !== 'string' || origin.length === 0) {
    return null;
  }

  try {
    const parsedOrigin = new URL(origin);
    return ['http:', 'https:'].includes(parsedOrigin.protocol) ? parsedOrigin.origin : null;
  } catch {
    return null;
  }
}

function normalizePathname(pathname) {
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  return normalized || '/';
}

function getSameSitePath(rawUrl, origin) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    return null;
  }

  const sameSiteOrigin = normalizeOrigin(origin);
  const isRootRelative = rawUrl.startsWith('/') && !rawUrl.startsWith('//');
  const isAbsolute = ABSOLUTE_URL_PATTERN.test(rawUrl);

  if ((!sameSiteOrigin && !isRootRelative) || (!isRootRelative && !isAbsolute)) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawUrl, sameSiteOrigin || 'https://local.invalid');

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }

    if (!isRootRelative && parsedUrl.origin !== sameSiteOrigin) {
      return null;
    }

    if (sameSiteOrigin && parsedUrl.origin !== sameSiteOrigin) {
      return null;
    }

    return normalizePathname(parsedUrl.pathname);
  } catch {
    return null;
  }
}

function toRouteTemplate(pathname) {
  if (STATIC_ROUTES.has(pathname)) {
    return pathname;
  }

  const matchedRoute = ROUTE_TEMPLATES.find(({ pattern }) => pattern.test(pathname));
  return matchedRoute?.template || '/:route';
}

export function getSentryRouteTemplate(rawUrl, { origin } = {}) {
  const pathname = getSameSitePath(rawUrl, origin);
  return pathname ? toRouteTemplate(pathname) : null;
}

function sanitizeStackFilename(filename, origin) {
  if (filename === '<anonymous>' || filename === 'native') {
    return filename;
  }

  const pathname = getSameSitePath(filename, origin);

  if (
    !pathname ||
    pathname.length > 300 ||
    EMAIL_LIKE_PATTERN.test(pathname) ||
    !STATIC_STACK_PATH_PATTERN.test(pathname)
  ) {
    return '<redacted>';
  }

  return pathname;
}

function sanitizeFunctionName(functionName) {
  if (typeof functionName !== 'string' || functionName.length === 0 || functionName.length > 160) {
    return null;
  }

  const prefix = functionName.startsWith('async ')
    ? 'async '
    : functionName.startsWith('new ')
      ? 'new '
      : '';
  const identifier = functionName.slice(prefix.length);

  if (EMAIL_LIKE_PATTERN.test(functionName) || !FUNCTION_NAME_PATTERN.test(identifier)) {
    return '<anonymous>';
  }

  return functionName;
}

function sanitizeFiniteInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function sanitizeStackFrame(frame, origin) {
  if (!frame || typeof frame !== 'object') {
    return null;
  }

  const sanitizedFrame = {};

  if (typeof frame.filename === 'string') {
    sanitizedFrame.filename = sanitizeStackFilename(frame.filename, origin);
  }

  if (typeof frame.abs_path === 'string') {
    const absolutePath = sanitizeStackFilename(frame.abs_path, origin);
    if (absolutePath !== '<redacted>') {
      sanitizedFrame.abs_path = absolutePath;
    }
  }

  const functionName = sanitizeFunctionName(frame.function);
  if (functionName) {
    sanitizedFrame.function = functionName;
  }

  const lineNumber = sanitizeFiniteInteger(frame.lineno);
  if (lineNumber !== null) {
    sanitizedFrame.lineno = lineNumber;
  }

  const columnNumber = sanitizeFiniteInteger(frame.colno);
  if (columnNumber !== null) {
    sanitizedFrame.colno = columnNumber;
  }

  if (typeof frame.in_app === 'boolean') {
    sanitizedFrame.in_app = frame.in_app;
  }

  return Object.keys(sanitizedFrame).length > 0 ? sanitizedFrame : null;
}

function sanitizeStacktrace(stacktrace, origin) {
  if (!stacktrace || typeof stacktrace !== 'object' || !Array.isArray(stacktrace.frames)) {
    return null;
  }

  const frames = stacktrace.frames
    .map((frame) => sanitizeStackFrame(frame, origin))
    .filter(Boolean);

  return frames.length > 0 ? { frames } : null;
}

function sanitizeErrorType(type) {
  if (typeof type !== 'string' || type.length === 0 || type.length > 128) {
    return null;
  }

  if (EMAIL_LIKE_PATTERN.test(type) || !ERROR_TYPE_PATTERN.test(type)) {
    return 'Error';
  }

  return type;
}

function sanitizeMechanism(mechanism) {
  if (!mechanism || typeof mechanism !== 'object') {
    return null;
  }

  const sanitizedMechanism = {};
  const type = sanitizeErrorType(mechanism.type);

  if (type) {
    sanitizedMechanism.type = type;
  }

  for (const key of ['handled', 'synthetic', 'is_exception_group']) {
    if (typeof mechanism[key] === 'boolean') {
      sanitizedMechanism[key] = mechanism[key];
    }
  }

  return Object.keys(sanitizedMechanism).length > 0 ? sanitizedMechanism : null;
}

function sanitizeException(exception, origin) {
  if (!exception || typeof exception !== 'object' || !Array.isArray(exception.values)) {
    return null;
  }

  const values = exception.values
    .filter((value) => value && typeof value === 'object')
    .map((value) => {
      const sanitizedValue = {};
      const type = sanitizeErrorType(value.type);

      if (type) {
        sanitizedValue.type = type;
      }

      const stacktrace = sanitizeStacktrace(value.stacktrace, origin);
      if (stacktrace) {
        sanitizedValue.stacktrace = stacktrace;
      }

      const rawStacktrace = sanitizeStacktrace(value.raw_stacktrace, origin);
      if (rawStacktrace) {
        sanitizedValue.raw_stacktrace = rawStacktrace;
      }

      const mechanism = sanitizeMechanism(value.mechanism);
      if (mechanism) {
        sanitizedValue.mechanism = mechanism;
      }

      return sanitizedValue;
    })
    .filter((value) => Object.keys(value).length > 0);

  return values.length > 0 ? { values } : null;
}

function sanitizeRequestMethod(method) {
  if (typeof method !== 'string') {
    return null;
  }

  const normalized = method.toUpperCase();
  return SAFE_REQUEST_METHODS.has(normalized) ? normalized : null;
}

function sanitizeRequest(request, origin) {
  if (!request || typeof request !== 'object') {
    return null;
  }

  const sanitizedRequest = {};
  const method = sanitizeRequestMethod(request.method);
  const url = getSentryRouteTemplate(request.url, { origin });

  if (method) {
    sanitizedRequest.method = method;
  }

  if (url) {
    sanitizedRequest.url = url;
  }

  return Object.keys(sanitizedRequest).length > 0 ? sanitizedRequest : null;
}

function sanitizeBuildLabel(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 200 ||
    value.includes('://') ||
    EMAIL_LIKE_PATTERN.test(value) ||
    !BUILD_LABEL_PATTERN.test(value)
  ) {
    return null;
  }

  return value;
}

function sanitizeDebugId(value) {
  return typeof value === 'string' && DEBUG_ID_PATTERN.test(value) ? value : null;
}

function sanitizeDebugMeta(debugMeta, origin) {
  if (!debugMeta || typeof debugMeta !== 'object' || !Array.isArray(debugMeta.images)) {
    return null;
  }

  const images = debugMeta.images
    .filter((image) => image && typeof image === 'object' && ['sourcemap', 'wasm'].includes(image.type))
    .map((image) => {
      const debugId = sanitizeDebugId(image.debug_id);

      if (!debugId || typeof image.code_file !== 'string') {
        return null;
      }

      const sanitizedImage = {
        type: image.type,
        code_file: sanitizeStackFilename(image.code_file, origin),
        debug_id: debugId
      };

      const codeId = sanitizeDebugId(image.code_id);
      if (codeId) {
        sanitizedImage.code_id = codeId;
      }

      return sanitizedImage;
    })
    .filter(Boolean);

  return images.length > 0 ? { images } : null;
}

export function sanitizeSentryEvent(event, { origin } = {}) {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const exception = sanitizeException(event.exception, origin);
  const stacktrace = sanitizeStacktrace(event.stacktrace, origin);

  if (!exception && !stacktrace) {
    return null;
  }

  const sanitizedEvent = {};

  if (typeof event.event_id === 'string' && EVENT_ID_PATTERN.test(event.event_id)) {
    sanitizedEvent.event_id = event.event_id;
  }

  if (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)) {
    sanitizedEvent.timestamp = event.timestamp;
  }

  if (event.platform === 'javascript') {
    sanitizedEvent.platform = event.platform;
  }

  if (SAFE_LEVELS.has(event.level)) {
    sanitizedEvent.level = event.level;
  }

  for (const key of ['release', 'dist', 'environment']) {
    const value = sanitizeBuildLabel(event[key]);
    if (value) {
      sanitizedEvent[key] = value;
    }
  }

  if (exception) {
    sanitizedEvent.exception = exception;
  }

  if (stacktrace) {
    sanitizedEvent.stacktrace = stacktrace;
  }

  const request = sanitizeRequest(event.request, origin);
  if (request) {
    sanitizedEvent.request = request;
  }

  const debugMeta = sanitizeDebugMeta(event.debug_meta, origin);
  if (debugMeta) {
    sanitizedEvent.debug_meta = debugMeta;
  }

  return sanitizedEvent;
}

export function createSentryPrivacyOptions({ origin } = {}) {
  return {
    sendDefaultPii: false,
    sendClientReports: false,
    enableLogs: false,
    maxBreadcrumbs: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    integrations: (defaultIntegrations = []) =>
      defaultIntegrations.filter(({ name }) => !DISABLED_INTEGRATIONS.has(name)),
    beforeSend: (event, hint) => {
      if (hint && typeof hint === 'object') {
        hint.attachments = [];
      }

      return sanitizeSentryEvent(event, { origin });
    },
    beforeSendTransaction: () => null
  };
}
