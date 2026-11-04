import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { AlertButton } from 'react-native';
import { followUser, getMyPicks, getProfile, getProfilePicks, unfollowUser } from '@finalmeal/api';
import type { Pick } from '@finalmeal/api';
import OtherProfile from '../../app/(app)/u/[id]';
import { makeProfile } from '../test-support/profile';
import { makeAlli } from '../test-support/people';
import { makePick } from '../test-support/picks';
import { SEED_PLACES } from '../test-support/seed-picks';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() };
const mockRedirect = jest.fn();
let mockParams: Record<string, string> = { id: 'u4' };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getProfile: jest.fn(),
  getProfilePicks: jest.fn(),
  getMyPicks: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockProfile = makeProfile({ id: 'u1' });
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ session: {}, profile: mockProfile, loading: false, error: null }),
}));
const mockGetProfile = jest.mocked(getProfile);
const mockGetProfilePicks = jest.mocked(getProfilePicks);
const mockGetMyPicks = jest.mocked(getMyPicks);
const mockFollow = jest.mocked(followUser);
const mockUnfollow = jest.mocked(unfollowUser);

const food = (name: string) => ({
  id: `t-${name}`,
  kind: 'food_type' as const,
  name,
  slug: name.toLowerCase(),
  featured: false,
});

/** Alli's picks as the seed has them: three finals and Butter Chicken. */
function alliPicks(): Pick[] {
  return [
    makePick({
      id: 'a1',
      slot: 1,
      dish: { id: 'd-biryani', name: 'Plain Biryani' },
      place: SEED_PLACES.spicyTime,
      tags: [food('Indian')],
    }),
    makePick({
      id: 'a2',
      slot: 2,
      dish: { id: 'd-khao', name: 'Khao Soi' },
      place: SEED_PLACES.kinKao,
      tags: [food('Thai')],
    }),
    makePick({
      id: 'a3',
      slot: 3,
      dish: { id: 'd-tacos', name: 'Tacos Al Pastor' },
      place: SEED_PLACES.callejon,
      tags: [food('Tacos')],
    }),
    makePick({
      id: 'a4',
      tier: 'honorable',
      slot: null,
      dish: { id: 'd-butter', name: 'Butter Chicken' },
      place: SEED_PLACES.spicyTime,
      tags: [food('Indian')],
    }),
  ];
}

describe('Other profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockParams = { id: 'u4' };
    mockGetProfile.mockResolvedValue(makeAlli());
    mockGetProfilePicks.mockResolvedValue(alliPicks());
    mockGetMyPicks.mockResolvedValue([]);
    mockFollow.mockResolvedValue('active');
    mockUnfollow.mockResolvedValue(undefined);
  });

  it('shows Alli: name, city and bio, stats, tabs, chips and her finals', async () => {
    await render(<OtherProfile />);
    expect(await screen.findByText('Alli Mercer')).toBeOnTheScreen();
    expect(mockGetProfile).toHaveBeenCalledWith({ fake: 'client' }, 'u4');
    expect(screen.getByText('@allimercer')).toBeOnTheScreen();
    expect(screen.getByText('Saskatoon, SK · Spice level: nuclear.')).toBeOnTheScreen();
    expect(screen.getByText('567 followers')).toBeOnTheScreen();
    expect(screen.getByText('203 following')).toBeOnTheScreen();
    expect(screen.getByText('4 dishes')).toBeOnTheScreen();
    expect(await screen.findByRole('tab', { name: 'Final Meal 3' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Honorable 1' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Saskatoon' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Indian' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mexico City' })).toBeOnTheScreen();
    expect(screen.getByText('Plain Biryani')).toBeOnTheScreen();
    expect(screen.getByText('Khao Soi')).toBeOnTheScreen();
    expect(mockGetProfilePicks).toHaveBeenCalledWith({ fake: 'client' }, 'u4');
  });

  it('has no empty seats, no Map tab, no Share and no More options before their phases', async () => {
    await render(<OtherProfile />);
    await screen.findByText('Plain Biryani');
    expect(screen.queryByText('Add a dish')).toBeNull();
    expect(screen.queryByTestId('seat-4')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Map' })).toBeNull();
    expect(screen.queryByText('Share')).toBeNull();
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
  });

  it('leaves out whichever of the city and bio is missing', async () => {
    mockGetProfile.mockResolvedValue(makeAlli({ homeCity: null }));
    const view = await render(<OtherProfile />);
    expect(await screen.findByText('Spice level: nuclear.')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-city')).toBeNull();
    await view.unmount();
    mockGetProfile.mockResolvedValue(makeAlli({ bio: null, homeCity: null }));
    await render(<OtherProfile />);
    await screen.findByText('Alli Mercer');
    expect(screen.queryByText(/Spice level/)).toBeNull();
    expect(screen.queryByTestId('home-city')).toBeNull();
  });

  it('hides the dish count when it is null', async () => {
    mockGetProfile.mockResolvedValue(
      makeAlli({ counts: { followers: 1, following: 2, dishes: null } }),
    );
    await render(<OtherProfile />);
    await screen.findByText('1 follower');
    expect(screen.queryByText(/dishes?$/)).toBeNull();
  });

  it('follows with one tap: Following at once, one more follower', async () => {
    await render(<OtherProfile />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Follow' }));
    expect(await screen.findByRole('button', { name: 'Following' })).toBeOnTheScreen();
    expect(mockFollow).toHaveBeenCalledWith({ fake: 'client' }, 'u4');
    expect(screen.getByText('568 followers')).toBeOnTheScreen();
  });

  it('says Follow back when Alli follows you', async () => {
    mockGetProfile.mockResolvedValue(makeAlli({ followsViewer: true }));
    await render(<OtherProfile />);
    expect(await screen.findByRole('button', { name: 'Follow back' })).toBeOnTheScreen();
  });

  it('asks before unfollowing', async () => {
    mockGetProfile.mockResolvedValue(makeAlli({ viewerFollow: 'active' }));
    const alert = jest.spyOn(Alert, 'alert');
    await render(<OtherProfile />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Following' }));
    expect(alert.mock.calls[0]?.[0]).toBe('Unfollow @allimercer?');
    expect(mockUnfollow).not.toHaveBeenCalled();
    const buttons: AlertButton[] = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => {
      buttons[1]?.onPress?.();
    });
    expect(mockUnfollow).toHaveBeenCalledWith({ fake: 'client' }, 'u4');
    expect(await screen.findByRole('button', { name: 'Follow' })).toBeOnTheScreen();
    expect(screen.getByText('566 followers')).toBeOnTheScreen();
  });

  it('opens the follower and following lists from the stats', async () => {
    await render(<OtherProfile />);
    await fireEvent.press(await screen.findByText('567 followers'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/u/u4/follows?tab=followers');
    await fireEvent.press(screen.getByText('203 following'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/u/u4/follows?tab=following');
  });

  it('filters by a chip and opens a pick', async () => {
    await render(<OtherProfile />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Mexico City' }));
    expect(screen.getByRole('tab', { name: 'Final Meal 1' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^3\. Tacos Al Pastor/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/pick/a3');
  });

  it('shows the honorable mentions and opens one', async () => {
    await render(<OtherProfile />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Honorable 1' }));
    expect(screen.queryByText('Plain Biryani')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Butter Chicken, Honorable/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/pick/a4');
  });

  describe('shared taste', () => {
    it('says what you both love', async () => {
      mockGetMyPicks.mockResolvedValue([
        makePick({ id: 'm1', dish: { id: 'd-biryani', name: 'Plain Biryani' } }),
        makePick({
          id: 'm2',
          tier: 'honorable',
          slot: null,
          dish: { id: 'd-khao', name: 'Khao Soi' },
        }),
      ]);
      await render(<OtherProfile />);
      expect(await screen.findByText('You both love Plain Biryani + 1 more')).toBeOnTheScreen();
    });

    it('is not there when nothing is shared', async () => {
      await render(<OtherProfile />);
      await screen.findByText('Plain Biryani');
      expect(screen.queryByText(/You both love/)).toBeNull();
    });
  });

  describe('a private account you are not approved for', () => {
    const privateAlli = (overrides = {}) =>
      makeAlli({
        visibility: 'private',
        bio: null,
        homeCity: null,
        canSeePicks: false,
        counts: { followers: 12, following: 8, dishes: null },
        ...overrides,
      });

    it('shows the header and This account is private, and never loads the picks', async () => {
      mockGetProfile.mockResolvedValue(privateAlli());
      await render(<OtherProfile />);
      expect(await screen.findByText('This account is private')).toBeOnTheScreen();
      expect(screen.getByText('Follow to see their picks.')).toBeOnTheScreen();
      expect(screen.getByText('Alli Mercer')).toBeOnTheScreen();
      expect(screen.getByText('12 followers')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Follow' })).toBeOnTheScreen();
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.queryByTestId('filter-chips')).toBeNull();
      expect(mockGetProfilePicks).not.toHaveBeenCalled();
      expect(mockGetMyPicks).not.toHaveBeenCalled();
    });

    it('does not link the stats to the lists', async () => {
      mockGetProfile.mockResolvedValue(privateAlli());
      await render(<OtherProfile />);
      await fireEvent.press(await screen.findByText('12 followers'));
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('turns Follow into Requested, and says the request is waiting', async () => {
      mockGetProfile.mockResolvedValue(privateAlli());
      mockFollow.mockResolvedValue('requested');
      await render(<OtherProfile />);
      await fireEvent.press(await screen.findByRole('button', { name: 'Follow' }));
      expect(await screen.findByRole('button', { name: 'Requested' })).toBeOnTheScreen();
      expect(screen.getByText('Your request is waiting for approval.')).toBeOnTheScreen();
      expect(screen.getByText('12 followers')).toBeOnTheScreen();
      expect(mockGetProfilePicks).not.toHaveBeenCalled();
    });

    it('shows the waiting line for a request made earlier, and cancels it without asking', async () => {
      mockGetProfile.mockResolvedValue(privateAlli({ viewerFollow: 'requested' }));
      const alert = jest.spyOn(Alert, 'alert');
      await render(<OtherProfile />);
      expect(await screen.findByText('Your request is waiting for approval.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Requested' }));
      expect(alert).not.toHaveBeenCalled();
      expect(await screen.findByRole('button', { name: 'Follow' })).toBeOnTheScreen();
      expect(screen.getByText('Follow to see their picks.')).toBeOnTheScreen();
    });
  });

  it('shows a private account to its approved followers, and hides it again on unfollow', async () => {
    mockGetProfile.mockResolvedValue(makeAlli({ visibility: 'private', viewerFollow: 'active' }));
    const alert = jest.spyOn(Alert, 'alert');
    await render(<OtherProfile />);
    expect(await screen.findByText('Plain Biryani')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Following' }));
    expect(alert.mock.calls[0]?.[1]).toBe('You’ll need to request again to see their picks.');
    const buttons: AlertButton[] = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => {
      buttons[1]?.onPress?.();
    });
    expect(await screen.findByText('This account is private')).toBeOnTheScreen();
    expect(screen.queryByText('Plain Biryani')).toBeNull();
  });

  it('says the profile is not available when there is none, or it is hidden by a block', async () => {
    mockGetProfile.mockResolvedValue(null);
    await render(<OtherProfile />);
    expect(await screen.findByText('This profile isn’t available.')).toBeOnTheScreen();
    expect(mockGetProfilePicks).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('shows friendly copy and Try again when the profile cannot load', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('boom'));
    await render(<OtherProfile />);
    expect(await screen.findByText('Something went wrong. Try again.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alli Mercer')).toBeOnTheScreen();
  });

  it('shows Try again when only the picks cannot load', async () => {
    mockGetProfilePicks.mockRejectedValueOnce(new Error('boom'));
    await render(<OtherProfile />);
    expect(await screen.findByText('Alli Mercer')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Plain Biryani')).toBeOnTheScreen();
  });

  it('sends your own profile to the You tab', async () => {
    mockParams = { id: 'u1' };
    await render(<OtherProfile />);
    expect(mockRedirect).toHaveBeenCalledWith('/you');
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it('sends you to the You tab when the server says the profile is yours', async () => {
    mockGetProfile.mockResolvedValue(makeAlli({ isMe: true }));
    await render(<OtherProfile />);
    await screen.findByText('Alli Mercer').catch(() => null);
    expect(mockRedirect).toHaveBeenCalledWith('/you');
  });
});
