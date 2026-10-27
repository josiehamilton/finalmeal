import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { ApiError, sendEmailCode } from '@finalmeal/api';
import Email from '../../app/(onboarding)/email';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(cb, [cb]),
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
    mockRouter.canGoBack.mockReturnValue(true);
    mockSend.mockResolvedValue(undefined);
  });

  describe('Back', () => {
    it('goes back when there is a screen to go back to', async () => {
      mockRouter.canGoBack.mockReturnValue(true);
      await render(<Email />);
      await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('goes to Welcome when there is nothing behind it (after Back from Name)', async () => {
      mockRouter.canGoBack.mockReturnValue(false);
      await render(<Email />);
      await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      expect(mockRouter.replace).toHaveBeenCalledWith('/welcome');
      expect(mockRouter.back).not.toHaveBeenCalled();
    });
  });

  it('treats the Android back button like Back when nothing is behind it, and leaves it alone otherwise', async () => {
    let handler: (...args: never[]) => boolean | null | undefined = () => false;
    const add = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, cb) => {
      handler = cb;
      return { remove: jest.fn() };
    });
    mockRouter.canGoBack.mockReturnValue(false);
    await render(<Email />);
    expect(handler()).toBe(true);
    expect(mockRouter.replace).toHaveBeenCalledWith('/welcome');
    mockRouter.replace.mockClear();
    mockRouter.canGoBack.mockReturnValue(true);
    expect(handler()).toBe(false);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    add.mockRestore();
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

  it('sends one code when return is pressed twice quickly', async () => {
    let finish: () => void = () => {};
    mockSend.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await render(<Email />);
    await typeEmail('you@example.com');
    // Both returns land before the first send settles (do not await the pending first one).
    void fireEvent(screen.getByLabelText('Email'), 'submitEditing');
    void fireEvent(screen.getByLabelText('Email'), 'submitEditing');
    expect(mockSend).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });
});
