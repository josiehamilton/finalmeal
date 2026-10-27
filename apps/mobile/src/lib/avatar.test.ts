import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { prepareAvatar } from './avatar';

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
const mockManipulate = jest.mocked(ImageManipulator.manipulate);

describe('prepareAvatar', () => {
  const bytes = new ArrayBuffer(4);
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('crops to a centred square, resizes to 512x512 JPEG at 0.8 and returns the bytes', async () => {
    const save = jest.fn().mockResolvedValue({ uri: 'file:///out.jpg' });
    const finalRef = { saveAsync: save };
    const resize = jest.fn().mockReturnValue({ renderAsync: async () => finalRef });
    const crop = jest.fn().mockReturnValue({ resize });
    const probeRef = { width: 3000, height: 2000 };
    mockManipulate
      .mockReturnValueOnce({ renderAsync: async () => probeRef } as never)
      .mockReturnValueOnce({ crop } as never);
    const fetchMock = jest.fn().mockResolvedValue({ arrayBuffer: async () => bytes });
    globalThis.fetch = fetchMock as never;

    await expect(prepareAvatar('file:///in.jpg')).resolves.toBe(bytes);

    expect(mockManipulate).toHaveBeenNthCalledWith(1, 'file:///in.jpg');
    expect(mockManipulate).toHaveBeenNthCalledWith(2, probeRef);
    expect(crop).toHaveBeenCalledWith({ originX: 500, originY: 0, width: 2000, height: 2000 });
    expect(resize).toHaveBeenCalledWith({ width: 512, height: 512 });
    expect(save).toHaveBeenCalledWith({ compress: 0.8, format: SaveFormat.JPEG });
    expect(fetchMock).toHaveBeenCalledWith('file:///out.jpg');
  });
});
