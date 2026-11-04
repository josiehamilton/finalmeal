import { Share } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getSuggestedPeople } from '@finalmeal/api';
import { FeedEmpty } from './FeedEmpty';
import { makeSuggested } from '../test-support/people';

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getSuggestedPeople: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockSuggested = jest.mocked(getSuggestedPeople);

const SUGGESTED = [
  makeSuggested({
    id: 'u2',
    username: 'mikebrennan',
    displayName: 'Mike Brennan',
    topDish: 'Wagyu Beef Don',
  }),
  makeSuggested({
    id: 'u4',
    username: 'allimercer',
    displayName: 'Alli Mercer',
    topDish: 'Plain Biryani',
  }),
  makeSuggested({ id: 'u5', username: 'newbie', displayName: 'New Bie', topDish: null }),
];

async function show(
  variant: Parameters<typeof FeedEmpty>[0]['variant'],
  city: string | null = 'Vancouver',
) {
  await render(<FeedEmpty variant={variant} cityName={city} />);
  await act(async () => {});
}

describe('FeedEmpty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSuggested.mockResolvedValue(SUGGESTED);
  });

  describe('Following, following nobody', () => {
    it('says it is an empty table, with Invite friends and Find people', async () => {
      await show('following-nobody');
      expect(screen.getByText('An empty table.')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Follow a few people and their picks show up here. Better yet, bring your friends.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Invite friends' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Find people' })).toBeOnTheScreen();
    });

    it('opens the Share sheet with the invite message', async () => {
      const share = jest
        .spyOn(Share, 'share')
        .mockResolvedValue({ action: 'dismissedAction', activityType: undefined });
      await show('following-nobody');
      await fireEvent.press(screen.getByRole('button', { name: 'Invite friends' }));
      expect(share).toHaveBeenCalledWith({
        message:
          'I’m choosing my Final Meal: five dishes, forever. Come pick yours: https://finalmeal.example',
      });
      share.mockRestore();
    });

    it('survives the Share sheet failing', async () => {
      const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('no sheet'));
      await show('following-nobody');
      await fireEvent.press(screen.getByRole('button', { name: 'Invite friends' }));
      await act(async () => {});
      expect(screen.getByText('An empty table.')).toBeOnTheScreen();
      share.mockRestore();
    });

    it('opens Find people', async () => {
      await show('following-nobody');
      await fireEvent.press(screen.getByRole('button', { name: 'Find people' }));
      expect(mockRouter.push).toHaveBeenCalledWith('/people');
    });

    it('lists the popular people near the home city with their number one dish', async () => {
      await show('following-nobody');
      expect(mockSuggested).toHaveBeenCalledWith({ fake: 'client' }, 5);
      expect(screen.getByText('Popular near Vancouver')).toBeOnTheScreen();
      expect(screen.getByText('Mike Brennan')).toBeOnTheScreen();
      expect(screen.getByText('#1 · Wagyu Beef Don')).toBeOnTheScreen();
      expect(screen.getByText('#1 · Plain Biryani')).toBeOnTheScreen();
      // Without a number one dish the row says the @handle instead.
      expect(screen.getByText('@newbie')).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: 'Follow' })).toHaveLength(3);
    });

    it('says Popular on Final Meal without a home city', async () => {
      await show('following-nobody', null);
      expect(screen.getByText('Popular on Final Meal')).toBeOnTheScreen();
    });

    it('opens a suggested person', async () => {
      await show('following-nobody');
      await fireEvent.press(screen.getByRole('button', { name: 'Mike Brennan, @mikebrennan' }));
      expect(mockRouter.push).toHaveBeenCalledWith('/u/u2');
    });

    it('leaves the Popular section out when there is nobody to suggest, or they cannot load', async () => {
      mockSuggested.mockResolvedValue([]);
      await show('following-nobody');
      expect(screen.queryByText(/^Popular/)).toBeNull();
      expect(screen.getByText('An empty table.')).toBeOnTheScreen();
    });

    it('keeps the message when the suggestions fail', async () => {
      mockSuggested.mockRejectedValue(new TypeError('Network request failed'));
      await show('following-nobody');
      expect(screen.queryByText(/^Popular/)).toBeNull();
      expect(screen.getByText('An empty table.')).toBeOnTheScreen();
    });
  });

  describe('Following, follows people but nothing new', () => {
    it('says nothing is new, without the buttons, and keeps the Popular list', async () => {
      await show('following-none');
      expect(screen.getByText('Nothing new yet.')).toBeOnTheScreen();
      expect(
        screen.getByText('When people you follow add dishes, they show up here.'),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Invite friends' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Find people' })).toBeNull();
      expect(screen.getByText('Popular near Vancouver')).toBeOnTheScreen();
    });
  });

  describe('Nearby', () => {
    it('asks for a home city when there is none, and never loads suggestions', async () => {
      await show('nearby-no-city', null);
      expect(screen.getByText('Set your home city to see picks near you.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Choose home city' }));
      expect(mockRouter.push).toHaveBeenCalledWith('/settings/home-city');
      expect(mockSuggested).not.toHaveBeenCalled();
    });

    it('says nothing is nearby yet', async () => {
      await show('nearby-empty');
      expect(screen.getByText('Nothing nearby yet.')).toBeOnTheScreen();
      expect(
        screen.getByText('When people near Vancouver add dishes, they show up here.'),
      ).toBeOnTheScreen();
      expect(mockSuggested).not.toHaveBeenCalled();
    });
  });
});
