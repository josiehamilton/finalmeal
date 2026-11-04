import { createContext, createElement, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Href } from 'expo-router';

/**
 * The route the add-dish screens live under: `/add` for the Add-a-dish modal, `/add-first` for the
 * onboarding copy of the same screens. The shared place screens read it to find their sibling
 * routes (Add a spot, and back to the form) so one implementation serves both stacks.
 */
const AddFlowBaseContext = createContext<string>('/add');

export function AddFlowBase({ base, children }: { base: string; children: ReactNode }) {
  return createElement(AddFlowBaseContext.Provider, { value: base }, children);
}

export function useAddFlowBase(): string {
  return useContext(AddFlowBaseContext);
}

/** Where Add goes back to when nobody said where it opened from. */
const DEFAULT_RETURN = '/(app)/you';

/**
 * Closes the Add-a-dish modal after a save, landing on the screen it was opened from (`from`, the
 * path the opener passed), or on the You tab when that is unknown. A `from` that is not an app
 * path is ignored.
 */
export function closeAddFlow(
  router: { dismissTo: (href: Href) => void },
  from: string | undefined,
): void {
  router.dismissTo((from && from.startsWith('/') ? from : DEFAULT_RETURN) as Href);
}

/** The Swap route, carrying where Add was opened from (and the pick being promoted, if any). */
export function swapHref(from: string | undefined, promote?: string) {
  const params: Record<string, string> = {};
  if (promote) params.promote = promote;
  if (from) params.from = from;
  return Object.keys(params).length > 0
    ? { pathname: '/add/swap' as const, params }
    : ('/add/swap' as const);
}
