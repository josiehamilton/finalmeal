import { Alert, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError, getMyPicks, searchTags, updatePick } from '@finalmeal/api';
import EditPick from '../../app/(app)/pick/[id]/edit/index';
import { pickPhoto } from '../lib/pick-photo';
import { preparePickPhoto } from '../lib/prepare-pick-photo';
import { RAMEN, VEGAN } from '../test-support/add-dish';
import { makePick } from '../test-support/picks';
import { AddDishProvider } from '../state/add-dish';
import { resetPickChanges, usePicksVersion } from '../state/pick-changes';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: 'pk1' }),
  useFocusEffect: (cb: () => void | (() => void)) => jest.requireActual('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyPicks: jest.fn(),
  searchTags: jest.fn(),
  updatePick: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../lib/pick-photo', () => ({ pickPhoto: jest.fn() }));
jest.mock('../lib/prepare-pick-photo', () => ({ preparePickPhoto: jest.fn() }));

const CLIENT = { fake: 'client' };
const PERSONAL = { id: 't9', kind: 'personal' as const, name: 'Rainy day', slug: 'rainy-day', featured: false };

function Version() {
  return <Text testID="version">{usePicksVersion()}</Text>;
}
async function show() {
  await render(
    <AddDishProvider>
      <EditPick />
      <Version />
    </AddDishProvider>,
  );
  await act(async () => {});
}
const save = () => screen.getByRole('button', { name: 'Save' });

describe('Edit pick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPickChanges();
    jest.mocked(getMyPicks).mockResolvedValue([
      makePick({
        note: 'Great broth.',
        photoUrl: 'https://x/p.jpg',
        tags: [RAMEN, PERSONAL],
      }),
    ]);
    jest.mocked(searchTags).mockImplementation(async (_c, kind) =>
      kind === 'food_type' ? [RAMEN] : kind === 'dietary' ? [VEGAN] : [PERSONAL],
    );
    jest.mocked(updatePick).mockResolvedValue(makePick());
  });

  it('shows the dish and restaurant read-only, with the helper copy', async () => {
    await show();
    expect(screen.getByText('Tonkotsu Ramen')).toBeOnTheScreen();
    expect(screen.getByText('Marutama Ramen · Bidwell St · Vancouver')).toBeOnTheScreen();
    expect(
      screen.getByText('To change the dish or restaurant, remove this pick and add it again.'),
    ).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText('e.g. Smash Burger')).toBeNull();
  });

  it('starts from the pick’s note and photo', async () => {
    await show();
    expect(screen.getByDisplayValue('Great broth.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Your photo')).toBeOnTheScreen();
  });

  it('saves only the note and tags when the photo is untouched', async () => {
    await show();
    await fireEvent.changeText(screen.getByLabelText('Note (optional)'), 'Even better.');
    await fireEvent.press(save());
    await act(async () => {});
    expect(updatePick).toHaveBeenCalledWith(CLIENT, 'pk1', {
      note: 'Even better.',
      tagIds: ['t1'],
      personalTags: ['Rainy day'],
    });
    expect(preparePickPhoto).not.toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalled();
    expect(screen.getByTestId('version')).toHaveTextContent('1');
  });

  it('clears the note when it is emptied', async () => {
    await show();
    await fireEvent.changeText(screen.getByLabelText('Note (optional)'), '  ');
    await fireEvent.press(save());
    await act(async () => {});
    expect(updatePick).toHaveBeenCalledWith(CLIENT, 'pk1', expect.objectContaining({ note: null }));
  });

  it('changes tags with the same picker as Add', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: /Add tags/ }));
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Vegan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ramen' }));
    await fireEvent.press(save());
    await act(async () => {});
    expect(updatePick).toHaveBeenCalledWith(
      CLIENT,
      'pk1',
      expect.objectContaining({ tagIds: ['t2'], personalTags: ['Rainy day'] }),
    );
  });

  it('opens tag search inside the edit flow from More', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: /Add tags/ }));
    await act(async () => {});
    await fireEvent.press(screen.getAllByRole('button', { name: 'More' })[0]!);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/pick/pk1/edit/tags-search',
      params: { kind: 'food_type' },
    });
  });

  it('uploads a newly chosen photo', async () => {
    const bytes = new ArrayBuffer(4);
    jest.mocked(pickPhoto).mockResolvedValue({ status: 'picked', uri: 'file:///new.jpg' });
    jest.mocked(preparePickPhoto).mockResolvedValue(bytes);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Photo' }));
    await act(async () =>
      alert.mock.calls[0]![2]?.find((b) => b.text === 'Choose from library')?.onPress?.(),
    );
    await fireEvent.press(save());
    await act(async () => {});
    expect(preparePickPhoto).toHaveBeenCalledWith('file:///new.jpg');
    expect(updatePick).toHaveBeenCalledWith(CLIENT, 'pk1', expect.objectContaining({ photo: bytes }));
    alert.mockRestore();
  });

  it('removes the photo when it is cleared', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Photo' }));
    await act(async () =>
      alert.mock.calls[0]![2]?.find((b) => b.text === 'Remove photo')?.onPress?.(),
    );
    await fireEvent.press(save());
    await act(async () => {});
    expect(updatePick).toHaveBeenCalledWith(CLIENT, 'pk1', expect.objectContaining({ photo: null }));
    alert.mockRestore();
  });

  it('stays, with friendly copy, when the new photo cannot be prepared', async () => {
    jest.mocked(pickPhoto).mockResolvedValue({ status: 'picked', uri: 'file:///bad.jpg' });
    jest.mocked(preparePickPhoto).mockRejectedValue(new Error('read failed'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Photo' }));
    await act(async () =>
      alert.mock.calls[0]![2]?.find((b) => b.text === 'Choose from library')?.onPress?.(),
    );
    await fireEvent.press(save());
    await act(async () => {});
    expect(screen.getByText('That photo didn’t work. Try another.')).toBeOnTheScreen();
    expect(updatePick).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('stays with friendly copy when saving fails, and can try again', async () => {
    jest.mocked(updatePick).mockRejectedValueOnce(new ApiError('gone', 'pick_not_found'));
    await show();
    await fireEvent.press(save());
    await act(async () => {});
    expect(screen.getByText('That pick isn’t there any more.')).toBeOnTheScreen();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
  });

  it('cannot be left or saved twice while saving', async () => {
    let finish: (p: ReturnType<typeof makePick>) => void = () => {};
    jest.mocked(updatePick).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await show();
    await fireEvent.press(save());
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await fireEvent.press(save());
    expect(updatePick).toHaveBeenCalledTimes(1);
    await act(async () => finish(makePick()));
  });

  it('says the pick is gone when it is not there', async () => {
    jest.mocked(getMyPicks).mockResolvedValue([]);
    await show();
    expect(screen.getByText('That pick isn’t there any more.')).toBeOnTheScreen();
  });

  it('goes back with the back arrow', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
