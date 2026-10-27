import { fireEvent, render, screen } from '@testing-library/react-native';
import { WelcomeScreen } from './WelcomeScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

describe('WelcomeScreen', () => {
  beforeEach(() => mockPush.mockClear());

  it('shows the wordmark, title, subtitle and map label', async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByText('Final Meal')).toBeOnTheScreen();
    expect(screen.getByText('Eat where people would eat their last meal.')).toBeOnTheScreen();
    expect(
      screen.getByText('Every pin is someone’s favourite dish, not a star rating.'),
    ).toBeOnTheScreen();
    // The map and its label are decoration, hidden from screen readers.
    expect(
      screen.getByText('Marutama · on 14 Final Meals', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('does not offer Apple or Google sign-in', async () => {
    await render(<WelcomeScreen />);
    expect(screen.queryByText(/apple/i)).toBeNull();
    expect(screen.queryByText(/google/i)).toBeNull();
  });

  it('sends both buttons to the email step', async () => {
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    await fireEvent.press(screen.getByRole('link', { name: /Log in/ }));
    expect(mockPush).toHaveBeenNthCalledWith(1, '/email');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/email');
  });

  it('shows a notice with a Try again button when given one', async () => {
    const onRetry = jest.fn();
    await render(<WelcomeScreen notice="Can’t reach the kitchen right now." onRetry={onRetry} />);
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows no Try again button without a notice', async () => {
    await render(<WelcomeScreen />);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
