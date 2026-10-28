import { useSyncExternalStore } from 'react';

/**
 * A tiny store that tells screens the person's picks changed (added, swapped, edited, moved,
 * removed), so lists and the profile's dish count refresh, and that a pick was saved without its
 * photo (You shows a banner until it is dismissed). The Task 7 lists subscribe to the version.
 */
let version = 0;
let photoNotice = false;
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

/** Call after any change to the person's picks. `photoFailed` raises the saved-without-photo notice. */
export function announcePicksChanged({ photoFailed = false }: { photoFailed?: boolean } = {}): void {
  version += 1;
  if (photoFailed) photoNotice = true;
  emit();
}

export function dismissPhotoNotice(): void {
  if (!photoNotice) return;
  photoNotice = false;
  emit();
}

/** For tests. */
export function resetPickChanges(): void {
  version = 0;
  photoNotice = false;
  emit();
}

/** The current version, for a screen that made a change itself and does not need to reload for it. */
export function getPicksVersion(): number {
  return version;
}

/** Counts up each time the picks change; 0 until then. */
export function usePicksVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** True while a "Saved without the photo" banner is waiting to be shown or dismissed. */
export function usePhotoNotice(): boolean {
  return useSyncExternalStore(subscribe, () => photoNotice);
}
