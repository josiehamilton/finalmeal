import { fireEvent, render, screen } from '@testing-library/react-native';
import You from '../../app/(app)/(tabs)/you';
import { makeProfile } from '../test-support/profile';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const mockRefresh = jest.fn();
let mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: mockProfile,
    loading: false,
    error: null,
    refreshProfile: mockRefresh,
  }),
}));

describe('You tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefresh.mockResolvedValue(null);
    mockProfile = makeProfile();
  });

  it('shows the profile: name, handle, bio, city and stats', async () => {
    await render(<You />);
    expect(screen.getByText('@josiehamilton')).toBeOnTheScreen();
    expect(screen.getByText('Josie Hamilton')).toBeOnTheScreen();
    expect(screen.getByText('Chasing the perfect meal.')).toBeOnTheScreen();
    expect(screen.getByText('Vancouver, BC, Canada')).toBeOnTheScreen();
    expect(screen.getByText('0 followers')).toBeOnTheScreen();
    expect(screen.getByText('1 following')).toBeOnTheScreen();
    expect(screen.getByText('0 dishes')).toBeOnTheScreen();
  });

  it('uses singular follower and dish at 1', async () => {
    mockProfile = makeProfile({ counts: { followers: 1, following: 1, dishes: 1 } });
    await render(<You />);
    expect(screen.getByText('1 follower')).toBeOnTheScreen();
    expect(screen.getByText('1 dish')).toBeOnTheScreen();
  });

  it('hides the home city when showHomeCity is false, or when none is set', async () => {
    mockProfile = makeProfile({ showHomeCity: false });
    const view = await render(<You />);
    expect(screen.queryByText('Vancouver, BC, Canada')).toBeNull();
    await view.unmount();
    mockProfile = makeProfile({ homeCity: null });
    await render(<You />);
    expect(screen.queryByTestId('home-city')).toBeNull();
  });

  it('shows initials when there is no photo, and no bio line without a bio', async () => {
    mockProfile = makeProfile({ bio: null });
    await render(<You />);
    expect(screen.getByText('JH')).toBeOnTheScreen();
    expect(screen.queryByText('Chasing the perfect meal.')).toBeNull();
  });

  it('shows five numbered seats, with the first-pick caption on seat 1', async () => {
    await render(<You />);
    for (const n of [1, 2, 3, 4, 5]) expect(screen.getByTestId(`seat-${n}`)).toBeOnTheScreen();
    expect(screen.getByText('Your first pick goes here.')).toBeOnTheScreen();
    expect(screen.getByText('Adding dishes arrives in the next build.')).toBeOnTheScreen();
  });

  it('has no filter chips and no Share a list yet', async () => {
    await render(<You />);
    expect(screen.queryByText('Share a list')).toBeNull();
    expect(screen.queryByTestId('filter-chips')).toBeNull();
  });

  it('switches between Final Meal, Honorable and Map', async () => {
    await render(<You />);
    expect(screen.getByRole('tab', { name: 'Final Meal' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Honorable' }));
    expect(screen.getByText('No honorable mentions yet.')).toBeOnTheScreen();
    expect(screen.queryByTestId('seat-1')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Map' }));
    expect(screen.getByText('Your map fills in as you add dishes.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Final Meal' }));
    expect(screen.getByTestId('seat-1')).toBeOnTheScreen();
  });

  it('opens Settings and Edit profile', async () => {
    await render(<You />);
    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/edit-profile');
  });

  it('pull to refresh reloads the profile', async () => {
    await render(<You />);
    const refresh = screen.getByTestId('you-scroll').props.refreshControl.props.onRefresh;
    await refresh();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows friendly copy when the refresh fails', async () => {
    mockRefresh.mockRejectedValue(new TypeError('Network request failed'));
    await render(<You />);
    await screen.getByTestId('you-scroll').props.refreshControl.props.onRefresh();
    expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
  });
});
