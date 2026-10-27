import { fireEvent, render, screen } from '@testing-library/react-native';
import { CodeInput } from './CodeInput';

describe('CodeInput', () => {
  it('fills all six boxes and completes when six digits are pasted', async () => {
    const onComplete = jest.fn();
    await render(<CodeInput onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByTestId('code-input'), '123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
    ['1', '2', '3', '4', '5', '6'].forEach((d, i) => {
      expect(screen.getByTestId(`code-box-${i}`)).toHaveTextContent(d);
    });
  });

  it('ignores non-digits', async () => {
    const onComplete = jest.fn();
    await render(<CodeInput onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByTestId('code-input'), 'a1');
    expect(screen.getByTestId('code-box-0')).toHaveTextContent('1');
    expect(screen.getByTestId('code-box-1')).toHaveTextContent('');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('accepts a pasted code with spaces and caps it at six digits', async () => {
    const onComplete = jest.fn();
    await render(<CodeInput onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByTestId('code-input'), '123 456 789');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('asks the OS for the one-time code', async () => {
    await render(<CodeInput onComplete={jest.fn()} />);
    const input = screen.getByTestId('code-input');
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.autoComplete).toBe('one-time-code');
  });

  it('finds the code in a long paste', async () => {
    const onComplete = jest.fn();
    await render(<CodeInput onComplete={onComplete} />);
    const input = screen.getByTestId('code-input');
    expect(input.props.maxLength).toBeUndefined();
    await fireEvent.changeText(input, 'Your code is 123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });
});
