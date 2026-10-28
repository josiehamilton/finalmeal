import { Alert, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import {
  ApiError,
  demotePick,
  getMyPicks,
  moveFinal,
  promotePick,
  removePick,
} from '@finalmeal/api';
import PickDetail from '../../app/(app)/pick/[id]';
import { RAMEN, VEGAN } from '../test-support/add-dish';
import { makeFinals, makePick } from '../test-support/picks';
import { announcePicksChanged, resetPickChanges } from '../state/pick-changes';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
let mockParams: Record<string, string> = { id: 'f2' };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-linking', () => ({ openURL: jest.fn().mockResolvedValue(true) }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyPicks: jest.fn(),
  moveFinal: jest.fn(),
  promotePick: jest.fn(),
  demotePick: jest.fn(),
  removePick: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));

const CLIENT = { fake: 'client' };
const mockGetPicks = jest.mocked(getMyPicks);
const mockMove = jest.mocked(moveFinal);
const mockPromote = jest.mocked(promotePick);
const mockDemote = jest.mocked(demotePick);
const mockRemove = jest.mocked(removePick);

async function settle() {
  await act(async () => {});
}
async function menu(name: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
  await fireEvent.press(screen.getByRole('menuitem', { name }));
}

describe('Pick detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPickChanges();
    mockParams = { id: 'f2' };
    const finals = makeFinals(3);
    finals[1] = makePick({
      ...finals[1]!,
      note: 'God tier. I still dream about it.',
      tags: [RAMEN, VEGAN],
    });
    mockGetPicks.mockResolvedValue(finals);
  });

  it('shows the own pick: badge, dish, place, tags and the note in quotes', async () => {
    await render(<PickDetail />);
    await settle();
    expect(screen.getByText('Final Meal · #2')).toBeOnTheScreen();
    expect(screen.getByText('Dish 2')).toBeOnTheScreen();
    expect(screen.getByText('Bidwell St · Vancouver')).toBeOnTheScreen();
    expect(screen.getByText('Ramen')).toBeOnTheScreen();
    expect(screen.getByText('Vegan')).toBeOnTheScreen();
    expect(screen.getByText('“God tier. I still dream about it.”')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Directions' })).toBeOnTheScreen();
  });

  it('hides Save to try and the Final Meals count (Phase 4)', async () => {
    await render(<PickDetail />);
    await settle();
    expect(screen.queryByText('Save to try')).toBeNull();
    expect(screen.queryByText(/On \d+ Final Meals/)).toBeNull();
  });

  it('shows the photo, or the placeholder tile when there is none', async () => {
    await render(<PickDetail />);
    await settle();
    expect(screen.getByTestId('hero-placeholder')).toBeOnTheScreen();
    expect(screen.queryByTestId('hero-photo')).toBeNull();
  });

  it('shows a photo when the pick has one', async () => {
    mockGetPicks.mockResolvedValue([makePick({ id: 'f2', slot: 2, photoUrl: 'https://x/p.jpg' })]);
    await render(<PickDetail />);
    await settle();
    expect(screen.getByTestId('hero-photo')).toBeOnTheScreen();
    expect(screen.queryByTestId('hero-placeholder')).toBeNull();
  });

  it('shows Honorable and no note block for an honorable pick without a note', async () => {
    mockParams = { id: 'h1' };
    mockGetPicks.mockResolvedValue([makePick({ id: 'h1', tier: 'honorable', slot: null })]);
    await render(<PickDetail />);
    await settle();
    expect(screen.getByText('Honorable')).toBeOnTheScreen();
    expect(screen.queryByTestId('pick-note')).toBeNull();
  });

  describe('Directions', () => {
    afterEach(() => jest.restoreAllMocks());

    it('opens Apple Maps on iOS with the coordinates and name', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      await render(<PickDetail />);
      await settle();
      await fireEvent.press(screen.getByRole('button', { name: 'Directions' }));
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://maps.apple.com/?ll=49.29,-123.13&q=Marutama%20Ramen',
      );
    });

    it('opens the Android map with the coordinates and name', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await render(<PickDetail />);
      await settle();
      await fireEvent.press(screen.getByRole('button', { name: 'Directions' }));
      expect(Linking.openURL).toHaveBeenCalledWith(
        'geo:49.29,-123.13?q=49.29,-123.13(Marutama%20Ramen)',
      );
    });

    it('says so when the map cannot be opened', async () => {
      jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('no app'));
      await render(<PickDetail />);
      await settle();
      await fireEvent.press(screen.getByRole('button', { name: 'Directions' }));
      await settle();
      expect(screen.getByText('Something went wrong. Try again.')).toBeOnTheScreen();
    });
  });

  it('goes back', async () => {
    await render(<PickDetail />);
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  describe('actions', () => {
    it('opens Edit', async () => {
      await render(<PickDetail />);
      await settle();
      await menu('Edit');
      expect(mockRouter.push).toHaveBeenCalledWith('/pick/f2/edit');
    });

    it('moves a final up and updates the badge', async () => {
      mockMove.mockResolvedValue([
        makePick({ id: 'f2', slot: 1 }),
        makePick({ id: 'f1', slot: 2 }),
        makePick({ id: 'f3', slot: 3 }),
      ]);
      await render(<PickDetail />);
      await settle();
      await menu('Move up');
      await settle();
      expect(mockMove).toHaveBeenCalledWith(CLIENT, 'f2', 1);
      expect(screen.getByText('Final Meal · #1')).toBeOnTheScreen();
    });

    it('moves a final down', async () => {
      mockMove.mockResolvedValue(makeFinals(3));
      await render(<PickDetail />);
      await settle();
      await menu('Move down');
      await settle();
      expect(mockMove).toHaveBeenCalledWith(CLIENT, 'f2', 3);
    });

    it('cannot move up from slot 1', async () => {
      mockParams = { id: 'f1' };
      await render(<PickDetail />);
      await settle();
      await fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
      expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeDisabled();
    });

    it('moves a final to Honorable', async () => {
      mockDemote.mockResolvedValue(makePick({ id: 'f2', tier: 'honorable', slot: null }));
      mockGetPicks.mockResolvedValueOnce(makeFinals(3));
      await render(<PickDetail />);
      await settle();
      await menu('Move to Honorable');
      await settle();
      expect(mockDemote).toHaveBeenCalledWith(CLIENT, 'f2');
      expect(screen.getByText('Honorable')).toBeOnTheScreen();
    });

    it('removes after confirming, then goes back', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      mockRemove.mockResolvedValue(undefined);
      await render(<PickDetail />);
      await settle();
      await menu('Remove from my list');
      expect(alert.mock.calls[0]![0]).toBe('Remove Dish 2? This can’t be undone.');
      expect(mockRemove).not.toHaveBeenCalled();
      await act(async () => alert.mock.calls[0]![2]?.find((b) => b.text === 'Remove')?.onPress?.());
      expect(mockRemove).toHaveBeenCalledWith(CLIENT, 'f2');
      expect(mockRouter.back).toHaveBeenCalled();
      alert.mockRestore();
    });

    it('shows friendly copy when an action fails', async () => {
      mockMove.mockRejectedValue(new ApiError('bad', 'invalid_slot'));
      await render(<PickDetail />);
      await settle();
      await menu('Move down');
      await settle();
      expect(screen.getByText('That spot in your five doesn’t exist.')).toBeOnTheScreen();
    });
  });

  describe('Make it a Final Meal', () => {
    beforeEach(() => {
      mockParams = { id: 'h1' };
    });
    const honorable = makePick({ id: 'h1', tier: 'honorable', slot: null });

    it('promotes straight away when there is room', async () => {
      mockGetPicks.mockResolvedValue([...makeFinals(2), honorable]);
      mockPromote.mockResolvedValue(makePick({ id: 'h1', slot: 3 }));
      await render(<PickDetail />);
      await settle();
      await menu('Make it a Final Meal');
      await settle();
      expect(mockPromote).toHaveBeenCalledWith(CLIENT, 'h1');
      expect(screen.getByText('Final Meal · #3')).toBeOnTheScreen();
    });

    it('goes to Swap when the five are full', async () => {
      mockGetPicks.mockResolvedValue([...makeFinals(5), honorable]);
      await render(<PickDetail />);
      await settle();
      await menu('Make it a Final Meal');
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/add/swap',
        params: { promote: 'h1' },
      });
      expect(mockPromote).not.toHaveBeenCalled();
    });

    it('goes to Swap when the server says the five are full after all', async () => {
      mockGetPicks.mockResolvedValue([...makeFinals(2), honorable]);
      mockPromote.mockRejectedValue(new ApiError('full', 'final_full'));
      await render(<PickDetail />);
      await settle();
      await menu('Make it a Final Meal');
      await settle();
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/add/swap',
        params: { promote: 'h1' },
      });
    });
  });

  it('reloads when picks change elsewhere (a saved edit)', async () => {
    await render(<PickDetail />);
    await settle();
    expect(mockGetPicks).toHaveBeenCalledTimes(1);
    await act(async () => announcePicksChanged());
    expect(mockGetPicks).toHaveBeenCalledTimes(2);
  });

  it('says the pick is gone when it is not in the list', async () => {
    mockParams = { id: 'someone-elses' };
    await render(<PickDetail />);
    await settle();
    expect(screen.getByText('That pick isn’t there any more.')).toBeOnTheScreen();
  });

  it('says what went wrong when it cannot load, and retries', async () => {
    mockGetPicks.mockRejectedValueOnce(new TypeError('Network request failed'));
    await render(<PickDetail />);
    await settle();
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await settle();
    expect(screen.getByText('Dish 2')).toBeOnTheScreen();
  });
});
