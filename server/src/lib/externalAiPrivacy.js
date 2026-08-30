import { serverConfig } from '../config.js';
import { createHttpError } from './httpError.js';

export const EXTERNAL_AI_DISCLOSURE_VERSION = '2026-08-30';

export const EXTERNAL_AI_ACTIONS = Object.freeze({
  semanticRecipes: 'semantic_recipe_recommendations',
  importCorrectionSuggestions: 'import_correction_suggestions',
  importCorrectionEmbedding: 'import_correction_embedding',
  aiRecipeSuggestions: 'ai_recipe_suggestions'
});

const SIGNAL_FIELDS = new Set(['action', 'disclosureVersion', 'userInitiated']);
const SENSITIVE_TEXT_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+?82[-.\s]?)?0(?:10|1[1-9]|2|[3-6]\d|70)[-.\s]?\d{3,4}[-.\s]?\d{4}\b/,
  /\b\d{6}[-.\s]?[1-4]\d{6}\b/,
  /(?:\d[-.\s]?){13,19}/,
  /\b(?:https?:\/\/|www\.)\S+/i,
  /[\uAC00-\uD7A3]{2,}(?:\uC2DC|\uB3C4)\s+[\uAC00-\uD7A30-9]{1,}(?:\uC2DC|\uAD70|\uAD6C)\s+[\uAC00-\uD7A30-9-]{1,}(?:\uB85C|\uAE38)\s+\d{1,5}/
];

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasControlCharacters(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
}

export function hasLikelySensitiveExternalAiText(value) {
  const text = String(value || '');
  return SENSITIVE_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function normalizeExternalAiText(value, field, { maxLength = 80 } = {}) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw createHttpError(400, `${field} is invalid.`);
  }

  const rawValue = String(value);
  const normalized = rawValue.replace(/\s+/g, ' ').trim();

  if (
    !normalized ||
    normalized.length > maxLength ||
    hasControlCharacters(rawValue) ||
    hasLikelySensitiveExternalAiText(normalized)
  ) {
    throw createHttpError(400, `${field} must not contain personal, sensitive, or receipt-level data.`);
  }

  return normalized;
}

export function normalizeExternalAiRequestSignal(value, expectedAction) {
  if (value === undefined || value === null) return null;

  if (
    !isPlainObject(value) ||
    Object.keys(value).some((field) => !SIGNAL_FIELDS.has(field)) ||
    value.action !== expectedAction ||
    value.disclosureVersion !== EXTERNAL_AI_DISCLOSURE_VERSION ||
    value.userInitiated !== true
  ) {
    throw createHttpError(400, 'The external AI request signal is invalid or out of date.');
  }

  return {
    action: expectedAction,
    disclosureVersion: EXTERNAL_AI_DISCLOSURE_VERSION,
    userInitiated: true
  };
}

export function isExternalAiOperationAllowed(signal, expectedAction) {
  return Boolean(
    serverConfig.externalAiDataProcessingEnabled &&
      signal?.userInitiated === true &&
      signal?.action === expectedAction &&
      signal?.disclosureVersion === EXTERNAL_AI_DISCLOSURE_VERSION
  );
}

export function assertExternalAiOperationAllowed(signal, expectedAction) {
  if (!serverConfig.externalAiDataProcessingEnabled) {
    throw createHttpError(503, 'External AI data processing is not enabled by the service operator.');
  }

  if (!isExternalAiOperationAllowed(signal, expectedAction)) {
    throw createHttpError(403, 'External AI processing requires a current disclosure and an explicit user action.');
  }
}
