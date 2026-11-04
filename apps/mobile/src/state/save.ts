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

/** For tests. */
export function resetSaveChanges(): void {
  version = 0;
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
 * and its owner is told). Changes optimistically, keeps one call in flight (a ref as well as state,
 * so two taps in the same frame make one call), puts the old state back with friendly copy when the
 * call fails, and tells the Saved tab to reload when it works. `initial` is what the server last
 * said; a fresh answer replaces ours unless a call is mid-flight.
 */
export function useSave(dishId: string, viaPickId: string, initial: boolean): SaveControl {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!inFlight.current) setSaved(initial);
  }, [initial]);

  const toggle = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const before = saved;
    setBusy(true);
    setError(null);
    setSaved(!before);
    try {
      if (before) await unsaveDish(getSupabase(), dishId);
      else await saveDish(getSupabase(), dishId, viaPickId);
      announceSavesChanged();
    } catch (e) {
      setSaved(before);
      setError(friendlyMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [saved, dishId, viaPickId]);

  return { saved, busy, error, toggle };
}
