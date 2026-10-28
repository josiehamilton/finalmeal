import { render, screen } from '@testing-library/react-native';
import Discover from '../../app/(app)/(tabs)/discover';
import Saved from '../../app/(app)/(tabs)/saved';

describe.each([
  ['Discover', Discover],
  ['Saved', Saved],
])('%s tab', (_name, Screen) => {
  it('says it is coming soon', async () => {
    await render(<Screen />);
    expect(screen.getByText('Coming soon.')).toBeOnTheScreen();
    expect(screen.getByText('This part of Final Meal is still being cooked.')).toBeOnTheScreen();
  });
});
