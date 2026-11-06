import { fireEvent, render, screen } from '@testing-library/react-native';
import { followUser } from '@finalmeal/api';
import { clearFollowStates } from '../state/follow-store';
import { makeActivity, makeFollowed, makeRequest, makeSaved } from '../test-support/activity';
import { ActivityRow } from './ActivityRow';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockFollow = jest.mocked(followUser);

function props(overrides: Partial<React.ComponentProps<typeof ActivityRow>> = {}) {
  return {
    item: makeActivity(),
    unread: true,
    now: new Date(),
    onOpen: jest.fn(),
    onRespond: jest.fn(),
    ...overrides,
  };
}

describe('ActivityRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFollowStates();
    mockFollow.mockResolvedValue('active');
  });

  it('says who dethroned what, with the time, an unread dot and a thumbnail', async () => {
    await render(<ActivityRow {...props()} />);
    expect(
      screen.getByText(
        'Ari Mitchell dethroned Tacos Al Pastor with Smash Burger on their Final Meal.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('2m')).toBeOnTheScreen();
    expect(screen.getByLabelText('Unread')).toBeOnTheScreen();
    expect(screen.getByText('AM')).toBeOnTheScreen();
    expect(screen.getByTestId('activity-thumb')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Follow/ })).toBeNull();
  });

  it('shows the pick photo when there is one', async () => {
    await render(
      <ActivityRow {...props({ item: makeActivity({ photoUrl: 'https://img/pick.jpg' }) })} />,
    );
    expect(screen.getByLabelText('Photo of Smash Burger').props.source).toEqual({
      uri: 'https://img/pick.jpg',
    });
  });

  it('has no dot when read', async () => {
    await render(<ActivityRow {...props({ unread: false })} />);
    expect(screen.queryByLabelText('Unread')).toBeNull();
  });

  it('shows Follow back for a new follower, and it follows from the row', async () => {
    const onOpen = jest.fn();
    await render(<ActivityRow {...props({ item: makeFollowed(), onOpen })} />);
    expect(screen.getByText('Alli Mercer started following you.')).toBeOnTheScreen();
    expect(screen.getByText('14m')).toBeOnTheScreen();
    expect(screen.queryByTestId('activity-thumb')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Follow back' }));
    expect(mockFollow).toHaveBeenCalledWith({ fake: 'client' }, 'u4');
    expect(await screen.findByRole('button', { name: 'Following' })).toBeOnTheScreen();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows Following when they are already followed', async () => {
    await render(<ActivityRow {...props({ item: makeFollowed({ viewerFollow: 'active' }) })} />);
    expect(screen.getByRole('button', { name: 'Following' })).toBeOnTheScreen();
  });

  it('says who saved the pick, with a thumbnail and no unread dot when read', async () => {
    await render(<ActivityRow {...props({ item: makeSaved(), unread: false })} />);
    expect(screen.getByText('Mike Brennan saved your Pork Gyro.')).toBeOnTheScreen();
    expect(screen.getByText('1h')).toBeOnTheScreen();
    expect(screen.getByTestId('activity-thumb')).toBeOnTheScreen();
  });

  it('words the other pick activities and a list save, which has no trailing item', async () => {
    const view = await render(
      <ActivityRow {...props({ item: makeActivity({ type: 'promoted', dishName: 'Ramen' }) })} />,
    );
    expect(screen.getByText('Ari Mitchell promoted Ramen to their Final Meal.')).toBeOnTheScreen();
    await view.unmount();
    await render(
      <ActivityRow
        {...props({
          item: makeActivity({
            type: 'saved_from_list',
            pickId: null,
            dishName: null,
            otherDishName: null,
            listTitle: 'Date night',
          }),
        })}
      />,
    );
    expect(
      screen.getByText('Ari Mitchell saved picks from your list Date night.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('activity-thumb')).toBeNull();
    expect(screen.queryByRole('button', { name: /Follow|Approve|Decline/ })).toBeNull();
  });

  it('shows Approve and Decline for a pending request, and each calls through', async () => {
    const onRespond = jest.fn();
    const item = makeRequest();
    await render(<ActivityRow {...props({ item, onRespond })} />);
    expect(screen.getByText('Alli Mercer wants to follow you.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Approve Alli Mercer' }));
    expect(onRespond).toHaveBeenLastCalledWith(item, true);
    await fireEvent.press(screen.getByRole('button', { name: 'Decline Alli Mercer' }));
    expect(onRespond).toHaveBeenLastCalledWith(item, false);
  });

  it('after Approve it reads started following you with a Follow back button', async () => {
    await render(<ActivityRow {...props({ item: makeRequest(), approved: true })} />);
    expect(screen.getByText('Alli Mercer started following you.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Follow back' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Approve|Decline/ })).toBeNull();
  });

  it('a request already answered elsewhere reads as a follow', async () => {
    await render(<ActivityRow {...props({ item: makeRequest({ requestPending: false }) })} />);
    expect(screen.getByText('Alli Mercer started following you.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Follow back' })).toBeOnTheScreen();
  });

  it('disables Approve and Decline while answering, and shows a problem', async () => {
    const onRespond = jest.fn();
    await render(
      <ActivityRow
        {...props({ item: makeRequest(), onRespond, responding: true, error: 'Try again.' })}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Approve Alli Mercer' }));
    expect(onRespond).not.toHaveBeenCalled();
    expect(screen.getByText('Try again.')).toBeOnTheScreen();
  });

  it('opens the activity when the row is tapped', async () => {
    const onOpen = jest.fn();
    const item = makeActivity();
    await render(<ActivityRow {...props({ item, onOpen })} />);
    await fireEvent.press(screen.getByText('2m'));
    expect(onOpen).toHaveBeenCalledWith(item);
  });
});
