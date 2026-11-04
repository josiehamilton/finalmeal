import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError, getMySaves, unsaveDish } from '@finalmeal/api';
import Saved from '../../app/(app)/(tabs)/saved';
import { makeSavedBoard } from '../test-support/saves';
import { makeProfile } from '../test-support/profile';
import { announceSavesChanged, resetSaveChanges } from '../state/save';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMySaves: jest.fn(),
  unsaveDish: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
let mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ session: {}, profile: mockProfile, loading: false, error: null }),
}));

const CLIENT = { fake: 'client' };
const mockGet = jest.mocked(getMySaves);
const mockUnsave = jest.mocked(unsaveDish);

async function show() {
  await render(<Saved />);
  await act(async () => {});
}
const chip = (name: string) => screen.getByRole('button', { name });

describe('Saved tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSaveChanges();
    mockProfile = makeProfile();
    mockGet.mockResolvedValue(makeSavedBoard());
    mockUnsave.mockResolvedValue(undefined);
  });

  it('renders the Saved board: header, chips, four cards and no Map view', async () => {
    await show();
    expect(screen.getByText('Saved to try')).toBeOnTheScreen();
    for (const name of ['All', 'Final Meals', 'Honorable', 'Nearby']) {
      expect(chip(name)).toBeOnTheScreen();
    }
    expect(chip('All')).toBeSelected();
    expect(screen.getByText('via @mikebrennan')).toBeOnTheScreen();
    expect(screen.getByText('via @allimercer')).toBeOnTheScreen();
    expect(screen.getByText('via @arimitchell')).toBeOnTheScreen();
    expect(screen.getByText('via @devpatel')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Map view' })).toBeNull();
  });

  it('filters to Final Meals and Honorable by the tier it was saved from', async () => {
    await show();
    await fireEvent.press(chip('Final Meals'));
    expect(chip('Final Meals')).toBeSelected();
    expect(screen.queryByText('Tacos Al Pastor')).toBeNull();
    expect(screen.getByText('Plain Biryani')).toBeOnTheScreen();
    await fireEvent.press(chip('Honorable'));
    expect(screen.getByText('Tacos Al Pastor')).toBeOnTheScreen();
    expect(screen.queryByText('Plain Biryani')).toBeNull();
    await fireEvent.press(chip('All'));
    expect(screen.getByText('Plain Biryani')).toBeOnTheScreen();
  });

  it('filters Nearby by distance from the home city', async () => {
    mockProfile = makeProfile({ homeCity: { id: 'c1', label: 'Vancouver, BC, Canada' } });
    mockGet.mockResolvedValue(makeSavedBoard().map((s, i) => ({ ...s, distanceM: [null, 400_000, 9_000_000, 3_000][i]! })));
    await show();
    await fireEvent.press(chip('Nearby'));
    expect(screen.getByText('Tonkotsu Ramen')).toBeOnTheScreen();
    expect(screen.queryByText('Wagyu Beef Don')).toBeNull();
    expect(screen.queryByText('Plain Biryani')).toBeNull();
    expect(screen.queryByText('Tacos Al Pastor')).toBeNull();
  });

  it('asks for a home city on Nearby when there is none, with a way to choose one', async () => {
    mockProfile = makeProfile({ homeCity: null });
    await show();
    await fireEvent.press(chip('Nearby'));
    expect(screen.getByText('Set your home city to see saves near you.')).toBeOnTheScreen();
    expect(screen.queryByText('Wagyu Beef Don')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose home city' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/home-city');
  });

  it('says so when a filter has nothing', async () => {
    mockProfile = makeProfile({ homeCity: { id: 'c1', label: 'Vancouver, BC, Canada' } });
    mockGet.mockResolvedValue(makeSavedBoard().slice(0, 1));
    await show();
    await fireEvent.press(chip('Honorable'));
    expect(screen.getByText('Nothing here with this filter.')).toBeOnTheScreen();
    await fireEvent.press(chip('Nearby'));
    expect(screen.getByText('Nothing here with this filter.')).toBeOnTheScreen();
  });

  it('shows the empty state with no saves, and no chips', async () => {
    mockGet.mockResolvedValue([]);
    await show();
    expect(screen.getByText('Nothing saved yet.')).toBeOnTheScreen();
    expect(screen.getByText('Tap Save on a dish you want to try and it lands here.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Final Meals' })).toBeNull();
  });

  it('opens the pick a dish was saved from', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: /Plain Biryani/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/pick/pk-alli');
  });

  it('shows a save whose pick is gone only under All, and does nothing when tapped', async () => {
    mockGet.mockResolvedValue([
      { ...makeSavedBoard()[0]!, via: null, viaPickId: null, viaTier: null, distanceM: 1000 },
    ]);
    await show();
    expect(screen.getByText('Wagyu Beef Don')).toBeOnTheScreen();
    expect(screen.queryByText(/via @/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Wagyu Beef Don/ }));
    expect(mockRouter.push).not.toHaveBeenCalled();
    await fireEvent.press(chip('Final Meals'));
    expect(screen.queryByText('Wagyu Beef Don')).toBeNull();
  });

  describe('Remove from Saved', () => {
    afterEach(() => jest.restoreAllMocks());
    const longPress = async (name: RegExp) => fireEvent(screen.getByRole('button', { name }), 'longPress');

    it('asks, and removes the dish on Remove', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      await show();
      await longPress(/Plain Biryani/);
      expect(alert.mock.calls[0]![0]).toBe('Remove from Saved');
      expect(alert.mock.calls[0]![2]!.map((b) => b.text)).toEqual(['Cancel', 'Remove']);
      expect(mockUnsave).not.toHaveBeenCalled();
      await act(async () => alert.mock.calls[0]![2]!.find((b) => b.text === 'Remove')!.onPress!());
      expect(mockUnsave).toHaveBeenCalledWith(CLIENT, 'd-biryani');
      expect(screen.queryByText('Plain Biryani')).toBeNull();
      expect(screen.getByText('Wagyu Beef Don')).toBeOnTheScreen();
    });

    it('does nothing on Cancel', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      await show();
      await longPress(/Plain Biryani/);
      await act(async () => alert.mock.calls[0]![2]!.find((b) => b.text === 'Cancel')!.onPress?.());
      expect(mockUnsave).not.toHaveBeenCalled();
      expect(screen.getByText('Plain Biryani')).toBeOnTheScreen();
    });

    it('puts the card back and says why when removing fails', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      mockUnsave.mockRejectedValue(new TypeError('Network request failed'));
      await show();
      await longPress(/Plain Biryani/);
      await act(async () => alert.mock.calls[0]![2]!.find((b) => b.text === 'Remove')!.onPress!());
      expect(screen.getByText('Plain Biryani')).toBeOnTheScreen();
      expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    });
  });

  it('reloads when a save changes elsewhere', async () => {
    await show();
    expect(mockGet).toHaveBeenCalledTimes(1);
    mockGet.mockResolvedValue(makeSavedBoard().slice(0, 1));
    await act(async () => announceSavesChanged());
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Plain Biryani')).toBeNull();
  });

  it('says what went wrong when it cannot load, and retries', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('x', 'network'));
    await show();
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await act(async () => {});
    expect(screen.getByText('Wagyu Beef Don')).toBeOnTheScreen();
  });
});
