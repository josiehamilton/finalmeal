import { render, screen } from '@testing-library/react-native';
import { Avatar, initialsOf } from './Avatar';

describe('initialsOf', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('Josie Hamilton')).toBe('JH');
    expect(initialsOf('  ari   mitchell  smith ')).toBe('AM');
    expect(initialsOf('Cher')).toBe('C');
    expect(initialsOf('')).toBe('');
  });
});

describe('Avatar', () => {
  it('shows initials without a photo', async () => {
    await render(<Avatar uri={null} name="Alli Mercer" size={80} />);
    expect(screen.getByText('AM')).toBeOnTheScreen();
  });

  it('shows the photo when there is one', async () => {
    await render(<Avatar uri="https://example.test/a.jpg" name="Alli Mercer" size={80} />);
    expect(screen.getByLabelText('Your photo')).toBeOnTheScreen();
    expect(screen.queryByText('AM')).toBeNull();
  });
});
