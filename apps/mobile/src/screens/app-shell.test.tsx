import { Pressable, Text } from 'react-native';
import { act } from '@testing-library/react-native';
import { router, useLocalSearchParams, useRouter } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import AppLayout from '../../app/(app)/_layout';
import TabsLayout from '../../app/(app)/(tabs)/_layout';
import Feed from '../../app/(app)/(tabs)/feed';
import Discover from '../../app/(app)/(tabs)/discover';
import Saved from '../../app/(app)/(tabs)/saved';
import You from '../../app/(app)/(tabs)/you';
import Settings from '../../app/(app)/settings/index';
import EditProfile from '../../app/(app)/settings/edit-profile';
import Privacy from '../../app/(app)/settings/privacy';
import HomeCity from '../../app/(app)/settings/home-city';
import AddLayout from '../../app/(app)/add/_layout';
import AddDish from '../../app/(app)/add/index';
import { closeAddFlow } from '../state/add-flow-base';
import { clearJustOnboarded, markJustOnboarded } from '../state/landing';

function Welcome() {
  return <Text>WELCOME</Text>;
}

// The real layouts and screens, wired through the real router, to check the navigation
// structure: tabs, Settings pushed over them, and back.
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
let mockSignedIn = true;
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyPicks: jest.fn().mockResolvedValue([]),
  searchTags: jest.fn().mockResolvedValue([]),
  suggestDishes: jest.fn().mockResolvedValue([]),
  getFollowingFeed: jest.fn().mockResolvedValue({ items: [], next: null }),
  getNearbyFeed: jest.fn().mockResolvedValue({ items: [], nextOffset: null }),
  getPlacePickers: jest.fn().mockResolvedValue({ otherCount: 0, people: [] }),
  getSuggestedPeople: jest.fn().mockResolvedValue([]),
  getUnreadCount: jest.fn().mockResolvedValue(0),
  subscribeToMyNotifications: jest.fn(() => () => {}),
}));
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: mockSignedIn ? {} : null,
    profile: mockSignedIn ? jest.requireActual('../test-support/profile').makeProfile() : null,
    loading: false,
    error: null,
    refreshProfile: jest.fn().mockResolvedValue(null),
  }),
}));

/** Stands in for the Add form: saving is "Finish", which closes the way the real form does. */
function FakeAdd() {
  const addRouter = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Finish" onPress={() => closeAddFlow(addRouter, from)}>
      <Text>{`FAKE ADD from ${from ?? 'nowhere'}`}</Text>
    </Pressable>
  );
}

const routes = () => ({
  index: () => null,
  welcome: Welcome,
  '(app)/_layout': AppLayout,
  '(app)/(tabs)/_layout': TabsLayout,
  '(app)/(tabs)/feed': Feed,
  '(app)/(tabs)/discover': Discover,
  '(app)/(tabs)/saved': Saved,
  '(app)/(tabs)/you': You,
  '(app)/add/_layout': AddLayout,
  '(app)/add/index': AddDish,
  '(app)/settings/index': Settings,
  '(app)/settings/edit-profile': EditProfile,
  '(app)/settings/privacy': Privacy,
  '(app)/settings/home-city': HomeCity,
});

describe('app shell navigation', () => {
  beforeEach(() => {
    mockSignedIn = true;
    clearJustOnboarded();
  });

  it('opens on You, with the tab bar', async () => {
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    expect(await screen.findByText('@josiehamilton')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add a dish' })).toBeOnTheScreen();
  });

  it('switches tabs from the tab bar', async () => {
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    await screen.findByText('@josiehamilton');
    await fireEvent.press(screen.getByRole('button', { name: 'Feed' }));
    expect(await screen.findByText('Nothing new yet.')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Following' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'You' }));
    expect(await screen.findByText('@josiehamilton')).toBeOnTheScreen();
  });

  it('pushes Settings over the tabs (no tab bar), and back returns to You', async () => {
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('Log out')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-screen')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add a dish' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('@josiehamilton')).toBeOnTheScreen();
    expect(screen.queryByText('Log out')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a dish' })).toBeOnTheScreen();
  });

  it('opens Add a dish as a modal over the tabs from the + button, and closing returns to You', async () => {
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    await screen.findByText('@josiehamilton');
    await fireEvent.press(screen.getByRole('button', { name: 'Add a dish' }));
    expect(await screen.findByPlaceholderText('e.g. Smash Burger')).toBeOnTheScreen();
    expect(screen.getByText('Choose a restaurant')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('@josiehamilton')).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText('e.g. Smash Burger')).toBeNull();
  });

  it('opens Add a dish on the tier named in the route param, through the real router', async () => {
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    await screen.findByText('@josiehamilton');
    await act(async () => router.navigate({ pathname: '/add', params: { tier: 'honorable' } }));
    expect(await screen.findByRole('button', { name: 'Add to Honorable' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('@josiehamilton')).toBeOnTheScreen();
    // Opened again with Final Meal, the tier is Final Meal: nothing is left over from before.
    await act(async () => router.navigate({ pathname: '/add', params: { tier: 'final' } }));
    expect(await screen.findByRole('button', { name: 'Add to Final Meal' })).toBeOnTheScreen();
  });

  it('opens Add a dish with Final Meal chosen from an empty seat on You', async () => {
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a dish, seat 1' }));
    expect(await screen.findByRole('button', { name: 'Add to Final Meal' })).toBeOnTheScreen();
  });

  it('does not stack two Add modals when + is tapped twice quickly', async () => {
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    await screen.findByText('@josiehamilton');
    const plus = screen.getByRole('button', { name: 'Add a dish' });
    await fireEvent.press(plus);
    await fireEvent.press(plus);
    expect(await screen.findByPlaceholderText('e.g. Smash Burger')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('@josiehamilton')).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText('e.g. Smash Burger')).toBeNull();
  });

  it('opens Edit profile from You and returns to You', async () => {
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));
    expect(await screen.findByLabelText('Username')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('@josiehamilton')).toBeOnTheScreen();
  });

  describe('First landing', () => {
    it('shows First landing on Feed right after onboarding, and the feed after a tab switch', async () => {
      markJustOnboarded();
      await renderRouter(routes(), { initialUrl: '/(app)/feed' });
      expect(await screen.findByText('Your table is set.')).toBeOnTheScreen();
      expect(screen.queryByRole('tab', { name: 'Following' })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Saved' }));
      await fireEvent.press(await screen.findByRole('button', { name: 'Feed' }));
      expect(await screen.findByRole('tab', { name: 'Following' })).toBeSelected();
      expect(screen.queryByText('Your table is set.')).toBeNull();
    });

    it('stays on First landing when Add is opened and closed', async () => {
      markJustOnboarded();
      await renderRouter(routes(), { initialUrl: '/(app)/feed' });
      await screen.findByText('Your table is set.');
      await fireEvent.press(screen.getByRole('button', { name: 'Add a dish' }));
      await screen.findByPlaceholderText('e.g. Smash Burger');
      await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
      expect(await screen.findByText('Your table is set.')).toBeOnTheScreen();
    });
  });

  describe('Add returns to where it opened', () => {
    const withFakeAdd = () => ({ ...routes(), '(app)/add/index': FakeAdd });

    it('from First landing’s button, back to First landing', async () => {
      markJustOnboarded();
      await renderRouter(withFakeAdd(), { initialUrl: '/(app)/feed' });
      await fireEvent.press(await screen.findByRole('button', { name: 'Add your first dish' }));
      expect(await screen.findByText('FAKE ADD from /feed')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Finish' }));
      expect(await screen.findByText('Your table is set.')).toBeOnTheScreen();
      expect(screen.queryByText(/FAKE ADD/)).toBeNull();
    });

    it('from the tab bar on the Feed tab, back to the feed', async () => {
      await renderRouter(withFakeAdd(), { initialUrl: '/(app)/feed' });
      await screen.findByText('Nothing new yet.');
      await fireEvent.press(screen.getByRole('button', { name: 'Add a dish' }));
      expect(await screen.findByText('FAKE ADD from /feed')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Finish' }));
      expect(await screen.findByText('Nothing new yet.')).toBeOnTheScreen();
    });

    it('from You’s empty seat, back to You', async () => {
      await renderRouter(withFakeAdd(), { initialUrl: '/(app)/you' });
      await fireEvent.press(await screen.findByRole('button', { name: 'Add a dish, seat 1' }));
      expect(await screen.findByText('FAKE ADD from /you')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Finish' }));
      expect(await screen.findByText('@josiehamilton')).toBeOnTheScreen();
    });

    it('goes to You when it was opened with no from', async () => {
      await renderRouter(withFakeAdd(), { initialUrl: '/(app)/feed' });
      await screen.findByText('Nothing new yet.');
      await act(async () => router.navigate('/add'));
      expect(await screen.findByText('FAKE ADD from nowhere')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Finish' }));
      expect(await screen.findByText('@josiehamilton')).toBeOnTheScreen();
    });
  });

  it('sends a signed-out person to Welcome', async () => {
    mockSignedIn = false;
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    expect(await screen.findByText('WELCOME')).toBeOnTheScreen();
  });
});
