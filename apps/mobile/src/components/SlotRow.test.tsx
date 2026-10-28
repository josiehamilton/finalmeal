import { fireEvent, render, screen } from '@testing-library/react-native';
import { SlotRow } from './SlotRow';
import { makePick } from '../test-support/picks';

describe('SlotRow', () => {
  const pick = makePick({ slot: 3, dish: { id: 'd', name: 'Plain Biryani' } });

  it('shows the numeral, dish and place label', async () => {
    await render(<SlotRow pick={pick} onPress={jest.fn()} />);
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('Plain Biryani')).toBeOnTheScreen();
    expect(screen.getByText('Bidwell St · Vancouver')).toBeOnTheScreen();
  });

  it('is a radio when selectable, reporting whether it is chosen', async () => {
    const onPress = jest.fn();
    await render(<SlotRow pick={pick} selectable selected={false} onPress={onPress} />);
    const radio = screen.getByRole('radio', { name: /Plain Biryani/ });
    expect(radio).not.toBeChecked();
    await fireEvent.press(radio);
    expect(onPress).toHaveBeenCalled();
  });

  it('strikes the dish through in ember glow when selected, with a line drawn the same on both platforms', async () => {
    await render(<SlotRow pick={pick} selectable selected onPress={jest.fn()} />);
    expect(screen.getByRole('radio', { name: /Plain Biryani/ })).toBeChecked();
    expect(screen.getByTestId('strike-line')).toHaveStyle({ backgroundColor: '#E8693F', height: 1.5 });
    // The native text decoration colour is iOS-only, so it is not used.
    expect(screen.getByText('Plain Biryani')).not.toHaveStyle({ textDecorationLine: 'line-through' });
  });

  it('has no strike line when not selected', async () => {
    await render(<SlotRow pick={pick} selectable selected={false} onPress={jest.fn()} />);
    expect(screen.queryByTestId('strike-line')).toBeNull();
  });

  it('is a plain button otherwise', async () => {
    await render(<SlotRow pick={pick} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Plain Biryani/ })).toBeOnTheScreen();
  });

  it('shows the photo as a thumbnail when there is one', async () => {
    await render(
      <SlotRow pick={{ ...pick, photoUrl: 'https://x/p.jpg' }} onPress={jest.fn()} />,
    );
    expect(screen.getByTestId('slot-thumb')).toBeOnTheScreen();
  });
});
