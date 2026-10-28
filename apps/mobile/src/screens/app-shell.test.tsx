import { Text } from 'react-native';
import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
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
    expect(await screen.findByText('Your table is set.')).toBeOnTheScreen();
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

  it('sends a signed-out person to Welcome', async () => {
    mockSignedIn = false;
    await renderRouter(routes(), { initialUrl: '/(app)/you' });
    expect(await screen.findByText('WELCOME')).toBeOnTheScreen();
  });
});
