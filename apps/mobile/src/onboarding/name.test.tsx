import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { signOut } from '@finalmeal/api';
import Name from '../../app/(onboarding)/name';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  signOut: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockSignOut = jest.mocked(signOut);

const cta = () => screen.getByRole('button', { name: 'Continue' });

describe('Name step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
  });

  it('shows the title and subtitle', async () => {
    await render(<Name />);
    expect(screen.getByText('What should we call you?')).toBeOnTheScreen();
    expect(screen.getByText('This shows on your profile and on every pick.')).toBeOnTheScreen();
  });

  it('keeps Continue disabled while the first name is empty', async () => {
    await render(<Name />);
    expect(cta()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Last name'), 'Hamilton');
    expect(cta()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('First name'), '   ');
    expect(cta()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Josie');
    expect(cta()).toBeEnabled();
  });

  it('passes "first last" on to the username step', async () => {
    await render(<Name />);
    await fireEvent.changeText(screen.getByLabelText('First name'), ' Josie ');
    await fireEvent.changeText(screen.getByLabelText('Last name'), ' Hamilton ');
    await fireEvent.press(cta());
    expect(mockRouter.push).toHaveBeenCalledWith('/username?name=Josie%20Hamilton');
  });

  it('works with a first name only', async () => {
    await render(<Name />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Josie');
    await fireEvent.press(cta());
    expect(mockRouter.push).toHaveBeenCalledWith('/username?name=Josie');
  });

  it('caps the display name at 60 characters', async () => {
    await render(<Name />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'a'.repeat(50));
    await fireEvent.changeText(screen.getByLabelText('Last name'), 'b'.repeat(50));
    await fireEvent.press(cta());
    const href = mockRouter.push.mock.calls[0]?.[0] as string;
    const name = decodeURIComponent(href.split('name=')[1] ?? '');
    expect(name).toHaveLength(60);
  });

  it('does not split an emoji when it caps the name at 60 characters', async () => {
    await render(<Name />);
    // 61 characters in all; the 60th is an emoji (two UTF-16 units) that a plain slice(0, 60)
    // would cut in half.
    await fireEvent.changeText(screen.getByLabelText('First name'), 'a'.repeat(30));
    await fireEvent.changeText(screen.getByLabelText('Last name'), `${'b'.repeat(28)}🍜🍜`);
    await fireEvent.press(cta());
    const href = mockRouter.push.mock.calls[0]?.[0] as string;
    const name = decodeURIComponent(href.split('name=')[1] ?? '');
    expect(Array.from(name)).toHaveLength(60);
    expect(name.endsWith('b🍜')).toBe(true);
    expect(name).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('pushes only once when return is pressed twice', async () => {
    await render(<Name />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Josie');
    await fireEvent(screen.getByLabelText('Last name'), 'submitEditing');
    await fireEvent(screen.getByLabelText('Last name'), 'submitEditing');
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it('signs out on this device and starts over at the email step when Back is pressed', async () => {
    await render(<Name />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/email');
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledWith({ fake: 'client' }, 'local');
  });

  it('still starts over at the email step when signing out fails', async () => {
    mockSignOut.mockRejectedValue(new Error('boom'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await render(<Name />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/email');
    warn.mockRestore();
  });

  it('treats the Android back button like Back', async () => {
    let handler: () => boolean | null | undefined = () => false;
    const add = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, cb) => {
      handler = cb;
      return { remove: jest.fn() };
    });
    await render(<Name />);
    expect(handler()).toBe(true);
    expect(mockRouter.replace).toHaveBeenCalledWith('/email');
    expect(mockSignOut).toHaveBeenCalledWith({ fake: 'client' }, 'local');
    add.mockRestore();
  });
});
