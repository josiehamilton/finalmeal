import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createPersonalTag, searchTags } from '@finalmeal/api';
import type { Tag } from '@finalmeal/api';
import TagsSearch from '../../app/(app)/add/tags-search';
import { RAMEN, VEGAN, readDraft, withDraft } from '../test-support/add-dish';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
let mockParams: Record<string, string> = { kind: 'food_type' };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  searchTags: jest.fn(),
  createPersonalTag: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockSearch = jest.mocked(searchTags);
const mockCreate = jest.mocked(createPersonalTag);

const tag = (id: string, name: string, kind: Tag['kind'] = 'food_type'): Tag => ({
  id,
  kind,
  name,
  slug: name.toLowerCase(),
  featured: false,
});
const KOREAN = tag('k1', 'Korean');
const KOREAN_BBQ = tag('k2', 'Korean BBQ');

async function wait(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('Tag search', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockParams = { kind: 'food_type' };
    mockSearch.mockImplementation(async (_c, kind, q) => {
      if (q === '') return kind === 'dietary' ? [VEGAN] : [RAMEN, tag('t3', 'Pho')];
      return kind === 'dietary' ? [] : [KOREAN, KOREAN_BBQ];
    });
  });
  afterEach(() => jest.useRealTimers());

  it('is titled Add food type with a Done action and a Food type | Dietary switch', async () => {
    await render(withDraft(<TagsSearch />));
    await wait(0);
    expect(screen.getByText('Add food type')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Done' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Food type' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Dietary' })).not.toBeSelected();
    expect(screen.getByPlaceholderText('Search food types')).toBeOnTheScreen();
  });

  it('opens on Dietary when asked to', async () => {
    mockParams = { kind: 'dietary' };
    await render(withDraft(<TagsSearch />));
    await wait(0);
    expect(screen.getByText('Add dietary')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Search dietary')).toBeOnTheScreen();
  });

  it('switches kind with the segmented control', async () => {
    await render(withDraft(<TagsSearch />));
    await wait(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Dietary' }));
    await wait(0);
    expect(screen.getByText('Add dietary')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Vegan' })).toBeOnTheScreen();
  });

  it('shows a Popular chip row when the query is empty', async () => {
    await render(withDraft(<TagsSearch />));
    await wait(0);
    expect(mockSearch).toHaveBeenCalledWith({ fake: 'client' }, 'food_type', '', 24);
    expect(screen.getByText('Popular')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ramen' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pho' })).toBeOnTheScreen();
    expect(screen.queryByText(/Not here\?/)).toBeNull();
  });

  it('toggles a Popular chip onto the draft', async () => {
    await render(withDraft(<TagsSearch />));
    await wait(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Ramen' }));
    expect(readDraft(screen).tags).toEqual([RAMEN]);
    expect(screen.getByRole('button', { name: 'Ramen' })).toBeSelected();
  });

  it('searches after 300 ms and shows results with an add/check toggle', async () => {
    await render(withDraft(<TagsSearch />, { tags: [KOREAN] }));
    await wait(0);
    mockSearch.mockClear();
    await fireEvent.changeText(screen.getByPlaceholderText('Search food types'), 'kor');
    await wait(299);
    expect(mockSearch).not.toHaveBeenCalled();
    await wait(1);
    expect(mockSearch).toHaveBeenCalledWith({ fake: 'client' }, 'food_type', 'kor', 10);
    expect(screen.queryByText('Popular')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Korean' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Add Korean BBQ' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Add Korean BBQ' }));
    expect(readDraft(screen).tags.map((t) => t.name)).toEqual(['Korean', 'Korean BBQ']);
  });

  it('creates a personal tag from the footer and selects it by name', async () => {
    mockCreate.mockResolvedValue(tag('x1', 'kor', 'personal'));
    await render(withDraft(<TagsSearch />));
    await wait(0);
    await fireEvent.changeText(screen.getByPlaceholderText('Search food types'), 'kor');
    await wait(300);
    const footer = screen.getByRole('button', { name: 'Not here? Add “kor” to Your tags instead' });
    await fireEvent.press(footer);
    await wait(0);
    expect(mockCreate).toHaveBeenCalledWith({ fake: 'client' }, 'kor');
    expect(readDraft(screen).personalTags).toEqual(['kor']);
  });

  it('shows friendly copy when the personal tag name is refused', async () => {
    const { ApiError } = jest.requireActual<typeof import('@finalmeal/api')>('@finalmeal/api');
    mockCreate.mockRejectedValue(new ApiError('too long', 'invalid_tag_name'));
    await render(withDraft(<TagsSearch />));
    await wait(0);
    await fireEvent.changeText(screen.getByPlaceholderText('Search food types'), 'kor');
    await wait(300);
    await fireEvent.press(screen.getByRole('button', { name: /Not here\?/ }));
    await wait(0);
    expect(screen.getByText('Tags can be up to 40 characters.')).toBeOnTheScreen();
  });

  it('goes back on Done and on the arrow', async () => {
    await render(withDraft(<TagsSearch />));
    await wait(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(2);
  });
});
