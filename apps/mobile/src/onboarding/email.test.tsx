import { fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError, sendEmailCode } from '@finalmeal/api';
import Email from '../../app/(onboarding)/email';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  sendEmailCode: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockSend = jest.mocked(sendEmailCode);

async function typeEmail(value: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), value);
}
const sendButton = () => screen.getByRole('button', { name: 'Send code' });

describe('Email step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue(undefined);
  });

  it('shows the title, subtitle, placeholder and footer', async () => {
    await render(<Email />);
    expect(screen.getByText('What’s your email?')).toBeOnTheScreen();
    expect(
      screen.getByText('We’ll send a code to sign you in. No passwords to remember.'),
    ).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('you@example.com')).toBeOnTheScreen();
    expect(screen.getByText('We never share your email.')).toBeOnTheScreen();
    expect(screen.queryByText(/privacy policy/i)).toBeNull();
  });

  it('sends the normalised email and moves on to the code step', async () => {
    await render(<Email />);
    await typeEmail('  You+Food@Example.COM ');
    await fireEvent.press(sendButton());
    expect(mockSend).toHaveBeenCalledWith({ fake: 'client' }, 'you+food@example.com');
    expect(mockRouter.push).toHaveBeenCalledWith('/code?email=you%2Bfood%40example.com');
  });

  it('shows the invalid-email copy and makes no call for a bad address', async () => {
    await render(<Email />);
    await typeEmail('not an email');
    await fireEvent.press(sendButton());
    expect(screen.getByText('That doesn’t look like an email address.')).toBeOnTheScreen();
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('clears the error when the person types again', async () => {
    await render(<Email />);
    await typeEmail('nope');
    await fireEvent.press(sendButton());
    await typeEmail('nope@');
    expect(screen.queryByText('That doesn’t look like an email address.')).toBeNull();
  });

  it('shows the friendly copy for a server error and stays on the step', async () => {
    mockSend.mockRejectedValue(new ApiError('slow down', 'rate_limited'));
    await render(<Email />);
    await typeEmail('a@b.co');
    await fireEvent.press(sendButton());
    expect(screen.getByText('Too many tries. Wait a minute and try again.')).toBeOnTheScreen();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('re-enables the button after a network failure (no stuck spinner)', async () => {
    mockSend.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Email />);
    await typeEmail('a@b.co');
    await fireEvent.press(sendButton());
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(screen.queryByTestId('cta-busy')).toBeNull();
    mockSend.mockResolvedValue(undefined);
    await fireEvent.press(sendButton());
    expect(mockRouter.push).toHaveBeenCalledWith('/code?email=a%40b.co');
  });

  it('goes back to Welcome', async () => {
    await render(<Email />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
