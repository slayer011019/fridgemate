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
  writeReviewedPublicRecipes,
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
  vi.restoreAllMocks();
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
    expect(() => parseArgs(['--write-from='])).toThrow('requires a reviewed local JSON file');
    expect(() => parseArgs(['--print-review', '--write-from=review.json'])).toThrow('Choose either');
  });

  it('uses a fixed repository output path and rejects non-primitive required fields', () => {
    expect(PUBLIC_RECIPES_OUTPUT_PATH).toBe(resolve(process.cwd(), 'src/data/publicRecipes.json'));
    expect(mapPublicRecipe({ ...READY_ROW, RCP_NM: { malicious: true } })).toBeNull();
    expect(mapPublicRecipe({ ...READY_ROW, RCP_SEQ: '../../outside' })).toBeNull();
    expect(mapPublicRecipe({ ...READY_ROW, RCP_NM: 'a'.repeat(201) })).toBeNull();
    expect(mapPublicRecipe({ ...READY_ROW, RCP_NM: 'invalid\u0000name' })).toBeNull();
  });

  it('reads a reviewed file through its verified file handle', async () => {
    const workspaceRoot = await createTemporaryDirectory();
    await writeFile(join(workspaceRoot, 'review.json'), JSON.stringify([READY_ROW]), 'utf8');

    await expect(readReviewedRows('review.json', { workspaceRoot })).resolves.toEqual([READY_ROW]);
  });

  it('imports only a reviewed local file to the fixed artifact without an API key or network call', async () => {
    const workspaceRoot = await createTemporaryDirectory();
    const outputPath = join(workspaceRoot, 'src/data/publicRecipes.json');
    await mkdir(join(workspaceRoot, 'src/data'), { recursive: true });
    await writeFile(outputPath, '[]', 'utf8');
    await writeFile(join(workspaceRoot, 'review.json'), JSON.stringify([READY_ROW]), 'utf8');
    delete process.env.FOODSAFETY_API_KEY;
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network must not be used for reviewed imports.'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(writeReviewedPublicRecipes('review.json', { workspaceRoot })).resolves.toEqual([
      mapPublicRecipe(READY_ROW)
    ]);
    expect(JSON.parse(await readFile(outputPath, 'utf8'))).toEqual([mapPublicRecipe(READY_ROW)]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects reviewed paths outside the workspace and non-JSON paths', async () => {
    const workspaceRoot = await createTemporaryDirectory();
    await expect(readReviewedRows('../outside.json', { workspaceRoot })).rejects.toThrow('inside the workspace');
    await expect(readReviewedRows('review.txt', { workspaceRoot })).rejects.toThrow('inside the workspace');
  });

  it('rejects a reviewed file that is a symlink or hard link', async () => {
    const workspaceRoot = await createTemporaryDirectory();
    const reviewPath = join(workspaceRoot, 'review.json');
    await writeFile(reviewPath, JSON.stringify([READY_ROW]), 'utf8');
    await symlink(reviewPath, join(workspaceRoot, 'symlink.json'));
    await expect(readReviewedRows('symlink.json', { workspaceRoot })).rejects.toThrow('not a bounded regular file');
    await link(reviewPath, join(workspaceRoot, 'hardlink.json'));
    await expect(readReviewedRows('hardlink.json', { workspaceRoot })).rejects.toThrow('not a bounded regular file');
  });

  it('rejects oversized reviewed files, non-arrays, and too many reviewed rows', async () => {
    const workspaceRoot = await createTemporaryDirectory();
    const reviewPath = join(workspaceRoot, 'review.json');
    await writeFile(reviewPath, ' '.repeat(20 * 1024 * 1024 + 1), 'utf8');
    await expect(readReviewedRows('review.json', { workspaceRoot })).rejects.toThrow('not a bounded regular file');
    await writeFile(reviewPath, JSON.stringify({ row: READY_ROW }), 'utf8');
    await expect(readReviewedRows('review.json', { workspaceRoot })).rejects.toThrow('at most 500 rows');
    await writeFile(reviewPath, JSON.stringify(Array(501).fill(READY_ROW)), 'utf8');
    await expect(readReviewedRows('review.json', { workspaceRoot })).rejects.toThrow('at most 500 rows');
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

  it('rejects a symlinked output and missing output without changing their targets', async () => {
    const workspaceRoot = await createTemporaryDirectory();
    const targetPath = join(workspaceRoot, 'target.json');
    const outputPath = join(workspaceRoot, 'output.json');
    await writeFile(targetPath, 'protected', 'utf8');
    await symlink(targetPath, outputPath);

    await expect(writeVerifiedPublicRecipeArtifact(outputPath, 'replacement', { workspaceRoot }))
      .rejects.toThrow('existing, unlinked regular repository file');
    await expect(readFile(targetPath, 'utf8')).resolves.toBe('protected');
    await expect(writeVerifiedPublicRecipeArtifact(join(workspaceRoot, 'missing.json'), 'replacement', { workspaceRoot }))
      .rejects.toThrow('existing, unlinked regular repository file');
    await expect(readFile(join(workspaceRoot, 'missing.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
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

  it('rejects legacy direct-write options before touching the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(exportPublicRecipes({ write: true, limit: 1 }))
      .rejects.toThrow('Direct network-to-file export is disabled');
    await expect(exportPublicRecipes({ writeFrom: 'review.json', printReview: true, limit: 1 }))
      .rejects.toThrow('Choose either');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('previews the network response with redirects disabled and a request deadline', async () => {
    process.env.FOODSAFETY_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ COOKRCP01: { row: [READY_ROW] } })));
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(exportPublicRecipes({ limit: 1, printReview: true, writeFrom: '' }))
      .resolves.toEqual([mapPublicRecipe(READY_ROW)]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openapi.foodsafetykorea.go.kr/api/test-key/COOKRCP01/json/1/1',
      { redirect: 'error', signal: expect.objectContaining({ aborted: false }) }
    );
    expect(log).toHaveBeenCalledWith(JSON.stringify([READY_ROW], null, 2));
    expect(errorLog).toHaveBeenCalledWith('Public recipe preview: fetched=1 ready=1 write=false');
  });

  it('rejects oversized streamed responses even without a declared length', async () => {
    process.env.FOODSAFETY_API_KEY = 'test-key';
    const cancel = vi.fn();
    const read = vi.fn().mockResolvedValue({ done: false, value: new Uint8Array(1024 * 1024) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      body: { getReader: () => ({ read, cancel }) }
    }));

    await expect(exportPublicRecipes({ limit: 1 })).rejects.toThrow('response exceeded the safe size limit');
    expect(read).toHaveBeenCalledTimes(21);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('enforces the preview row limit even when the source returns extra rows', async () => {
    process.env.FOODSAFETY_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ COOKRCP01: { row: [READY_ROW, READY_ROW] } })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(exportPublicRecipes({ limit: 0 })).rejects.toThrow('integer between 1 and 500');
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(exportPublicRecipes({ limit: 1 })).rejects.toThrow('more rows than the preview limit');
  });
});
