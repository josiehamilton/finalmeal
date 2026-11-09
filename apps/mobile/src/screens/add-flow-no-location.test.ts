/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { buildMapHtml, MAP_PAGE_SCRIPT } from '../map/map-page';

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

/** The map and its page: every `src/map` file except the tests (which name what they forbid). */
const MAP_FILES = sources('src/map').filter((f) => !/\.test\.tsx?$/.test(f));

describe('the map and the current location', () => {
  it('covers the map’s files', () => {
    const names = MAP_FILES.map((f) => f.replace(root + '/', ''));
    for (const expected of ['src/map/PicksMap.tsx', 'src/map/map-page.ts', 'src/map/bridge.ts']) {
      expect(names).toContain(expected);
    }
  });

  it.each(MAP_FILES.map((f) => [f.replace(root + '/', ''), f]))(
    '%s never imports expo-location or asks for a permission',
    (_name, file) => {
      const text = readFileSync(file as string, 'utf8');
      expect(text).not.toMatch(/expo-location/);
      expect(text).not.toMatch(/requestForegroundPermissions|getCurrentPosition|nearestCity/);
    },
  );

  it('keeps geolocation out of the page: no navigator.geolocation, no GeolocateControl', () => {
    const html = buildMapHtml({ camera: { lat: 0, lng: 0, zoom: 1 }, interactive: true });
    for (const text of [html, MAP_PAGE_SCRIPT]) {
      expect(text).not.toMatch(/geolocation|GeolocateControl|getCurrentPosition|watchPosition/i);
    }
  });

  it('turns the WebView’s own geolocation off', () => {
    const text = readFileSync(join(root, 'src/map/PicksMap.tsx'), 'utf8');
    expect(text).toContain('geolocationEnabled={false}');
  });
});

/**
 * Discover: the screen, its state and every component it uses. The map starts at the home city and
 * distances come from the map’s centre, so nothing here may touch the phone’s position.
 * `nearestCity` is allowed only in `state/discover.ts`, where it names the map’s centre.
 */
const DISCOVER_FILES = [
  'app/(app)/(tabs)/discover.tsx',
  'src/state/discover.ts',
  ...readdirSync(join(root, 'src/components'))
    .filter(
      (name: string) =>
        /^(Discover.*|FiltersSheet|MapLegend|SelectedPlaceSheet|DishResultRow|DishPhoto)\.tsx$/.test(name),
    )
    .map((name: string) => join('src/components', name)),
].filter((f) => !/\.test\.tsx?$/.test(f));

describe('Discover and the current location', () => {
  it('covers the screen, its state and its components', () => {
    for (const expected of [
      'app/(app)/(tabs)/discover.tsx',
      'src/state/discover.ts',
      'src/components/DiscoverTopBar.tsx',
      'src/components/DiscoverSheet.tsx',
      'src/components/DiscoverDishCard.tsx',
      'src/components/DiscoverListView.tsx',
      'src/components/SelectedPlaceSheet.tsx',
      'src/components/FiltersSheet.tsx',
      'src/components/MapLegend.tsx',
      'src/components/DishResultRow.tsx',
    ]) {
      expect(DISCOVER_FILES).toContain(expected);
    }
  });

  it.each(DISCOVER_FILES.map((f) => [f]))(
    '%s never imports expo-location or asks for a permission',
    (file) => {
      const text = readFileSync(join(root, file), 'utf8');
      expect(text).not.toMatch(/expo-location/);
      expect(text).not.toMatch(/requestForegroundPermissions|getCurrentPosition|watchPosition|geolocation/i);
      if (file !== 'src/state/discover.ts') expect(text).not.toMatch(/nearestCity/);
    },
  );
});
