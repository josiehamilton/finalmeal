import { render, screen } from '@testing-library/react-native';
import Discover from '../../app/(app)/(tabs)/discover';

describe('Discover tab', () => {
  it('says it is coming soon', async () => {
    await render(<Discover />);
    expect(screen.getByText('Coming soon.')).toBeOnTheScreen();
    expect(screen.getByText('This part of Final Meal is still being cooked.')).toBeOnTheScreen();
  });
});
