import { Alert, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  ApiError,
  addPick,
  createPersonalTag,
  getCity,
  getMyPicks,
  getPopularPlaces,
  promotePick,
  searchTags,
  suggestDishes,
} from '@finalmeal/api';
import type { Pick } from '@finalmeal/api';
import AddDish from '../../app/(app)/add/index';
import ChooseRestaurant from '../../app/(app)/add/place';
import { preparePickPhoto } from '../lib/prepare-pick-photo';
import { pickPhoto } from '../lib/pick-photo';
import { PLACE, RAMEN, VEGAN, readDraft, withDraft } from '../test-support/add-dish';
import { resetPickChanges, usePhotoNotice } from '../state/pick-changes';

const mockModalSetOptions = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ getParent: () => ({ setOptions: mockModalSetOptions }) }),
  useFocusEffect: (cb: () => void | (() => void)) => jest.requireActual('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  addPick: jest.fn(),
  createPersonalTag: jest.fn(),
  getMyPicks: jest.fn(),
  getCity: jest.fn(),
  promotePick: jest.fn(),
  searchPlaces: jest.fn().mockResolvedValue([]),
  getPopularPlaces: jest.fn().mockResolvedValue([]),
  searchTags: jest.fn(),
  suggestDishes: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../lib/pick-photo', () => ({ pickPhoto: jest.fn() }));
jest.mock('../lib/prepare-pick-photo', () => ({ preparePickPhoto: jest.fn() }));
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ session: {}, profile: jest.requireActual('../test-support/profile').makeProfile(), loading: false, error: null }),
}));
const mockLocation = {
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
};
jest.mock('expo-location', () => mockLocation);

const mockAddPick = jest.mocked(addPick);
const mockGetPicks = jest.mocked(getMyPicks);
const mockPromote = jest.mocked(promotePick);
const mockSearchTags = jest.mocked(searchTags);
const mockSuggest = jest.mocked(suggestDishes);
const mockCreateTag = jest.mocked(createPersonalTag);

const CLIENT = { fake: 'client' };

function pickAt(tier: 'final' | 'honorable', slot: number | null, id = 'pk1'): Pick {
  return {
    id,
    tier,
    slot,
    dish: { id: 'd1', name: 'Tonkotsu Ramen' },
    originalDishName: 'tonkotsu ramen',
    place: PLACE,
    note: null,
    photoUrl: null,
    tags: [],
    createdAt: '2026-10-27T00:00:00Z',
  };
}
function finals(n: number): Pick[] {
  return Array.from({ length: n }, (_, i) => ({
    ...pickAt('final', i + 1, `f${i + 1}`),
    dish: { id: `fd${i}`, name: `Dish ${i}` },
    originalDishName: `Dish ${i}`,
  }));
}

const READY = { place: PLACE, dishName: 'Tonkotsu Ramen' };
const cta = (name: string) => screen.getByRole('button', { name });

async function settle() {
  await act(async () => {});
}

describe('Add a dish form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPickChanges();
    mockGetPicks.mockResolvedValue(finals(2));
    mockSearchTags.mockImplementation(async (_c, kind) =>
      kind === 'food_type'
        ? [RAMEN, { ...RAMEN, id: 't3', name: 'Noodles', slug: 'noodles' }]
        : kind === 'dietary'
          ? [VEGAN]
          : [{ id: 't9', kind: 'personal', name: 'Rainy day', slug: 'rainy-day', featured: false }],
    );
    mockSuggest.mockResolvedValue([]);
    mockAddPick.mockResolvedValue({ pick: pickAt('final', 3), photoFailed: false });
    mockPromote.mockResolvedValue(pickAt('final', 3));
  });

  it('shows the form with the canvas copy', async () => {
    await render(withDraft(<AddDish />));
    await settle();
    expect(screen.getByText('Add a dish')).toBeOnTheScreen();
    expect(screen.getByText('Photo (optional).')).toBeOnTheScreen();
    expect(screen.getByText(/Only your own\. We never use stock images\./)).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('e.g. Smash Burger')).toBeOnTheScreen();
    expect(screen.getByText('Choose a restaurant')).toBeOnTheScreen();
    expect(screen.getByText('Add to')).toBeOnTheScreen();
    expect(screen.getByText('2 of 5 used.')).toBeOnTheScreen();
    expect(screen.getByText('Unlimited runners-up.')).toBeOnTheScreen();
    expect(screen.getByText('Note (optional)')).toBeOnTheScreen();
    expect(screen.getByText('Optional · food type, dietary, your own')).toBeOnTheScreen();
  });

  it('keeps the button off until a restaurant and a dish name are set', async () => {
    await render(withDraft(<AddDish />));
    await settle();
    expect(cta('Add to Final Meal')).toBeDisabled();
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Smash Burger'), 'Tonkotsu Ramen');
    expect(cta('Add to Final Meal')).toBeDisabled();
  });

  it('is enabled with a restaurant and a dish name', async () => {
    await render(withDraft(<AddDish />, READY));
    await settle();
    expect(cta('Add to Final Meal')).toBeEnabled();
  });

  it('opens the restaurant search from the Restaurant row, which shows the place with Change', async () => {
    await render(withDraft(<AddDish />, READY));
    await settle();
    expect(screen.getByText('Marutama Ramen')).toBeOnTheScreen();
    expect(screen.getByText('Bidwell St · Vancouver')).toBeOnTheScreen();
    expect(screen.getByText('Change')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Restaurant/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/add/place');
  });

  it('switches the button to Add to Honorable', async () => {
    await render(withDraft(<AddDish />, READY));
    await settle();
    await fireEvent.press(screen.getByRole('radio', { name: /Honorable/ }));
    expect(cta('Add to Honorable')).toBeEnabled();
  });

  it('adds a Final Meal pick and returns to You', async () => {
    await render(withDraft(<AddDish />, { ...READY, note: 'The broth is a religious experience.' }));
    await settle();
    await fireEvent.press(cta('Add to Final Meal'));
    await settle();
    expect(mockAddPick).toHaveBeenCalledWith(CLIENT, {
      placeId: 'p1',
      dishId: undefined,
      dishName: 'Tonkotsu Ramen',
      tier: 'final',
      note: 'The broth is a religious experience.',
      tagIds: [],
      personalTags: [],
      photo: undefined,
    });
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/you');
  });

  it('adds an honorable pick with the chosen suggestion, tags and prepared photo', async () => {
    const bytes = new ArrayBuffer(8);
    jest.mocked(preparePickPhoto).mockResolvedValue(bytes);
    await render(
      withDraft(<AddDish />, {
        ...READY,
        dishId: 'd1',
        tier: 'honorable',
        tags: [RAMEN, VEGAN],
        personalTags: ['Rainy day'],
        photoUri: 'file:///a.jpg',
      }),
    );
    await settle();
    await fireEvent.press(cta('Add to Honorable'));
    await settle();
    expect(preparePickPhoto).toHaveBeenCalledWith('file:///a.jpg');
    expect(mockAddPick).toHaveBeenCalledWith(CLIENT, {
      placeId: 'p1',
      dishId: 'd1',
      dishName: 'Tonkotsu Ramen',
      tier: 'honorable',
      note: undefined,
      tagIds: ['t1', 't2'],
      personalTags: ['Rainy day'],
      photo: bytes,
    });
  });

  it('stays on the form with friendly copy when adding fails', async () => {
    mockAddPick.mockRejectedValue(new TypeError('Network request failed'));
    await render(withDraft(<AddDish />, READY));
    await settle();
    await fireEvent.press(cta('Add to Final Meal'));
    await settle();
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(cta('Add to Final Meal')).toBeEnabled();
  });

  describe('with five Final Meal picks', () => {
    beforeEach(() => mockGetPicks.mockResolvedValue(finals(5)));

    it('says the five are full and reads Choose one to replace', async () => {
      await render(withDraft(<AddDish />, READY));
      await settle();
      expect(screen.getByText('5 of 5 used. You’ll choose one to replace.')).toBeOnTheScreen();
      expect(cta('Choose one to replace')).toBeEnabled();
    });

    it('opens Swap instead of adding', async () => {
      await render(withDraft(<AddDish />, READY));
      await settle();
      await fireEvent.press(cta('Choose one to replace'));
      expect(mockRouter.push).toHaveBeenCalledWith('/add/swap');
      expect(mockAddPick).not.toHaveBeenCalled();
    });

    it('still adds a runner-up straight away', async () => {
      await render(withDraft(<AddDish />, { ...READY, tier: 'honorable' }));
      await settle();
      await fireEvent.press(cta('Add to Honorable'));
      await settle();
      expect(mockAddPick).toHaveBeenCalledTimes(1);
    });
  });

  describe('a dish that is already on the list', () => {
    const duplicate = () => new ApiError('duplicate', 'duplicate_pick');

    it('offers to make an honorable pick a Final Meal, and does it', async () => {
      mockAddPick.mockRejectedValue(duplicate());
      mockGetPicks.mockResolvedValue([...finals(2), pickAt('honorable', null, 'pk9')]);
      await render(withDraft(<AddDish />, { ...READY, dishName: 'tonkotsu  ramen!' }));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(screen.getByText('That dish is already on your list.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Make it a Final Meal instead' }));
      await settle();
      expect(mockPromote).toHaveBeenCalledWith(CLIENT, 'pk9');
      expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/you');
    });

    it('recognises the pick by the chosen suggestion', async () => {
      mockAddPick.mockRejectedValue(duplicate());
      mockGetPicks.mockResolvedValue([
        { ...pickAt('honorable', null, 'pk9'), dish: { id: 'd1', name: 'Totally different' } },
      ]);
      await render(withDraft(<AddDish />, { ...READY, dishId: 'd1' }));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(screen.getByRole('button', { name: 'Make it a Final Meal instead' })).toBeOnTheScreen();
    });

    it('clears the refusal and the offer once the dish or the list is changed', async () => {
      mockAddPick.mockRejectedValue(duplicate());
      mockGetPicks.mockResolvedValue([pickAt('honorable', null, 'pk9')]);
      await render(withDraft(<AddDish />, READY));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(screen.getByRole('button', { name: 'Make it a Final Meal instead' })).toBeOnTheScreen();
      await fireEvent.changeText(screen.getByPlaceholderText('e.g. Smash Burger'), 'Spicy Miso Ramen');
      expect(screen.queryByText('That dish is already on your list.')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Make it a Final Meal instead' })).toBeNull();
    });

    it('does not offer it when the existing pick is already a Final Meal', async () => {
      mockAddPick.mockRejectedValue(duplicate());
      mockGetPicks.mockResolvedValue([pickAt('final', 1)]);
      await render(withDraft(<AddDish />, READY));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(screen.getByText('That dish is already on your list.')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Make it a Final Meal instead' })).toBeNull();
    });

    it('does not offer it when the person was adding it as honorable', async () => {
      mockAddPick.mockRejectedValue(duplicate());
      mockGetPicks.mockResolvedValue([pickAt('honorable', null)]);
      await render(withDraft(<AddDish />, { ...READY, tier: 'honorable' }));
      await settle();
      await fireEvent.press(cta('Add to Honorable'));
      await settle();
      expect(screen.getByText('That dish is already on your list.')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Make it a Final Meal instead' })).toBeNull();
    });

    it('shows friendly copy when promoting fails for another reason', async () => {
      mockAddPick.mockRejectedValue(duplicate());
      mockGetPicks.mockResolvedValue([pickAt('honorable', null, 'pk9')]);
      mockPromote.mockRejectedValue(new ApiError('gone', 'pick_not_found'));
      await render(withDraft(<AddDish />, READY));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      await fireEvent.press(screen.getByRole('button', { name: 'Make it a Final Meal instead' }));
      await settle();
      expect(screen.getByText('That pick isn’t there any more.')).toBeOnTheScreen();
      expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    });

    it('opens Swap in promote mode when promoting finds the five full', async () => {
      mockAddPick.mockRejectedValue(duplicate());
      mockGetPicks.mockResolvedValue([pickAt('honorable', null, 'pk9')]);
      mockPromote.mockRejectedValue(new ApiError('full', 'final_full'));
      await render(withDraft(<AddDish />, READY));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      await fireEvent.press(screen.getByRole('button', { name: 'Make it a Final Meal instead' }));
      await settle();
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/add/swap',
        params: { promote: 'pk9' },
      });
    });
  });

  describe('saving', () => {
    function Notice() {
      return <Text testID="notice">{String(usePhotoNotice())}</Text>;
    }
    const withNotice = (draft: Parameters<typeof withDraft>[1]) => (
      <>
        {withDraft(<AddDish />, draft)}
        <Notice />
      </>
    );

    it('keeps the button busy and the screen shut while saving, and saves once', async () => {
      let finish: (v: { pick: Pick; photoFailed: boolean }) => void = () => {};
      mockAddPick.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await render(withDraft(<AddDish />, READY));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      expect(screen.getByTestId('cta-busy')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
      await fireEvent.press(screen.getByTestId('cta-busy'));
      expect(mockAddPick).toHaveBeenCalledTimes(1);
      await act(async () => finish({ pick: pickAt('final', 3), photoFailed: false }));
      expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/you');
    });

    it('raises the saved-without-photo notice for You when the upload failed', async () => {
      mockAddPick.mockResolvedValue({ pick: pickAt('final', 3), photoFailed: true });
      jest.mocked(preparePickPhoto).mockResolvedValue(new ArrayBuffer(8));
      await render(withNotice({ ...READY, photoUri: 'file:///a.jpg' }));
      await settle();
      expect(screen.getByTestId('notice')).toHaveTextContent('false');
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(screen.getByTestId('notice')).toHaveTextContent('true');
      expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/you');
    });

    it('saves without the photo, with the notice, when it cannot be prepared', async () => {
      jest.mocked(preparePickPhoto).mockRejectedValue(new Error('resize failed'));
      await render(withNotice({ ...READY, photoUri: 'file:///a.jpg' }));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(mockAddPick).toHaveBeenCalledTimes(1);
      expect(mockAddPick.mock.calls[0]![1].photo).toBeUndefined();
      expect(screen.getByTestId('notice')).toHaveTextContent('true');
      expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/you');
    });

    it('shows no notice when the photo went up', async () => {
      await render(withNotice(READY));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(screen.getByTestId('notice')).toHaveTextContent('false');
    });

    it('counts a duplicate after a lost connection as saved, instead of showing an error', async () => {
      mockAddPick
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockRejectedValueOnce(new ApiError('duplicate', 'duplicate_pick'));
      await render(withDraft(<AddDish />, READY));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
      mockGetPicks.mockResolvedValue([pickAt('final', 3)]);
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(mockAddPick).toHaveBeenCalledTimes(2);
      expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(app)/you');
    });

    it('still reports a duplicate that was there before any retry', async () => {
      mockAddPick.mockRejectedValue(new ApiError('duplicate', 'duplicate_pick'));
      mockGetPicks.mockResolvedValue([pickAt('final', 3)]);
      await render(withDraft(<AddDish />, READY));
      await settle();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(screen.getByText('That dish is already on your list.')).toBeOnTheScreen();
      expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    });
  });

  it('opens Swap when the server says the five are full after all', async () => {
    mockAddPick.mockRejectedValue(new ApiError('full', 'final_full'));
    await render(withDraft(<AddDish />, READY));
    await settle();
    await fireEvent.press(cta('Add to Final Meal'));
    await settle();
    expect(mockRouter.push).toHaveBeenCalledWith('/add/swap');
  });

  describe('tags', () => {
    async function expand() {
      await fireEvent.press(screen.getByRole('button', { name: /Add tags/ }));
      await settle();
    }

    it('expands inline with the three groups and a Hide link', async () => {
      await render(withDraft(<AddDish />, READY));
      await settle();
      await expand();
      expect(screen.getByText('Food type')).toBeOnTheScreen();
      expect(screen.getByText('Suggested')).toBeOnTheScreen();
      expect(screen.getByText('Dietary')).toBeOnTheScreen();
      expect(screen.getByText('Any that apply')).toBeOnTheScreen();
      expect(screen.getByText('Your tags')).toBeOnTheScreen();
      expect(screen.getByText('Just for you')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Ramen' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Vegan' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Rainy day' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Your own' })).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: 'More' })).toHaveLength(2);
      expect(mockSearchTags).toHaveBeenCalledWith(CLIENT, 'food_type', '');
      expect(mockSearchTags).toHaveBeenCalledWith(CLIENT, 'dietary', '');
      expect(mockSearchTags).toHaveBeenCalledWith(CLIENT, 'personal', '');
      await fireEvent.press(screen.getByRole('button', { name: 'Hide' }));
      expect(screen.queryByText('Just for you')).toBeNull();
      expect(screen.getByText('Optional · food type, dietary, your own')).toBeOnTheScreen();
    });

    it('selects chips (ember wash) and sends global tags by id and personal tags by name', async () => {
      await render(withDraft(<AddDish />, READY));
      await settle();
      await expand();
      await fireEvent.press(screen.getByRole('button', { name: 'Ramen' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Rainy day' }));
      expect(screen.getByRole('button', { name: 'Ramen' })).toBeSelected();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(mockAddPick).toHaveBeenCalledWith(
        CLIENT,
        expect.objectContaining({ tagIds: ['t1'], personalTags: ['Rainy day'] }),
      );
    });

    it('shows the first 5 food types and 7 dietary tags, then More; chosen extras still show', async () => {
      const many = (kind: 'food_type' | 'dietary', n: number, prefix: string) =>
        Array.from({ length: n }, (_, i) => ({
          id: `${prefix}${i}`,
          kind,
          name: `${prefix}${i}`,
          slug: `${prefix}${i}`,
          featured: true,
        }));
      mockSearchTags.mockImplementation(async (_c, kind) =>
        kind === 'food_type' ? many('food_type', 9, 'F') : kind === 'dietary' ? many('dietary', 10, 'D') : [],
      );
      const extra = { id: 'x1', kind: 'food_type' as const, name: 'Korean', slug: 'korean', featured: false };
      await render(withDraft(<AddDish />, { ...READY, tags: [extra] }));
      await settle();
      await expand();
      for (let i = 0; i < 5; i++) expect(screen.getByRole('button', { name: `F${i}` })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'F5' })).toBeNull();
      for (let i = 0; i < 7; i++) expect(screen.getByRole('button', { name: `D${i}` })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'D7' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Korean' })).toBeSelected();
      expect(screen.getAllByRole('button', { name: 'More' })).toHaveLength(2);
    });

    it('opens tag search for the kind from More', async () => {
      await render(withDraft(<AddDish />, READY));
      await settle();
      await expand();
      const more = screen.getAllByRole('button', { name: 'More' });
      await fireEvent.press(more[1]!);
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/add/tags-search',
        params: { kind: 'dietary' },
      });
    });

    it('creates and selects a personal tag from Your own, by name', async () => {
      mockCreateTag.mockResolvedValue({
        id: 't10',
        kind: 'personal',
        name: 'Date night',
        slug: 'date-night',
        featured: false,
      });
      await render(withDraft(<AddDish />, READY));
      await settle();
      await expand();
      await fireEvent.press(screen.getByRole('button', { name: 'Your own' }));
      await fireEvent.changeText(screen.getByPlaceholderText('Name your tag'), 'date night');
      await fireEvent.press(screen.getByRole('button', { name: 'Add tag' }));
      await settle();
      expect(mockCreateTag).toHaveBeenCalledWith(CLIENT, 'date night');
      expect(screen.getByRole('button', { name: 'Date night' })).toBeSelected();
      await fireEvent.press(cta('Add to Final Meal'));
      await settle();
      expect(mockAddPick).toHaveBeenCalledWith(
        CLIENT,
        expect.objectContaining({ personalTags: ['Date night'] }),
      );
    });

    it('shows a selected tag that is not featured, so it can be unselected', async () => {
      const korean = { id: 't7', kind: 'food_type' as const, name: 'Korean', slug: 'korean', featured: false };
      await render(withDraft(<AddDish />, { ...READY, tags: [korean] }));
      await settle();
      await expand();
      expect(screen.getByRole('button', { name: 'Korean' })).toBeSelected();
    });
  });

  it('shows the choice of photo and keeps the one picked', async () => {
    jest.mocked(pickPhoto).mockResolvedValue({ status: 'picked', uri: 'file:///x.jpg' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(withDraft(<AddDish />, READY));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Photo' }));
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(buttons.map((b) => b.text)).toEqual(['Take a photo', 'Choose from library', 'Cancel']);
    await act(async () => buttons.find((b) => b.text === 'Choose from library')?.onPress?.());
    expect(readDraft(screen).photoUri).toBe('file:///x.jpg');
    expect(pickPhoto).toHaveBeenCalledWith('library', { crop: false });
  });

  describe('swipe-down to dismiss', () => {
    it('is allowed while the form is empty', async () => {
      await render(withDraft(<AddDish />));
      await settle();
      expect(mockModalSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    });

    it('is blocked once there is something typed, and again when it is cleared', async () => {
      await render(withDraft(<AddDish />));
      await settle();
      await fireEvent.changeText(screen.getByPlaceholderText('e.g. Smash Burger'), 'Ramen');
      expect(mockModalSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
      await fireEvent.changeText(screen.getByPlaceholderText('e.g. Smash Burger'), '');
      expect(mockModalSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    });

    it('is blocked with a restaurant chosen', async () => {
      await render(withDraft(<AddDish />, { place: PLACE }));
      await settle();
      expect(mockModalSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    });
  });

  it('closes with the X', async () => {
    await render(withDraft(<AddDish />));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('never asks for the current location', async () => {
    await render(withDraft(<AddDish />, READY));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: /Add tags/ }));
    await settle();
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(screen.queryByText('Use my current location')).toBeNull();
  });
});

describe('Choose a restaurant screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getCity).mockResolvedValue(null);
    jest.mocked(getPopularPlaces).mockResolvedValue([PLACE]);
  });

  it('sets the place on the draft and goes back to the form', async () => {
    await render(withDraft(<ChooseRestaurant />));
    await settle();
    await fireEvent.press(await screen.findByText('Marutama Ramen'));
    expect(readDraft(screen).place).toEqual(PLACE);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('has its title and the Search restaurants field, and no location button', async () => {
    await render(withDraft(<ChooseRestaurant />));
    await settle();
    expect(screen.getByText('Choose a restaurant')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Search restaurants')).toBeOnTheScreen();
    expect(screen.queryByText('Use my current location')).toBeNull();
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('opens Add a spot with the typed text', async () => {
    await render(withDraft(<ChooseRestaurant />));
    await settle();
    await fireEvent.changeText(screen.getByPlaceholderText('Search restaurants'), 'Taco Truck');
    await fireEvent.press(screen.getByRole('button', { name: 'Can’t find it? Add it' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/add/custom-place',
      params: { name: 'Taco Truck' },
    });
  });

  it('goes back', async () => {
    await render(withDraft(<ChooseRestaurant />));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
