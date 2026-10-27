import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { ApiError, sendEmailCode, verifyEmailCode } from '@finalmeal/api';
import type { MyProfile } from '@finalmeal/api';
import Code from '../../app/(onboarding)/code';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockRefresh = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ email: 'You@Example.com' }),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  sendEmailCode: jest.fn(),
  verifyEmailCode: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ refreshProfile: mockRefresh }),
}));
const mockVerify = jest.mocked(verifyEmailCode);
const mockSend = jest.mocked(sendEmailCode);

const PROFILE: MyProfile = {
  id: 'u1',
  username: 'josie',
  displayName: 'Josie',
  bio: null,
  avatarUrl: null,
  homeCity: null,
  showHomeCity: true,
  visibility: 'public',
  onboarded: true,
  counts: { followers: 0, following: 0, dishes: 0 },
};

async function enterCode(code: string) {
  await fireEvent.changeText(screen.getByTestId('code-input'), code);
}
const boxes = () => [0, 1, 2, 3, 4, 5].map((i) => screen.getByTestId(`code-box-${i}`));
async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('Code step', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockVerify.mockResolvedValue(undefined);
    mockSend.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(null);
  });
  afterEach(() => jest.useRealTimers());

  it('shows the title and where the code went', async () => {
    await render(<Code />);
    expect(screen.getByText('Check your email.')).toBeOnTheScreen();
    expect(
      screen.getByText('Enter the 6-digit code we sent to you@example.com.'),
    ).toBeOnTheScreen();
  });

  it('verifies as soon as six digits are in, then sends a new person to the name step', async () => {
    await render(<Code />);
    await enterCode('123456');
    expect(mockVerify).toHaveBeenCalledWith({ fake: 'client' }, 'you@example.com', '123456');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/name');
  });

  it('sends a signed-up person who left mid-way to the city step', async () => {
    mockRefresh.mockResolvedValue({ ...PROFILE, onboarded: false });
    await render(<Code />);
    await enterCode('123456');
    expect(mockRouter.replace).toHaveBeenCalledWith('/city');
  });

  it('lands a returning, onboarded person on You', async () => {
    mockRefresh.mockResolvedValue(PROFILE);
    await render(<Code />);
    await enterCode('123456');
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/you');
  });

  it('Verify also works and is disabled until six digits are in', async () => {
    await render(<Code />);
    const verify = screen.getByRole('button', { name: 'Verify' });
    expect(verify).toBeDisabled();
    await enterCode('12345');
    expect(mockVerify).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
  });

  it('shows the wrong-code copy and clears the boxes', async () => {
    mockVerify.mockRejectedValue(new ApiError('nope', 'invalid_code'));
    await render(<Code />);
    await enterCode('123456');
    expect(screen.getByText('That code didn’t work. Check it and try again.')).toBeOnTheScreen();
    boxes().forEach((box) => expect(box).toHaveTextContent(''));
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    // The person can try again straight away.
    mockVerify.mockResolvedValue(undefined);
    await enterCode('654321');
    expect(mockVerify).toHaveBeenLastCalledWith({ fake: 'client' }, 'you@example.com', '654321');
    expect(mockRouter.replace).toHaveBeenCalledWith('/name');
  });

  it('shows the expired copy', async () => {
    mockVerify.mockRejectedValue(new ApiError('old', 'code_expired'));
    await render(<Code />);
    await enterCode('123456');
    expect(
      screen.getByText('That code has expired. Tap “Resend code” for a new one.'),
    ).toBeOnTheScreen();
  });

  it('re-enables everything after a network failure (no stuck spinner)', async () => {
    mockVerify.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Code />);
    await enterCode('123456');
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(screen.queryByTestId('cta-busy')).toBeNull();
    expect(screen.getByTestId('code-input').props.editable).toBe(true);
  });

  it('does not spend the code twice when only the profile load failed', async () => {
    mockRefresh.mockRejectedValueOnce(new TypeError('Network request failed'));
    await render(<Code />);
    await enterCode('123456');
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
    expect(mockRouter.replace).toHaveBeenCalledWith('/name');
  });

  it('counts down from 30 and turns into Resend code', async () => {
    await render(<Code />);
    expect(screen.getByText('Resend in 0:30')).toBeOnTheScreen();
    await tick(1000);
    expect(screen.getByText('Resend in 0:29')).toBeOnTheScreen();
    await tick(20_000);
    expect(screen.getByText('Resend in 0:09')).toBeOnTheScreen();
    await tick(9000);
    expect(screen.queryByText(/Resend in/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Resend code' })).toBeOnTheScreen();
  });

  it('resends the code, clears any error and starts the countdown again', async () => {
    mockVerify.mockRejectedValue(new ApiError('nope', 'invalid_code'));
    await render(<Code />);
    await enterCode('123456');
    await tick(30_000);
    await fireEvent.press(screen.getByRole('link', { name: 'Resend code' }));
    expect(mockSend).toHaveBeenCalledWith({ fake: 'client' }, 'you@example.com');
    expect(screen.getByText('Resend in 0:30')).toBeOnTheScreen();
    expect(screen.queryByText('That code didn’t work. Check it and try again.')).toBeNull();
  });

  it('shows the rate-limit copy when resending is refused', async () => {
    mockSend.mockRejectedValue(new ApiError('slow', 'rate_limited'));
    await render(<Code />);
    await tick(30_000);
    await fireEvent.press(screen.getByRole('link', { name: 'Resend code' }));
    expect(screen.getByText('Too many tries. Wait a minute and try again.')).toBeOnTheScreen();
  });

  it('keeps the countdown running through a code error', async () => {
    mockVerify.mockRejectedValue(new ApiError('nope', 'invalid_code'));
    await render(<Code />);
    await tick(5000);
    await enterCode('123456');
    expect(screen.getByText('Resend in 0:25')).toBeOnTheScreen();
    await tick(1000);
    expect(screen.getByText('Resend in 0:24')).toBeOnTheScreen();
  });

  it('Change email goes back, and the email is kept', async () => {
    await render(<Code />);
    await fireEvent.press(screen.getByRole('link', { name: 'Change email' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('opens the mail app on iOS', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    await render(<Code />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open mail app' }));
    expect(open).toHaveBeenCalledWith('message:');
    open.mockRestore();
  });
});
