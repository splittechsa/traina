// Shared numeric picker: a real snapping wheel (UIPickerView-style) for integers and
// decimals, with haptic ticks, a typing fallback, and a VoiceOver "adjustable" role.
//
// Decimals are split into two columns (whole + fraction), the way Apple Health does weight —
// 30.0–300.0 kg becomes a 271-row column and a 10-row column instead of one 2,701-row list.
import { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import type { Locale } from '../../format';
import { useTheme } from '../../theme/ThemeProvider';
import { useMotion } from '../../theme/motion';
import { fontFamily, radius, spacing, typeScale } from '../../theme/tokens';
import { tapSelection } from '../haptics';
import { WheelColumn } from './WheelColumn';
import {
  clamp,
  decimalColumns,
  decimalsFromStep,
  formatFixed,
  integerRange,
  joinDecimal,
  normalizeValue,
  roundToStep,
  splitDecimal,
} from './wheelMath';

export type NumberWheelProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** 1 for integers, 0.1 for one decimal, 500 for coarse integer stops, … Default 1. */
  step?: number;
  /** Display precision. Defaults to what `step` implies. */
  decimals?: number;
  suffix?: string;
  locale: Locale;
  accessibilityLabel: string;
  itemHeight?: number;
  /** Odd. Default 5. */
  visibleCount?: number;
  /** Shows "type instead". Default true. */
  allowTyping?: boolean;
  testID?: string;
};

export function NumberWheel({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals,
  suffix,
  locale,
  accessibilityLabel,
  itemHeight = 42,
  visibleCount = 5,
  allowTyping = true,
  testID,
}: NumberWheelProps) {
  const theme = useTheme();
  const { reduce } = useMotion();
  const places = decimals ?? decimalsFromStep(step);
  const isDecimal = places > 0 && step < 1;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const safeValue = clamp(roundToStep(value, step), min, max);

  // Integer mode: one column of legal stops. Decimal mode: whole + fraction columns.
  const integerStops = useMemo(() => (isDecimal ? [] : integerRange(min, max, Math.max(1, Math.round(step)))), [isDecimal, min, max, step]);
  const columns = useMemo(() => (isDecimal ? decimalColumns(min, max, step) : null), [isDecimal, min, max, step]);
  const parts = columns === null ? null : splitDecimal(safeValue, columns.decimals);

  const commit = useCallback(
    (next: number) => {
      const legal = clamp(roundToStep(next, step), min, max);
      if (legal !== value) onChange(legal);
    },
    [max, min, onChange, step, value],
  );

  const display = `${formatFixed(safeValue, places)}${suffix !== undefined ? ` ${suffix}` : ''}`;

  function adjust(direction: 1 | -1) {
    const next = clamp(roundToStep(safeValue + direction * step, step), min, max);
    commit(next);
    tapSelection(reduce);
    AccessibilityInfo.announceForAccessibility(`${formatFixed(next, places)}${suffix !== undefined ? ` ${suffix}` : ''}`);
  }

  function openTyping() {
    setDraft(formatFixed(safeValue, places));
    setEditing(true);
  }

  function finishTyping() {
    const parsed = normalizeValue(draft, min, max, step);
    if (parsed !== null) {
      commit(parsed);
      tapSelection(reduce);
    }
    setEditing(false);
    Keyboard.dismiss();
  }

  const band = (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        start: 0,
        end: 0,
        top: itemHeight * Math.floor(visibleCount / 2),
        height: itemHeight,
        borderRadius: radius.sm,
        backgroundColor: theme.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    />
  );

  const unit =
    suffix !== undefined ? (
      <Text style={{ color: theme.textMuted, fontFamily: fontFamily.semibold, fontSize: typeScale.card, marginHorizontal: spacing[2] }}>{suffix}</Text>
    ) : null;

  return (
    <View testID={testID} style={{ gap: spacing[2] }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: display }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') adjust(1);
          if (event.nativeEvent.actionName === 'decrement') adjust(-1);
        }}
        style={{ height: itemHeight * visibleCount, justifyContent: 'center' }}
      >
        {band}
        {/* Numbers read left-to-right in Arabic too, so the column row is pinned LTR;
            the unit sits on the reading-end side for each language. */}
        <View style={{ flexDirection: 'row', direction: 'ltr', justifyContent: 'center', alignItems: 'center' }}>
          {locale === 'ar' ? unit : null}
          {columns === null || parts === null ? (
            <WheelColumn
              labels={integerStops.map(String)}
              index={Math.max(0, integerStops.indexOf(safeValue))}
              onIndexChange={(i) => commit(integerStops[i] ?? safeValue)}
              itemHeight={itemHeight}
              visibleCount={visibleCount}
              minWidth={84}
            />
          ) : (
            <>
              <WheelColumn
                labels={columns.wholes.map(String)}
                index={Math.max(0, columns.wholes.indexOf(parts.whole))}
                onIndexChange={(i) => commit(joinDecimal(columns.wholes[i] ?? parts.whole, parts.fraction, columns.decimals))}
                itemHeight={itemHeight}
                visibleCount={visibleCount}
                minWidth={72}
              />
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.title }}>.</Text>
              <WheelColumn
                labels={columns.fractions.map((f) => String(f).padStart(columns.decimals, '0'))}
                index={Math.max(0, columns.fractions.indexOf(parts.fraction))}
                onIndexChange={(i) => commit(joinDecimal(parts.whole, columns.fractions[i] ?? parts.fraction, columns.decimals))}
                itemHeight={itemHeight}
                visibleCount={visibleCount}
                minWidth={44}
              />
            </>
          )}
          {locale === 'ar' ? null : unit}
        </View>
      </View>
      {allowTyping ? (
        editing ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={finishTyping}
            onBlur={finishTyping}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
            accessibilityLabel={accessibilityLabel}
            style={{
              alignSelf: 'center',
              minWidth: 140,
              textAlign: 'center',
              color: theme.text,
              fontFamily: fontFamily.semibold,
              fontSize: typeScale.card,
              paddingVertical: spacing[2],
              paddingHorizontal: spacing[4],
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: theme.accent,
              backgroundColor: theme.surface,
            }}
          />
        ) : (
          <Pressable
            onPress={openTyping}
            accessibilityRole="button"
            accessibilityLabel={locale === 'ar' ? 'اكتب الرقم بدلاً من التمرير' : 'Type the number instead'}
            hitSlop={8}
            style={({ pressed }) => ({
              alignSelf: 'center',
              paddingVertical: spacing[1] + 2,
              paddingHorizontal: spacing[4],
              borderRadius: radius.pill,
              backgroundColor: pressed ? theme.surfaceMuted : 'transparent',
            })}
          >
            <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: typeScale.label }}>
              {locale === 'ar' ? 'اكتب الرقم' : 'Type a value'}
            </Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}
