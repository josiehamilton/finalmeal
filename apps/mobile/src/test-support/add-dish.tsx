import type { ReactNode } from 'react';
import { Text } from 'react-native';
import type { Place, Tag } from '@finalmeal/api';
import { AddDishProvider, useAddDish } from '../state/add-dish';
import type { AddDishDraft } from '../state/add-dish';

export const PLACE: Place = {
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

export const RAMEN: Tag = { id: 't1', kind: 'food_type', name: 'Ramen', slug: 'ramen', featured: true };
export const VEGAN: Tag = { id: 't2', kind: 'dietary', name: 'Vegan', slug: 'vegan', featured: true };

/** Shows the draft as JSON so a test can read what the screen put in it. */
function Probe() {
  const { draft } = useAddDish();
  return <Text testID="draft">{JSON.stringify(draft)}</Text>;
}

/** The add-dish providers around a screen, with a probe that exposes the draft. */
export function withDraft(ui: ReactNode, initial: Partial<AddDishDraft> = {}) {
  return (
    <AddDishProvider initial={initial}>
      {ui}
      <Probe />
    </AddDishProvider>
  );
}

export function readDraft(screen: { getByTestId: (id: string) => { props: { children?: unknown } } }) {
  return JSON.parse(String(screen.getByTestId('draft').props.children)) as AddDishDraft;
}
