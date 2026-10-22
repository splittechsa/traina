import { Text } from './Text';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useLocale } from '../i18n/LocaleProvider';

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
  const { locale } = useLocale();
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
            style={[styles.row, { backgroundColor: on ? theme.heroAccent : theme.overlay, borderColor: on ? theme.heroAccent : 'rgba(255,249,239,0.22)' }]}
          >
            <Text style={{ flex: 1, color: on ? theme.goldInk : theme.heroText, fontFamily: fontFamily.semibold, fontSize: typeScale.body, lineHeight: 24, textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: locale === 'ar' ? 'rtl' : 'ltr' }}>
              {option.label}
            </Text>
            <SymbolView
              name={multiple
                ? on
                  ? { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' }
                  : { ios: 'square', android: 'check_box_outline_blank', web: 'check_box_outline_blank' }
                : on
                  ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
                  : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }}
              size={19}
              tintColor={on ? theme.goldInk : theme.heroText}
            />
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
