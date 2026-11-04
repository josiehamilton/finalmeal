import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { saveDish, unsaveDish } from '@finalmeal/api';
import { FeedCard } from './FeedCard';
import { hoursAgo, makeFeedItem } from '../test-support/feed';
import { makePick } from '../test-support/picks';

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  saveDish: jest.fn(),
  unsaveDish: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockSave = jest.mocked(saveDish);
const mockUnsave = jest.mocked(unsaveDish);

describe('FeedCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockUnsave.mockResolvedValue(undefined);
  });

  it('renders the Feed board’s card', async () => {
    await render(<FeedCard item={makeFeedItem()} />);
    expect(screen.getByText('@arimitchell')).toBeOnTheScreen();
    expect(screen.getByText('added to their Final Meal · 2h')).toBeOnTheScreen();
    expect(screen.getByText('Final Meal · #1')).toBeOnTheScreen();
    expect(screen.getByText('Pork Gyro')).toBeOnTheScreen();
    expect(screen.getByText('Skewers · Vancouver')).toBeOnTheScreen();
    expect(screen.getByText('Greek')).toBeOnTheScreen();
    expect(screen.getByText('Late night')).toBeOnTheScreen();
    expect(screen.getByText('“Delicious. I’d fly back for it.”')).toBeOnTheScreen();
    expect(screen.getByText('On 8 lists')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
  });

  it('has no Share and no More options', async () => {
    await render(<FeedCard item={makeFeedItem()} />);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
  });

  it('says what was dethroned', async () => {
    await render(
      <FeedCard item={makeFeedItem({ kind: 'dethroned', otherDishName: 'Plain Biryani' })} />,
    );
    expect(
      screen.getByText('dethroned Plain Biryani from their Final Meal · 2h'),
    ).toBeOnTheScreen();
  });

  it('shows the other captions and an older time', async () => {
    await render(<FeedCard item={makeFeedItem({ kind: 'promoted', at: hoursAgo(30) })} />);
    expect(screen.getByText('promoted to their Final Meal · Yesterday')).toBeOnTheScreen();
  });

  it('shows an Honorable badge, a placeholder tile without a photo, and leaves out what is missing', async () => {
    await render(
      <FeedCard
        item={makeFeedItem({
          kind: 'added_honorable',
          listCount: 0,
          pick: makePick({ tier: 'honorable', slot: null, note: null, tags: [] }),
        })}
      />,
    );
    expect(screen.getByText('Honorable')).toBeOnTheScreen();
    expect(screen.getByText('added an Honorable Mention · 2h')).toBeOnTheScreen();
    expect(screen.queryByText(/Final Meal · #/)).toBeNull();
    expect(screen.queryByText(/“/)).toBeNull();
    expect(screen.queryByText(/On \d+ list/)).toBeNull();
    expect(screen.queryByTestId('tag-chips')).toBeNull();
    expect(screen.getByTestId('feed-photo-placeholder')).toBeOnTheScreen();
  });

  it('shows the photo when there is one', async () => {
    await render(
      <FeedCard
        item={makeFeedItem({ pick: makePick({ photoUrl: 'https://img.example/gyro.jpg' }) })}
      />,
    );
    expect(screen.queryByTestId('feed-photo-placeholder')).toBeNull();
    expect(screen.getByTestId('feed-photo')).toBeOnTheScreen();
  });

  it('opens the person from their @username', async () => {
    await render(<FeedCard item={makeFeedItem()} />);
    await fireEvent.press(screen.getByRole('button', { name: '@arimitchell' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/u/u3');
  });

  it('opens the pick from the photo and from the dish name', async () => {
    await render(<FeedCard item={makeFeedItem()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open Pork Gyro' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/pick/pk-ari');
    await fireEvent.press(screen.getByText('Pork Gyro'));
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/pick/pk-ari');
  });

  describe('Save', () => {
    it('saves the dish through this pick and flips to Saved', async () => {
      await render(<FeedCard item={makeFeedItem()} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('button', { name: 'Saved' })).toBeOnTheScreen();
      expect(mockSave).toHaveBeenCalledWith({ fake: 'client' }, 'd-gyro', 'pk-ari');
    });

    it('calls saveDish once on a double tap', async () => {
      let finish: () => void = () => {};
      mockSave.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      await render(<FeedCard item={makeFeedItem()} />);
      const button = screen.getByRole('button', { name: 'Save' });
      await fireEvent.press(button);
      await fireEvent.press(button);
      await fireEvent.press(screen.getByRole('button', { name: 'Saved' }));
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockUnsave).not.toHaveBeenCalled();
      await act(async () => finish());
      expect(screen.getByRole('button', { name: 'Saved' })).toBeOnTheScreen();
    });

    it('unsaves a saved dish', async () => {
      await render(<FeedCard item={makeFeedItem({ savedByMe: true })} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Saved' }));
      expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
      expect(mockUnsave).toHaveBeenCalledWith({ fake: 'client' }, 'd-gyro');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('can be tapped again once the call has finished', async () => {
      await render(<FeedCard item={makeFeedItem()} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Saved' }));
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockUnsave).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
    });

    it('puts it back and says why when the call fails', async () => {
      mockSave.mockRejectedValueOnce(new TypeError('Network request failed'));
      await render(<FeedCard item={makeFeedItem()} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
      expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(screen.queryByText('Can’t reach the kitchen right now.')).toBeNull();
    });

    it('follows a fresh answer from the server when idle', async () => {
      const view = await render(<FeedCard item={makeFeedItem()} />);
      await view.rerender(<FeedCard item={makeFeedItem({ savedByMe: true })} />);
      expect(screen.getByRole('button', { name: 'Saved' })).toBeOnTheScreen();
    });
  });
});
