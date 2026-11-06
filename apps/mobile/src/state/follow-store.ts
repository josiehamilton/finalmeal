import { useSyncExternalStore } from 'react';
import type { FollowState } from '@finalmeal/api';

/**
 * How the signed-in person follows each person they have touched this session, keyed by id. Every
 * Follow button (profile, lists, Find people, the feed) reads and writes it, so they agree after
 * going back and forward. An entry beats the `viewerFollow` a screen was handed when it was
 * fetched; a screen that has just fetched fresh data calls `syncFollowStates` to replace it.
 */
const states = new Map<string, FollowState>();
const listeners = new Set<() => void>();
/** Ids with a follow or unfollow call in flight, across every button for that person. */
const pending = new Set<string>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setFollowState(id: string, state: FollowState): void {
  if (states.get(id) === state) return;
  states.set(id, state);
  emit();
}

/** Fresh server answers (a profile, a page of people): they replace what the store holds. */
export function syncFollowStates(
  people: readonly { id: string; viewerFollow: FollowState }[],
): void {
  let changed = false;
  for (const { id, viewerFollow } of people) {
    // A call in flight owns the id; its result will say what the server holds.
    if (pending.has(id) || states.get(id) === viewerFollow) continue;
    states.set(id, viewerFollow);
    changed = true;
  }
  if (changed) emit();
}

/** The state to show for `id`: the store's, else `fallback` (what the screen was handed). */
export function useFollowState(id: string, fallback: FollowState): FollowState {
  const stored = useSyncExternalStore(subscribe, () => states.get(id));
  return stored ?? fallback;
}

/** Claims `id` for a call. False when another button already has one in flight. */
export function beginFollowCall(id: string): boolean {
  if (pending.has(id)) return false;
  pending.add(id);
  return true;
}

export function endFollowCall(id: string): void {
  pending.delete(id);
}

export function hasFollowCall(id: string): boolean {
  return pending.has(id);
}

/** Forgets every follow state. Called when the session ends (and by tests). */
export function clearFollowStates(): void {
  states.clear();
  pending.clear();
  emit();
}
