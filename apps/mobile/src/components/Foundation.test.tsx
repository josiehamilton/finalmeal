import { render, screen } from '@testing-library/react-native';
import type { FoundationStats } from '@finalmeal/api';
import { Foundation } from './Foundation';

const stats: FoundationStats = { people: 6, places: 14, dishes: 17, picks: 28 };

describe('Foundation', () => {
  it('renders the wordmark', async () => {
    await render(<Foundation loadStats={() => Promise.resolve(stats)} />);
    expect(await screen.findByText('Final Meal')).toBeOnTheScreen();
  });

  it('shows the tagline and the four swatches', async () => {
    await render(<Foundation loadStats={() => Promise.resolve(stats)} />);
    expect(await screen.findByText('Five dishes. That’s it. Choose.')).toBeOnTheScreen();
    for (const label of ['Ember', 'Ember Glow', 'Bone', 'Night']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it('shows an ellipsis while the counts load', async () => {
    await render(<Foundation loadStats={() => new Promise<FoundationStats>(() => {})} />);
    expect(await screen.findByText('…')).toBeOnTheScreen();
  });

  it('renders the counts once loadStats resolves', async () => {
    await render(<Foundation loadStats={() => Promise.resolve(stats)} />);
    expect(await screen.findByText('6 people · 14 places · 17 dishes')).toBeOnTheScreen();
  });

  it('renders the unreachable message when loadStats rejects', async () => {
    await render(<Foundation loadStats={() => Promise.reject(new Error('boom'))} />);
    expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
  });

  it('labels the skull Final Meal for accessibility', async () => {
    await render(<Foundation loadStats={() => Promise.resolve(stats)} />);
    expect(await screen.findByLabelText('Final Meal')).toBeOnTheScreen();
  });
});
