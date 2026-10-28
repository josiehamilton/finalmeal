import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { groupPicksByPlace } from '@finalmeal/core';
import { HonorableList } from './HonorableList';
import { seedPicks } from '../test-support/seed-picks';

const HONORABLES = seedPicks().filter((p) => p.tier === 'honorable');

describe('HonorableList', () => {
  it('groups the dishes under their restaurant', async () => {
    await render(<HonorableList groups={groupPicksByPlace(HONORABLES)} onOpen={jest.fn()} />);
    expect(screen.getAllByTestId(/^group-/)).toHaveLength(11);
    const marutama = within(screen.getByTestId('group-pl-marutama'));
    expect(marutama.getByText('Marutama')).toBeOnTheScreen();
    expect(marutama.getByText('Tonkotsu Ramen')).toBeOnTheScreen();
    expect(marutama.getByText('Pork Gyoza')).toBeOnTheScreen();
    expect(marutama.getByText(/Bidwell St · Vancouver/)).toBeOnTheScreen();
  });

  it('says 2 dishes from two up, and nothing for a single dish', async () => {
    await render(<HonorableList groups={groupPicksByPlace(HONORABLES)} onOpen={jest.fn()} />);
    expect(within(screen.getByTestId('group-pl-marutama')).getByText('2 dishes')).toBeOnTheScreen();
    expect(within(screen.getByTestId('group-pl-kin-kao')).getByText('2 dishes')).toBeOnTheScreen();
    expect(screen.getAllByText('2 dishes')).toHaveLength(2);
    expect(within(screen.getByTestId('group-pl-miku')).queryByText(/dish/)).toBeNull();
    expect(within(screen.getByTestId('group-pl-miku')).getByText('Waterfront · Vancouver')).toBeOnTheScreen();
  });

  it('badges each dish Honorable and shows its tags', async () => {
    await render(<HonorableList groups={groupPicksByPlace(HONORABLES)} onOpen={jest.fn()} />);
    expect(screen.getAllByText('Honorable')).toHaveLength(13);
    const khao = within(screen.getByRole('button', { name: /^Khao Soi/ }));
    expect(khao.getByText('Thai')).toBeOnTheScreen();
    expect(khao.getByText('Noodles')).toBeOnTheScreen();
    expect(khao.getByText('Dairy-free')).toBeOnTheScreen();
  });

  it('opens a dish', async () => {
    const onOpen = jest.fn();
    await render(<HonorableList groups={groupPicksByPlace(HONORABLES)} onOpen={onOpen} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Omakase/ }));
    expect(onOpen).toHaveBeenCalledWith(HONORABLES.find((p) => p.dish.name === 'Omakase'));
  });
});
