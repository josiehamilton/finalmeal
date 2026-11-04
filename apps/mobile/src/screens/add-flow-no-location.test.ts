/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/** The post-meal diary never uses the phone's position: nothing in the add flow may touch it. */
const root = join(__dirname, '..', '..');
const FILES = [
  'app/(app)/add',
  'app/(onboarding)/add-first',
  'src/state/add-flow-base.ts',
  'src/components/RestaurantField.tsx',
  'src/state/add-dish.ts',
  'src/components/PlaceSearch.tsx',
  'src/components/DishField.tsx',
  'src/components/TierChooser.tsx',
  'src/components/TagPicker.tsx',
  'src/components/TagChip.tsx',
  'src/components/PhotoField.tsx',
  // The feed never uses the phone’s position either: Nearby is the home city.
  'app/(app)/(tabs)/feed.tsx',
];

/** The Feed components: every `src/components/Feed*.tsx` (and its test files are skipped). */
const FEED_COMPONENTS = readdirSync(join(root, 'src/components'))
  .filter((name: string) => /^Feed.*\.tsx$/.test(name) && !name.endsWith('.test.tsx'))
  .map((name: string) => join('src/components', name));

function sources(path: string): string[] {
  const full = join(root, path);
  if (statSync(full).isDirectory()) {
    return readdirSync(full).flatMap((name: string) => sources(join(path, name)));
  }
  return [full];
}

describe('the add flow and the current location', () => {
  const files = [...FILES, 'src/components/FirstLanding.tsx', ...FEED_COMPONENTS].flatMap(sources);

  it('covers the flow’s files', () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
  });

  it('covers the feed’s components and screen', () => {
    const names = files.map((f) => f.replace(root + '/', ''));
    for (const expected of [
      'app/(app)/(tabs)/feed.tsx',
      'src/components/FeedCard.tsx',
      'src/components/FeedList.tsx',
      'src/components/FeedEmpty.tsx',
      'src/components/FeedHeader.tsx',
      'src/components/FirstLanding.tsx',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it.each(files.map((f) => [f.replace(root + '/', ''), f]))(
    '%s never imports expo-location or asks for a permission',
    (_name, file) => {
      const text = readFileSync(file as string, 'utf8');
      expect(text).not.toMatch(/expo-location/);
      expect(text).not.toMatch(/requestForegroundPermissions|getCurrentPosition|nearestCity/);
    },
  );
});
