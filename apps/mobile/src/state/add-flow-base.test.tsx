import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createCustomPlace, getCity, getPopularPlaces } from '@finalmeal/api';
import CustomPlace from '../../app/(app)/add/custom-place';
import ChooseRestaurant from '../../app/(app)/add/place';
import { PLACE, withDraft } from '../test-support/add-dish';
import { AddFlowBase } from './add-flow-base';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ name: 'Taco Truck' }),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  createCustomPlace: jest.fn(),
  getCity: jest.fn(),
  getPopularPlaces: jest.fn(),
  searchPlaces: jest.fn().mockResolvedValue([]),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: jest.requireActual('../test-support/profile').makeProfile(),
    loading: false,
    error: null,
  }),
}));
jest.mock('../components/CityPicker', () => ({ CityPicker: () => null }));

describe('the shared place screens inside the onboarding flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getCity).mockResolvedValue(null);
    jest.mocked(getPopularPlaces).mockResolvedValue([PLACE]);
  });

  it('Add a spot opens the onboarding stack’s own screen', async () => {
    await render(
      <AddFlowBase base="/add-first">{withDraft(<ChooseRestaurant />)}</AddFlowBase>,
    );
    await act(async () => {});
    await fireEvent.changeText(screen.getByPlaceholderText('Search restaurants'), 'Taco Truck');
    await fireEvent.press(screen.getByRole('button', { name: 'Can’t find it? Add it' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/add-first/custom-place',
      params: { name: 'Taco Truck' },
    });
  });

  it('a new spot returns to the onboarding form', async () => {
    jest.mocked(createCustomPlace).mockResolvedValue(PLACE);
    const city = { id: 'c1', label: 'Vancouver, BC, Canada', point: { lat: 49.28, lng: -123.12 } };
    await render(
      <AddFlowBase base="/add-first">{withDraft(<CustomPlace />, { searchCity: city })}</AddFlowBase>,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('123 Main St'), '123 Main St');
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'This spot is open to the public' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Add spot' }));
    await act(async () => {});
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/add-first');
  });

  it('defaults to the Add modal’s routes when there is no provider', async () => {
    await render(withDraft(<ChooseRestaurant />));
    await act(async () => {});
    await fireEvent.changeText(screen.getByPlaceholderText('Search restaurants'), 'Taco Truck');
    await fireEvent.press(screen.getByRole('button', { name: 'Can’t find it? Add it' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/add/custom-place',
      params: { name: 'Taco Truck' },
    });
  });
});
