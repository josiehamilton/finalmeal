import { fireEvent, render, screen } from '@testing-library/react-native';
import { followUser } from '@finalmeal/api';
import { clearFollowStates } from '../state/follow-store';
import { makePerson } from '../test-support/people';
import { PersonRow } from './PersonRow';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockFollow = jest.mocked(followUser);

describe('PersonRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFollowStates();
    mockFollow.mockResolvedValue('active');
  });

  it('shows the name, the handle and a Follow button, and opens the person', async () => {
    const onOpen = jest.fn();
    await render(<PersonRow person={makePerson()} onOpen={onOpen} />);
    expect(screen.getByText('Alli Mercer')).toBeOnTheScreen();
    expect(screen.getByText('@allimercer')).toBeOnTheScreen();
    expect(screen.getByText('AM')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Alli Mercer'));
    expect(onOpen).toHaveBeenCalledWith('u4');
  });

  it('shows a subtitle in place of the handle', async () => {
    await render(
      <PersonRow person={makePerson()} subtitle="#1 · Plain Biryani" onOpen={jest.fn()} />,
    );
    expect(screen.getByText('#1 · Plain Biryani')).toBeOnTheScreen();
    expect(screen.queryByText('@allimercer')).toBeNull();
  });

  it('follows from the row without opening the person', async () => {
    const onOpen = jest.fn();
    await render(<PersonRow person={makePerson()} onOpen={onOpen} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Follow' }));
    expect(mockFollow).toHaveBeenCalledWith({ fake: 'client' }, 'u4');
    expect(await screen.findByRole('button', { name: 'Following' })).toBeOnTheScreen();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('has no button for yourself', async () => {
    await render(<PersonRow person={makePerson({ isMe: true })} onOpen={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
  });

  it('says so under the row when a follow fails, and the button goes back', async () => {
    mockFollow.mockRejectedValue(new Error('boom'));
    await render(<PersonRow person={makePerson()} onOpen={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Follow' }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeOnTheScreen();
  });

  it('agrees with another row for the same person', async () => {
    await render(
      <>
        <PersonRow person={makePerson()} onOpen={jest.fn()} />
        <PersonRow person={makePerson()} onOpen={jest.fn()} />
      </>,
    );
    await fireEvent.press(screen.getAllByRole('button', { name: 'Follow' })[0]!);
    expect(await screen.findAllByRole('button', { name: 'Following' })).toHaveLength(2);
  });
});
