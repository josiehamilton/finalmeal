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
  /** Darkens what is under it: round buttons over a photo, and the backdrop behind a sheet. */
  scrim: 'rgba(11,10,9,0.6)',
  /** The off track of a switch (NotificationSettings board). A neutral, not an accent. */
  switchOff: '#3A3530',
  honorable: '#E6DFD5',
  /** The map's floating controls (the zoom buttons, the attribution panel). */
  glass: 'rgba(23,21,19,0.94)',
  /** The ring around a selected Final Meal pin on the map. */
  emberRing: 'rgba(232,105,63,0.35)',
  /** The ring around a selected Honorable pin on the map. */
  honorableRing: 'rgba(230,223,213,0.3)',
  danger: '#FF7A6B',
  white: '#FFFFFF',
});

export type ColorName = keyof typeof colors;
