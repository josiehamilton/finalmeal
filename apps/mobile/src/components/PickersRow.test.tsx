import { render, screen } from '@testing-library/react-native';
import { PickersRow } from './PickersRow';
import { makePickDetail } from '../test-support/saves';

describe('PickersRow', () => {
  it('shows the count, with at most four avatars', async () => {
    const { pickers } = makePickDetail();
    await render(<PickersRow pickers={[...pickers, ...pickers]} finalCount={23} />);
    expect(screen.getByText('On 23 Final Meals')).toBeOnTheScreen();
    expect(screen.getAllByTestId('picker-avatar')).toHaveLength(4);
  });

  it('says "On 1 Final Meal" for one', async () => {
    await render(<PickersRow pickers={makePickDetail().pickers.slice(0, 1)} finalCount={1} />);
    expect(screen.getByText('On 1 Final Meal')).toBeOnTheScreen();
  });

  it('shows nothing at zero', async () => {
    await render(<PickersRow pickers={[]} finalCount={0} />);
    expect(screen.queryByText(/On \d/)).toBeNull();
    expect(screen.queryByTestId('picker-avatar')).toBeNull();
  });

  it('is not a button (not tappable this phase)', async () => {
    await render(<PickersRow pickers={makePickDetail().pickers} finalCount={23} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
