/** Map-art tones from design/canvas-generator/gen.py `map_svg`. Not brand colours: used only for the maps. */
export const map = Object.freeze({
  land: '#141210',
  water: '#0F1A1F',
  park: '#16201A',
  /** Minor roads and railways. */
  road: 'rgba(243,237,228,0.07)',
  /** Motorways, trunk and primary roads. */
  roadMajor: 'rgba(243,237,228,0.12)',
  /** Place and street names (the same grey as `colors.dim`). */
  label: '#8C847A',
  /** The halo that keeps a label legible over a road (the same as `colors.night`). */
  labelHalo: '#0B0A09',
});
