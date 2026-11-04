import { fireEvent, render, screen } from '@testing-library/react-native';
import { FollowButton } from './FollowButton';

describe('FollowButton', () => {
  it('says Follow for someone you do not follow', async () => {
    await render(<FollowButton state="none" followsViewer={false} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Follow' })).toBeOnTheScreen();
  });

  it('says Follow back when they follow you', async () => {
    await render(<FollowButton state="none" followsViewer onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Follow back' })).toBeOnTheScreen();
  });

  it('says Requested while waiting, and Following once approved', async () => {
    const view = await render(
      <FollowButton state="requested" followsViewer={false} onPress={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Requested' })).toBeOnTheScreen();
    await view.rerender(<FollowButton state="active" followsViewer onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Following' })).toBeOnTheScreen();
  });

  it('presses through, in both sizes', async () => {
    const onPress = jest.fn();
    const view = await render(
      <FollowButton state="none" followsViewer={false} onPress={onPress} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Follow' }));
    await view.rerender(
      <FollowButton state="none" followsViewer={false} onPress={onPress} size="row" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Follow' }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('is not there for yourself', async () => {
    await render(<FollowButton state="none" followsViewer={false} isMe onPress={jest.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('tells a screen reader it is busy, in both sizes', async () => {
    const view = await render(
      <FollowButton state="active" followsViewer={false} busy onPress={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Following' })).toBeBusy();
    await view.rerender(
      <FollowButton state="active" followsViewer={false} busy onPress={jest.fn()} size="row" />,
    );
    expect(screen.getByRole('button', { name: 'Following' })).toBeBusy();
    await view.rerender(<FollowButton state="active" followsViewer={false} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Following' })).not.toBeBusy();
  });
});
