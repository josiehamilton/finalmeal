import { ApiError, promotePick, updatePick } from '@finalmeal/api';
import type { Tag } from '@finalmeal/api';
import { preparePickPhoto } from '../lib/prepare-pick-photo';
import { PLACE, RAMEN, VEGAN } from '../test-support/add-dish';
import { makePick } from '../test-support/picks';
import { initialDraft } from './add-dish';
import type { AddDishDraft } from './add-dish';
import { promoteWithDraft } from './promote-with-draft';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  promotePick: jest.fn(),
  updatePick: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../lib/prepare-pick-photo', () => ({ preparePickPhoto: jest.fn() }));

const CLIENT = { fake: 'client' };
const mockPromote = jest.mocked(promotePick);
const mockUpdate = jest.mocked(updatePick);
const mockPrepare = jest.mocked(preparePickPhoto);
const BYTES = new ArrayBuffer(8);

const RAINY: Tag = { id: 'tp1', kind: 'personal', name: 'Rainy day', slug: 'rainy-day', featured: false };

function draft(overrides: Partial<AddDishDraft> = {}): AddDishDraft {
  return { ...initialDraft, place: PLACE, dishName: 'Tonkotsu Ramen', ...overrides };
}
const existing = (overrides = {}) =>
  makePick({ id: 'h9', tier: 'honorable', slot: null, ...overrides });

describe('promoteWithDraft', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPromote.mockResolvedValue(makePick());
    mockUpdate.mockResolvedValue(makePick());
    mockPrepare.mockResolvedValue(BYTES);
  });

  it('promotes without a slot argument when none is given, and with one when it is', async () => {
    await promoteWithDraft(existing(), draft());
    expect(mockPromote).toHaveBeenLastCalledWith(CLIENT, 'h9');
    await promoteWithDraft(existing(), draft(), 3);
    expect(mockPromote).toHaveBeenLastCalledWith(CLIENT, 'h9', 3);
  });

  it('does not touch the pick again when the draft adds nothing', async () => {
    const result = await promoteWithDraft(existing(), draft());
    expect(result).toEqual({ photoFailed: false });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('merges tags (union), fills a blank note and adds the photo to a bare pick', async () => {
    const result = await promoteWithDraft(
      existing({ tags: [VEGAN, RAINY] }),
      draft({
        tags: [RAMEN, VEGAN],
        personalTags: ['Date night', ' rainy  DAY '],
        note: '  Great broth ',
        photoUri: 'file:///a.jpg',
      }),
    );
    expect(result).toEqual({ photoFailed: false });
    expect(mockPrepare).toHaveBeenCalledWith('file:///a.jpg');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(CLIENT, 'h9', {
      tagIds: ['t2', 't1'],
      personalTags: ['Rainy day', 'Date night'],
      note: 'Great broth',
      photo: BYTES,
    });
  });

  it('never overwrites an existing photo or note', async () => {
    await promoteWithDraft(
      existing({ note: 'Mine first', photoUrl: 'https://x/old.jpg', tags: [VEGAN] }),
      draft({ tags: [RAMEN], note: 'New words', photoUri: 'file:///new.jpg' }),
    );
    expect(mockPrepare).not.toHaveBeenCalled();
    const patch = mockUpdate.mock.calls[0]![2];
    expect(patch).toEqual({ tagIds: ['t2', 't1'], personalTags: [] });
    expect(patch).not.toHaveProperty('note');
    expect(patch).not.toHaveProperty('photo');
  });

  it('treats a whitespace-only existing note as empty', async () => {
    await promoteWithDraft(existing({ note: '   ' }), draft({ note: 'Fresh' }));
    expect(mockUpdate).toHaveBeenCalledWith(CLIENT, 'h9', expect.objectContaining({ note: 'Fresh' }));
  });

  it('skips the update when the existing pick already has everything the draft brings', async () => {
    await promoteWithDraft(
      existing({ note: 'Mine', photoUrl: 'https://x/old.jpg', tags: [RAMEN, RAINY] }),
      draft({ tags: [RAMEN], personalTags: ['rainy day'], note: 'Other', photoUri: 'file:///n.jpg' }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('reports photoFailed and still applies the rest when the photo cannot be prepared', async () => {
    mockPrepare.mockRejectedValue(new Error('resize failed'));
    const result = await promoteWithDraft(existing(), draft({ tags: [RAMEN], photoUri: 'file:///a.jpg' }));
    expect(result).toEqual({ photoFailed: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0]![2]).toEqual({ tagIds: ['t1'], personalTags: [] });
  });

  it('reports photoFailed and retries without the photo when the upload fails', async () => {
    mockUpdate
      .mockRejectedValueOnce(new ApiError('timed out', 'timeout'))
      .mockResolvedValueOnce(makePick());
    const result = await promoteWithDraft(
      existing(),
      draft({ tags: [RAMEN], note: 'Great', photoUri: 'file:///a.jpg' }),
    );
    expect(result).toEqual({ photoFailed: true });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[0]![2]).toHaveProperty('photo', BYTES);
    expect(mockUpdate.mock.calls[1]![2]).toEqual({ tagIds: ['t1'], personalTags: [], note: 'Great' });
  });

  it('reports photoFailed when a photo-only update fails, with nothing else to retry', async () => {
    mockUpdate.mockRejectedValue(new ApiError('bad', 'invalid_photo'));
    const result = await promoteWithDraft(existing(), draft({ photoUri: 'file:///a.jpg' }));
    expect(result).toEqual({ photoFailed: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('lets a failed promote through without touching the pick', async () => {
    mockPromote.mockRejectedValue(new ApiError('full', 'final_full'));
    await expect(promoteWithDraft(existing(), draft({ tags: [RAMEN] }), 2)).rejects.toMatchObject({
      code: 'final_full',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
