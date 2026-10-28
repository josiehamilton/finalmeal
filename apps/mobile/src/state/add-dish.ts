import { createContext, createElement, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { Pick, Place, Tag } from '@finalmeal/api';
import { FINAL_MEAL_SIZE, NOTE_MAX } from '@finalmeal/core';

/** The city the restaurant search is anchored to. Its point only ranks results; it is never the person's location. */
export interface SearchCity {
  id: string;
  label: string;
  point: { lat: number; lng: number } | null;
}

export interface AddDishDraft {
  place: Place | null;
  dishName: string;
  /** Set when the person chose an existing dish from the suggestions; cleared as soon as they type. */
  dishId: string | null;
  tier: 'final' | 'honorable';
  note: string;
  /** The picked photo, as the picker gave it; prepared (1600 px JPEG) only when saving. */
  photoUri: string | null;
  /** Chosen food-type and dietary tags. */
  tags: Tag[];
  /** Chosen personal tags, by name (the server creates new names). */
  personalTags: string[];
  /** Last city chosen in this flow; the place search and Add a spot start from it. */
  searchCity: SearchCity | null;
}

export const initialDraft: AddDishDraft = {
  place: null,
  dishName: '',
  dishId: null,
  tier: 'final',
  note: '',
  photoUri: null,
  tags: [],
  personalTags: [],
  searchCity: null,
};

/** The tier named by a route param (`/add?tier=final`), or undefined when it is missing or unknown. */
export function tierFromParam(value: string | string[] | undefined): 'final' | 'honorable' | undefined {
  const tier = Array.isArray(value) ? value[0] : value;
  return tier === 'final' || tier === 'honorable' ? tier : undefined;
}

export type AddDishAction =
  | { type: 'setPlace'; place: Place }
  | { type: 'setDishName'; name: string }
  | { type: 'chooseSuggestion'; suggestion: { id: string; name: string } }
  | { type: 'setTier'; tier: 'final' | 'honorable' }
  | { type: 'setNote'; note: string }
  | { type: 'setPhoto'; uri: string | null }
  | { type: 'toggleTag'; tag: Tag }
  | { type: 'togglePersonalTag'; name: string }
  | { type: 'selectPersonalTag'; name: string }
  | { type: 'setSearchCity'; city: SearchCity | null }
  /** Replaces parts of the draft wholesale (Edit loads a pick's note, photo and tags this way). */
  | { type: 'hydrate'; draft: Partial<AddDishDraft> }
  | { type: 'reset' };

/** "Rainy day" and " rainy  DAY " are the same personal tag. */
export function personalKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function addDishReducer(state: AddDishDraft, action: AddDishAction): AddDishDraft {
  switch (action.type) {
    case 'setPlace':
      // Suggestions are dishes at one place, so a suggestion does not follow the person to another.
      return {
        ...state,
        place: action.place,
        dishId: state.place?.id === action.place.id ? state.dishId : null,
      };
    case 'setDishName':
      return { ...state, dishName: action.name, dishId: null };
    case 'chooseSuggestion':
      return { ...state, dishName: action.suggestion.name, dishId: action.suggestion.id };
    case 'setTier':
      return { ...state, tier: action.tier };
    case 'setNote':
      return { ...state, note: action.note.slice(0, NOTE_MAX) };
    case 'setPhoto':
      return { ...state, photoUri: action.uri };
    case 'toggleTag':
      return {
        ...state,
        tags: state.tags.some((t) => t.id === action.tag.id)
          ? state.tags.filter((t) => t.id !== action.tag.id)
          : [...state.tags, action.tag],
      };
    case 'togglePersonalTag': {
      const key = personalKey(action.name);
      return {
        ...state,
        personalTags: state.personalTags.some((n) => personalKey(n) === key)
          ? state.personalTags.filter((n) => personalKey(n) !== key)
          : [...state.personalTags, action.name.trim()],
      };
    }
    case 'selectPersonalTag': {
      const key = personalKey(action.name);
      return state.personalTags.some((n) => personalKey(n) === key)
        ? state
        : { ...state, personalTags: [...state.personalTags, action.name.trim()] };
    }
    case 'setSearchCity':
      return { ...state, searchCity: action.city };
    case 'hydrate':
      return { ...state, ...action.draft };
    case 'reset':
      return { ...initialDraft, searchCity: state.searchCity };
  }
}

/** True once the person has put anything in the form (the tier and the search city do not count). */
export function draftHasContent(draft: AddDishDraft): boolean {
  return (
    draft.place !== null ||
    draft.dishName.trim() !== '' ||
    draft.note !== '' ||
    draft.photoUri !== null ||
    draft.tags.length > 0 ||
    draft.personalTags.length > 0
  );
}

export interface Cta {
  label: string;
  disabled: boolean;
  /** `swap` opens the Swap screen; `add` saves the pick. */
  mode: 'add' | 'swap';
}

/**
 * The form's button. `finalCount` is how many Final Meal picks the person has (null until known).
 * With the five full, adding to the Final Meal means choosing one to replace.
 */
export function ctaFor(draft: AddDishDraft, finalCount: number | null): Cta {
  const disabled = draft.place === null || draft.dishName.trim() === '';
  if (draft.tier === 'honorable') return { label: 'Add to Honorable', disabled, mode: 'add' };
  if (finalCount !== null && finalCount >= FINAL_MEAL_SIZE) {
    return { label: 'Choose one to replace', disabled, mode: 'swap' };
  }
  return { label: 'Add to Final Meal', disabled, mode: 'add' };
}

/** "<name> · <n> picks here"; the count is left out at 0. */
export function suggestionLabel(s: { name: string; pickCount: number }): string {
  if (s.pickCount <= 0) return s.name;
  return `${s.name} · ${s.pickCount} ${s.pickCount === 1 ? 'pick' : 'picks'} here`;
}

/** The Final Meal card's sub-copy, or null while the count is unknown. */
export function tierSubCopy(finalCount: number | null): string | null {
  if (finalCount === null) return null;
  return finalCount >= FINAL_MEAL_SIZE
    ? `${FINAL_MEAL_SIZE} of ${FINAL_MEAL_SIZE} used. You’ll choose one to replace.`
    : `${finalCount} of ${FINAL_MEAL_SIZE} used.`;
}

interface AddDishContextValue {
  draft: AddDishDraft;
  dispatch: (action: AddDishAction) => void;
}

const AddDishContext = createContext<AddDishContextValue | null>(null);

/** Holds the draft for the whole Add-a-dish modal stack. Tests may start from a partial draft. */
export function AddDishProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Partial<AddDishDraft>;
}) {
  const [draft, dispatch] = useReducer(addDishReducer, { ...initialDraft, ...initial });
  const value = useMemo(() => ({ draft, dispatch }), [draft]);
  return createElement(AddDishContext.Provider, { value }, children);
}

export function useAddDish(): AddDishContextValue {
  const value = useContext(AddDishContext);
  if (!value) throw new Error('useAddDish must be used inside <AddDishProvider>.');
  return value;
}

/** Lower-case, accent-free words with plural "s" dropped and any "(...)" aside removed: close to what the server matches on. */
function dishKey(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w !== '')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

/**
 * The person's existing pick for the dish in the draft (what a `duplicate_pick` refusal means),
 * found at the same place by the chosen suggestion or by the dish name as typed. Null if none matches.
 */
export function findExistingPick(picks: readonly Pick[], draft: AddDishDraft): Pick | null {
  if (!draft.place) return null;
  const typed = dishKey(draft.dishName);
  return (
    picks.find(
      (p) =>
        p.place.id === draft.place?.id &&
        ((draft.dishId !== null && p.dish.id === draft.dishId) ||
          (typed !== '' && (dishKey(p.dish.name) === typed || dishKey(p.originalDishName) === typed))),
    ) ?? null
  );
}
