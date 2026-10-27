import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SettingsRow } from './SettingsRow';

const LONG = 'Ho Chi Minh City, Ho Chi Minh City (HCMC), Vietnam';

describe('SettingsRow', () => {
  it('keeps a long value on one line and lets it shrink, never the label', async () => {
    await render(<SettingsRow icon="pin" label="Home city" value={LONG} onPress={() => {}} />);
    const value = screen.getByText(LONG);
    expect(value.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(value.props.style).flexShrink).toBe(1);
    const label = StyleSheet.flatten(screen.getByText('Home city').props.style);
    expect(label.flexShrink).toBe(0);
  });

  it('shows no value text when there is none', async () => {
    await render(<SettingsRow icon="pin" label="Home city" />);
    expect(screen.getByText('Home city')).toBeOnTheScreen();
  });
});
