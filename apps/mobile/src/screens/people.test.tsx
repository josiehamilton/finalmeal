import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getSuggestedPeople, searchPeople } from '@finalmeal/api';
import People from '../../app/(app)/people';
import { makeProfile } from '../test-support/profile';
import { makePerson, makeSuggested } from '../test-support/people';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getSuggestedPeople: jest.fn(),
  searchPeople: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
let mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ session: {}, profile: mockProfile, loading: false, error: null }),
}));
const mockSuggested = jest.mocked(getSuggestedPeople);
const mockSearch = jest.mocked(searchPeople);
const client = { fake: 'client' };

describe('Find people', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockProfile = makeProfile();
    mockSuggested.mockResolvedValue([
      makeSuggested({
        id: 'u2',
        username: 'mikebrennan',
        displayName: 'Mike Brennan',
        topDish: 'Wagyu Beef Don',
      }),
      makeSuggested({ id: 'u5', username: 'devpatel', displayName: 'Dev Patel', topDish: null }),
    ]);
    mockSearch.mockResolvedValue([
      makePerson({ id: 'u4', username: 'allimercer', displayName: 'Alli Mercer' }),
    ]);
  });
  afterEach(() => jest.useRealTimers());

  it('opens on the people popular near your home city', async () => {
    await render(<People />);
    expect(screen.getByText('Find people')).toBeOnTheScreen();
    expect(screen.getByLabelText('Search people')).toBeOnTheScreen();
    expect(await screen.findByText('Popular near Vancouver')).toBeOnTheScreen();
    expect(mockSuggested).toHaveBeenCalledWith(client, 20);
    expect(screen.getByText('Mike Brennan')).toBeOnTheScreen();
    expect(screen.getByText('#1 · Wagyu Beef Don')).toBeOnTheScreen();
    // No top dish: the handle stands in.
    expect(screen.getByText('@devpatel')).toBeOnTheScreen();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('says Popular on Final Meal without a home city', async () => {
    mockProfile = makeProfile({ homeCity: null });
    await render(<People />);
    expect(await screen.findByText('Popular on Final Meal')).toBeOnTheScreen();
  });

  it('searches after a pause, and shows the results in place of the popular list', async () => {
    await render(<People />);
    await screen.findByText('Mike Brennan');
    await fireEvent.changeText(screen.getByLabelText('Search people'), 'ali');
    expect(mockSearch).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    expect(mockSearch).toHaveBeenCalledWith(client, 'ali', 20);
    expect(await screen.findByText('Alli Mercer')).toBeOnTheScreen();
    expect(screen.getByText('@allimercer')).toBeOnTheScreen();
    expect(screen.queryByText('Mike Brennan')).toBeNull();
    expect(screen.queryByText('Popular near Vancouver')).toBeNull();
  });

  it('goes back to the popular list when the search is cleared', async () => {
    await render(<People />);
    await screen.findByText('Mike Brennan');
    await fireEvent.changeText(screen.getByLabelText('Search people'), 'ali');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    await screen.findByText('Alli Mercer');
    await fireEvent.changeText(screen.getByLabelText('Search people'), '');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText('Mike Brennan')).toBeOnTheScreen();
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it('says when no one matches', async () => {
    mockSearch.mockResolvedValue([]);
    await render(<People />);
    await fireEvent.changeText(screen.getByLabelText('Search people'), 'zzz');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText('No one matches “zzz”.')).toBeOnTheScreen();
  });

  it('says so when no one is popular yet', async () => {
    mockSuggested.mockResolvedValue([]);
    await render(<People />);
    expect(
      await screen.findByText('No suggestions yet. Search for a friend by name or @handle.'),
    ).toBeOnTheScreen();
  });

  it('opens a person, and follows from the row', async () => {
    await render(<People />);
    await fireEvent.press(await screen.findByText('Mike Brennan'));
    expect(mockRouter.push).toHaveBeenCalledWith('/u/u2');
    expect(screen.getAllByRole('button', { name: 'Follow' })).toHaveLength(2);
  });

  it('shows friendly copy and Try again when it cannot load', async () => {
    mockSuggested.mockRejectedValueOnce(new Error('boom'));
    await render(<People />);
    expect(await screen.findByText('Something went wrong. Try again.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Mike Brennan')).toBeOnTheScreen();
  });

  it('goes back', async () => {
    await render(<People />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
