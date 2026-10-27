// Checks the brand assets twice: freshly generated into a temp folder (so the generator works),
// and the committed files in the repo (so stale or missing assets fail). Never overwrites the repo.
// Run with: node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { colors } from '../packages/ui-tokens/src/colors.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const outputs = [
  ['apps/mobile/assets/icon.png', 1024],
  ['apps/mobile/assets/adaptive-icon.png', 1024],
  ['apps/mobile/assets/splash-icon.png', 1024],
  ['apps/web/src/app/icon.png', 512],
  ['apps/web/src/app/apple-icon.png', 180],
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function pixel(file, x, y) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function near(actual, expected, tolerance = 2) {
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(actual[i] - expected[i]) <= tolerance, `channel ${i}: ${actual[i]} vs ${expected[i]}`);
  }
}

function checkAssets(getRoot) {
  const file = (p) => join(getRoot(), p);

  test('every asset exists at the exact size', async () => {
    for (const [path, size] of outputs) {
      assert.ok(existsSync(file(path)), `${path} exists`);
      const meta = await sharp(file(path)).metadata();
      assert.equal(meta.width, size, `${path} width`);
      assert.equal(meta.height, size, `${path} height`);
    }
  });

  test('icon.png has a night corner and an ember centre', async () => {
    const icon = file('apps/mobile/assets/icon.png');
    const corner = await pixel(icon, 0, 0);
    assert.deepEqual(corner.slice(0, 3), hexToRgb(colors.night));
    assert.equal(corner[3], 255);
    near(await pixel(icon, 512, 512), hexToRgb(colors.ember));
  });

  test('adaptive-icon.png and splash-icon.png are transparent with an ember centre', async () => {
    for (const name of ['adaptive-icon.png', 'splash-icon.png']) {
      const img = file(`apps/mobile/assets/${name}`);
      assert.equal((await pixel(img, 0, 0))[3], 0, `${name} corner is transparent`);
      near(await pixel(img, 512, 512), hexToRgb(colors.ember));
    }
  });

  test('web icons share the app icon look', async () => {
    for (const [name, size] of [['icon.png', 512], ['apple-icon.png', 180]]) {
      const img = file(`apps/web/src/app/${name}`);
      assert.deepEqual((await pixel(img, 0, 0)).slice(0, 3), hexToRgb(colors.night));
      near(await pixel(img, size / 2, size / 2), hexToRgb(colors.ember));
    }
  });
}

describe('generated into a temp folder', () => {
  let tmp;
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'finalmeal-brand-'));
    execFileSync(process.execPath, [join(repoRoot, 'scripts/generate-brand-assets.mjs'), tmp], { stdio: 'pipe' });
  });
  after(() => rmSync(tmp, { recursive: true, force: true }));
  checkAssets(() => tmp);
});

describe('committed in the repo', () => {
  checkAssets(() => repoRoot);
});
