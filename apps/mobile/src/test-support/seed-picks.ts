import type { Pick, Place, Tag } from '@finalmeal/api';

/**
 * Josie's picks as supabase/seed.sql makes them, in the order `getMyPicks` returns them: the four
 * finals by slot, then the thirteen honorable mentions newest first. The numbers the You tab
 * should produce from it (17 picks at 14 spots):
 *
 * - Final Meal 4, Honorable 13, and 17 dishes.
 * - Honorable: 11 spots, of which Marutama and Kin Kao have 2 dishes each.
 * - Vancouver: 8 picks at 6 spots (1 final, 7 honorable at 5 spots), in a chip row of
 *   Vancouver 8, Tokyo 3, New York 2, then Mexico City, Portland, Saigon, Saskatoon with 1 each.
 * - Sushi: 4 picks at 4 spots. Splurge (a personal tag): 1 pick at 1 spot.
 */
const place = (
  id: string,
  name: string,
  area: string,
  city: string,
  region: string,
  country: string,
): Place => ({
  id,
  name,
  area,
  address: null,
  city,
  region,
  country,
  source: 'custom',
  lat: 0,
  lng: 0,
  label: `${area} · ${city}`,
});

export const SEED_PLACES = {
  skewers: place('pl-skewers', 'Skewers', '4th Ave', 'Vancouver', 'BC', 'CA'),
  marutama: place('pl-marutama', 'Marutama', 'Bidwell St', 'Vancouver', 'BC', 'CA'),
  kinKao: place('pl-kin-kao', 'Kin Kao', 'Main St', 'Vancouver', 'BC', 'CA'),
  miku: place('pl-miku', 'Miku', 'Waterfront', 'Vancouver', 'BC', 'CA'),
  lotus: place('pl-lotus', 'Lotus Noodle Bar', 'Chinatown', 'Vancouver', 'BC', 'CA'),
  hearth: place('pl-hearth', 'Hearth Bakery', 'Main St', 'Vancouver', 'BC', 'CA'),
  sushiItto: place('pl-sushi-itto', 'Sushi Itto', 'Shibuya', 'Tokyo', 'Tokyo', 'JP'),
  sushiDai: place('pl-sushi-dai', 'Sushi Dai', 'Toyosu', 'Tokyo', 'Tokyo', 'JP'),
  spicyTime: place('pl-spicy-time', 'Spicy Time', 'Downtown', 'Saskatoon', 'SK', 'CA'),
  lukes: place('pl-lukes', 'Luke’s Lobster', 'Old Port', 'Portland', 'ME', 'US'),
  callejon: place('pl-callejon', 'El Callejón', 'Centro', 'Mexico City', 'CDMX', 'MX'),
  jGrill: place('pl-j-grill', 'J. Grill', 'East Village', 'New York', 'NY', 'US'),
  nami: place('pl-nami', 'Nami', 'SoHo', 'New York', 'NY', 'US'),
  banh: place('pl-banh', 'Bánh', 'District 1', 'Saigon', 'SG', 'VN'),
};

const food = (name: string): Tag => ({
  id: `t-${name}`,
  kind: 'food_type',
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  featured: false,
});
const diet = (name: string): Tag => ({ ...food(name), kind: 'dietary' });
const mine = (name: string): Tag => ({ ...food(name), kind: 'personal' });

type Row = [
  slot: number | null,
  dish: string,
  place: keyof typeof SEED_PLACES,
  tags: Tag[],
  note?: string,
];

const ROWS: Row[] = [
  [1, 'Pork Gyro', 'skewers', [food('Greek'), mine('Late night')], 'Delicious. I’d fly back for it.'],
  [2, 'Wagyu Beef Don', 'sushiItto', [food('Rice bowl'), diet('Gluten-free')]],
  [3, 'Plain Biryani', 'spicyTime', [food('Indian'), diet('Gluten-free'), diet('Vegan')]],
  [4, 'Lobster Roll', 'lukes', [food('Seafood')]],
  [null, 'Tonkotsu Ramen', 'marutama', [food('Noodles'), food('Ramen')]],
  [null, 'Pork Gyoza', 'marutama', [food('Dumplings'), food('Pork')]],
  [null, 'Khao Soi', 'kinKao', [food('Noodles'), food('Thai'), diet('Dairy-free')]],
  [null, 'Crispy Rice Salad', 'kinKao', [food('Thai'), diet('Gluten-free'), mine('Spicy')]],
  [null, 'Aburi Salmon Oshi', 'miku', [food('Sushi'), diet('Low-FODMAP')]],
  [null, 'Vegan Dan Dan Noodles', 'lotus', [food('Noodles'), diet('Vegan'), mine('Spicy')]],
  [null, 'Cardamom Bun', 'hearth', [food('Bakery'), diet('Gluten-free')]],
  [null, 'Omakase', 'sushiDai', [food('Sushi'), diet('Gluten-free'), mine('Splurge')]],
  [null, 'Nigiri Set', 'sushiItto', [food('Sushi'), diet('Low-FODMAP')]],
  [null, 'Toro Hand Roll', 'nami', [food('Sushi')]],
  [null, 'Smash Burger', 'jGrill', [food('Burgers')]],
  [null, 'Tacos Al Pastor', 'callejon', [food('Tacos'), diet('Gluten-free')]],
  [null, 'Banh Mi', 'banh', [food('Sandwiches')]],
];

/** Josie's 17 seeded picks. Ids are `f1`..`f4` for the finals and `h1`..`h13` for the honorables. */
export function seedPicks(): Pick[] {
  let honorable = 0;
  return ROWS.map(([slot, dish, where, tags, note], i): Pick => {
    if (slot === null) honorable += 1;
    return {
      id: slot === null ? `h${honorable}` : `f${slot}`,
      tier: slot === null ? 'honorable' : 'final',
      slot,
      dish: { id: `d-${i}`, name: dish },
      originalDishName: dish,
      place: SEED_PLACES[where],
      note: note ?? null,
      photoUrl: null,
      tags,
      createdAt: new Date(Date.UTC(2026, 9, 27, 12, 0) - i * 60000).toISOString(),
    };
  });
}
