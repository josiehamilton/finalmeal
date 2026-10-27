import { fireEvent, render, screen } from '@testing-library/react-native';
import Name from '../../app/(onboarding)/name';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}));

const cta = () => screen.getByRole('button', { name: 'Continue' });

describe('Name step', () => {
  beforeEach(() => jest.clearAllMocks());

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

  it('goes back', async () => {
    await render(<Name />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
