import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyMessage, getDishesInView, getPicksInView, nearestCity } from '@finalmeal/api';
import type { DiscoverDish, DiscoverPlace, LatLng } from '@finalmeal/api';
import { DEFAULT_DISCOVER_FILTERS } from '@finalmeal/core';
import type { DiscoverFilters } from '@finalmeal/core';
import { getSupabase } from '../lib/supabase';
import { HOME_ZOOM, WORLD_CAMERA } from '../map/camera';
import type { MapRegion } from '../map/bridge';

/** How long the map must hold still before a region change loads. */
export const REGION_DEBOUNCE_MS = 250;
/** The sheet shows this many dish cards; the full list view asks for more. */
const SHEET_DISHES = 20;
/** Below this zoom the view spans too much to be "near" one city: the title says "here". */
export const CITY_NAME_MIN_ZOOM = 9;
/** Two centres closer than this (degrees) are the same place. */
const SAME_CENTRE = 1e-5;

/** Whether any filter is off its default (so an empty map may be the filters' doing). */
export function hasActiveFilters(f: DiscoverFilters): boolean {
  return (
    f.tier !== 'all' ||
    f.followingOnly ||
    f.radiusKm !== null ||
    f.foodTypeIds.length > 0 ||
    f.dietaryIds.length > 0
  );
}

export type DiscoverStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DiscoverState {
  filters: DiscoverFilters;
  setFilters: (filters: DiscoverFilters) => void;
  /** The latest view of the map, or the starting view before the map has reported one. */
  region: MapRegion | null;
  places: DiscoverPlace[];
  truncated: boolean;
  dishes: DiscoverDish[];
  cityName: string | null;
  status: DiscoverStatus;
  /** The friendly message while `status` is `error`. */
  error: string | null;
  selectedId: string | null;
  /** `from` is where distances are measured; the map's centre when not given. */
  select: (id: string | null, from?: LatLng) => void;
  /** The selected place's dishes, or null while none is selected (or they are still loading). */
  selected: DiscoverDish[] | null;
  onRegionChange: (region: MapRegion) => void;
  retry: () => void;
}

/**
 * Roughly what a phone shows at the start camera: about 390 by 844 points on 256-point tiles.
 * It lets the sheet load before (or without) the map page ever reporting a view.
 */
function startRegion(home: LatLng | null): MapRegion {
  if (!home) {
    return {
      bounds: { west: -180, south: -85, east: 180, north: 85 },
      center: { lat: WORLD_CAMERA.lat, lng: WORLD_CAMERA.lng },
      zoom: WORLD_CAMERA.zoom,
    };
  }
  const degreesPerPoint = 360 / (256 * 2 ** HOME_ZOOM);
  const lngSpan = (390 * degreesPerPoint) / 2;
  const latSpan = (844 * degreesPerPoint * Math.cos((home.lat * Math.PI) / 180)) / 2;
  return {
    bounds: {
      west: Math.max(home.lng - lngSpan, -180),
      east: Math.min(home.lng + lngSpan, 180),
      south: Math.max(home.lat - latSpan, -90),
      north: Math.min(home.lat + latSpan, 90),
    },
    center: { lat: home.lat, lng: home.lng },
    zoom: HOME_ZOOM,
  };
}

function cityKey(center: LatLng): string {
  return `${center.lat.toFixed(2)},${center.lng.toFixed(2)}`;
}

/**
 * Discover's data: the places and cards for the map's view, the selected place's dishes, and the
 * filters. Every load for a view runs both reads under one request number, and an answer for an
 * older number is dropped, so the pins and the sheet always come from the same viewport.
 * Distances and the Distance filter are measured from the map's centre, never from the phone.
 */
export function useDiscover(home: LatLng | null): DiscoverState {
  const [filters, setFiltersState] = useState<DiscoverFilters>(DEFAULT_DISCOVER_FILTERS);
  const [region, setRegion] = useState<MapRegion | null>(null);
  const [places, setPlaces] = useState<DiscoverPlace[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [dishes, setDishes] = useState<DiscoverDish[]>([]);
  const [cityName, setCityName] = useState<string | null>(null);
  const [status, setStatus] = useState<DiscoverStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DiscoverDish[] | null>(null);

  const filtersRef = useRef(filters);
  const regionRef = useRef<MapRegion | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const viewRequest = useRef(0);
  const selectRequest = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  /** What `retry` repeats: the last view load and the last selection load, kept apart. */
  const lastView = useRef<() => void>(() => {});
  const lastSelection = useRef<() => void>(() => {});
  /** The view the last load asked for; a region with the same centre and zoom is not reloaded. */
  const loadedView = useRef<MapRegion | null>(null);
  /** Which kind of load the error on screen came from. */
  const errorSource = useRef<'view' | 'selection' | null>(null);
  const cityCache = useRef(new Map<string, string | null>());

  const showError = useCallback((e: unknown, source: 'view' | 'selection') => {
    errorSource.current = source;
    setError(friendlyMessage(e));
    setStatus('error');
  }, []);

  /** The city a view is "near", or null when the view is too wide to name one (or the lookup fails). */
  const cityFor = useCallback(async (view: MapRegion): Promise<string | null> => {
    if (view.zoom < CITY_NAME_MIN_ZOOM) return null;
    const key = cityKey(view.center);
    const cached = cityCache.current.get(key);
    if (cached !== undefined) return cached;
    try {
      const city = await nearestCity(getSupabase(), view.center.lat, view.center.lng);
      cityCache.current.set(key, city?.name ?? null);
      return city?.name ?? null;
    } catch {
      // The title falls back to "picks here"; a missing city name is not worth an error.
      return null;
    }
  }, []);

  const loadView = useCallback(
    (view: MapRegion, using: DiscoverFilters) => {
      const request = ++viewRequest.current;
      loadedView.current = view;
      lastView.current = () => loadView(view, using);
      setStatus('loading');
      setError(null);
      errorSource.current = null;
      const client = getSupabase();
      // The city comes with the view it labels, so the title never pairs it with another view's count.
      Promise.all([
        getPicksInView(client, view.bounds, using, view.center),
        getDishesInView(client, view.bounds, using, view.center, { limit: SHEET_DISHES }),
        cityFor(view),
      ]).then(
        ([picks, cards, city]) => {
          if (!mounted.current || request !== viewRequest.current) return;
          setPlaces(picks.places);
          setTruncated(picks.truncated);
          setDishes(cards);
          setCityName(city);
          setStatus('ready');
        },
        (e: unknown) => {
          if (!mounted.current || request !== viewRequest.current) return;
          showError(e, 'view');
        },
      );
    },
    [showError, cityFor],
  );

  const loadSelection = useCallback(
    (id: string, using: DiscoverFilters, from?: LatLng) => {
      const request = ++selectRequest.current;
      lastSelection.current = () => loadSelection(id, using, from);
      if (errorSource.current === 'selection') {
        errorSource.current = null;
        setError(null);
        setStatus('ready');
      }
      const center = from ?? regionRef.current?.center ?? home;
      getDishesInView(getSupabase(), null, using, center, { placeId: id }).then(
        (cards) => {
          if (!mounted.current || request !== selectRequest.current) return;
          if (cards.length === 0) {
            // Nothing to show for this place: do not leave an invisible selection behind.
            selectedIdRef.current = null;
            setSelectedId(null);
            return;
          }
          setSelected(cards);
        },
        (e: unknown) => {
          if (!mounted.current || request !== selectRequest.current) return;
          showError(e, 'selection');
        },
      );
    },
    [home, showError],
  );

  // The first load comes from the starting view, so the sheet works even if the map never reports.
  useEffect(() => {
    mounted.current = true;
    const start = startRegion(home);
    regionRef.current = start;
    setRegion(start);
    loadView(start, filtersRef.current);
    return () => {
      mounted.current = false;
      if (debounce.current) clearTimeout(debounce.current);
    };
    // The starting view is fixed when the screen mounts; a new home city remounts the screen.
  }, []);

  const onRegionChange = useCallback(
    (next: MapRegion) => {
      regionRef.current = next;
      setRegion(next);
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        debounce.current = null;
        const current = regionRef.current;
        if (!current) return;
        // A sheet changing height only pads the map: same centre and zoom, nothing new to read.
        const last = loadedView.current;
        const same =
          last !== null &&
          errorSource.current !== 'view' &&
          current.zoom === last.zoom &&
          Math.abs(current.center.lat - last.center.lat) < SAME_CENTRE &&
          Math.abs(current.center.lng - last.center.lng) < SAME_CENTRE;
        if (!same) loadView(current, filtersRef.current);
      }, REGION_DEBOUNCE_MS);
    },
    [loadView],
  );

  const select = useCallback(
    (id: string | null, from?: LatLng) => {
      selectedIdRef.current = id;
      setSelectedId(id);
      setSelected(null);
      if (id === null) {
        selectRequest.current += 1;
        if (errorSource.current === 'selection') {
          errorSource.current = null;
          setError(null);
          setStatus('ready');
        }
        return;
      }
      loadSelection(id, filtersRef.current, from);
    },
    [loadSelection],
  );

  const setFilters = useCallback(
    (next: DiscoverFilters) => {
      filtersRef.current = next;
      setFiltersState(next);
      selectedIdRef.current = null;
      selectRequest.current += 1;
      setSelectedId(null);
      setSelected(null);
      if (debounce.current) {
        clearTimeout(debounce.current);
        debounce.current = null;
      }
      const current = regionRef.current;
      if (current) loadView(current, next);
    },
    [loadView],
  );

  const retry = useCallback(() => {
    if (errorSource.current === 'selection') lastSelection.current();
    else lastView.current();
  }, []);

  return {
    filters,
    setFilters,
    region,
    places,
    truncated,
    dishes,
    cityName,
    status,
    error,
    selectedId,
    select,
    selected,
    onRegionChange,
    retry,
  };
}
