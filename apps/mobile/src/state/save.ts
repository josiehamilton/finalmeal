import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { friendlyMessage, saveDish, unsaveDish } from '@finalmeal/api';
import { getSupabase } from '../lib/supabase';

/**
 * A tiny store that tells the Saved tab a save or unsave happened elsewhere (a pick's Save to try),
 * so it reloads. The same shape as `pick-changes.ts`.
 */
let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call after a dish is saved or unsaved. */
export function announceSavesChanged(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/**
 * Whether the signed-in person has each dish saved, for the dishes touched this session, keyed by
 * dish id. Every holder (a feed card, a pick detail, the Saved tab) reads and writes it, so they
 * agree. An entry beats the `savedByMe` a screen was handed when it was fetched.
 */
const states = new Map<string, boolean>();
/** Dish ids with a save or unsave call in flight, across every holder of that dish. */
const pending = new Set<string>();

/** Records that a dish is (or is no longer) saved, for every holder. */
export function setSavedState(dishId: string, saved: boolean): void {
  if (states.get(dishId) === saved) return;
  states.set(dishId, saved);
  for (const listener of listeners) listener();
}

/** Forgets every saved state and the reload counter. Called when the session ends (and by tests). */
export function clearSaveStates(): void {
  version = 0;
  states.clear();
  pending.clear();
  for (const listener of listeners) listener();
}

/** The current version, for a screen that made the change itself and does not need to reload for it. */
export function getSavesVersion(): number {
  return version;
}

/** Counts up each time a save changes; 0 until then. */
export function useSavesVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

export interface SaveControl {
  saved: boolean;
  /** A call is in flight; taps are ignored until it ends. */
  busy: boolean;
  /** Friendly copy for the last failure, cleared by the next try. */
  error: string | null;
  toggle: () => Promise<void>;
}

/**
 * Whether the signed-in person has saved a dish, as seen from one pick (`viaPickId` is remembered
 * and its owner is told). The answer lives in a store shared by every holder of the dish. It
 * changes optimistically, one call per dish is in flight at a time (extra taps, from any holder,
 * are ignored), the old state comes back with friendly copy when the call fails, and the Saved tab
 * is told to reload when it works. `initial` is what the server last said; a fresh answer replaces
 * the store's unless a call is mid-flight.
 */
export function useSave(dishId: string, viaPickId: string, initial: boolean): SaveControl {
  const stored = useSyncExternalStore(subscribe, () => states.get(dishId));
  const saved = stored ?? initial;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A changed answer from the server (a refresh) replaces ours, unless a call is mid-flight.
  const seen = useRef(initial);
  useEffect(() => {
    if (seen.current === initial) return;
    seen.current = initial;
    if (!pending.has(dishId)) setSavedState(dishId, initial);
  }, [dishId, initial]);

  const toggle = useCallback(async () => {
    if (pending.has(dishId)) return;
    pending.add(dishId);
    const before = saved;
    setBusy(true);
    setError(null);
    setSavedState(dishId, !before);
    try {
      if (before) await unsaveDish(getSupabase(), dishId);
      else await saveDish(getSupabase(), dishId, viaPickId);
      announceSavesChanged();
    } catch (e) {
      setSavedState(dishId, before);
      setError(friendlyMessage(e));
    } finally {
      pending.delete(dishId);
      setBusy(false);
    }
  }, [saved, dishId, viaPickId]);

  return { saved, busy, error, toggle };
}
