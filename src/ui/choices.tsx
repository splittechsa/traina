import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

export function ChoiceList({
  options,
  value,
  onChange,
  multiple = false,
}: {
  options: readonly { id: string; label: string }[];
  value: string | readonly string[];
  onChange: (id: string) => void;
  multiple?: boolean;
}) {
  const theme = useTheme();
  const selected = new Set(typeof value === 'string' ? [value] : value);
  return (
    <View style={styles.list}>
      {options.map((option) => {
        const on = selected.has(option.id);
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.id)}
            style={[styles.row, { backgroundColor: on ? theme.emphasis : theme.surface, borderColor: on ? theme.emphasis : theme.border }]}
          >
            <Text style={{ color: on ? theme.emphasisText : theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body, lineHeight: 24 }}>
              {option.label}
            </Text>
            <Text style={{ color: on ? theme.emphasisText : theme.textMuted, fontFamily: fontFamily.medium }}>{multiple && on ? '●' : on ? '●' : '○'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[2] },
  row: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
