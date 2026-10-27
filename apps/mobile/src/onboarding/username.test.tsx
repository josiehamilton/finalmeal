import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError, createMyProfile, isUsernameAvailable } from '@finalmeal/api';
import Username from '../../app/(onboarding)/username';
import { suggestUsername } from './suggest-username';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: { name?: string } = { name: 'Josie Hamilton' };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  isUsernameAvailable: jest.fn(),
  createMyProfile: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockAvailable = jest.mocked(isUsernameAvailable);
const mockCreate = jest.mocked(createMyProfile);

const TAKEN = 'That handle’s taken. Try another.';
const INVALID = 'Letters, numbers and underscores, 3–30 characters.';

async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
async function typeHandle(value: string) {
  await fireEvent.changeText(screen.getByLabelText('Username'), value);
}
const cta = () => screen.getByRole('button', { name: 'Continue' });

describe('suggestUsername', () => {
  it('lower-cases, joins with underscores and drops other characters', () => {
    expect(suggestUsername('Josie Hamilton')).toBe('josie_hamilton');
    expect(suggestUsername('  Zoë  O’Neil-Smith ')).toBe('zoe_oneilsmith');
    expect(suggestUsername('A'.repeat(40))).toBe('a'.repeat(30));
  });
  it('suggests nothing when too little is left', () => {
    expect(suggestUsername('Jo')).toBe('');
    expect(suggestUsername('!!!')).toBe('');
  });
});

describe('Username step', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockParams = { name: 'Josie Hamilton' };
    mockAvailable.mockResolvedValue(true);
    mockCreate.mockResolvedValue({} as never);
  });
  afterEach(() => jest.useRealTimers());

  it('shows the copy and suggests a handle from the name', async () => {
    await render(<Username />);
    expect(screen.getByText('Claim your handle.')).toBeOnTheScreen();
    expect(screen.getByText('This is how friends find your Final Meal.')).toBeOnTheScreen();
    expect(
      screen.getByText('Letters, numbers and underscores. You can change it later.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('@')).toBeOnTheScreen();
    expect(screen.getByLabelText('Username').props.value).toBe('josie_hamilton');
  });

  it('checks availability after a 400 ms pause and shows Available', async () => {
    await render(<Username />);
    await typeHandle('josie');
    await tick(399);
    expect(mockAvailable).not.toHaveBeenCalled();
    await tick(1);
    expect(mockAvailable).toHaveBeenCalledTimes(1);
    expect(mockAvailable).toHaveBeenCalledWith({ fake: 'client' }, 'josie');
    expect(screen.getByText('Available')).toBeOnTheScreen();
  });

  it('only checks the last thing typed', async () => {
    await render(<Username />);
    await typeHandle('jos');
    await tick(300);
    await typeHandle('josie');
    await tick(300);
    expect(mockAvailable).not.toHaveBeenCalled();
    await tick(100);
    expect(mockAvailable).toHaveBeenCalledTimes(1);
    expect(mockAvailable).toHaveBeenCalledWith({ fake: 'client' }, 'josie');
  });

  it('shows the taken copy', async () => {
    mockAvailable.mockResolvedValue(false);
    await render(<Username />);
    await typeHandle('josie');
    await tick(400);
    expect(screen.getByText(TAKEN)).toBeOnTheScreen();
    expect(screen.queryByText('Available')).toBeNull();
    expect(cta()).toBeDisabled();
  });

  it('shows the invalid copy at once, with no check', async () => {
    await render(<Username />);
    await typeHandle('a!');
    expect(screen.getByText(INVALID)).toBeOnTheScreen();
    await tick(1000);
    expect(mockAvailable).not.toHaveBeenCalled();
    expect(cta()).toBeDisabled();
  });

  it('creates the profile and goes to the city step', async () => {
    await render(<Username />);
    await tick(400);
    await fireEvent.press(cta());
    expect(mockCreate).toHaveBeenCalledWith(
      { fake: 'client' },
      { displayName: 'Josie Hamilton', username: 'josie_hamilton' },
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/city');
  });

  it('shows the taken copy when the server says taken after "Available"', async () => {
    mockCreate.mockRejectedValue(new ApiError('taken', 'username_taken'));
    await render(<Username />);
    await typeHandle('josie');
    await tick(400);
    expect(screen.getByText('Available')).toBeOnTheScreen();
    await fireEvent.press(cta());
    expect(screen.getByText(TAKEN)).toBeOnTheScreen();
    expect(screen.queryByText('Available')).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cta-busy')).toBeNull();
  });

  it('re-enables Continue after a network failure and shows its copy', async () => {
    mockCreate.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Username />);
    await tick(400);
    await fireEvent.press(cta());
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(screen.queryByTestId('cta-busy')).toBeNull();
    expect(cta()).toBeEnabled();
  });

  it('moves on when the profile already exists', async () => {
    mockCreate.mockRejectedValue(new ApiError('exists', 'profile_exists'));
    await render(<Username />);
    await tick(400);
    await fireEvent.press(cta());
    expect(mockRouter.replace).toHaveBeenCalledWith('/city');
  });

  it('lets the person continue when the availability check itself failed', async () => {
    mockAvailable.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Username />);
    await tick(400);
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(cta()).toBeEnabled();
  });

  it('goes back', async () => {
    await render(<Username />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
