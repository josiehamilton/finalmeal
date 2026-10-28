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
];

function sources(path: string): string[] {
  const full = join(root, path);
  if (statSync(full).isDirectory()) {
    return readdirSync(full).flatMap((name: string) => sources(join(path, name)));
  }
  return [full];
}

describe('the add flow and the current location', () => {
  const files = FILES.flatMap(sources);

  it('covers the flow’s files', () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
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
