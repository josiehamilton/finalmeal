import { fireEvent, render, screen } from '@testing-library/react-native';
import { setMyHomeCity } from '@finalmeal/api';
import HomeCity from '../../app/(app)/settings/home-city';
import { makeProfile } from '../test-support/profile';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  setMyHomeCity: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../components/CityPicker', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CityPicker: ({ onChange }: { onChange: (city: unknown) => void }) => (
      <Pressable accessibilityRole="button" onPress={() => onChange({ id: 'c9', label: 'Tokyo' })}>
        <Text>pick Tokyo</Text>
      </Pressable>
    ),
  };
});
const mockRefresh = jest.fn();
let mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: mockProfile,
    loading: false,
    error: null,
    refreshProfile: mockRefresh,
  }),
}));
const mockSetCity = jest.mocked(setMyHomeCity);
const save = () => screen.getByRole('button', { name: 'Save' });

describe('Home city', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile = makeProfile();
    mockSetCity.mockResolvedValue(makeProfile());
    mockRefresh.mockResolvedValue(null);
  });

  it('keeps Save off until a city is chosen', async () => {
    await render(<HomeCity />);
    expect(screen.getByText('Home city')).toBeOnTheScreen();
    expect(save()).toBeDisabled();
    await fireEvent.press(screen.getByText('pick Tokyo'));
    expect(save()).toBeEnabled();
  });

  it('saves the chosen city, reloads the profile and goes back', async () => {
    await render(<HomeCity />);
    await fireEvent.press(screen.getByText('pick Tokyo'));
    await fireEvent.press(save());
    expect(mockSetCity).toHaveBeenCalledWith({ fake: 'client' }, 'c9');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('still goes back when only the reload after a successful save fails', async () => {
    mockRefresh.mockRejectedValue(new TypeError('Network request failed'));
    await render(<HomeCity />);
    await fireEvent.press(screen.getByText('pick Tokyo'));
    await fireEvent.press(save());
    expect(mockSetCity).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Can’t reach the kitchen right now.')).toBeNull();
  });

  it('clears the home city', async () => {
    await render(<HomeCity />);
    await fireEvent.press(screen.getByRole('button', { name: 'Clear home city' }));
    expect(mockSetCity).toHaveBeenCalledWith({ fake: 'client' }, null);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('offers no Clear link when no home city is set', async () => {
    mockProfile = makeProfile({ homeCity: null });
    await render(<HomeCity />);
    expect(screen.queryByRole('button', { name: 'Clear home city' })).toBeNull();
  });

  it('shows friendly copy and stays when saving fails', async () => {
    mockSetCity.mockRejectedValue(new TypeError('Network request failed'));
    await render(<HomeCity />);
    await fireEvent.press(screen.getByText('pick Tokyo'));
    await fireEvent.press(save());
    expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
  });

  it('goes back', async () => {
    await render(<HomeCity />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
