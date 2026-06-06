import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getArgValue(name, fallback = null) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function getGroupKey(event) {
  return [event.userId || '', event.sessionId || '', event.recipeId].join('|');
}

function toCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toTrainingRow(impression, clickedRecipeKeys) {
  return {
    userId: impression.userId,
    sessionId: impression.sessionId,
    recipeId: impression.recipeId,
    rank: impression.rank,
    score: impression.score,
    matchRate: impression.matchRate,
    missingIngredientCount: impression.missingIngredientCount,
    urgentMatchCount: impression.urgentMatchCount,
    canMakeNow: impression.canMakeNow,
    source: impression.source,
    clicked: clickedRecipeKeys.has(getGroupKey(impression)) ? 1 : 0,
    createdAt: impression.createdAt.toISOString()
  };
}

function formatJsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join('\n');
}

function formatCsv(rows) {
  const columns = [
    'userId',
    'sessionId',
    'recipeId',
    'rank',
    'score',
    'matchRate',
    'missingIngredientCount',
    'urgentMatchCount',
    'canMakeNow',
    'source',
    'clicked',
    'createdAt'
  ];

  return [columns.join(','), ...rows.map((row) => columns.map((column) => toCsvValue(row[column])).join(','))].join('\n');
}

async function main() {
  const format = getArgValue('--format', 'jsonl');
  const output = getArgValue('--output', format === 'csv' ? 'recommendation-training.csv' : 'recommendation-training.jsonl');

  if (!['jsonl', 'csv'].includes(format)) {
    throw new Error('--format must be jsonl or csv.');
  }

  const [impressions, clicks] = await Promise.all([
    prisma.recommendationEvent.findMany({
      where: {
        eventType: 'impression'
      },
      orderBy: {
        createdAt: 'asc'
      }
    }),
    prisma.recommendationEvent.findMany({
      where: {
        eventType: 'click'
      },
      select: {
        userId: true,
        sessionId: true,
        recipeId: true
      }
    })
  ]);

  const clickedRecipeKeys = new Set(clicks.map(getGroupKey));
  const rows = impressions.map((impression) => toTrainingRow(impression, clickedRecipeKeys));
  const content = format === 'csv' ? formatCsv(rows) : formatJsonl(rows);

  writeFileSync(output, `${content}${content ? '\n' : ''}`, 'utf8');
  console.log(`Exported ${rows.length} recommendation training rows to ${output}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
