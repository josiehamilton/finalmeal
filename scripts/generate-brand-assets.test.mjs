// Runs the generator, then checks sizes and key pixels. Run with: node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { colors } from '../packages/ui-tokens/src/colors.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => resolve(root, p);

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

test('generator writes every asset at the exact size', async () => {
  execFileSync(process.execPath, [out('scripts/generate-brand-assets.mjs')], { stdio: 'pipe' });
  for (const [path, size] of outputs) {
    assert.ok(existsSync(out(path)), `${path} exists`);
    const meta = await sharp(out(path)).metadata();
    assert.equal(meta.width, size, `${path} width`);
    assert.equal(meta.height, size, `${path} height`);
  }
});

test('icon.png has a night corner and an ember centre', async () => {
  const file = out('apps/mobile/assets/icon.png');
  const corner = await pixel(file, 0, 0);
  assert.deepEqual(corner.slice(0, 3), hexToRgb(colors.night));
  assert.equal(corner[3], 255);
  near(await pixel(file, 512, 512), hexToRgb(colors.ember));
});

test('adaptive-icon.png and splash-icon.png are transparent with an ember centre', async () => {
  for (const name of ['adaptive-icon.png', 'splash-icon.png']) {
    const file = out(`apps/mobile/assets/${name}`);
    assert.equal((await pixel(file, 0, 0))[3], 0, `${name} corner is transparent`);
    near(await pixel(file, 512, 512), hexToRgb(colors.ember));
  }
});

test('web icons share the app icon look', async () => {
  for (const [name, size] of [['icon.png', 512], ['apple-icon.png', 180]]) {
    const file = out(`apps/web/src/app/${name}`);
    assert.deepEqual((await pixel(file, 0, 0)).slice(0, 3), hexToRgb(colors.night));
    near(await pixel(file, size / 2, size / 2), hexToRgb(colors.ember));
  }
});
