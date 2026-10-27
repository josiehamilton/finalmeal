import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextField } from './TextField';

describe('TextField', () => {
  it('labels the input and reports typed text', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Email" value="" onChangeText={onChangeText} />);
    expect(screen.getByText('Email')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.co');
    expect(onChangeText).toHaveBeenCalledWith('a@b.co');
  });

  it('shows the error text and the prefix', async () => {
    await render(
      <TextField
        label="Username"
        prefix="@"
        value="x"
        onChangeText={jest.fn()}
        error="That handle’s taken. Try another."
      />,
    );
    expect(screen.getByText('That handle’s taken. Try another.')).toBeOnTheScreen();
    expect(screen.getByText('@')).toBeOnTheScreen();
  });
});
