import { fireEvent, render, screen } from '@testing-library/react-native';
import { ToggleRow } from './ToggleRow';

describe('ToggleRow', () => {
  it('shows the label and sub-line, and reports the opposite value when tapped', async () => {
    const onChange = jest.fn();
    await render(
      <ToggleRow label="Dethronings" sub="When it happens." value onChange={onChange} />,
    );
    expect(screen.getByText('Dethronings')).toBeOnTheScreen();
    expect(screen.getByText('When it happens.')).toBeOnTheScreen();
    const toggle = screen.getByRole('switch', { name: 'Dethronings' });
    expect(toggle).toBeChecked();
    await fireEvent.press(toggle);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('is off when the value is false, and turns on when tapped', async () => {
    const onChange = jest.fn();
    await render(<ToggleRow label="New followers" value={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'New followers' });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('ignores taps while disabled', async () => {
    const onChange = jest.fn();
    await render(<ToggleRow label="Saves" value disabled onChange={onChange} />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Saves' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
