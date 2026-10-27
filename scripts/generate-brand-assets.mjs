// Generates the placeholder app icon, adaptive icon, splash image and web favicons
// from design/brand/icon-skull.svg. Usage: pnpm brand:assets
// Replace with Josie's final art by pointing SKULL_SVG at new source art and re-running.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
// Node strips the types and loads the tokens' colour file directly (it has no imports).
import { colors } from '../packages/ui-tokens/src/colors.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKULL_SVG = resolve(root, 'design/brand/icon-skull.svg');

// Recolour the source skull to the ember token so the art never carries its own hex.
const skullSvg = readFileSync(SKULL_SVG, 'utf8').replace(/fill="#[0-9a-fA-F]{3,8}"/g, `fill="${colors.ember}"`);

/** A square PNG with the skull centred at `heightRatio` of the canvas height. */
async function render({ size, heightRatio, background }) {
  const skullHeight = Math.round(size * heightRatio);
  // Rasterise at high density so downscaled sizes stay crisp.
  const skull = await sharp(Buffer.from(skullSvg), { density: 384 })
    .resize({ height: skullHeight })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: skull, gravity: 'center' }])
    .png()
    .toBuffer();
}

const write = async (path, options) => {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  await sharp(await render(options)).toFile(file);
  console.log(`brand:assets: wrote ${path}`);
};

const night = colors.night;
await write('apps/mobile/assets/icon.png', { size: 1024, heightRatio: 0.56, background: night });
await write('apps/mobile/assets/adaptive-icon.png', { size: 1024, heightRatio: 0.42 });
await write('apps/mobile/assets/splash-icon.png', { size: 1024, heightRatio: 0.6 });
await write('apps/web/src/app/icon.png', { size: 512, heightRatio: 0.56, background: night });
await write('apps/web/src/app/apple-icon.png', { size: 180, heightRatio: 0.56, background: night });
