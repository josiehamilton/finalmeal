import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getCity, searchPlaces } from '@finalmeal/api';
import type { Place } from '@finalmeal/api';
import { PLACE } from '../test-support/add-dish';
import { PlaceSearch } from './PlaceSearch';
import type { SearchCity } from '../state/add-dish';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  searchPlaces: jest.fn(),
  getCity: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('./CityPicker', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CityPicker: ({
      onChange,
      allowCurrentLocation,
    }: {
      onChange: (city: unknown) => void;
      allowCurrentLocation?: boolean;
    }) => (
      <>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange({ id: 'c9', label: 'Tokyo, Japan', name: 'Tokyo' })}
        >
          <Text>pick Tokyo</Text>
        </Pressable>
        <Text>{allowCurrentLocation === false ? 'no location button' : 'location button'}</Text>
      </>
    ),
  };
});
const mockSearch = jest.mocked(searchPlaces);
const mockGetCity = jest.mocked(getCity);

const VANCOUVER = { lat: 49.2827, lng: -123.1207 };
const TOKYO = { lat: 35.68, lng: 139.69 };
const HOME = { id: 'c1', label: 'Vancouver, BC, Canada' };
const RESULT: Place = { ...PLACE };

function Harness({
  initial = null,
  onChoose = jest.fn(),
  onAddNew = jest.fn(),
}: {
  initial?: SearchCity | null;
  onChoose?: (p: Place) => void;
  onAddNew?: (text: string) => void;
}) {
  const [city, setCity] = useState<SearchCity | null>(initial);
  return (
    <PlaceSearch
      homeCity={HOME}
      city={city}
      onCityChange={setCity}
      onChoose={onChoose}
      onAddNew={onAddNew}
    />
  );
}

async function wait(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('PlaceSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSearch.mockResolvedValue([RESULT]);
    mockGetCity.mockImplementation(async (_client, id) =>
      id === 'c9'
        ? { id: 'c9', label: 'Tokyo, Japan', name: 'Tokyo', ...TOKYO } as never
        : { id: 'c1', label: HOME.label, name: 'Vancouver', ...VANCOUVER } as never,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('defaults the city chip to the home city and ranks with its point', async () => {
    await render(<Harness />);
    await wait(0);
    expect(mockGetCity).toHaveBeenCalledWith({ fake: 'client' }, 'c1');
    expect(screen.getByRole('button', { name: 'In Vancouver, BC, Canada · Change' })).toBeOnTheScreen();
    await wait(300);
    expect(mockSearch).toHaveBeenCalledWith({ fake: 'client' }, '', VANCOUVER, 12);
  });

  it('uses the last city chosen in the flow instead of the home city', async () => {
    await render(<Harness initial={{ id: 'c9', label: 'Tokyo, Japan', point: TOKYO }} />);
    await wait(300);
    expect(mockGetCity).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'In Tokyo, Japan · Change' })).toBeOnTheScreen();
    expect(mockSearch).toHaveBeenCalledWith({ fake: 'client' }, '', TOKYO, 12);
  });

  it('shows the most-picked spots for an empty field, then results with name and area · city', async () => {
    await render(<Harness />);
    await wait(300);
    expect(screen.getByText('Marutama Ramen')).toBeOnTheScreen();
    expect(screen.getByText('Bidwell St · Vancouver')).toBeOnTheScreen();
    expect(screen.queryByText(/ km| m$/)).toBeNull();
  });

  it('debounces typing by 300 ms', async () => {
    await render(<Harness />);
    await wait(300);
    mockSearch.mockClear();
    const field = screen.getByPlaceholderText('Search restaurants');
    await fireEvent.changeText(field, 'mar');
    await wait(200);
    await fireEvent.changeText(field, 'maru');
    await wait(299);
    expect(mockSearch).not.toHaveBeenCalled();
    await wait(1);
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith({ fake: 'client' }, 'maru', VANCOUVER, 12);
  });

  it('changing the city re-runs the search with the new point', async () => {
    await render(<Harness />);
    await wait(300);
    await fireEvent.changeText(screen.getByPlaceholderText('Search restaurants'), 'ramen');
    await wait(300);
    mockSearch.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'In Vancouver, BC, Canada · Change' }));
    await fireEvent.press(screen.getByText('pick Tokyo'));
    await wait(0);
    expect(mockGetCity).toHaveBeenCalledWith({ fake: 'client' }, 'c9');
    expect(screen.getByRole('button', { name: 'In Tokyo, Japan · Change' })).toBeOnTheScreen();
    await wait(300);
    expect(mockSearch).toHaveBeenCalledWith({ fake: 'client' }, 'ramen', TOKYO, 12);
  });

  it('opens the city picker without the current-location button', async () => {
    await render(<Harness />);
    await wait(300);
    await fireEvent.press(screen.getByRole('button', { name: 'In Vancouver, BC, Canada · Change' }));
    expect(screen.getByText('no location button')).toBeOnTheScreen();
  });

  it('chooses a place', async () => {
    const onChoose = jest.fn();
    await render(<Harness onChoose={onChoose} />);
    await wait(300);
    await fireEvent.press(screen.getByText('Marutama Ramen'));
    expect(onChoose).toHaveBeenCalledWith(RESULT);
  });

  it('offers "Can’t find it? Add it" with the typed text', async () => {
    const onAddNew = jest.fn();
    await render(<Harness onAddNew={onAddNew} />);
    await wait(300);
    await fireEvent.changeText(screen.getByPlaceholderText('Search restaurants'), 'Taco Truck');
    await fireEvent.press(screen.getByRole('button', { name: 'Can’t find it? Add it' }));
    expect(onAddNew).toHaveBeenCalledWith('Taco Truck');
  });

  it('shows friendly copy when the search fails', async () => {
    mockSearch.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Harness />);
    await wait(300);
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
  });

  it('still searches when the home city cannot be read (no ranking point)', async () => {
    mockGetCity.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Harness />);
    await wait(0);
    expect(screen.getByRole('button', { name: 'In Vancouver, BC, Canada · Change' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('Search restaurants'), 'maru');
    await wait(300);
    expect(mockSearch).toHaveBeenLastCalledWith({ fake: 'client' }, 'maru', undefined, 12);
  });
});
