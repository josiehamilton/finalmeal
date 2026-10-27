import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { nearestCity, searchCities, setMyHomeCity } from '@finalmeal/api';
import type { City } from '@finalmeal/api';
import CityStep from '../../app/(onboarding)/city';
import { splitMatch } from '../components/CityPicker';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(cb, []),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  searchCities: jest.fn(),
  nearestCity: jest.fn(),
  setMyHomeCity: jest.fn(),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockSearch = jest.mocked(searchCities);
const mockNearest = jest.mocked(nearestCity);
const mockSetCity = jest.mocked(setMyHomeCity);
const mockPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockPosition = jest.mocked(Location.getCurrentPositionAsync);

function city(id: string, label: string): City {
  return {
    id,
    name: label.split(',')[0] ?? label,
    regionCode: null,
    regionName: null,
    country: 'CA',
    countryName: 'Canada',
    label,
  };
}
const VAN = city('c1', 'Vancouver, BC, Canada');
const VAN_WA = city('c2', 'Vancouver, WA, United States');

async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
async function search(q: string) {
  await fireEvent.changeText(screen.getByLabelText('City'), q);
  await tick(250);
}
const cta = () => screen.getByRole('button', { name: 'Continue' });

describe('splitMatch', () => {
  it('splits the typed prefix from the rest, ignoring case', () => {
    expect(splitMatch('Vancouver, BC, Canada', 'vanc')).toEqual(['Vanc', 'ouver, BC, Canada']);
    expect(splitMatch('Vancouver', 'Toronto')).toEqual(['', 'Vancouver']);
    expect(splitMatch('Vancouver', '  van ')).toEqual(['Van', 'couver']);
  });
});

describe('City step', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSearch.mockResolvedValue([VAN, VAN_WA]);
    mockSetCity.mockResolvedValue({} as never);
    mockPermission.mockResolvedValue({ granted: true } as never);
    mockPosition.mockResolvedValue({ coords: { latitude: 49.28, longitude: -123.12 } } as never);
    mockNearest.mockResolvedValue(VAN);
  });
  afterEach(() => jest.useRealTimers());

  it('shows the copy, Skip, and no Back', async () => {
    await render(<CityStep />);
    expect(screen.getByText('What’s your home city?')).toBeOnTheScreen();
    expect(
      screen.getByText('We’ll show you the best picks nearby. You can change it anytime.'),
    ).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Search your city')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('searches after 250 ms for the top 6 and lists the results', async () => {
    await render(<CityStep />);
    await fireEvent.changeText(screen.getByLabelText('City'), 'Vanc');
    await tick(249);
    expect(mockSearch).not.toHaveBeenCalled();
    await tick(1);
    expect(mockSearch).toHaveBeenCalledWith({ fake: 'client' }, 'Vanc', 6);
    expect(screen.getByText('Vancouver, BC, Canada')).toBeOnTheScreen();
    expect(screen.getByText('Vancouver, WA, United States')).toBeOnTheScreen();
  });

  it('keeps Continue disabled until a city is chosen, then saves it', async () => {
    await render(<CityStep />);
    expect(cta()).toBeDisabled();
    await search('Vanc');
    expect(cta()).toBeDisabled();
    await fireEvent.press(screen.getByText('Vancouver, BC, Canada'));
    expect(screen.getByLabelText('City').props.value).toBe('Vancouver, BC, Canada');
    expect(cta()).toBeEnabled();
    await fireEvent.press(cta());
    expect(mockSetCity).toHaveBeenCalledWith({ fake: 'client' }, 'c1');
    expect(mockRouter.push).toHaveBeenCalledWith('/photo');
  });

  it('forgets the choice when the text is edited', async () => {
    await render(<CityStep />);
    await search('Vanc');
    await fireEvent.press(screen.getByText('Vancouver, BC, Canada'));
    await fireEvent.changeText(screen.getByLabelText('City'), 'Van');
    expect(cta()).toBeDisabled();
  });

  it('Skip goes to the photo step without setting a city', async () => {
    await render(<CityStep />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(mockSetCity).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/photo');
  });

  it('shows the friendly copy and re-enables Continue when saving fails', async () => {
    mockSetCity.mockRejectedValue(new TypeError('Network request failed'));
    await render(<CityStep />);
    await search('Vanc');
    await fireEvent.press(screen.getByText('Vancouver, BC, Canada'));
    await fireEvent.press(cta());
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(screen.queryByTestId('cta-busy')).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('fills the field from the current location', async () => {
    await render(<CityStep />);
    await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
    expect(mockNearest).toHaveBeenCalledWith({ fake: 'client' }, 49.28, -123.12);
    expect(screen.getByLabelText('City').props.value).toBe('Vancouver, BC, Canada');
    expect(cta()).toBeEnabled();
  });

  it('shows the no-problem copy when location permission is denied', async () => {
    mockPermission.mockResolvedValue({ granted: false } as never);
    await render(<CityStep />);
    await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
    expect(screen.getByText('No problem. Search for your city instead.')).toBeOnTheScreen();
    expect(mockPosition).not.toHaveBeenCalled();
    expect(cta()).toBeDisabled();
  });

  it('shows the same copy when no city is near, and when the position cannot be read', async () => {
    mockNearest.mockResolvedValue(null);
    await render(<CityStep />);
    await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
    expect(screen.getByText('No problem. Search for your city instead.')).toBeOnTheScreen();
    mockPosition.mockRejectedValue(new Error('Location services are off'));
    await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
    expect(screen.getByText('No problem. Search for your city instead.')).toBeOnTheScreen();
  });
});
