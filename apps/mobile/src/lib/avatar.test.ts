import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { friendlyMessage } from '@finalmeal/api';
import { prepareAvatar } from './avatar';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
const mockFile = jest.mocked(File);

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
const mockManipulate = jest.mocked(ImageManipulator.manipulate);

describe('prepareAvatar', () => {
  const jpegBytes = (length: number) => {
    const view = new Uint8Array(length);
    view[0] = 0xff;
    view[1] = 0xd8;
    return view.buffer as ArrayBuffer;
  };
  const bytes = jpegBytes(2048);
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();

  /** The manipulator chain up to the saved file, which is where the bytes get read. */
  function stubManipulator(savedUri = 'file:///out.jpg') {
    const save = jest.fn().mockResolvedValue({ uri: savedUri });
    const resize = jest.fn().mockReturnValue({ renderAsync: async () => ({ saveAsync: save }) });
    const crop = jest.fn().mockReturnValue({ resize });
    mockManipulate
      .mockReturnValueOnce({ renderAsync: async () => ({ width: 3000, height: 2000 }) } as never)
      .mockReturnValueOnce({ crop } as never);
    return { save, resize, crop };
  }
  /** `new File(uri).arrayBuffer()` resolves to `result`. */
  function stubFileBytes(result: ArrayBuffer) {
    const arrayBuffer = jest.fn().mockResolvedValue(result);
    mockFile.mockImplementation((() => ({ arrayBuffer })) as never);
    return arrayBuffer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = fetchMock as never;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('crops to a centred square, resizes to 512x512 JPEG at 0.8 and returns the bytes', async () => {
    const { save, resize, crop } = stubManipulator();
    const arrayBuffer = stubFileBytes(bytes);

    await expect(prepareAvatar('file:///in.jpg')).resolves.toBe(bytes);

    expect(mockManipulate).toHaveBeenNthCalledWith(1, 'file:///in.jpg');
    expect(crop).toHaveBeenCalledWith({ originX: 500, originY: 0, width: 2000, height: 2000 });
    expect(resize).toHaveBeenCalledWith({ width: 512, height: 512 });
    expect(save).toHaveBeenCalledWith({ compress: 0.8, format: SaveFormat.JPEG });
    expect(mockFile).toHaveBeenCalledWith('file:///out.jpg');
    expect(arrayBuffer).toHaveBeenCalledTimes(1);
  });

  it('reads the saved file with expo-file-system, never with fetch (Android returns "File not found" for it)', async () => {
    stubManipulator('file:///cache/ImageManipulator/abc.jpg');
    stubFileBytes(bytes);

    await prepareAvatar('file:///in.jpg');

    expect(mockFile).toHaveBeenCalledWith('file:///cache/ImageManipulator/abc.jpg');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects the 14-byte "File not found" body instead of returning it for upload', async () => {
    stubManipulator();
    stubFileBytes(new TextEncoder().encode('File not found').buffer as ArrayBuffer);

    const attempt = prepareAvatar('file:///in.jpg');
    await expect(attempt).rejects.toMatchObject({ name: 'ApiError', code: 'unknown' });
    await attempt.catch((e) => expect(friendlyMessage(e)).toBe('Something went wrong. Try again.'));
  });

  it.each([
    ['empty', new ArrayBuffer(0)],
    ['under 100 bytes', jpegBytes(99)],
    ['not starting FF D8', new Uint8Array(500).fill(0x41).buffer as ArrayBuffer],
  ])('rejects bytes that are %s', async (_label, notAJpeg) => {
    stubManipulator();
    stubFileBytes(notAJpeg);
    await expect(prepareAvatar('file:///in.jpg')).rejects.toMatchObject({ code: 'unknown' });
  });

  it('passes a failure to read the file up as an error', async () => {
    stubManipulator();
    const arrayBuffer = jest.fn().mockRejectedValue(new Error('gone'));
    mockFile.mockImplementation((() => ({ arrayBuffer })) as never);
    await expect(prepareAvatar('file:///in.jpg')).rejects.toThrow('gone');
  });
});
