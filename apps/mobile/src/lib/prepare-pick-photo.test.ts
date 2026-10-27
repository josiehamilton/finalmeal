import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { preparePickPhoto } from './prepare-pick-photo';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
const mockManipulate = jest.mocked(ImageManipulator.manipulate);
const mockFile = jest.mocked(File);

const jpeg = (() => {
  const view = new Uint8Array(2048);
  view[0] = 0xff;
  view[1] = 0xd8;
  return view.buffer as ArrayBuffer;
})();

function stub(width: number, height: number) {
  const save = jest.fn().mockResolvedValue({ uri: 'file:///out.jpg' });
  const resize = jest.fn().mockReturnValue({ renderAsync: async () => ({ saveAsync: save }) });
  mockManipulate
    .mockReturnValueOnce({ renderAsync: async () => ({ width, height, saveAsync: save }) } as never)
    .mockReturnValueOnce({ resize } as never);
  mockFile.mockImplementation((() => ({ arrayBuffer: async () => jpeg })) as never);
  return { save, resize };
}

describe('preparePickPhoto', () => {
  beforeEach(() => jest.resetAllMocks());

  it('scales a landscape photo to 1600 px wide and returns the JPEG bytes', async () => {
    const { save, resize } = stub(4000, 3000);
    await expect(preparePickPhoto('file:///in.jpg')).resolves.toBe(jpeg);
    expect(mockManipulate).toHaveBeenNthCalledWith(1, 'file:///in.jpg');
    expect(resize).toHaveBeenCalledWith({ width: 1600 });
    expect(save).toHaveBeenCalledWith({ compress: 0.8, format: SaveFormat.JPEG });
    expect(mockFile).toHaveBeenCalledWith('file:///out.jpg');
  });

  it('scales a portrait photo to 1600 px tall', async () => {
    const { resize } = stub(3000, 4000);
    await preparePickPhoto('file:///in.jpg');
    expect(resize).toHaveBeenCalledWith({ height: 1600 });
  });

  it('does not enlarge a small photo', async () => {
    const { resize, save } = stub(800, 600);
    await preparePickPhoto('file:///in.jpg');
    expect(resize).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith({ compress: 0.8, format: SaveFormat.JPEG });
  });

  it('rejects bytes that are not a JPEG', async () => {
    stub(4000, 3000);
    mockFile.mockImplementation((() => ({
      arrayBuffer: async () => new TextEncoder().encode('File not found').buffer,
    })) as never);
    await expect(preparePickPhoto('file:///in.jpg')).rejects.toMatchObject({ name: 'ApiError' });
  });
});
