import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { finishOnboarding } from '@finalmeal/api';
import FirstPick from '../../app/(onboarding)/first-pick';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  finishOnboarding: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockFinish = jest.mocked(finishOnboarding);

const add = () => screen.getByRole('button', { name: 'Add my first pick' });
const skip = () => screen.getByRole('button', { name: 'Skip for now' });

describe('The hard part (first pick intro)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFinish.mockResolvedValue({} as never);
  });

  it('shows the canvas copy', async () => {
    await render(<FirstPick />);
    expect(screen.getByText('Now for the hard part.')).toBeOnTheScreen();
    expect(
      screen.getByText('Five dishes. Forever. What’s the first one on your Final Meal?'),
    ).toBeOnTheScreen();
    expect(add()).toBeOnTheScreen();
    expect(skip()).toBeOnTheScreen();
  });

  it('shows five seat tiles with the first one highlighted', async () => {
    await render(<FirstPick />);
    const tiles = screen.getAllByTestId(/^seat-tile-/, { hidden: true });
    expect(tiles).toHaveLength(5);
    expect(screen.getByTestId('seat-tile-1', { hidden: true })).toHaveStyle({ borderStyle: 'solid' });
    for (const n of [2, 3, 4, 5]) {
      expect(screen.getByTestId(`seat-tile-${n}`, { hidden: true })).toHaveStyle({
        borderStyle: 'dashed',
      });
    }
  });

  it('Add my first pick opens the form and does not finish onboarding yet', async () => {
    await render(<FirstPick />);
    await fireEvent.press(add());
    expect(mockRouter.push).toHaveBeenCalledWith('/add-first');
    expect(mockFinish).not.toHaveBeenCalled();
  });

  it('Skip for now finishes onboarding, then shows the loading screen', async () => {
    await render(<FirstPick />);
    await fireEvent.press(skip());
    expect(mockFinish).toHaveBeenCalledWith({ fake: 'client' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/loading');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('stays put with friendly copy when finishing fails, and can try again', async () => {
    mockFinish.mockRejectedValueOnce(new TypeError('Network request failed'));
    await render(<FirstPick />);
    await fireEvent.press(skip());
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(skip()).toBeEnabled();
    expect(add()).toBeEnabled();
    await fireEvent.press(skip());
    expect(mockFinish).toHaveBeenCalledTimes(2);
    expect(mockRouter.replace).toHaveBeenCalledWith('/loading');
  });

  it('ignores a second tap while finishing', async () => {
    let done: (v: unknown) => void = () => {};
    mockFinish.mockReturnValue(new Promise((resolve) => (done = resolve)) as never);
    await render(<FirstPick />);
    await fireEvent.press(skip());
    await fireEvent.press(skip());
    expect(mockFinish).toHaveBeenCalledTimes(1);
    await act(async () => done({}));
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });
});
