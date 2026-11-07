import type { MapCamera } from './bridge';

/** Where Discover opens with a home city: its point at this zoom. */
export const HOME_ZOOM = 12;

/** Where the map goes to show one place. */
export const FOCUS_ZOOM = 15;

/** The map without a home city: the whole world, never the phone's position. */
export const WORLD_CAMERA: MapCamera = Object.freeze({ lat: 20, lng: 0, zoom: 1.5 });
