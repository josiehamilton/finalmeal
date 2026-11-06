import { fireEvent, render, screen } from '@testing-library/react-native';
import { SaveButton } from './SaveButton';

describe('SaveButton', () => {
  it('reads Save to try until the dish is saved', async () => {
    const onPress = jest.fn();
    await render(<SaveButton saved={false} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save to try' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull();
  });

  it('reads Saved once saved, and tapping again still calls onPress (to unsave)', async () => {
    const onPress = jest.fn();
    await render(<SaveButton saved onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Saved' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('tells a screen reader a call is in flight while keeping its label', async () => {
    const { rerender } = await render(<SaveButton saved={false} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save to try' })).not.toBeBusy();
    await rerender(<SaveButton saved={false} busy onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save to try' })).toBeBusy();
  });
});
