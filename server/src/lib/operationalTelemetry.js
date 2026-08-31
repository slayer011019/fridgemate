import { serverConfig } from '../config.js';

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeInteger(value) {
  const parsed = finiteNumber(value);
  return parsed == null ? null : Math.max(0, Math.floor(parsed));
}

function round(value, precision = 8) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function buildAiUsageEvent(metrics = {}, config = serverConfig) {
  const promptTokens = nonNegativeInteger(metrics.promptTokens);
  const totalTokens = nonNegativeInteger(metrics.totalTokens);
  const inputCount = nonNegativeInteger(metrics.inputCount) ?? 0;
  const durationMs = nonNegativeInteger(metrics.durationMs) ?? 0;
  const configuredPrice = finiteNumber(config.recipeEmbeddingPricePerMillionTokens);
  const pricePerMillionTokens = configuredPrice != null && configuredPrice > 0
    ? configuredPrice
    : null;
  const estimatedCostUsd = pricePerMillionTokens != null && promptTokens != null
    ? round((promptTokens / 1_000_000) * pricePerMillionTokens)
    : null;

  return {
    event: 'ai_usage',
    provider: String(metrics.provider || 'unknown').slice(0, 40),
    operation: String(metrics.operation || 'unknown').slice(0, 80),
    model: String(metrics.model || 'unknown').slice(0, 120),
    dimensions: nonNegativeInteger(metrics.dimensions),
    success: metrics.success !== false,
    status: nonNegativeInteger(metrics.status),
    inputCount,
    promptTokens,
    totalTokens,
    durationMs,
    estimatedCostUsd
  };
}

export function recordAiUsage(metrics, options = {}) {
  const config = options.config || serverConfig;

  if (!config.aiUsageLoggingEnabled) return null;

  const logger = options.logger || console;
  const event = buildAiUsageEvent(metrics, config);
  const logMethod = event.success ? 'info' : 'warn';
  logger[logMethod]?.('[server] ai usage', event);
  return event;
}

export function recordRecommendationFallback(source, error, options = {}) {
  const logger = options.logger || console;
  const event = {
    event: 'recommendation_fallback',
    source: String(source || 'unknown').slice(0, 80),
    errorName: String(error?.name || 'Error').slice(0, 80),
    errorCode: error?.code == null ? null : String(error.code).slice(0, 80)
  };

  logger.warn?.('[server] recommendation fallback', event);
  return event;
}

export function recordAccountDeletionRevocationFailure(error, options = {}) {
  const logger = options.logger || console;
  const event = {
    event: 'account_deletion_revocation_failure',
    errorName: String(error?.name || 'Error').slice(0, 80),
    errorCode: error?.code == null ? null : String(error.code).slice(0, 80)
  };

  logger.warn?.('[server] account deletion revocation failure', event);
  return event;
}

export function recordSemanticRecommendationOutcome(metrics = {}, options = {}) {
  const logger = options.logger || console;
  const event = {
    event: 'semantic_recommendation',
    mode: metrics.mode === 'semantic' ? 'semantic' : 'rule-fallback',
    recommendationCount: nonNegativeInteger(metrics.recommendationCount) ?? 0,
    durationMs: nonNegativeInteger(metrics.durationMs) ?? 0
  };

  logger.info?.('[server] semantic recommendation', event);
  return event;
}
