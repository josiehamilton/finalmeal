import { Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import AppLayout from '../../app/(app)/_layout';
import TabsLayout from '../../app/(app)/(tabs)/_layout';
import Feed from '../../app/(app)/(tabs)/feed';
import Discover from '../../app/(app)/(tabs)/discover';
import Add from '../../app/(app)/(tabs)/add';
import Saved from '../../app/(app)/(tabs)/saved';
import You from '../../app/(app)/(tabs)/you';
import Settings from '../../app/(app)/settings/index';
import EditProfile from '../../app/(app)/settings/edit-profile';
import Privacy from '../../app/(app)/settings/privacy';
import HomeCity from '../../app/(app)/settings/home-city';

function Welcome() {
  return <Text>WELCOME</Text>;
}

// The real layouts and screens, wired through the real router, to check the navigation
// structure: tabs, Settings pushed over them, and back.
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
let mockSignedIn = true;
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
  '(app)/(tabs)/add': Add,
  '(app)/(tabs)/saved': Saved,
  '(app)/(tabs)/you': You,
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
    expect(await screen.findByText('Coming soon.')).toBeOnTheScreen();
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
