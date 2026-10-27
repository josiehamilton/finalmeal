import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { OnboardingScreen } from './OnboardingScreen';

describe('OnboardingScreen', () => {
  it('shows the step label, title, subtitle and children', async () => {
    await render(
      <OnboardingScreen
        step={3}
        title="What should we call you?"
        subtitle="This shows on your profile."
        cta={{ label: 'Continue', onPress: jest.fn() }}
      >
        <Text>field goes here</Text>
      </OnboardingScreen>,
    );
    expect(screen.getByText('Step 3 of 6')).toBeOnTheScreen();
    expect(screen.getByText('What should we call you?')).toBeOnTheScreen();
    expect(screen.getByText('This shows on your profile.')).toBeOnTheScreen();
    expect(screen.getByText('field goes here')).toBeOnTheScreen();
  });

  it('reports progress as 3 of 6', async () => {
    await render(
      <OnboardingScreen step={3} title="t" cta={{ label: 'Continue', onPress: jest.fn() }}>
        <Text>x</Text>
      </OnboardingScreen>,
    );
    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityValue', {
      min: 1,
      max: 6,
      now: 3,
    });
  });

  it('calls the CTA when pressed', async () => {
    const onPress = jest.fn();
    await render(
      <OnboardingScreen title="t" cta={{ label: 'Continue', onPress }}>
        <Text>x</Text>
      </OnboardingScreen>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disables the CTA and shows the busy indicator while busy', async () => {
    const onPress = jest.fn();
    await render(
      <OnboardingScreen title="t" cta={{ label: 'Continue', onPress, busy: true }}>
        <Text>x</Text>
      </OnboardingScreen>,
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByTestId('cta-busy')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows Back and Skip only when given handlers', async () => {
    const onBack = jest.fn();
    const onSkip = jest.fn();
    const { rerender } = await render(
      <OnboardingScreen title="t" cta={{ label: 'Continue', onPress: jest.fn() }}>
        <Text>x</Text>
      </OnboardingScreen>,
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();

    await rerender(
      <OnboardingScreen
        title="t"
        onBack={onBack}
        onSkip={onSkip}
        cta={{ label: 'Continue', onPress: jest.fn() }}
      >
        <Text>x</Text>
      </OnboardingScreen>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
