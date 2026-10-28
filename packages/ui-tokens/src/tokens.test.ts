import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { colors, contrastRatio, cssVariables, map, skull } from './index';

const ALLOWED_HEX = [
  '#0B0A09',
  '#171513',
  '#221F1B',
  '#F3EDE4',
  '#A39B91',
  '#8C847A',
  '#C04B28',
  '#E8693F',
  '#E6DFD5',
  '#FF7A6B',
  '#FFFFFF',
];

describe('colors', () => {
  it('uses the canvas ember values', () => {
    expect(colors.ember).toBe('#C04B28');
    expect(colors.emberGlow).toBe('#E8693F');
  });

  it('contains no 6-digit hex colour outside the approved palette', () => {
    const hexes = Object.values(colors).filter((v) => /^#[0-9A-Fa-f]{6}$/.test(v));
    expect(hexes.length).toBeGreaterThan(0);
    for (const hex of hexes) {
      expect(ALLOWED_HEX).toContain(hex.toUpperCase());
    }
  });
});

describe('translucent colours', () => {
  it('has only the approved rgba tokens, with scrim the one overlay for photos and sheets', () => {
    const rgba = Object.entries(colors)
      .filter(([, v]) => v.startsWith('rgba('))
      .map(([name]) => name)
      .sort();
    expect(rgba).toEqual(['emberWash', 'line', 'lineStrong', 'scrim']);
    expect(colors.scrim).toBe('rgba(11,10,9,0.6)');
  });

  it('exposes scrim as a css variable', () => {
    expect(cssVariables()).toContain('--fm-scrim:rgba(11,10,9,0.6)');
  });
});

describe('skull', () => {
  it('uses the path from the brand SVG', () => {
    const svgUrl = new URL('../../../design/brand/icon-skull-small.svg', import.meta.url);
    const svg = readFileSync(fileURLToPath(svgUrl), 'utf8');
    const match = /<path[^>]*\sd="([^"]+)"/.exec(svg);
    expect(match).not.toBeNull();
    expect(skull.path).toBe(match?.[1]);
    expect(skull.viewBox).toBe('0 0 13.568 16');
  });
});

describe('cssVariables', () => {
  it('emits colour variables in a :root block', () => {
    const css = cssVariables();
    expect(css.startsWith(':root{')).toBe(true);
    expect(css).toContain('--fm-night:#0B0A09');
    expect(css).toContain('--fm-ember-glow:#E8693F');
    expect(css).toContain('--fm-radius-card:20px');
  });
});

describe('contrast', () => {
  it('meets WCAG AA for the key pairings', () => {
    expect(contrastRatio(colors.bone, colors.night)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.smoke, colors.ash)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.dim, colors.ash)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.white, colors.ember)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.emberGlow, colors.night)).toBeGreaterThanOrEqual(4.5);
  });

  it('computes known reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('map', () => {
  it('has the canvas map-art tones, apart from the brand colours', () => {
    expect(map).toEqual({ land: '#141210', water: '#0F1A1F', park: '#16201A' });
    for (const hex of Object.values(map)) {
      expect(Object.values(colors)).not.toContain(hex);
    }
  });
});
