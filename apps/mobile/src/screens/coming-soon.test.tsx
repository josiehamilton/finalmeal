import { render, screen } from '@testing-library/react-native';
import Add from '../../app/(app)/(tabs)/add';
import Discover from '../../app/(app)/(tabs)/discover';
import Feed from '../../app/(app)/(tabs)/feed';
import Saved from '../../app/(app)/(tabs)/saved';

describe.each([
  ['Feed', Feed],
  ['Discover', Discover],
  ['Add', Add],
  ['Saved', Saved],
])('%s tab', (_name, Screen) => {
  it('says it is coming soon', async () => {
    await render(<Screen />);
    expect(screen.getByText('Coming soon.')).toBeOnTheScreen();
    expect(screen.getByText('This part of Final Meal is still being cooked.')).toBeOnTheScreen();
  });
});
