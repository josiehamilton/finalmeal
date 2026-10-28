import { createContext, createElement, useContext } from 'react';
import type { ReactNode } from 'react';

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
