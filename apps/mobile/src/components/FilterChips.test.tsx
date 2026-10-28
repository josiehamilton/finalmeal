import { fireEvent, render, screen } from '@testing-library/react-native';
import { chipOptions } from '@finalmeal/core';
import { FilterChips } from './FilterChips';
import { seedPicks } from '../test-support/seed-picks';

const OPTIONS = chipOptions(seedPicks());

describe('FilterChips', () => {
  it('shows All first, then the cities, then the tags', async () => {
    await render(<FilterChips options={OPTIONS} selected={null} onSelect={jest.fn()} />);
    const names = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(names.slice(0, 4)).toEqual(['All', 'Vancouver', 'Tokyo', 'New York']);
    expect(names).toContain('Sushi');
    expect(names).toContain('Gluten-free');
    expect(names).toContain('Splurge');
    expect(names.indexOf('Saskatoon')).toBeLessThan(names.indexOf('Sushi'));
  });

  it('marks All as selected when no filter is active', async () => {
    await render(<FilterChips options={OPTIONS} selected={null} onSelect={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Vancouver' })).not.toBeSelected();
  });

  it('marks only the chosen chip as selected', async () => {
    const vancouver = OPTIONS.find((o) => o.label === 'Vancouver')!;
    await render(<FilterChips options={OPTIONS} selected={vancouver} onSelect={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Vancouver' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'All' })).not.toBeSelected();
  });

  it('reports the chosen option, and null for All', async () => {
    const onSelect = jest.fn();
    await render(<FilterChips options={OPTIONS} selected={null} onSelect={onSelect} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tokyo' }));
    expect(onSelect).toHaveBeenLastCalledWith(OPTIONS.find((o) => o.label === 'Tokyo'));
    await fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
