import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Pick } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

interface PickActionsProps {
  pick: Pick;
  /** How many Final Meal picks the person has (the last slot is the highest). */
  finalCount: number;
  onEdit: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  /** Something is in flight: the menu button is off. */
  disabled?: boolean;
}

interface Item {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/** The overflow menu on a pick: Edit, move between lists, reorder a final, and remove (after a confirm). */
export function PickActions({
  pick,
  finalCount,
  onEdit,
  onPromote,
  onDemote,
  onMove,
  onRemove,
  disabled = false,
}: PickActionsProps) {
  const [open, setOpen] = useState(false);
  const isFinal = pick.tier === 'final' && pick.slot !== null;
  const slot = pick.slot ?? 0;

  function confirmRemove() {
    Alert.alert(`Remove ${pick.dish.name}? This can’t be undone.`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
  }

  const items: Item[] = [
    { label: 'Edit', onPress: onEdit },
    isFinal
      ? { label: 'Move to Honorable', onPress: onDemote }
      : { label: 'Make it a Final Meal', onPress: onPromote },
    ...(isFinal
      ? [
          { label: 'Move up', onPress: () => onMove('up'), disabled: slot <= 1 },
          { label: 'Move down', onPress: () => onMove('down'), disabled: slot >= finalCount },
        ]
      : []),
    { label: 'Remove from my list', onPress: confirmRemove, danger: true },
  ];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More actions"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <Icon name="more" size={21} color={colors.bone} />
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        {open ? (
          <View style={styles.overlay}>
            <Pressable
              accessibilityLabel="Close menu"
              style={styles.backdrop}
              onPress={() => setOpen(false)}
            />
            <View accessibilityRole="menu" style={styles.sheet}>
              {items.map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  accessibilityState={{ disabled: item.disabled === true }}
                  disabled={item.disabled}
                  onPress={() => {
                    setOpen(false);
                    item.onPress();
                  }}
                  style={[styles.item, item.disabled && styles.itemOff]}
                >
                  <Text style={[styles.itemText, item.danger && styles.itemDanger]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.ash,
    borderTopWidth: 1,
    borderColor: colors.lineStrong,
  },
  item: { height: 52, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12 },
  itemOff: { opacity: 0.4 },
  itemText: { fontFamily: fontFamily.uiSemiBold, fontSize: 16, color: colors.bone },
  itemDanger: { color: colors.danger },
});
