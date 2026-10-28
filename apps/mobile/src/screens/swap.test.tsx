import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError, addPick, getMyPicks, promotePick } from '@finalmeal/api';
import Swap from '../../app/(app)/add/swap';
import { preparePickPhoto } from '../lib/prepare-pick-photo';
import { PLACE, withDraft } from '../test-support/add-dish';
import { makeFinals, makePick } from '../test-support/picks';
import { resetPickChanges } from '../state/pick-changes';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
let mockParams: Record<string, string> = {};
const mockSetOptions = jest.fn();
const mockParentSetOptions = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({
    setOptions: mockSetOptions,
    getParent: () => ({ setOptions: mockParentSetOptions }),
  }),
  useFocusEffect: (cb: () => void | (() => void)) => jest.requireActual('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  addPick: jest.fn(),
  getMyPicks: jest.fn(),
  promotePick: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../lib/prepare-pick-photo', () => ({ preparePickPhoto: jest.fn() }));

const CLIENT = { fake: 'client' };
const mockAddPick = jest.mocked(addPick);
const mockGetPicks = jest.mocked(getMyPicks);
const mockPromote = jest.mocked(promotePick);

const READY = { place: PLACE, dishName: 'Tonkotsu Ramen' };
async function settle() {
  await act(async () => {});
}
const row = (dish: string) => screen.getByRole('radio', { name: new RegExp(dish) });

describe('Swap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPickChanges();
    mockParams = {};
    mockGetPicks.mockResolvedValue(makeFinals(5));
    mockAddPick.mockResolvedValue({ pick: makePick({ slot: 4 }), photoFailed: false });
    mockPromote.mockResolvedValue(makePick({ slot: 4 }));
  });

  it('shows the canvas copy, the incoming dish and the five finals', async () => {
    await render(withDraft(<Swap />, READY));
    await settle();
    expect(screen.getByText('Your five are full')).toBeOnTheScreen();
    expect(screen.getByText('Something has to go.')).toBeOnTheScreen();
    expect(screen.getByText('Tonkotsu Ramen')).toBeOnTheScreen();
    expect(screen.getByText('Incoming')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Pick the dish it replaces. That one moves to your Honorable Mentions — nothing is deleted.',
      ),
    ).toBeOnTheScreen();
    for (let i = 1; i <= 5; i++) expect(screen.getByText(`Dish ${i}`)).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('keeps the button off until a row is chosen, then names the dish', async () => {
    await render(withDraft(<Swap />, READY));
    await settle();
    expect(screen.getByRole('button', { name: 'Choose one to replace' })).toBeDisabled();
    await fireEvent.press(row('Dish 4'));
    expect(row('Dish 4')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Replace Dish 4' })).toBeEnabled();
    await fireEvent.press(row('Dish 2'));
    expect(row('Dish 4')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Replace Dish 2' })).toBeEnabled();
  });

  it('adds the draft with replaceSlot and returns to You', async () => {
    await render(withDraft(<Swap />, { ...READY, note: 'Yes.', dishId: 'd9' }));
    await settle();
    await fireEvent.press(row('Dish 4'));
    await fireEvent.press(screen.getByRole('button', { name: 'Replace Dish 4' }));
    await settle();
    expect(mockAddPick).toHaveBeenCalledWith(CLIENT, {
      placeId: 'p1',
      dishId: 'd9',
      dishName: 'Tonkotsu Ramen',
      tier: 'final',
      note: 'Yes.',
      tagIds: [],
      personalTags: [],
      photo: undefined,
      replaceSlot: 4,
    });
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/you');
  });

  it('saves without the photo when it cannot be prepared', async () => {
    jest.mocked(preparePickPhoto).mockRejectedValue(new Error('read failed'));
    await render(withDraft(<Swap />, { ...READY, photoUri: 'file:///a.jpg' }));
    await settle();
    await fireEvent.press(row('Dish 1'));
    await fireEvent.press(screen.getByRole('button', { name: 'Replace Dish 1' }));
    await settle();
    expect(mockAddPick).toHaveBeenCalledWith(
      CLIENT,
      expect.objectContaining({ photo: undefined, replaceSlot: 1 }),
    );
    expect(mockRouter.dismissTo).toHaveBeenCalled();
  });

  it('shows friendly copy and stays when the swap fails', async () => {
    mockAddPick.mockRejectedValue(new TypeError('Network request failed'));
    await render(withDraft(<Swap />, READY));
    await settle();
    await fireEvent.press(row('Dish 5'));
    await fireEvent.press(screen.getByRole('button', { name: 'Replace Dish 5' }));
    await settle();
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Replace Dish 5' })).toBeEnabled();
  });

  it('Cancel goes back', async () => {
    await render(withDraft(<Swap />, READY));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('cannot be left while saving', async () => {
    let finish: (v: { pick: ReturnType<typeof makePick>; photoFailed: boolean }) => void = () => {};
    mockAddPick.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await render(withDraft(<Swap />, READY));
    await settle();
    await fireEvent.press(row('Dish 3'));
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Replace Dish 3' }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    // iOS swipe-back is off while saving, so a success can never pop past where it was meant to.
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Replace Dish 3' }));
    expect(mockAddPick).toHaveBeenCalledTimes(1);
    await act(async () => finish({ pick: makePick(), photoFailed: false }));
  });

  describe('the dish is already an honorable pick (five full)', () => {
    const honorable = () =>
      makePick({ id: 'h9', tier: 'honorable', slot: null, dish: { id: 'd1', name: 'Tonkotsu Ramen' } });
    const replaceDish4 = async () => {
      await fireEvent.press(row('Dish 4'));
      await fireEvent.press(screen.getByRole('button', { name: 'Replace Dish 4' }));
      await settle();
    };

    beforeEach(() => {
      mockAddPick.mockRejectedValue(new ApiError('duplicate', 'duplicate_pick'));
      mockGetPicks.mockResolvedValue([...makeFinals(5), honorable()]);
    });

    it('offers Make it a Final Meal instead, and promotes into the chosen slot', async () => {
      await render(withDraft(<Swap />, READY));
      await settle();
      await replaceDish4();
      expect(screen.getByText('That dish is already on your list.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Make it a Final Meal instead' }));
      await settle();
      expect(mockPromote).toHaveBeenCalledWith(CLIENT, 'h9', 4);
      expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/you');
    });

    it('recognises the pick by the dish name as typed, however it is spelled', async () => {
      await render(withDraft(<Swap />, { ...READY, dishName: 'tonkotsu  ramen!' }));
      await settle();
      await replaceDish4();
      expect(screen.getByRole('button', { name: 'Make it a Final Meal instead' })).toBeOnTheScreen();
    });

    it('shows friendly copy when that promote fails', async () => {
      mockPromote.mockRejectedValue(new ApiError('gone', 'pick_not_found'));
      await render(withDraft(<Swap />, READY));
      await settle();
      await replaceDish4();
      await fireEvent.press(screen.getByRole('button', { name: 'Make it a Final Meal instead' }));
      await settle();
      expect(screen.getByText('That pick isn’t there any more.')).toBeOnTheScreen();
      expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    });

    it('does not offer it when the dish is already a Final Meal', async () => {
      const finals = makeFinals(5);
      finals[2] = makePick({ ...finals[2]!, dish: { id: 'd1', name: 'Tonkotsu Ramen' } });
      mockGetPicks.mockResolvedValue(finals);
      await render(withDraft(<Swap />, READY));
      await settle();
      await replaceDish4();
      expect(screen.getByText('That dish is already on your list.')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Make it a Final Meal instead' })).toBeNull();
    });

    it('promotes into whichever slot is chosen after the refusal', async () => {
      await render(withDraft(<Swap />, READY));
      await settle();
      await replaceDish4();
      await fireEvent.press(row('Dish 2'));
      await fireEvent.press(screen.getByRole('button', { name: 'Make it a Final Meal instead' }));
      await settle();
      expect(mockPromote).toHaveBeenCalledWith(CLIENT, 'h9', 2);
    });
  });

  describe('the Add modal', () => {
    it('stays shut to swipe-down while the draft has content', async () => {
      await render(withDraft(<Swap />, READY));
      await settle();
      expect(mockParentSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    });
  });

  describe('promoting an honorable pick when the five are full', () => {
    beforeEach(() => {
      mockParams = { promote: 'h1' };
      mockGetPicks.mockResolvedValue([
        ...makeFinals(5),
        makePick({
          id: 'h1',
          tier: 'honorable',
          slot: null,
          dish: { id: 'hd', name: 'Gyoza' },
        }),
      ]);
    });

    it('shows the honorable pick as the incoming card', async () => {
      await render(withDraft(<Swap />));
      await settle();
      expect(screen.getByText('Gyoza')).toBeOnTheScreen();
      expect(screen.getByText('Incoming')).toBeOnTheScreen();
      expect(screen.getAllByRole('radio')).toHaveLength(5);
    });

    it('allows swipe-down while idle (the draft is empty) and not while promoting', async () => {
      let finish: (p: ReturnType<typeof makePick>) => void = () => {};
      mockPromote.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await render(withDraft(<Swap />));
      await settle();
      expect(mockParentSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
      await fireEvent.press(row('Dish 2'));
      await fireEvent.press(screen.getByRole('button', { name: 'Replace Dish 2' }));
      expect(mockParentSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
      expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
      await act(async () => finish(makePick()));
    });

    it('promotes with the chosen slot instead of adding', async () => {
      await render(withDraft(<Swap />));
      await settle();
      await fireEvent.press(row('Dish 2'));
      await fireEvent.press(screen.getByRole('button', { name: 'Replace Dish 2' }));
      await settle();
      expect(mockPromote).toHaveBeenCalledWith(CLIENT, 'h1', 2);
      expect(mockAddPick).not.toHaveBeenCalled();
      expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/you');
    });

    it('shows friendly copy when promoting fails', async () => {
      mockPromote.mockRejectedValue(new ApiError('gone', 'pick_not_found'));
      await render(withDraft(<Swap />));
      await settle();
      await fireEvent.press(row('Dish 2'));
      await fireEvent.press(screen.getByRole('button', { name: 'Replace Dish 2' }));
      await settle();
      expect(screen.getByText('That pick isn’t there any more.')).toBeOnTheScreen();
    });
  });

  it('says what went wrong when the list cannot load, with a way to retry', async () => {
    mockGetPicks.mockRejectedValueOnce(new TypeError('Network request failed'));
    await render(withDraft(<Swap />, READY));
    await settle();
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await settle();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });
});
