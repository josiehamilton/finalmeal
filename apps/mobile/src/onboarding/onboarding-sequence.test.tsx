import { Text } from 'react-native';
import { act } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { addPick, finishOnboarding, getMyPicks, getPopularPlaces, getCity } from '@finalmeal/api';
import AppLayout from '../../app/(app)/_layout';
import TabsLayout from '../../app/(app)/(tabs)/_layout';
import Feed from '../../app/(app)/(tabs)/feed';
import Discover from '../../app/(app)/(tabs)/discover';
import Saved from '../../app/(app)/(tabs)/saved';
import You from '../../app/(app)/(tabs)/you';
import OnboardingLayout from '../../app/(onboarding)/_layout';
import Photo from '../../app/(onboarding)/photo';
import FirstPick from '../../app/(onboarding)/first-pick';
import Loading from '../../app/(onboarding)/loading';
import AddFirstLayout from '../../app/(onboarding)/add-first/_layout';
import AddFirst from '../../app/(onboarding)/add-first/index';
import AddFirstPlace from '../../app/(onboarding)/add-first/place';
import { makeFinals } from '../test-support/picks';
import { PLACE } from '../test-support/add-dish';

// The real onboarding screens wired through the real router, from the photo step to First landing.
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  addPick: jest.fn(),
  finishOnboarding: jest.fn(),
  getCity: jest.fn(),
  getMyPicks: jest.fn(),
  getPopularPlaces: jest.fn(),
  searchPlaces: jest.fn().mockResolvedValue([]),
  searchTags: jest.fn().mockResolvedValue([]),
  suggestDishes: jest.fn().mockResolvedValue([]),
}));
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: jest.requireActual('../test-support/profile').makeProfile({ onboarded: false }),
    loading: false,
    error: null,
    refreshProfile: jest.fn().mockResolvedValue(null),
  }),
}));

function Welcome() {
  return <Text>WELCOME</Text>;
}

const routes = () => ({
  index: () => null,
  welcome: Welcome,
  '(onboarding)/_layout': OnboardingLayout,
  '(onboarding)/photo': Photo,
  '(onboarding)/first-pick': FirstPick,
  '(onboarding)/loading': Loading,
  '(onboarding)/add-first/_layout': AddFirstLayout,
  '(onboarding)/add-first/index': AddFirst,
  '(onboarding)/add-first/place': AddFirstPlace,
  '(app)/_layout': AppLayout,
  '(app)/(tabs)/_layout': TabsLayout,
  '(app)/(tabs)/feed': Feed,
  '(app)/(tabs)/discover': Discover,
  '(app)/(tabs)/saved': Saved,
  '(app)/(tabs)/you': You,
});

async function waitForLoading() {
  expect(await screen.findByText('Setting your table…')).toBeOnTheScreen();
  await act(async () => {
    jest.advanceTimersByTime(1300);
  });
}

describe('onboarding from the photo step to First landing', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.clearAllMocks();
    jest.mocked(finishOnboarding).mockResolvedValue({} as never);
    jest.mocked(getMyPicks).mockResolvedValue([]);
    jest.mocked(getCity).mockResolvedValue(null);
    jest.mocked(getPopularPlaces).mockResolvedValue([PLACE]);
    jest.mocked(addPick).mockResolvedValue({ pick: {} as never, photoFailed: false });
  });
  afterEach(() => jest.useRealTimers());

  it('photo → first pick → Skip for now → loading → First landing with the table set', async () => {
    await renderRouter(routes(), { initialUrl: '/photo' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('Now for the hard part.')).toBeOnTheScreen();
    expect(finishOnboarding).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    await waitForLoading();
    expect(finishOnboarding).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Your table is set.')).toBeOnTheScreen();
    expect(screen.getByText('Welcome, Josie')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add your first dish' })).toBeOnTheScreen();
  });

  it('photo → first pick → Add → add-first → Lock it in → loading → First landing with the pick', async () => {
    await renderRouter(routes(), { initialUrl: '/photo' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Add my first pick' }));
    expect(await screen.findByText('Your first pick')).toBeOnTheScreen();
    expect(screen.getByText('#1 of 5')).toBeOnTheScreen();

    // Choose a restaurant through the onboarding stack's own search screen, and come back.
    await fireEvent.press(screen.getByRole('button', { name: /Restaurant/ }));
    await fireEvent.press(await screen.findByText('Marutama Ramen'));
    expect(await screen.findByText('Your first pick')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Dish'), 'Pork Gyro');
    await fireEvent.press(screen.getByRole('button', { name: 'Lock it in' }));
    await act(async () => {});

    expect(addPick).toHaveBeenCalledWith(
      { fake: 'client' },
      expect.objectContaining({ placeId: 'p1', dishName: 'Pork Gyro', tier: 'final' }),
    );
    expect(finishOnboarding).toHaveBeenCalledTimes(1);
    jest.mocked(getMyPicks).mockResolvedValue(makeFinals(1));
    await waitForLoading();
    expect(await screen.findByText('Your Final Meal has begun.')).toBeOnTheScreen();
    expect(screen.getByText('Final Meal · #1')).toBeOnTheScreen();
    expect(screen.getByText('4 seats left')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add your next dish' })).toBeOnTheScreen();
  });

  it('Back from the form returns to the intro without finishing onboarding', async () => {
    await renderRouter(routes(), { initialUrl: '/first-pick' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add my first pick' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Now for the hard part.')).toBeOnTheScreen();
    expect(finishOnboarding).not.toHaveBeenCalled();
  });
});
