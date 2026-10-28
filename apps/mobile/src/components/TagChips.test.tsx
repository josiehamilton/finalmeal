import { render, screen } from '@testing-library/react-native';
import { TagChips } from './TagChips';
import { RAMEN, VEGAN } from '../test-support/add-dish';

describe('TagChips', () => {
  it('shows one chip per tag, personal tags too', async () => {
    await render(
      <TagChips
        tags={[
          RAMEN,
          VEGAN,
          { id: 't9', kind: 'personal', name: 'Rainy day', slug: 'rainy-day', featured: false },
        ]}
      />,
    );
    expect(screen.getByText('Ramen')).toBeOnTheScreen();
    expect(screen.getByText('Vegan')).toBeOnTheScreen();
    expect(screen.getByText('Rainy day')).toBeOnTheScreen();
  });

  it('renders nothing without tags', async () => {
    await render(<TagChips tags={[]} />);
    expect(screen.queryByTestId('tag-chips')).toBeNull();
  });
});
