import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { searchTags } from '@finalmeal/api';
import { RAMEN } from '../test-support/add-dish';
import { TagPicker } from './TagPicker';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  searchTags: jest.fn(),
  createPersonalTag: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));

const settle = () => act(async () => {});
const noop = () => {};

function picker(disabled: boolean) {
  return (
    <TagPicker
      inline
      disabled={disabled}
      tags={[]}
      personalTags={[]}
      onToggleTag={noop}
      onTogglePersonal={noop}
      onSelectPersonal={noop}
      onMore={noop}
    />
  );
}

describe('TagPicker', () => {
  beforeEach(() => {
    jest.mocked(searchTags).mockResolvedValue([RAMEN]);
  });

  it('opens the box to name your own tag', async () => {
    await render(picker(false));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Your own' }));
    expect(screen.getByLabelText('Name your tag')).toBeEnabled();
  });

  it('closes an open “Your own” box when the picker becomes locked', async () => {
    await render(picker(false));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Your own' }));
    await fireEvent.changeText(screen.getByLabelText('Name your tag'), 'Date night');
    expect(screen.getByRole('button', { name: 'Add tag' })).toBeEnabled();

    await screen.rerender(picker(true));
    await settle();
    expect(screen.queryByLabelText('Name your tag')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add tag' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Your own' })).toBeDisabled();
  });
});
