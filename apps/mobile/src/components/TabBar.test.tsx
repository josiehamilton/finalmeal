import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { TabBar } from './TabBar';
import type { TabBarProps } from './TabBar';
import { clearJustOnboarded, markJustOnboarded, useJustOnboarded } from '../state/landing';

const ROUTES = ['feed', 'discover', 'saved', 'you'].map((name) => ({
  key: `${name}-key`,
  name,
}));

function setup(index: number, prevented = false) {
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: prevented })) };
  const navigateToTab = jest.fn();
  const onAdd = jest.fn();
  const props = {
    state: { index, routes: ROUTES },
    emitter,
    navigateToTab,
  } as unknown as TabBarProps;
  return { emitter, navigateToTab, onAdd, ui: <TabBar {...props} onAdd={onAdd} /> };
}

describe('TabBar', () => {
  it('shows Feed, Discover, Add a dish, Saved and You', async () => {
    await render(setup(0).ui);
    for (const name of ['Feed', 'Discover', 'Add a dish', 'Saved', 'You']) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
  });

  it('marks the current tab as selected', async () => {
    await render(setup(3).ui);
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

  it('opens the Add-a-dish flow from the centre button, without switching tabs', async () => {
    const { navigateToTab, onAdd, ui } = setup(0);
    await render(ui);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a dish' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it('never marks the centre button as selected', async () => {
    await render(setup(0).ui);
    expect(screen.getByRole('button', { name: 'Add a dish' })).not.toBeSelected();
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

  describe('the First landing flag', () => {
    beforeEach(() => act(() => clearJustOnboarded()));

    it('clears when the person switches to another tab', async () => {
      const flag = await renderHook(() => useJustOnboarded());
      await act(async () => markJustOnboarded());
      await render(setup(0).ui);
      await fireEvent.press(screen.getByRole('button', { name: 'Discover' }));
      expect(flag.result.current).toBe(false);
    });

    it('stays on while the Add button is used, or the current tab is pressed again', async () => {
      const flag = await renderHook(() => useJustOnboarded());
      await act(async () => markJustOnboarded());
      await render(setup(0).ui);
      await fireEvent.press(screen.getByRole('button', { name: 'Add a dish' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Feed' }));
      expect(flag.result.current).toBe(true);
    });

    it('stays on when a tab press is prevented', async () => {
      const flag = await renderHook(() => useJustOnboarded());
      await act(async () => markJustOnboarded());
      await render(setup(0, true).ui);
      await fireEvent.press(screen.getByRole('button', { name: 'Saved' }));
      expect(flag.result.current).toBe(true);
    });
  });
});
