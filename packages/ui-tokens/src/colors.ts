// Keep this file import-free: apps/mobile/app.config.ts and scripts/generate-brand-assets.mjs import it directly in plain Node.
/** Ember-only palette, verbatim from the design canvas. No other accent colours. */
export const colors = Object.freeze({
  night: '#0B0A09',
  ash: '#171513',
  ashRaised: '#221F1B',
  line: 'rgba(243,237,228,0.09)',
  lineStrong: 'rgba(243,237,228,0.16)',
  bone: '#F3EDE4',
  smoke: '#A39B91',
  dim: '#8C847A',
  ember: '#C04B28',
  emberGlow: '#E8693F',
  emberWash: 'rgba(192,75,40,0.14)',
  honorable: '#E6DFD5',
  danger: '#FF7A6B',
  white: '#FFFFFF',
});

export type ColorName = keyof typeof colors;
