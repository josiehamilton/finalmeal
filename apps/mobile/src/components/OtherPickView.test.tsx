import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { ApiError, saveDish, unsaveDish } from '@finalmeal/api';
import { OtherPickView } from './OtherPickView';
import { makePickDetail } from '../test-support/saves';
import { makePick } from '../test-support/picks';
import { getSavesVersion, resetSaveChanges } from '../state/save';

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-linking', () => ({ openURL: jest.fn().mockResolvedValue(true) }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  saveDish: jest.fn(),
  unsaveDish: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));

const CLIENT = { fake: 'client' };
const mockSave = jest.mocked(saveDish);
const mockUnsave = jest.mocked(unsaveDish);

async function show(detail = makePickDetail()) {
  await render(<OtherPickView detail={detail} />);
}

describe('OtherPickView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSaveChanges();
    mockSave.mockResolvedValue(undefined);
    mockUnsave.mockResolvedValue(undefined);
  });

  it('renders the PickDetail board', async () => {
    await show();
    expect(screen.getByText('Final Meal · #2')).toBeOnTheScreen();
    expect(screen.getByText('Wagyu Beef Don')).toBeOnTheScreen();
    expect(screen.getByText('Sushi Itto · Shibuya, Tokyo')).toBeOnTheScreen();
    expect(screen.getByText('Rice bowl')).toBeOnTheScreen();
    expect(screen.getByText('Japanese')).toBeOnTheScreen();
    expect(screen.getByText('Gluten-free')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Directions' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save to try' })).toBeOnTheScreen();
    expect(screen.getByText('“God tier. I still dream about it.”')).toBeOnTheScreen();
    expect(screen.getByText('@mikebrennan · #2 on their Final Meal')).toBeOnTheScreen();
    expect(screen.getByText('On 23 Final Meals')).toBeOnTheScreen();
    expect(screen.getByTestId('hero-placeholder')).toBeOnTheScreen();
  });

  it('renders no Share control and no owner actions', async () => {
    await show();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });

  it('shows the photo when the pick has one', async () => {
    const detail = makePickDetail();
    await show({ ...detail, pick: { ...detail.pick, photoUrl: 'https://x/p.jpg' } });
    expect(screen.getByTestId('hero-photo')).toBeOnTheScreen();
    expect(screen.queryByTestId('hero-placeholder')).toBeNull();
  });

  it('shows Honorable and the Honorable Mention caption', async () => {
    const detail = makePickDetail();
    await show({ ...detail, pick: { ...detail.pick, tier: 'honorable', slot: null } });
    expect(screen.getByText('Honorable')).toBeOnTheScreen();
    expect(screen.getByText('@mikebrennan · Honorable Mention')).toBeOnTheScreen();
  });

  it('keeps the caption but drops the quote when there is no note', async () => {
    const detail = makePickDetail();
    await show({ ...detail, pick: { ...detail.pick, note: null } });
    expect(screen.queryByText(/God tier/)).toBeNull();
    expect(screen.getByText('@mikebrennan · #2 on their Final Meal')).toBeOnTheScreen();
  });

  it('hides the pickers row when nobody has it as a Final Meal', async () => {
    await show(makePickDetail({ finalCount: 0, pickers: [] }));
    expect(screen.queryByText(/On \d+ Final Meal/)).toBeNull();
  });

  it('opens the owner from their @username', async () => {
    await show();
    await fireEvent.press(screen.getByText('@mikebrennan'));
    expect(mockRouter.push).toHaveBeenCalledWith('/u/u-mike');
  });

  it('goes back', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  describe('Directions', () => {
    afterEach(() => jest.restoreAllMocks());

    it('opens the map for the place', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Directions' }));
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('maps.apple.com'));
    });

    it('says so when the map cannot be opened', async () => {
      jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('no app'));
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Directions' }));
      await act(async () => {});
      expect(screen.getByText('Something went wrong. Try again.')).toBeOnTheScreen();
    });
  });

  describe('Save to try', () => {
    it('saves through this pick, turns to Saved, and the hero bookmark follows', async () => {
      await show();
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeSelected();
      await fireEvent.press(screen.getByRole('button', { name: 'Save to try' }));
      await act(async () => {});
      expect(mockSave).toHaveBeenCalledWith(CLIENT, 'd-wagyu', 'pk-mike');
      expect(screen.getByRole('button', { name: 'Saved' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Save to try' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Save' })).toBeSelected();
      expect(getSavesVersion()).toBe(1);
    });

    it('unsaves from either button', async () => {
      await show(makePickDetail({ savedByMe: true }));
      expect(screen.getByRole('button', { name: 'Saved' })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      await act(async () => {});
      expect(mockUnsave).toHaveBeenCalledWith(CLIENT, 'd-wagyu');
      expect(screen.getByRole('button', { name: 'Save to try' })).toBeOnTheScreen();
    });

    it('makes one call for a double tap', async () => {
      let finish: () => void = () => {};
      mockSave.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Save to try' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Saved' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockUnsave).not.toHaveBeenCalled();
      await act(async () => finish());
      expect(screen.getByRole('button', { name: 'Saved' })).toBeOnTheScreen();
    });

    it('reverts with friendly copy when saving fails', async () => {
      mockSave.mockRejectedValue(new ApiError('gone', 'dish_not_found'));
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Save to try' }));
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'Save to try' })).toBeOnTheScreen();
      expect(screen.getByText('That dish isn’t there any more.')).toBeOnTheScreen();
    });
  });

  it('is built from a pick with no tags or note without breaking', async () => {
    const detail = makePickDetail();
    await show({ ...detail, pick: makePick({ id: 'pk-x', note: null, tags: [] }) });
    expect(screen.getByText('Tonkotsu Ramen')).toBeOnTheScreen();
  });
});
