import { act, render, screen } from '@testing-library/react-native';
import { Keyboard, Text, View } from 'react-native';
import type { KeyboardMetrics } from 'react-native';
import { KeyboardAvoider } from './KeyboardAvoider';

/** Where the avoider sits in the window: y 0, 800 tall, so its bottom edge is at 800. */
const BOX = { y: 0, height: 800 };

function keyboard(screenY: number): KeyboardMetrics {
  return { screenX: 0, screenY, width: 400, height: 900 - screenY };
}
const padding = () => screen.getByTestId('keyboard-avoider').props.style;

describe('KeyboardAvoider', () => {
  let shown: ((e: { endCoordinates: KeyboardMetrics }) => void) | undefined;
  let hidden: (() => void) | undefined;

  beforeEach(() => {
    shown = undefined;
    hidden = undefined;
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
    jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event: string, listener: (...args: never[]) => void) => {
        if (/Show$/.test(event)) shown = listener as never;
        if (/Hide$/.test(event)) hidden = listener as never;
        return { remove: jest.fn() } as never;
      });
    // The host View has no layout under Jest; give it the box above.
    jest
      .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
      .mockImplementation(((cb: (x: number, y: number, w: number, h: number) => void) =>
        cb(0, BOX.y, 400, BOX.height)) as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('renders its children in a full-height wrapper with no padding while the keyboard is hidden', async () => {
    await render(
      <KeyboardAvoider>
        <Text>content</Text>
      </KeyboardAvoider>,
    );
    expect(screen.getByText('content')).toBeOnTheScreen();
    expect(padding()).toEqual(expect.arrayContaining([expect.objectContaining({ flex: 1 })]));
    expect(padding()).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 0 })]),
    );
  });

  it('pads the bottom by how far the keyboard overlaps it, and removes it when the keyboard hides', async () => {
    await render(
      <KeyboardAvoider>
        <Text>content</Text>
      </KeyboardAvoider>,
    );
    await act(async () => shown?.({ endCoordinates: keyboard(500) }));
    expect(padding()).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 300 })]),
    );
    await act(async () => hidden?.());
    expect(padding()).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 0 })]),
    );
  });

  it('pads at once when the keyboard is already open as the screen mounts', async () => {
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(keyboard(600));
    await render(
      <KeyboardAvoider>
        <Text>content</Text>
      </KeyboardAvoider>,
    );
    expect(padding()).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 200 })]),
    );
  });
});
