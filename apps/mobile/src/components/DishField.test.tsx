import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { suggestDishes } from '@finalmeal/api';
import { DishField } from './DishField';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  suggestDishes: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockSuggest = jest.mocked(suggestDishes);

const SUGGESTIONS = [
  { id: 'd1', name: 'Tonkotsu Ramen', pickCount: 14 },
  { id: 'd2', name: 'Tonkotsu Black', pickCount: 1 },
  { id: 'd3', name: 'Tonkotsu Spicy', pickCount: 0 },
];

async function typeAndWait(text: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. Smash Burger'), text);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
}

describe('DishField', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSuggest.mockResolvedValue(SUGGESTIONS);
  });
  afterEach(() => jest.useRealTimers());

  it('has the Dish label and the example placeholder', async () => {
    await render(<DishField value="" placeId="p1" onChangeText={jest.fn()} onChoose={jest.fn()} />);
    expect(screen.getByText('Dish')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('e.g. Smash Burger')).toBeOnTheScreen();
  });

  it('shows suggestions as "<name> · <n> picks here" and hides a count of 0', async () => {
    await render(<DishField value="tonk" placeId="p1" onChangeText={jest.fn()} onChoose={jest.fn()} />);
    await typeAndWait('tonk');
    expect(mockSuggest).toHaveBeenCalledWith({ fake: 'client' }, 'p1', 'tonk');
    expect(screen.getByRole('button', { name: 'Tonkotsu Ramen · 14 picks here' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tonkotsu Black · 1 pick here' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tonkotsu Spicy' })).toBeOnTheScreen();
    expect(screen.queryByText(/0 picks/)).toBeNull();
  });

  it('shows at most 6 suggestions', async () => {
    mockSuggest.mockResolvedValue(
      Array.from({ length: 9 }, (_, i) => ({ id: `d${i}`, name: `Dish ${i}`, pickCount: 2 })),
    );
    await render(<DishField value="d" placeId="p1" onChangeText={jest.fn()} onChoose={jest.fn()} />);
    await typeAndWait('d');
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it('waits 300 ms after the last keystroke before asking', async () => {
    await render(<DishField value="t" placeId="p1" onChangeText={jest.fn()} onChoose={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Smash Burger'), 'to');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(299);
    });
    expect(mockSuggest).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Smash Burger'), 'ton');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(299);
    });
    expect(mockSuggest).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(mockSuggest).toHaveBeenCalledTimes(1);
    expect(mockSuggest).toHaveBeenCalledWith({ fake: 'client' }, 'p1', 'ton');
  });

  it('chooses a suggestion and then hides the list', async () => {
    const onChoose = jest.fn();
    await render(<DishField value="tonk" placeId="p1" onChangeText={jest.fn()} onChoose={onChoose} />);
    await typeAndWait('tonk');
    await fireEvent.press(screen.getByRole('button', { name: 'Tonkotsu Ramen · 14 picks here' }));
    expect(onChoose).toHaveBeenCalledWith(SUGGESTIONS[0]);
    expect(screen.queryByRole('button', { name: 'Tonkotsu Black · 1 pick here' })).toBeNull();
  });

  it('suggests nothing until a restaurant is chosen', async () => {
    await render(<DishField value="" placeId={null} onChangeText={jest.fn()} onChoose={jest.fn()} />);
    await typeAndWait('tonk');
    expect(mockSuggest).not.toHaveBeenCalled();
  });

  it('shows no suggestions for a cleared field', async () => {
    await render(<DishField value="" placeId="p1" onChangeText={jest.fn()} onChoose={jest.fn()} />);
    await typeAndWait('tonk');
    await typeAndWait('');
    expect(screen.queryByRole('button', { name: /Tonkotsu/ })).toBeNull();
  });

  it('keeps typing working when suggestions fail', async () => {
    mockSuggest.mockRejectedValue(new TypeError('Network request failed'));
    const onChangeText = jest.fn();
    await render(<DishField value="" placeId="p1" onChangeText={onChangeText} onChoose={jest.fn()} />);
    await typeAndWait('tonk');
    expect(onChangeText).toHaveBeenCalledWith('tonk');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
