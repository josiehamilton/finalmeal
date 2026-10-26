import { colors } from './colors';
import { radii } from './layout';

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Returns a `:root{...}` block exposing every colour and radius as `--fm-*` variables. */
export function cssVariables(): string {
  const colorVars = Object.entries(colors).map(([name, value]) => `--fm-${kebab(name)}:${value}`);
  const radiusVars = Object.entries(radii).map(
    ([name, value]) => `--fm-radius-${kebab(name)}:${value}px`,
  );
  return `:root{${[...colorVars, ...radiusVars].join(';')}}`;
}
