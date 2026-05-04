#!/usr/bin/env node
/**
 * label-review.js
 * Usage:
 *   node scripts/label-review.js --input review-needed-v2.jsonl
 *   node scripts/label-review.js --input review-needed-v2.jsonl --output gold-set.jsonl
 *   node scripts/label-review.js --input review-needed-v2.jsonl --stats
 *
 * Key controls:
 *   y  accept parser result as-is
 *   e  edit fields
 *   s  skip for later
 *   b  go back
 *   q  save and quit
 *   ?  help
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { parseArgs } from 'node:util';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bgBlue: '\x1b[44m'
};

const b = (s) => `${C.bold}${s}${C.reset}`;
const dim = (s) => `${C.dim}${s}${C.reset}`;
const colored = (color, s) => `${C[color] || ''}${s}${C.reset}`;

const { values: args } = parseArgs({
  options: {
    input: { type: 'string', short: 'i' },
    output: { type: 'string', short: 'o' },
    stats: { type: 'boolean', default: false },
    resume: { type: 'boolean', default: true }
  },
  strict: false
});

if (!args.input) {
  console.error('Usage: node scripts/label-review.js --input <file.jsonl> [--output <gold.jsonl>]');
  process.exit(1);
}

const INPUT_PATH = args.input;
const OUTPUT_PATH = args.output ?? INPUT_PATH.replace(/\.jsonl$/, '') + '.gold.jsonl';
const PROGRESS_PATH = INPUT_PATH.replace(/\.jsonl$/, '') + '.progress.json';

function loadJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (_error) {
        console.error(`JSON parse error at line ${index + 1}`);
        process.exit(1);
      }
    });
}

function loadProgress() {
  if (!args.resume) {
    return { reviewed: {}, currentIndex: 0 };
  }

  if (fs.existsSync(PROGRESS_PATH)) {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  }

  return { reviewed: {}, currentIndex: 0 };
}

function saveProgress(progress) {
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

function appendToGold(record) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.appendFileSync(OUTPUT_PATH, `${JSON.stringify(record)}\n`);
}

function goldKey(record) {
  return `${record.recipe?.id}__${record.metadata?.chunkIndex}`;
}

function loadGoldIds() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return new Set();
  }

  return new Set(
    fs
      .readFileSync(OUTPUT_PATH, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return goldKey(JSON.parse(line));
        } catch (_error) {
          return null;
        }
      })
      .filter(Boolean)
  );
}

function showStats(records) {
  const reasons = {};
  for (const record of records) {
    const reason = record.metadata?.lowConfidenceReason ?? 'unknown';
    reasons[reason] = (reasons[reason] || 0) + 1;
  }

  console.log(b('\nLow-confidence breakdown\n'));
  const sortedReasons = Object.entries(reasons).sort((left, right) => right[1] - left[1]);
  for (const [reason, count] of sortedReasons) {
    const bar = '█'.repeat(Math.round((count / records.length) * 30));
    console.log(`  ${colored('cyan', bar.padEnd(31))} ${String(count).padStart(3)}  ${dim(reason)}`);
  }

  const units = {};
  for (const record of records) {
    const unit = record.label?.unit ?? '(null)';
    units[unit] = (units[unit] || 0) + 1;
  }

  console.log(b('\n단위 분포\n'));
  for (const [unit, count] of Object.entries(units).sort((left, right) => right[1] - left[1])) {
    console.log(`  ${unit.padEnd(12)} ${count}`);
  }

  const amounts = records.filter((record) => record.label?.amount !== null);
  console.log(b('\n요약\n'));
  console.log(`  전체 항목     : ${records.length}`);
  console.log(`  amount 있음   : ${amounts.length}`);
  console.log(`  amount 없음   : ${records.length - amounts.length}`);
  console.log();
  process.exit(0);
}

function renderRecord(record, index, total, goldIds) {
  const { recipe, input, label, metadata } = record;
  const isAlreadyDone = goldIds.has(goldKey(record));

  console.clear();

  const pct = Math.round(((index + 1) / total) * 100);
  const progress = `${index + 1}/${total} (${pct}%)`;
  console.log(
    `${C.bgBlue}${C.bold}  recipe-ingredient-labeler  ${C.reset}  ${dim(progress)}  ${isAlreadyDone ? colored('yellow', '★ already in gold') : ''}`
  );
  console.log();

  console.log(`${colored('magenta', '레시피')}  ${b(recipe.name)}  ${dim(`(id: ${recipe.externalId})`)}`);
  console.log(`${colored('dim', '전체 재료문')}  ${dim(input.fullIngredientsText)}`);
  console.log();

  const divider = '─'.repeat(60);
  console.log(divider);
  console.log(`  ${colored('cyan', '원문')}    ${b(input.rawText)}`);
  console.log(divider);
  console.log();

  console.log(b('파서 결과'));
  const fields = [
    ['rawName', label.rawName],
    ['parsedRawName', label.parsedRawName],
    ['normalizedName', label.normalizedName],
    ['canonicalName', label.canonicalName],
    ['amount', label.amount],
    ['unit', label.unit]
  ];

  for (const [key, value] of fields) {
    const valueText = value === null ? colored('red', 'null') : colored('green', String(value));
    console.log(`  ${key.padEnd(18)}${valueText}`);
  }
  console.log();

  const confidence = metadata.confidence;
  const confidenceColor = confidence >= 0.8 ? 'green' : confidence >= 0.6 ? 'yellow' : 'red';
  console.log(`${b('confidence')}  ${colored(confidenceColor, confidence.toFixed(2))}  ${dim(metadata.lowConfidenceReason ?? '')}`);
  console.log(`${b('chunkIndex')}  ${metadata.chunkIndex}`);
  console.log();
}

function renderHelp() {
  console.log(b('\n키 조작\n'));
  console.log('  y  accept parser result and save');
  console.log('  e  edit amount / unit / canonicalName');
  console.log('  s  skip for later');
  console.log('  b  back');
  console.log('  q  save and quit');
  console.log('  ?  help\n');
}

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function getKey(rl) {
  return new Promise((resolve) => {
    rl.question('', (key) => resolve(key.trim().toLowerCase()));
  });
}

async function editRecord(record, rl) {
  const label = { ...record.label };
  const editableFields = ['parsedRawName', 'normalizedName', 'canonicalName', 'amount', 'unit'];

  console.log();
  console.log(b('편집 모드') + dim("  (빈 값 입력 시 기존값 유지, 'null' 입력 시 null)"));
  console.log();

  for (const field of editableFields) {
    const current = label[field];
    const currentStr = current === null ? 'null' : String(current);
    const input = await prompt(rl, `  ${field.padEnd(18)}${dim(`[${currentStr}]`)} → `);

    if (input === '') {
      continue;
    }

    if (input === 'null') {
      label[field] = null;
      continue;
    }

    if (field === 'amount') {
      const numberValue = Number.parseFloat(input);
      label[field] = Number.isNaN(numberValue) ? null : numberValue;
      continue;
    }

    label[field] = input;
  }

  console.log();
  console.log(dim('  정책 태그 (빈칸 구분, 예: quantity_implicit product_name)'));
  const tagInput = await prompt(rl, '  tags → ');
  const tags = tagInput.trim() ? tagInput.trim().split(/\s+/) : [];

  return { label, tags };
}

async function main() {
  const records = loadJsonl(INPUT_PATH);

  if (args.stats) {
    showStats(records);
  }

  const progress = loadProgress();
  const goldIds = loadGoldIds();

  let index = progress.currentIndex ?? 0;
  if (index >= records.length) {
    index = 0;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const doneCount = Object.values(progress.reviewed).filter((value) => value !== 'skip').length;
  const skipCount = Object.values(progress.reviewed).filter((value) => value === 'skip').length;
  console.clear();
  console.log(b('\n  recipe-ingredient-labeler 시작\n'));
  console.log(`  입력   ${INPUT_PATH}`);
  console.log(`  출력   ${OUTPUT_PATH}`);
  console.log(`  전체   ${records.length}개  |  완료 ${doneCount}  |  스킵 ${skipCount}  |  남음 ${records.length - doneCount}`);
  console.log();
  await prompt(rl, '  Enter 키를 눌러 시작 → ');

  let running = true;
  while (running && index < records.length) {
    const record = records[index];
    renderRecord(record, index, records.length, goldIds);
    console.log(
      `  ${colored('green', 'y')} accept   ${colored('yellow', 'e')} 편집   ${colored('cyan', 's')} skip   ${colored('dim', 'b')} 뒤로   ${colored('red', 'q')} 종료   ${colored('dim', '?')} 도움말`
    );
    process.stdout.write('> ');

    const key = await getKey(rl);

    if (key === '?') {
      renderHelp();
      await prompt(rl, '  Enter 키로 계속 → ');
      continue;
    }

    if (key === 'q') {
      running = false;
      break;
    }

    if (key === 'b') {
      if (index > 0) {
        index -= 1;
      }
      continue;
    }

    if (key === 's') {
      progress.reviewed[goldKey(record)] = 'skip';
      progress.currentIndex = index + 1;
      saveProgress(progress);
      index += 1;
      continue;
    }

    if (key === 'y') {
      const goldRecord = {
        ...record,
        label: { ...record.label, action: 'accept' },
        goldMetadata: {
          reviewedAt: new Date().toISOString(),
          reviewAction: 'accept',
          tags: []
        }
      };
      appendToGold(goldRecord);
      goldIds.add(goldKey(record));
      progress.reviewed[goldKey(record)] = 'accept';
      progress.currentIndex = index + 1;
      saveProgress(progress);
      console.log(`\n  ${colored('green', '✓')} gold에 저장했습니다.`);
      await new Promise((resolve) => setTimeout(resolve, 400));
      index += 1;
      continue;
    }

    if (key === 'e') {
      const { label, tags } = await editRecord(record, rl);
      const goldRecord = {
        ...record,
        label: { ...record.label, ...label, action: 'edited' },
        goldMetadata: {
          reviewedAt: new Date().toISOString(),
          reviewAction: 'edit',
          tags
        }
      };
      appendToGold(goldRecord);
      goldIds.add(goldKey(record));
      progress.reviewed[goldKey(record)] = 'edit';
      progress.currentIndex = index + 1;
      saveProgress(progress);
      console.log(`\n  ${colored('green', '✓')} 수정 후 gold에 저장했습니다.`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      index += 1;
    }
  }

  console.clear();
  const finalDone = Object.values(progress.reviewed).filter((value) => value !== 'skip').length;
  const finalSkip = Object.values(progress.reviewed).filter((value) => value === 'skip').length;
  const editCount = Object.values(progress.reviewed).filter((value) => value === 'edit').length;
  const acceptCount = Object.values(progress.reviewed).filter((value) => value === 'accept').length;

  console.log(b('\n세션 종료\n'));
  console.log(`  완료    ${finalDone}개  (accept ${acceptCount}  |  edit ${editCount})`);
  console.log(`  스킵    ${finalSkip}개`);
  console.log(`  출력    ${OUTPUT_PATH}`);
  console.log(`  진행    ${PROGRESS_PATH}`);
  console.log();

  rl.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
