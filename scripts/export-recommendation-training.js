import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RECOMMENDATION_EXPORT_DAYS = 180;

function getArgValue(args, name, fallback = null) {
  const prefix = `${name}=`;
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) throw new Error(`${name} may be provided only once.`);
  return matches.length ? matches[0].slice(prefix.length) : fallback;
}

function parseDateArgument(value, name) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid ISO date or timestamp.`);
  }
  return date;
}

export function parseRecommendationExportWindow(args = [], now = new Date()) {
  const currentTime = now instanceof Date ? new Date(now) : new Date(now);
  if (Number.isNaN(currentTime.getTime())) throw new Error('Export time must be a valid date.');

  const untilValue = getArgValue(args, '--until');
  const until = untilValue ? parseDateArgument(untilValue, '--until') : currentTime;
  const sinceValue = getArgValue(args, '--since');
  const since = sinceValue
    ? parseDateArgument(sinceValue, '--since')
    : new Date(until.getTime() - MAX_RECOMMENDATION_EXPORT_DAYS * DAY_MS);

  if (until > currentTime) throw new Error('--until cannot be in the future.');
  if (since >= until) throw new Error('--since must be earlier than --until.');
  if (until.getTime() - since.getTime() > MAX_RECOMMENDATION_EXPORT_DAYS * DAY_MS) {
    throw new Error(`Recommendation export windows cannot exceed ${MAX_RECOMMENDATION_EXPORT_DAYS} days.`);
  }

  return { since, until };
}

function getGroupKey(event) {
  return [event.userId || '', event.sessionId || '', event.recipeId].join('|');
}

const SPREADSHEET_FORMULA_PREFIX = /^[\p{White_Space}\p{Cc}\p{Cf}]*[=+\-@]/u;

export function neutralizeSpreadsheetFormula(value) {
  const text = String(value);
  return SPREADSHEET_FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function toCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = value instanceof Date ? value.toISOString() : String(value);
  const safeText = typeof value === 'string' ? neutralizeSpreadsheetFormula(text) : text;
  return /[",\r\n]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText;
}

const ACTION_COLUMNS = {
  click: 'clicked',
  select: 'selected',
  dismiss: 'dismissed',
  external_open: 'externalOpened',
  complete: 'completed'
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function buildEventAudit(events = []) {
  const summary = {
    total: events.length,
    catalogNamespaced: 0,
    bareUuid: 0,
    local: 0,
    unmatched: 0,
    catalogJoined: 0,
    byType: {}
  };

  events.forEach((event) => {
    const recipeId = String(event.recipeId || '');
    if (/^catalog:/u.test(recipeId)) summary.catalogNamespaced += 1;
    else if (UUID_PATTERN.test(recipeId)) summary.bareUuid += 1;
    else if (/^local:/u.test(recipeId)) summary.local += 1;
    else summary.unmatched += 1;
    if (event.catalogRecipeId) summary.catalogJoined += 1;
    summary.byType[event.eventType] = (summary.byType[event.eventType] || 0) + 1;
  });

  return summary;
}

function toTrainingRow(impression, actionKeysByType) {
  const groupKey = getGroupKey(impression);
  return {
    recipeId: impression.recipeId,
    catalogRecipeId: impression.catalogRecipeId,
    rank: impression.rank,
    score: impression.score,
    matchRate: impression.matchRate,
    missingIngredientCount: impression.missingIngredientCount,
    urgentMatchCount: impression.urgentMatchCount,
    canMakeNow: impression.canMakeNow,
    source: impression.source,
    ...Object.fromEntries(
      Object.entries(ACTION_COLUMNS).map(([eventType, column]) => [
        column,
        actionKeysByType.get(eventType)?.has(groupKey) ? 1 : 0
      ])
    ),
    createdAt: impression.createdAt.toISOString()
  };
}

export function buildTrainingRows(impressions = [], actions = []) {
  const actionKeysByType = actions.reduce((map, event) => {
    const keys = map.get(event.eventType) || new Set();
    keys.add(getGroupKey(event));
    map.set(event.eventType, keys);
    return map;
  }, new Map());

  return impressions.map((impression) => toTrainingRow(impression, actionKeysByType));
}

export function formatJsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join('\n');
}

export function formatCsv(rows) {
  const columns = [
    'recipeId',
    'catalogRecipeId',
    'rank',
    'score',
    'matchRate',
    'missingIngredientCount',
    'urgentMatchCount',
    'canMakeNow',
    'source',
    'clicked',
    'selected',
    'dismissed',
    'externalOpened',
    'completed',
    'createdAt'
  ];

  return [
    columns.map((column) => toCsvValue(column)).join(','),
    ...rows.map((row) => columns.map((column) => toCsvValue(row[column])).join(','))
  ].join('\n');
}

export async function loadRecommendationTrainingEvents(prismaClient, window) {
  return Promise.all([
    prismaClient.recommendationEvent.findMany({
      where: {
        eventType: 'impression',
        createdAt: { gte: window.since, lt: window.until }
      },
      orderBy: {
        createdAt: 'asc'
      }
    }),
    prismaClient.recommendationEvent.findMany({
      where: {
        eventType: { in: Object.keys(ACTION_COLUMNS) },
        createdAt: { gte: window.since, lt: window.until }
      },
      select: {
        userId: true,
        sessionId: true,
        recipeId: true,
        catalogRecipeId: true,
        eventType: true
      }
    })
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  const format = getArgValue(args, '--format', 'jsonl');
  const output = getArgValue(
    args,
    '--output',
    format === 'csv' ? 'recommendation-training.csv' : 'recommendation-training.jsonl'
  );
  const window = parseRecommendationExportWindow(args);

  if (!['jsonl', 'csv'].includes(format)) {
    throw new Error('--format must be jsonl or csv.');
  }

  const [impressions, actions] = await loadRecommendationTrainingEvents(prisma, window);

  const rows = buildTrainingRows(impressions, actions);
  const audit = buildEventAudit([...impressions, ...actions]);
  const content = format === 'csv' ? formatCsv(rows) : formatJsonl(rows);

  writeFileSync(output, `${content}${content ? '\n' : ''}`, 'utf8');
  console.log(`Exported ${rows.length} recommendation training rows to ${output}.`);
  console.log(`Export window: since=${window.since.toISOString()} until=${window.until.toISOString()}.`);
  console.log(`Event audit: total=${audit.total} catalog_namespaced=${audit.catalogNamespaced} bare_uuid=${audit.bareUuid} local=${audit.local} unmatched=${audit.unmatched} catalog_joined=${audit.catalogJoined}.`);
  console.log(`Funnel counts: impression=${audit.byType.impression || 0} select=${audit.byType.select || 0} external_open=${audit.byType.external_open || 0} complete=${audit.byType.complete || 0}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
