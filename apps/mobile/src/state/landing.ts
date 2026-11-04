import { useSyncExternalStore } from 'react';

/**
 * Whether the person has just finished onboarding and has not yet left the Feed tab. While it is
 * set, the Feed tab shows First landing instead of the feed. In memory only, so a restart clears
 * it; the loading screen sets it, and switching to another tab clears it.
 */
let justOnboarded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function markJustOnboarded(): void {
  if (justOnboarded) return;
  justOnboarded = true;
  emit();
}

export function clearJustOnboarded(): void {
  if (!justOnboarded) return;
  justOnboarded = false;
  emit();
}

/** True from the end of onboarding until the person switches to another tab. */
export function useJustOnboarded(): boolean {
  return useSyncExternalStore(subscribe, () => justOnboarded);
}
