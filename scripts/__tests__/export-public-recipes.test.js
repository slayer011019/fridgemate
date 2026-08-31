import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PUBLIC_RECIPES_OUTPUT_PATH,
  exportPublicRecipes,
  mapPublicRecipe,
  parseArgs,
  readReviewedRows,
  writeVerifiedPublicRecipeArtifact
} from '../export-public-recipes.js';

const READY_ROW = {
  RCP_SEQ: '42',
  RCP_NM: '테스트 요리',
  RCP_WAY2: '끓이기',
  RCP_PAT2: '국&찌개',
  INFO_WGT: '200g',
  INFO_ENG: '123.4kcal',
  INFO_CAR: '10g',
  INFO_PRO: '8g',
  INFO_FAT: '4g',
  INFO_NA: '300mg',
  HASH_TAG: '#저염,#국물',
  ATT_FILE_NO_MAIN: 'http://www.foodsafetykorea.go.kr/image-small.jpg',
  ATT_FILE_NO_MK: 'https://www.foodsafetykorea.go.kr/image-large.jpg',
  RCP_PARTS_DTLS: '두부 100g\n대파 10g',
  MANUAL01: '두부를 썬다.',
  MANUAL_IMG01: 'http://www.foodsafetykorea.go.kr/step-1.jpg',
  MANUAL02: '재료를 끓인다.',
  RCP_NA_TIP: '소금은 적게 사용한다.'
};
const originalFoodSafetyApiKey = process.env.FOODSAFETY_API_KEY;
const temporaryDirectories = new Set();

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'fridgemate-public-recipes-'));
  temporaryDirectories.add(directory);
  return directory;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  if (originalFoodSafetyApiKey === undefined) {
    delete process.env.FOODSAFETY_API_KEY;
  } else {
    process.env.FOODSAFETY_API_KEY = originalFoodSafetyApiKey;
  }

  await Promise.all(
    [...temporaryDirectories].map((directory) => rm(directory, { force: true, recursive: true }))
  );
  temporaryDirectories.clear();
});

describe('export-public-recipes', () => {
  it('maps only source-backed recipe fields and upgrades MFDS image URLs to HTTPS', () => {
    const recipe = mapPublicRecipe(READY_ROW);

    expect(recipe).toMatchObject({
      externalId: '42',
      name: '테스트 요리',
      nutrition: { calories: 123.4, sodium: 300 },
      hashTags: ['저염', '국물']
    });
    expect(recipe.steps).toHaveLength(2);
    expect(recipe.imageSmallUrl).toMatch(/^https:/u);
    expect(recipe.steps[0].imageUrl).toMatch(/^https:/u);
    expect(recipe).not.toHaveProperty('raw');
  });

  it('rejects rows without enough instructions, ingredients, or an image', () => {
    expect(mapPublicRecipe({ ...READY_ROW, MANUAL02: '' })).toBeNull();
    expect(mapPublicRecipe({ ...READY_ROW, RCP_PARTS_DTLS: '' })).toBeNull();
    expect(mapPublicRecipe({ ...READY_ROW, ATT_FILE_NO_MAIN: '', ATT_FILE_NO_MK: '' })).toBeNull();
  });

  it('rejects image URLs outside the official source host', () => {
    expect(
      mapPublicRecipe({
        ...READY_ROW,
        ATT_FILE_NO_MAIN: 'https://attacker.example/image-small.jpg',
        ATT_FILE_NO_MK: 'https://attacker.example/image-large.jpg'
      })
    ).toBeNull();

    expect(
      mapPublicRecipe({
        ...READY_ROW,
        ATT_FILE_NO_MAIN: 'https://www.foodsafetykorea.go.kr.attacker.example/image-small.jpg',
        ATT_FILE_NO_MK: 'https://user@www.foodsafetykorea.go.kr/image-large.jpg'
      })
    ).toBeNull();
  });

  it('caps previews and requires a separate reviewed file before writing', () => {
    expect(parseArgs(['--limit=9999'])).toEqual({ printReview: false, writeFrom: '', limit: 500 });
    expect(parseArgs(['--limit=25', '--print-review'])).toEqual({
      printReview: true,
      writeFrom: '',
      limit: 25
    });
    expect(parseArgs(['--write-from=review/public-recipes.json'])).toMatchObject({
      writeFrom: 'review/public-recipes.json'
    });
    expect(() => parseArgs(['--write'])).toThrow('Direct network-to-file export is disabled');
  });

  it('uses a fixed repository output path and rejects non-primitive required fields', () => {
    expect(PUBLIC_RECIPES_OUTPUT_PATH).toBe(resolve(process.cwd(), 'src/data/publicRecipes.json'));
    expect(mapPublicRecipe({ ...READY_ROW, RCP_NM: { malicious: true } })).toBeNull();
  });

  it('reads a reviewed file through its verified file handle', async () => {
    const workspaceRoot = await createTemporaryDirectory();
    await writeFile(join(workspaceRoot, 'review.json'), JSON.stringify([READY_ROW]), 'utf8');

    await expect(readReviewedRows('review.json', { workspaceRoot })).resolves.toEqual([READY_ROW]);
  });

  it('rejects a reviewed file reached through a symlinked directory', async () => {
    const sandbox = await createTemporaryDirectory();
    const workspaceRoot = join(sandbox, 'workspace');
    const outsideDirectory = join(sandbox, 'outside');
    await mkdir(workspaceRoot);
    await mkdir(outsideDirectory);
    await writeFile(join(outsideDirectory, 'review.json'), JSON.stringify([READY_ROW]), 'utf8');
    await symlink(
      outsideDirectory,
      join(workspaceRoot, 'review-link'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );

    await expect(
      readReviewedRows('review-link/review.json', { workspaceRoot })
    ).rejects.toThrow('not a bounded regular file');
  });

  it('does not truncate an output reached through a symlinked directory', async () => {
    const sandbox = await createTemporaryDirectory();
    const workspaceRoot = join(sandbox, 'workspace');
    const outsideDirectory = join(sandbox, 'outside');
    const outsideOutput = join(outsideDirectory, 'publicRecipes.json');
    await mkdir(workspaceRoot);
    await mkdir(outsideDirectory);
    await writeFile(outsideOutput, 'protected', 'utf8');
    await symlink(
      outsideDirectory,
      join(workspaceRoot, 'data'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );

    await expect(
      writeVerifiedPublicRecipeArtifact(
        join(workspaceRoot, 'data', 'publicRecipes.json'),
        'replacement',
        { workspaceRoot }
      )
    ).rejects.toThrow('existing, unlinked regular repository file');
    await expect(readFile(outsideOutput, 'utf8')).resolves.toBe('protected');
  });

  it('rejects hard-linked output files before writing', async () => {
    const sandbox = await createTemporaryDirectory();
    const workspaceRoot = join(sandbox, 'workspace');
    const outsideOutput = join(sandbox, 'outside.json');
    const outputDirectory = join(workspaceRoot, 'data');
    const outputPath = join(outputDirectory, 'publicRecipes.json');
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outsideOutput, 'protected', 'utf8');
    await link(outsideOutput, outputPath);

    await expect(
      writeVerifiedPublicRecipeArtifact(outputPath, 'replacement', { workspaceRoot })
    ).rejects.toThrow('existing, unlinked regular repository file');
    await expect(readFile(outsideOutput, 'utf8')).resolves.toBe('protected');
  });

  it('writes only after pinning an existing regular output file', async () => {
    const workspaceRoot = await createTemporaryDirectory();
    const outputDirectory = join(workspaceRoot, 'data');
    const outputPath = join(outputDirectory, 'publicRecipes.json');
    await mkdir(outputDirectory);
    await writeFile(outputPath, 'old', 'utf8');

    await writeVerifiedPublicRecipeArtifact(outputPath, 'replacement', { workspaceRoot });

    await expect(readFile(outputPath, 'utf8')).resolves.toBe('replacement');
  });

  it('rejects an oversized network response before reading its body', async () => {
    const readBody = vi.fn();
    process.env.FOODSAFETY_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: { get: () => String(20 * 1024 * 1024 + 1) },
        body: null,
        text: readBody,
        ok: true
      })
    );

    await expect(
      exportPublicRecipes({ limit: 1, printReview: false, writeFrom: '' })
    ).rejects.toThrow('response exceeded the safe size limit');
    expect(readBody).not.toHaveBeenCalled();
  });
});
