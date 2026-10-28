import { fireEvent, render, screen } from '@testing-library/react-native';
import { FinalMealList } from './FinalMealList';
import { makeFinals } from '../test-support/picks';

const noop = () => {};

describe('FinalMealList', () => {
  it('shows each final as a slot row and opens it', async () => {
    const onOpen = jest.fn();
    const finals = makeFinals(4);
    await render(<FinalMealList picks={finals} dimmedIds={null} onOpen={onOpen} onAdd={noop} />);
    expect(screen.getAllByRole('button', { name: /^\d\. Dish/ })).toHaveLength(4);
    await fireEvent.press(screen.getByRole('button', { name: /^2\. Dish 2/ }));
    expect(onOpen).toHaveBeenCalledWith(finals[1]);
  });

  it('says one seat is left at four', async () => {
    const onAdd = jest.fn();
    await render(<FinalMealList picks={makeFinals(4)} dimmedIds={null} onOpen={noop} onAdd={onAdd} />);
    expect(screen.getByText('One seat left. Choose wisely.')).toBeOnTheScreen();
    expect(screen.queryByText('Add a dish')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'One seat left. Choose wisely.' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows dashed Add a dish seats below four, numbered after the filled ones', async () => {
    const onAdd = jest.fn();
    await render(<FinalMealList picks={makeFinals(2)} dimmedIds={null} onOpen={noop} onAdd={onAdd} />);
    expect(screen.getAllByText('Add a dish')).toHaveLength(3);
    expect(screen.queryByTestId('seat-2')).toBeNull();
    expect(screen.getByTestId('seat-3')).toBeOnTheScreen();
    expect(screen.getByTestId('seat-5')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: /^Add a dish/ })[0]!);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows all five seats when there are no finals', async () => {
    await render(<FinalMealList picks={[]} dimmedIds={null} onOpen={noop} onAdd={noop} />);
    for (const n of [1, 2, 3, 4, 5]) expect(screen.getByTestId(`seat-${n}`)).toBeOnTheScreen();
  });

  it('shows no seats when the five are full', async () => {
    await render(<FinalMealList picks={makeFinals(5)} dimmedIds={null} onOpen={noop} onAdd={noop} />);
    expect(screen.queryByText('One seat left. Choose wisely.')).toBeNull();
    expect(screen.queryByText('Add a dish')).toBeNull();
  });

  it('dims the non-matching finals but keeps them, and their numbers', async () => {
    await render(
      <FinalMealList picks={makeFinals(3)} dimmedIds={new Set(['f2', 'f3'])} onOpen={noop} onAdd={noop} />,
    );
    expect(screen.getByTestId('final-row-f1')).toHaveStyle({ opacity: 1 });
    expect(screen.getByTestId('final-row-f2')).toHaveStyle({ opacity: 0.35 });
    expect(screen.getByRole('button', { name: /^3\. Dish 3/ })).toBeOnTheScreen();
  });
});
