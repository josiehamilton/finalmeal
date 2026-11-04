import { render, screen } from '@testing-library/react-native';
import { makePick } from '../test-support/picks';
import { SharedTaste, sharedDishNames } from './SharedTaste';

const dish = (id: string, name: string) => ({ id, name });

describe('SharedTaste', () => {
  const biryani = makePick({ id: 'a', dish: dish('d-biryani', 'Plain Biryani') });
  const khao = makePick({
    id: 'b',
    tier: 'honorable',
    slot: null,
    dish: dish('d-khao', 'Khao Soi'),
  });
  const ramen = makePick({ id: 'c', dish: dish('d-ramen', 'Tonkotsu Ramen') });

  it('names the first shared dish and counts the rest', async () => {
    await render(<SharedTaste mine={[ramen, khao, biryani]} theirs={[biryani, khao]} />);
    expect(screen.getByText('You both love Plain Biryani + 1 more')).toBeOnTheScreen();
  });

  it('names one shared dish with no count', async () => {
    await render(<SharedTaste mine={[biryani]} theirs={[biryani, ramen]} />);
    expect(screen.getByText('You both love Plain Biryani')).toBeOnTheScreen();
  });

  it('counts a dish picked in either tier', async () => {
    const theirHonorable = makePick({
      id: 'x',
      tier: 'honorable',
      slot: null,
      dish: dish('d-ramen', 'Tonkotsu Ramen'),
    });
    await render(<SharedTaste mine={[ramen]} theirs={[theirHonorable]} />);
    expect(screen.getByText('You both love Tonkotsu Ramen')).toBeOnTheScreen();
  });

  it('is hidden when nothing is shared', async () => {
    await render(<SharedTaste mine={[ramen]} theirs={[biryani, khao]} />);
    expect(screen.queryByText(/You both love/)).toBeNull();
    expect(screen.queryByTestId('shared-taste')).toBeNull();
  });

  it('lists shared dishes in the order of their list, once each', () => {
    expect(sharedDishNames([khao, biryani, biryani], [biryani, khao])).toEqual([
      'Plain Biryani',
      'Khao Soi',
    ]);
  });
});
