import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getProfile, listFollowers, listFollowing } from '@finalmeal/api';
import Follows from '../../app/(app)/u/[id]/follows';
import { makeProfile } from '../test-support/profile';
import { makeAlli, makePerson } from '../test-support/people';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() };
let mockParams: Record<string, string> = { id: 'u1', tab: 'followers' };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getProfile: jest.fn(),
  listFollowers: jest.fn(),
  listFollowing: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockProfile = makeProfile({ id: 'u1' });
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ session: {}, profile: mockProfile, loading: false, error: null }),
}));
const mockGetProfile = jest.mocked(getProfile);
const mockFollowers = jest.mocked(listFollowers);
const mockFollowing = jest.mocked(listFollowing);
const client = { fake: 'client' };

const josie = () =>
  makeAlli({
    id: 'u1',
    username: 'josiehamilton',
    displayName: 'Josie Hamilton',
    counts: { followers: 14, following: 62, dishes: 17 },
    isMe: true,
  });

function people(n: number, prefix = 'p') {
  return Array.from({ length: n }, (_, i) =>
    makePerson({
      id: `${prefix}${i + 1}`,
      username: `${prefix}${i + 1}`,
      displayName: `Person ${prefix}${i + 1}`,
    }),
  );
}

describe('Followers and following', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockParams = { id: 'u1', tab: 'followers' };
    mockGetProfile.mockResolvedValue(josie());
    mockFollowers.mockResolvedValue([
      makePerson({
        id: 'u4',
        username: 'allimercer',
        displayName: 'Alli Mercer',
        followsViewer: true,
      }),
      makePerson({
        id: 'u3',
        username: 'arimitchell',
        displayName: 'Ari Mitchell',
        viewerFollow: 'active',
        followsViewer: true,
      }),
    ]);
    mockFollowing.mockResolvedValue([
      makePerson({
        id: 'u2',
        username: 'mikebrennan',
        displayName: 'Mike Brennan',
        viewerFollow: 'active',
      }),
    ]);
  });
  afterEach(() => jest.useRealTimers());

  it('shows the handle, the two tabs with their counts, and the followers', async () => {
    await render(<Follows />);
    expect(await screen.findByText('Alli Mercer')).toBeOnTheScreen();
    expect(mockGetProfile).toHaveBeenCalledWith(client, 'u1');
    expect(screen.getByText('@josiehamilton')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '14 Followers' })).toBeSelected();
    expect(screen.getByRole('tab', { name: '62 Following' })).toBeOnTheScreen();
    expect(mockFollowers).toHaveBeenCalledWith(client, 'u1', {
      q: undefined,
      offset: 0,
      limit: 20,
    });
    expect(screen.getByText('@allimercer')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Follow back' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Following' })).toBeOnTheScreen();
    expect(mockFollowing).not.toHaveBeenCalled();
  });

  it('starts on Following when asked to', async () => {
    mockParams = { id: 'u1', tab: 'following' };
    await render(<Follows />);
    expect(await screen.findByText('Mike Brennan')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: '62 Following' })).toBeSelected();
    expect(mockFollowing).toHaveBeenCalledWith(client, 'u1', {
      q: undefined,
      offset: 0,
      limit: 20,
    });
    expect(mockFollowers).not.toHaveBeenCalled();
  });

  it('switches tabs', async () => {
    await render(<Follows />);
    await screen.findByText('Alli Mercer');
    await fireEvent.press(screen.getByRole('tab', { name: '62 Following' }));
    expect(await screen.findByText('Mike Brennan')).toBeOnTheScreen();
    expect(screen.queryByText('Alli Mercer')).toBeNull();
    expect(screen.getByRole('tab', { name: '62 Following' })).toBeSelected();
  });

  it('searches after a pause, with the typed text, and says when no one matches', async () => {
    await render(<Follows />);
    await screen.findByText('Alli Mercer');
    mockFollowers.mockResolvedValue([]);
    await fireEvent.changeText(screen.getByLabelText('Search followers'), 'zz');
    expect(mockFollowers).toHaveBeenCalledTimes(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    expect(mockFollowers).toHaveBeenLastCalledWith(client, 'u1', { q: 'zz', offset: 0, limit: 20 });
    expect(await screen.findByText('No one matches “zz”.')).toBeOnTheScreen();
  });

  it('searches the following list with its own placeholder', async () => {
    mockParams = { id: 'u1', tab: 'following' };
    await render(<Follows />);
    await screen.findByText('Mike Brennan');
    await fireEvent.changeText(screen.getByLabelText('Search following'), 'mi');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    expect(mockFollowing).toHaveBeenLastCalledWith(client, 'u1', { q: 'mi', offset: 0, limit: 20 });
  });

  it('has empty copy for each list', async () => {
    mockFollowers.mockResolvedValue([]);
    mockFollowing.mockResolvedValue([]);
    await render(<Follows />);
    expect(await screen.findByText('No followers yet.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: '62 Following' }));
    expect(await screen.findByText('Not following anyone yet.')).toBeOnTheScreen();
  });

  it('loads the next 20 at the end of the list, and stops after a short page', async () => {
    mockFollowers.mockResolvedValueOnce(people(20)).mockResolvedValueOnce(people(3, 'q'));
    await render(<Follows />);
    await screen.findByText('Person p1');
    await fireEvent(screen.getByTestId('people-list'), 'endReached');
    await act(async () => {});
    expect(mockFollowers).toHaveBeenLastCalledWith(client, 'u1', {
      q: undefined,
      offset: 20,
      limit: 20,
    });
    await fireEvent(screen.getByTestId('people-list'), 'endReached');
    await act(async () => {});
    expect(mockFollowers).toHaveBeenCalledTimes(2);
  });

  it('opens a person from their row', async () => {
    await render(<Follows />);
    await fireEvent.press(await screen.findByText('Alli Mercer'));
    expect(mockRouter.push).toHaveBeenCalledWith('/u/u4');
  });

  it('goes back', async () => {
    await render(<Follows />);
    await screen.findByText('Alli Mercer');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('says the profile is not available when it is hidden', async () => {
    mockGetProfile.mockResolvedValue(null);
    await render(<Follows />);
    expect(await screen.findByText('This profile isn’t available.')).toBeOnTheScreen();
    expect(mockFollowers).not.toHaveBeenCalled();
  });

  it('shows friendly copy and Try again when the list cannot load', async () => {
    mockFollowers.mockRejectedValueOnce(new Error('boom'));
    await render(<Follows />);
    expect(await screen.findByText('Something went wrong. Try again.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alli Mercer')).toBeOnTheScreen();
  });

  it('hides Follow on your own row', async () => {
    mockFollowers.mockResolvedValue([
      makePerson({
        id: 'u1',
        username: 'josiehamilton',
        displayName: 'Josie Hamilton',
        isMe: true,
      }),
    ]);
    await render(<Follows />);
    expect(await screen.findByText('Josie Hamilton')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
  });
});
