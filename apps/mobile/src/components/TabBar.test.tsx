import { fireEvent, render, screen } from '@testing-library/react-native';
import { TabBar } from './TabBar';
import type { TabBarProps } from './TabBar';

const ROUTES = ['feed', 'discover', 'add', 'saved', 'you'].map((name) => ({
  key: `${name}-key`,
  name,
}));

function setup(index: number, prevented = false) {
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: prevented })) };
  const navigateToTab = jest.fn();
  const props = {
    state: { index, routes: ROUTES },
    emitter,
    navigateToTab,
  } as unknown as TabBarProps;
  return { emitter, navigateToTab, ui: <TabBar {...props} /> };
}

describe('TabBar', () => {
  it('shows Feed, Discover, Add a dish, Saved and You', async () => {
    await render(setup(0).ui);
    for (const name of ['Feed', 'Discover', 'Add a dish', 'Saved', 'You']) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
  });

  it('marks the current tab as selected', async () => {
    await render(setup(4).ui);
    expect(screen.getByRole('button', { name: 'You' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Feed' })).not.toBeSelected();
  });

  it('navigates when another tab is pressed', async () => {
    const { emitter, navigateToTab, ui } = setup(0);
    await render(ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Saved' }));
    expect(emitter.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'saved-key',
      canPreventDefault: true,
    });
    expect(navigateToTab).toHaveBeenCalledWith('saved-key');
  });

  it('opens the Add screen from the centre button', async () => {
    const { navigateToTab, ui } = setup(0);
    await render(ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a dish' }));
    expect(navigateToTab).toHaveBeenCalledWith('add-key');
  });

  it('does not navigate to the tab it is already on, or when the press is prevented', async () => {
    const same = setup(0);
    const view = await render(same.ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Feed' }));
    expect(same.navigateToTab).not.toHaveBeenCalled();
    await view.unmount();
    const blocked = setup(0, true);
    await render(blocked.ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Discover' }));
    expect(blocked.navigateToTab).not.toHaveBeenCalled();
  });
});
