import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PickActions } from './PickActions';
import { makePick } from '../test-support/picks';

function handlers() {
  return {
    onEdit: jest.fn(),
    onPromote: jest.fn(),
    onDemote: jest.fn(),
    onMove: jest.fn(),
    onRemove: jest.fn(),
  };
}

async function open(pick = makePick({ slot: 2 }), finalCount = 4, h = handlers()) {
  await render(<PickActions pick={pick} finalCount={finalCount} {...h} />);
  await fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
  return h;
}
const item = (name: string) => screen.getByRole('menuitem', { name });

describe('PickActions', () => {
  afterEach(() => jest.restoreAllMocks());

  it('offers the final-pick actions', async () => {
    await open();
    expect(item('Edit')).toBeOnTheScreen();
    expect(item('Move to Honorable')).toBeOnTheScreen();
    expect(item('Move up')).toBeEnabled();
    expect(item('Move down')).toBeEnabled();
    expect(item('Remove from my list')).toBeOnTheScreen();
    expect(screen.queryByRole('menuitem', { name: 'Make it a Final Meal' })).toBeNull();
  });

  it('offers Make it a Final Meal, and no moves, for an honorable pick', async () => {
    await open(makePick({ tier: 'honorable', slot: null }));
    expect(item('Make it a Final Meal')).toBeOnTheScreen();
    expect(screen.queryByRole('menuitem', { name: 'Move to Honorable' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Move up' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Move down' })).toBeNull();
  });

  it('disables Move up on slot 1 and Move down on the last slot', async () => {
    const h = await open(makePick({ slot: 1 }), 3);
    expect(item('Move up')).toBeDisabled();
    expect(item('Move down')).toBeEnabled();
    await fireEvent.press(item('Move up'));
    expect(h.onMove).not.toHaveBeenCalled();
  });

  it('disables Move down on the last slot', async () => {
    await open(makePick({ slot: 3 }), 3);
    expect(item('Move down')).toBeDisabled();
    expect(item('Move up')).toBeEnabled();
  });

  it('calls the handlers and closes the menu', async () => {
    const h = await open();
    await fireEvent.press(item('Move up'));
    expect(h.onMove).toHaveBeenCalledWith('up');
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
    await fireEvent.press(item('Move down'));
    expect(h.onMove).toHaveBeenCalledWith('down');
    await fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
    await fireEvent.press(item('Edit'));
    expect(h.onEdit).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
    await fireEvent.press(item('Move to Honorable'));
    expect(h.onDemote).toHaveBeenCalled();
  });

  it('asks before removing, with the canvas copy, and removes only on confirm', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const h = await open();
    await fireEvent.press(item('Remove from my list'));
    expect(h.onRemove).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alert.mock.calls[0]!;
    expect(title).toBe('Remove Tonkotsu Ramen? This can’t be undone.');
    expect(buttons?.map((b) => b.text)).toEqual(['Cancel', 'Remove']);
    buttons?.find((b) => b.text === 'Remove')?.onPress?.();
    expect(h.onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not remove when the confirm is cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const h = await open();
    await fireEvent.press(item('Remove from my list'));
    alert.mock.calls[0]![2]?.find((b) => b.text === 'Cancel')?.onPress?.();
    expect(h.onRemove).not.toHaveBeenCalled();
  });

  it('can be disabled while something is in flight', async () => {
    await render(<PickActions pick={makePick()} finalCount={3} disabled {...handlers()} />);
    expect(screen.getByRole('button', { name: 'More actions' })).toBeDisabled();
  });
});
