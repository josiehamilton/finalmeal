/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/** Colours come from @finalmeal/ui-tokens: no hex literal in the app's screens or components. */
const root = join(__dirname, '..', '..');

function sources(path: string): string[] {
  const full = join(root, path);
  if (statSync(full).isDirectory()) {
    return readdirSync(full).flatMap((name: string) => sources(join(path, name)));
  }
  return /\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full) ? [full] : [];
}

describe('colours', () => {
  const files = [...sources('app'), ...sources('src')];

  it('covers the app', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no raw hex colour outside the tokens', () => {
    const offenders = files.filter((file) => /#[0-9A-Fa-f]{6}\b/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
