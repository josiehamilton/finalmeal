import type { Pick, Place, Tag } from '@finalmeal/api';
import {
  addDishReducer,
  ctaFor,
  findExistingPick,
  initialDraft,
  suggestionLabel,
  tierSubCopy,
} from './add-dish';
import type { AddDishDraft } from './add-dish';

const PLACE: Place = {
  id: 'p1',
  name: 'Marutama Ramen',
  area: 'Bidwell St',
  address: null,
  city: 'Vancouver',
  region: 'BC',
  country: 'CA',
  source: 'fsq',
  lat: 49.29,
  lng: -123.13,
  label: 'Bidwell St · Vancouver',
};
const RAMEN: Tag = { id: 't1', kind: 'food_type', name: 'Ramen', slug: 'ramen', featured: true };
const VEGAN: Tag = { id: 't2', kind: 'dietary', name: 'Vegan', slug: 'vegan', featured: true };

const draft = (over: Partial<AddDishDraft> = {}): AddDishDraft => ({ ...initialDraft, ...over });

describe('addDishReducer', () => {
  it('starts empty, on the Final Meal', () => {
    expect(initialDraft).toMatchObject({
      place: null,
      dishName: '',
      dishId: null,
      tier: 'final',
      note: '',
      photoUri: null,
      tags: [],
      personalTags: [],
      searchCity: null,
    });
  });

  it('sets the place', () => {
    expect(addDishReducer(draft(), { type: 'setPlace', place: PLACE }).place).toBe(PLACE);
  });

  it('forgets a chosen suggestion when the place changes (dishes belong to a place)', () => {
    const chosen = draft({ place: PLACE, dishName: 'Tonkotsu Ramen', dishId: 'd1' });
    const next = addDishReducer(chosen, { type: 'setPlace', place: { ...PLACE, id: 'p2' } });
    expect(next.dishId).toBeNull();
    expect(next.dishName).toBe('Tonkotsu Ramen');
  });

  it('keeps a chosen suggestion when the same place is set again', () => {
    const chosen = draft({ place: PLACE, dishName: 'Tonkotsu Ramen', dishId: 'd1' });
    expect(addDishReducer(chosen, { type: 'setPlace', place: PLACE }).dishId).toBe('d1');
  });

  it('typing a dish name clears the chosen suggestion', () => {
    const chosen = draft({ dishName: 'Tonkotsu Ramen', dishId: 'd1' });
    const next = addDishReducer(chosen, { type: 'setDishName', name: 'Tonkotsu Ram' });
    expect(next).toMatchObject({ dishName: 'Tonkotsu Ram', dishId: null });
  });

  it('choosing a suggestion sets the name and the dish id', () => {
    const next = addDishReducer(draft({ dishName: 'tonk' }), {
      type: 'chooseSuggestion',
      suggestion: { id: 'd1', name: 'Tonkotsu Ramen' },
    });
    expect(next).toMatchObject({ dishName: 'Tonkotsu Ramen', dishId: 'd1' });
  });

  it('sets the tier', () => {
    expect(addDishReducer(draft(), { type: 'setTier', tier: 'honorable' }).tier).toBe('honorable');
  });

  it('keeps the note to 280 characters', () => {
    const next = addDishReducer(draft(), { type: 'setNote', note: 'x'.repeat(300) });
    expect(next.note).toHaveLength(280);
  });

  it('sets and clears the photo', () => {
    const set = addDishReducer(draft(), { type: 'setPhoto', uri: 'file:///a.jpg' });
    expect(set.photoUri).toBe('file:///a.jpg');
    expect(addDishReducer(set, { type: 'setPhoto', uri: null }).photoUri).toBeNull();
  });

  it('toggles global tags on and off', () => {
    const on = addDishReducer(draft(), { type: 'toggleTag', tag: RAMEN });
    const both = addDishReducer(on, { type: 'toggleTag', tag: VEGAN });
    expect(both.tags).toEqual([RAMEN, VEGAN]);
    expect(addDishReducer(both, { type: 'toggleTag', tag: RAMEN }).tags).toEqual([VEGAN]);
  });

  it('toggles personal tags by name, ignoring case and extra spaces', () => {
    const on = addDishReducer(draft(), { type: 'togglePersonalTag', name: 'Rainy day' });
    expect(on.personalTags).toEqual(['Rainy day']);
    expect(addDishReducer(on, { type: 'togglePersonalTag', name: ' rainy  DAY ' }).personalTags).toEqual(
      [],
    );
  });

  it('selects a personal tag once, however often it is added', () => {
    const once = addDishReducer(draft(), { type: 'selectPersonalTag', name: 'Rainy day' });
    const twice = addDishReducer(once, { type: 'selectPersonalTag', name: 'rainy day' });
    expect(twice.personalTags).toEqual(['Rainy day']);
  });

  it('remembers the last city chosen in the flow', () => {
    const city = { id: 'c2', label: 'Tokyo, Japan', point: { lat: 35.68, lng: 139.69 } };
    expect(addDishReducer(draft(), { type: 'setSearchCity', city }).searchCity).toBe(city);
  });

  it('reset clears the dish but keeps the city', () => {
    const city = { id: 'c2', label: 'Tokyo, Japan', point: null };
    const full = draft({
      place: PLACE,
      dishName: 'x',
      dishId: 'd',
      tier: 'honorable',
      note: 'n',
      photoUri: 'u',
      tags: [RAMEN],
      personalTags: ['a'],
      searchCity: city,
    });
    expect(addDishReducer(full, { type: 'reset' })).toEqual({ ...initialDraft, searchCity: city });
  });
});

describe('ctaFor', () => {
  it('reads Add to Final Meal with room in the five', () => {
    expect(ctaFor(draft({ place: PLACE, dishName: 'Ramen' }), 2)).toEqual({
      label: 'Add to Final Meal',
      disabled: false,
      mode: 'add',
    });
  });

  it('reads Add to Honorable for the runners-up, even with five full', () => {
    expect(ctaFor(draft({ place: PLACE, dishName: 'Ramen', tier: 'honorable' }), 5)).toEqual({
      label: 'Add to Honorable',
      disabled: false,
      mode: 'add',
    });
  });

  it('reads Choose one to replace, and opens Swap, when five are full and Final Meal is chosen', () => {
    expect(ctaFor(draft({ place: PLACE, dishName: 'Ramen' }), 5)).toEqual({
      label: 'Choose one to replace',
      disabled: false,
      mode: 'swap',
    });
  });

  it('is disabled until a restaurant is chosen', () => {
    expect(ctaFor(draft({ dishName: 'Ramen' }), 0).disabled).toBe(true);
  });

  it.each(['', '   '])('is disabled for the dish name %j', (dishName) => {
    expect(ctaFor(draft({ place: PLACE, dishName }), 0).disabled).toBe(true);
  });

  it('still reads Add to Final Meal while the count is unknown', () => {
    expect(ctaFor(draft({ place: PLACE, dishName: 'Ramen' }), null).label).toBe('Add to Final Meal');
  });
});

describe('copy helpers', () => {
  it('labels a suggestion with its pick count', () => {
    expect(suggestionLabel({ name: 'Tonkotsu Ramen', pickCount: 14 })).toBe(
      'Tonkotsu Ramen · 14 picks here',
    );
    expect(suggestionLabel({ name: 'Tonkotsu Ramen', pickCount: 1 })).toBe(
      'Tonkotsu Ramen · 1 pick here',
    );
  });

  it('omits the count when it is 0', () => {
    expect(suggestionLabel({ name: 'Tonkotsu Ramen', pickCount: 0 })).toBe('Tonkotsu Ramen');
  });

  it('says how many of the five are used, or that they are full', () => {
    expect(tierSubCopy(3)).toBe('3 of 5 used.');
    expect(tierSubCopy(5)).toBe('5 of 5 used. You’ll choose one to replace.');
    expect(tierSubCopy(null)).toBeNull();
  });
});

describe('findExistingPick', () => {
  const pick = (over: Partial<Pick> = {}): Pick => ({
    id: 'pk1',
    tier: 'honorable',
    slot: null,
    dish: { id: 'd1', name: 'Tonkotsu Ramen' },
    originalDishName: 'tonkotsu ramen',
    place: PLACE,
    note: null,
    photoUrl: null,
    tags: [],
    createdAt: '2026-10-27T00:00:00Z',
    ...over,
  });

  it('finds the pick for the chosen suggestion', () => {
    const d = draft({ place: PLACE, dishName: 'whatever', dishId: 'd1' });
    expect(findExistingPick([pick()], d)?.id).toBe('pk1');
  });

  it.each(['tonkotsu ramen', 'Tonkotsu  Ramen!', 'Tonkotsu Ramen (extra chashu)', 'Tonkotsu Ramens'])(
    'finds the pick when the same dish is typed as %j',
    (typed) => {
      expect(findExistingPick([pick()], draft({ place: PLACE, dishName: typed }))?.id).toBe('pk1');
    },
  );

  it('matches the wording the person originally used', () => {
    const p = pick({ dish: { id: 'd1', name: 'Ramen, Tonkotsu' }, originalDishName: 'Pork Noodle Soup' });
    expect(findExistingPick([p], draft({ place: PLACE, dishName: 'pork noodle soup' }))?.id).toBe('pk1');
  });

  it('ignores picks at other places and other dishes', () => {
    const elsewhere = pick({ place: { ...PLACE, id: 'p2' } });
    const other = pick({ dish: { id: 'd2', name: 'Gyoza' }, originalDishName: 'Gyoza' });
    expect(findExistingPick([elsewhere, other], draft({ place: PLACE, dishName: 'Tonkotsu Ramen' }))).toBeNull();
  });

  it('finds nothing without a place or a name', () => {
    expect(findExistingPick([pick()], draft({ dishName: 'Tonkotsu Ramen' }))).toBeNull();
    expect(findExistingPick([pick()], draft({ place: PLACE, dishName: ' ' }))).toBeNull();
  });
});
