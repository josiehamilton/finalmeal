import { fireEvent, render, screen } from '@testing-library/react-native';
import { SavedGrid } from './SavedGrid';
import { makeSavedBoard, makeSavedDish } from '../test-support/saves';

describe('SavedGrid', () => {
  const noop = () => {};

  it('renders the Saved board’s cards', async () => {
    await render(<SavedGrid saves={makeSavedBoard()} onOpen={noop} onRemove={noop} />);
    expect(screen.getByText('Wagyu Beef Don')).toBeOnTheScreen();
    expect(screen.getByText('Sushi Itto · Tokyo')).toBeOnTheScreen();
    expect(screen.getByText('via @mikebrennan')).toBeOnTheScreen();
    expect(screen.getByText('Plain Biryani')).toBeOnTheScreen();
    expect(screen.getByText('Spicy Time · Saskatoon')).toBeOnTheScreen();
    expect(screen.getByText('via @allimercer')).toBeOnTheScreen();
    expect(screen.getByText('Tacos Al Pastor')).toBeOnTheScreen();
    expect(screen.getByText('via @arimitchell')).toBeOnTheScreen();
    expect(screen.getByText('Tonkotsu Ramen')).toBeOnTheScreen();
    expect(screen.getByText('via @devpatel')).toBeOnTheScreen();
    expect(screen.getAllByText('Final Meal')).toHaveLength(3);
    expect(screen.getAllByText('Honorable')).toHaveLength(1);
  });

  it('shows the photo of the pick it was saved from, else a placeholder tile', async () => {
    await render(
      <SavedGrid
        saves={[makeSavedDish({ photoUrl: 'https://x/p.jpg' }), makeSavedDish({ dish: { id: 'd2', name: 'Gyoza' } })]}
        onOpen={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getAllByTestId('saved-photo')).toHaveLength(1);
    expect(screen.getAllByTestId('saved-placeholder')).toHaveLength(1);
  });

  it('drops the badge and the via line when the pick it came from is gone', async () => {
    await render(
      <SavedGrid
        saves={[makeSavedDish({ via: null, viaPickId: null, viaTier: null, photoUrl: null })]}
        onOpen={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getByText('Wagyu Beef Don')).toBeOnTheScreen();
    expect(screen.queryByText(/via @/)).toBeNull();
    expect(screen.queryByText('Final Meal')).toBeNull();
    expect(screen.queryByText('Honorable')).toBeNull();
    expect(screen.getByTestId('saved-placeholder')).toBeOnTheScreen();
  });

  it('opens a card, and offers removal on a long press', async () => {
    const onOpen = jest.fn();
    const onRemove = jest.fn();
    const saves = makeSavedBoard();
    await render(<SavedGrid saves={saves} onOpen={onOpen} onRemove={onRemove} />);
    const card = screen.getByRole('button', { name: /Wagyu Beef Don/ });
    await fireEvent.press(card);
    expect(onOpen).toHaveBeenCalledWith(saves[0]);
    await fireEvent(card, 'longPress');
    expect(onRemove).toHaveBeenCalledWith(saves[0]);
  });

  it('does not open a card whose pick is gone', async () => {
    const onOpen = jest.fn();
    await render(
      <SavedGrid
        saves={[makeSavedDish({ via: null, viaPickId: null, viaTier: null })]}
        onOpen={onOpen}
        onRemove={noop}
      />,
    );
    // Not announced as a button: it has nothing to open, but removing is still offered.
    expect(screen.queryByRole('button', { name: /Wagyu Beef Don/ })).toBeNull();
    await fireEvent.press(screen.getByText('Wagyu Beef Don'));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('still offers removal on a card whose pick is gone', async () => {
    const onRemove = jest.fn();
    const save = makeSavedDish({ via: null, viaPickId: null, viaTier: null });
    await render(<SavedGrid saves={[save]} onOpen={noop} onRemove={onRemove} />);
    await fireEvent(screen.getByText('Wagyu Beef Don'), 'longPress');
    expect(onRemove).toHaveBeenCalledWith(save);
  });
});
