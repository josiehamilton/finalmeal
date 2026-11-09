import { fireEvent, render, screen } from '@testing-library/react-native';
import { PLACE } from '../test-support/add-dish';
import { SpotResultRow } from './SpotResultRow';

describe('SpotResultRow', () => {
  it('shows the name, the area and the distance, and opens the place', async () => {
    const onPress = jest.fn();
    await render(<SpotResultRow place={PLACE} distanceM={1234} onPress={onPress} />);
    expect(screen.getByText('Marutama Ramen')).toBeOnTheScreen();
    expect(screen.getByText('Bidwell St · 1.2 km')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Marutama Ramen'));
    expect(onPress).toHaveBeenCalledWith(PLACE);
  });

  it('uses the street, never the whole address, when there is no area', async () => {
    const place = {
      ...PLACE,
      area: null,
      address: '1234 Main St, Vancouver, BC',
      label: '1234 Main St · Vancouver',
    };
    await render(<SpotResultRow place={place} distanceM={850} onPress={jest.fn()} />);
    expect(screen.getByText('1234 Main St · 850 m')).toBeOnTheScreen();
  });

  it('treats a blank area as none', async () => {
    const place = { ...PLACE, area: '  ', address: '9 Pine St' };
    await render(<SpotResultRow place={place} distanceM={2000} onPress={jest.fn()} />);
    expect(screen.getByText('9 Pine St · 2.0 km')).toBeOnTheScreen();
  });

  it('shows only the distance when the place has no area or street', async () => {
    const place = { ...PLACE, area: null, address: null };
    await render(<SpotResultRow place={place} distanceM={2000} onPress={jest.fn()} />);
    expect(screen.getByText('2.0 km')).toBeOnTheScreen();
  });

  it('shows the place’s label when there is no distance', async () => {
    await render(<SpotResultRow place={PLACE} distanceM={null} onPress={jest.fn()} />);
    expect(screen.getByText('Bidwell St · Vancouver')).toBeOnTheScreen();
  });

  it('shows the label for a distance of 100 km or more', async () => {
    await render(<SpotResultRow place={PLACE} distanceM={150000} onPress={jest.fn()} />);
    expect(screen.getByText('Bidwell St · Vancouver')).toBeOnTheScreen();
  });
});
