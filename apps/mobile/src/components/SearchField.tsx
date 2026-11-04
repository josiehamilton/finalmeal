import { StyleSheet, TextInput, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

/** How long to wait after the last keystroke before searching a people list. */
export const SEARCH_DEBOUNCE_MS = 300;

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** The placeholder and the accessibility label, such as "Search followers". */
  label: string;
}

/** The canvas search box: a 44-point raised field with a search icon. */
export function SearchField({ value, onChangeText, label }: SearchFieldProps) {
  return (
    <View style={styles.box}>
      <Icon name="search" size={18} color={colors.dim} />
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={colors.dim}
        selectionColor={colors.emberGlow}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.ash,
  },
  input: { flex: 1, fontFamily: fontFamily.ui, fontSize: 15, color: colors.bone, padding: 0 },
});
