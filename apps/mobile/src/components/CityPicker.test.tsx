import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { nearestCity, searchCities } from '@finalmeal/api';
import type { City } from '@finalmeal/api';
import { CityPicker } from './CityPicker';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  searchCities: jest.fn(),
  nearestCity: jest.fn(),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockSearch = jest.mocked(searchCities);
const mockNearest = jest.mocked(nearestCity);
const mockPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockPosition = jest.mocked(Location.getCurrentPositionAsync);

const VAN: City = {
  id: 'c1',
  name: 'Vancouver',
  regionCode: 'BC',
  regionName: 'British Columbia',
  country: 'CA',
  countryName: 'Canada',
  label: 'Vancouver, BC, Canada',
};

describe('CityPicker current location', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSearch.mockResolvedValue([VAN]);
    mockNearest.mockResolvedValue(VAN);
    mockPermission.mockResolvedValue({ granted: true } as never);
    mockPosition.mockResolvedValue({ coords: { latitude: 49.28, longitude: -123.12 } } as never);
  });
  afterEach(() => jest.useRealTimers());

  it('does not offer "Use my current location" by default', async () => {
    await render(<CityPicker onChange={jest.fn()} />);
    expect(screen.queryByText('Use my current location')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use my current location' })).toBeNull();
  });

  it('never asks for a permission or a position when it is off, even while searching and choosing', async () => {
    const onChange = jest.fn();
    await render(<CityPicker onChange={onChange} allowCurrentLocation={false} />);
    await fireEvent.changeText(screen.getByLabelText('City'), 'van');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Vancouver, BC, Canada' }));
    expect(onChange).toHaveBeenLastCalledWith(VAN);
    expect(screen.queryByText('Use my current location')).toBeNull();
    expect(mockPermission).not.toHaveBeenCalled();
    expect(mockPosition).not.toHaveBeenCalled();
    expect(mockNearest).not.toHaveBeenCalled();
  });

  it('shows the button and uses the location when a screen opts in', async () => {
    const onChange = jest.fn();
    await render(<CityPicker onChange={onChange} allowCurrentLocation />);
    await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
    await act(async () => {});
    expect(mockPermission).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(VAN);
  });
});

describe('CityPicker initialLabel', () => {
  it('starts with the text given and chooses nothing by itself', async () => {
    const onChange = jest.fn();
    await render(<CityPicker onChange={onChange} initialLabel="Vancouver, BC, Canada" />);
    expect(screen.getByLabelText('City')).toHaveDisplayValue('Vancouver, BC, Canada');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('starts empty without one', async () => {
    await render(<CityPicker onChange={jest.fn()} />);
    expect(screen.getByLabelText('City')).toHaveDisplayValue('');
  });

  it('reports no chosen city once the text is edited', async () => {
    const onChange = jest.fn();
    await render(<CityPicker onChange={onChange} initialLabel="Vancouver, BC, Canada" />);
    await fireEvent.changeText(screen.getByLabelText('City'), 'Vancouve');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
