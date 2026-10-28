import { render, screen } from '@testing-library/react-native';
import AddLayout from '../../app/(app)/add/_layout';
import { tierFromParam } from '../state/add-dish';

let mockParams: Record<string, string | string[]> = {};
jest.mock('expo-router', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const { useAddDish } = jest.requireActual<typeof import('../state/add-dish')>('../state/add-dish');
  // The stack stands in for the add screens: it just shows the tier the draft starts with.
  const Stack = () => createElement(Text, { testID: 'tier' }, useAddDish().draft.tier);
  Stack.Screen = () => null;
  return { Stack, useLocalSearchParams: () => mockParams };
});

describe('Add-a-dish layout', () => {
  beforeEach(() => {
    mockParams = {};
  });

  it('starts on Final Meal with no param', async () => {
    await render(<AddLayout />);
    expect(screen.getByTestId('tier')).toHaveTextContent('final');
  });

  it('starts on the tier named in the route param', async () => {
    mockParams = { tier: 'honorable' };
    await render(<AddLayout />);
    expect(screen.getByTestId('tier')).toHaveTextContent('honorable');
  });

  it('starts on Final Meal for tier=final', async () => {
    mockParams = { tier: 'final' };
    await render(<AddLayout />);
    expect(screen.getByTestId('tier')).toHaveTextContent('final');
  });

  it('ignores a tier it does not know', async () => {
    mockParams = { tier: 'bogus' };
    await render(<AddLayout />);
    expect(screen.getByTestId('tier')).toHaveTextContent('final');
  });
});

describe('tierFromParam', () => {
  it('accepts the two tiers, first of a list, and nothing else', () => {
    expect(tierFromParam('final')).toBe('final');
    expect(tierFromParam('honorable')).toBe('honorable');
    expect(tierFromParam(['honorable', 'final'])).toBe('honorable');
    expect(tierFromParam('x')).toBeUndefined();
    expect(tierFromParam(undefined)).toBeUndefined();
  });
});
