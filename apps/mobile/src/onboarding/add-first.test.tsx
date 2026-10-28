import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { addPick, finishOnboarding, getMyPicks, searchTags, suggestDishes } from '@finalmeal/api';
import AddFirst from '../../app/(onboarding)/add-first';
import { PLACE, RAMEN, readDraft, withDraft } from '../test-support/add-dish';
import { resetPickChanges, getPicksVersion } from '../state/pick-changes';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
const mockSetOptions = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({
    setOptions: mockSetOptions,
    getParent: () => ({ setOptions: mockSetOptions }),
  }),
  useFocusEffect: (cb: () => void | (() => void)) =>
    jest.requireActual('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  addPick: jest.fn(),
  finishOnboarding: jest.fn(),
  getMyPicks: jest.fn(),
  searchTags: jest.fn(),
  suggestDishes: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../lib/pick-photo', () => ({ pickPhoto: jest.fn() }));
jest.mock('../lib/prepare-pick-photo', () => ({ preparePickPhoto: jest.fn() }));

const mockAddPick = jest.mocked(addPick);
const mockFinish = jest.mocked(finishOnboarding);
const CLIENT = { fake: 'client' };
const READY = { place: PLACE, dishName: 'Pork Gyro' };
const lockIt = () => screen.getByRole('button', { name: 'Lock it in' });
const settle = () => act(async () => {});

describe('Your first pick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPickChanges();
    jest.mocked(getMyPicks).mockResolvedValue([]);
    jest.mocked(suggestDishes).mockResolvedValue([]);
    jest.mocked(searchTags).mockResolvedValue([RAMEN]);
    mockAddPick.mockResolvedValue({ pick: {} as never, photoFailed: false });
    mockFinish.mockResolvedValue({} as never);
  });

  it('shows the canvas copy: header, #1 of 5, labels and the Lock it in button', async () => {
    await render(withDraft(<AddFirst />));
    await settle();
    expect(screen.getByText('Your first pick')).toBeOnTheScreen();
    expect(screen.getByText('#1 of 5')).toBeOnTheScreen();
    expect(screen.getByText('Add a photo (optional)')).toBeOnTheScreen();
    expect(screen.getByText('Tags (optional)')).toBeOnTheScreen();
    expect(screen.getByText('Why this one? (optional)')).toBeOnTheScreen();
    expect(screen.getByText('Choose a restaurant')).toBeOnTheScreen();
    expect(lockIt()).toBeOnTheScreen();
  });

  it('is locked to Final Meal: no tier choice and no swap', async () => {
    await render(withDraft(<AddFirst />));
    await settle();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText('Honorable')).toBeNull();
    expect(screen.queryByText('Add to')).toBeNull();
    expect(readDraft(screen).tier).toBe('final');
  });

  it('keeps Lock it in off until a restaurant and a dish are set', async () => {
    await render(withDraft(<AddFirst />));
    await settle();
    expect(lockIt()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Dish'), 'Pork Gyro');
    expect(lockIt()).toBeDisabled();
  });

  it('opens the onboarding restaurant search and tag search, not the Add modal’s', async () => {
    await render(withDraft(<AddFirst />, READY));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: /Restaurant/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/add-first/place');
  });

  it('saves a Final Meal pick, then finishes onboarding, then shows the loading screen', async () => {
    const order: string[] = [];
    mockAddPick.mockImplementation(async () => {
      order.push('save');
      return { pick: {} as never, photoFailed: false };
    });
    mockFinish.mockImplementation(async () => {
      order.push('finish');
      return {} as never;
    });
    await render(withDraft(<AddFirst />, { ...READY, note: 'Delicious. I’d fly back for it.' }));
    await settle();
    await fireEvent.press(lockIt());
    await settle();
    expect(mockAddPick).toHaveBeenCalledWith(
      CLIENT,
      expect.objectContaining({
        placeId: 'p1',
        dishName: 'Pork Gyro',
        tier: 'final',
        note: 'Delicious. I’d fly back for it.',
      }),
    );
    expect(mockFinish).toHaveBeenCalledWith(CLIENT);
    expect(order).toEqual(['save', 'finish']);
    expect(mockRouter.replace).toHaveBeenCalledWith('/loading');
    expect(getPicksVersion()).toBe(1);
  });

  it('does not finish onboarding when the pick fails to save, and shows the friendly copy', async () => {
    mockAddPick.mockRejectedValueOnce(new TypeError('Network request failed'));
    await render(withDraft(<AddFirst />, READY));
    await settle();
    await fireEvent.press(lockIt());
    await settle();
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(mockFinish).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(lockIt()).toBeEnabled();
  });

  it('retries only the finish after the pick saved but finishing failed (no duplicate pick)', async () => {
    mockFinish.mockRejectedValueOnce(new TypeError('Network request failed'));
    await render(withDraft(<AddFirst />, READY));
    await settle();
    await fireEvent.press(lockIt());
    await settle();
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(lockIt()).toBeEnabled();
    await fireEvent.press(lockIt());
    await settle();
    expect(mockAddPick).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledTimes(2);
    expect(mockRouter.replace).toHaveBeenCalledWith('/loading');
  });

  it('goes back to the intro', async () => {
    await render(withDraft(<AddFirst />));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
