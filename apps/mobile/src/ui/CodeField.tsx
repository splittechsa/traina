import { Text } from './Text';
import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { verificationDigits } from '../auth/code';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

export function CodeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const digits = verificationDigits(value).padEnd(6, ' ').slice(0, 6).split('');
  return (
    <Pressable accessibilityRole="none" onPress={() => input.current?.focus()} style={styles.wrap}>
      <View style={styles.row} pointerEvents="none">
        {digits.map((digit, index) => (
          <View key={index} style={[styles.slot, { borderColor: digit.trim().length > 0 ? theme.lime : theme.border, backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.title }}>{digit.trim()}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={verificationDigits(value)}
        onChangeText={(next) => onChange(verificationDigits(next))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
        maxLength={6}
        caretHidden
        autoFocus
        style={styles.capture}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing[4], minHeight: 64 },
  row: { flexDirection: 'row', justifyContent: 'space-between', direction: 'ltr' },
  slot: {
    width: 48,
    height: 58,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capture: { ...StyleSheet.absoluteFill, color: 'transparent', fontSize: typeScale.title },
});
