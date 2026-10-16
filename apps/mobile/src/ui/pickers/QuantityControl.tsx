// Compact quantity control: big tappable value, −/+ with press-and-hold acceleration,
// optional preset chips, and tap-to-type. Used where a wheel is the wrong tool (food grams,
// sets, servings) — fast for both small nudges and big jumps.
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useMotion } from '../../theme/motion';
import { fontFamily, radius, spacing, typeScale } from '../../theme/tokens';
import { tapImpact, tapSelection } from '../haptics';
import { clamp, normalizeValue, roundToStep } from './wheelMath';

export type QuantityPreset = { label: string; value: number };

export type QuantityControlProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  presets?: readonly QuantityPreset[];
  accessibilityLabel: string;
  testID?: string;
};

const HOLD_DELAY_MS = 380;
const HOLD_INTERVAL_MS = 70;

function StepButton({ glyph, onStep, disabled, label }: { glyph: string; onStep: (multiplier: number) => void; disabled: boolean; label: string }) {
  const theme = useTheme();
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const ticks = useRef(0);

  function stop() {
    if (delay.current !== null) clearTimeout(delay.current);
    if (repeat.current !== null) clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
    ticks.current = 0;
  }

  useEffect(() => stop, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={() => {
        onStep(1);
        delay.current = setTimeout(() => {
          repeat.current = setInterval(() => {
            ticks.current += 1;
            // Accelerate: 1× for the first ~0.7 s of holding, then 5×, then 10×.
            onStep(ticks.current > 20 ? 10 : ticks.current > 10 ? 5 : 1);
          }, HOLD_INTERVAL_MS);
        }, HOLD_DELAY_MS);
      }}
      onPressOut={stop}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.accent : theme.surfaceMuted,
        opacity: disabled ? 0.35 : 1,
      })}
    >
      {({ pressed }) => (
        <Text style={{ color: pressed ? theme.emphasisText : theme.text, fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 30 }}>{glyph}</Text>
      )}
    </Pressable>
  );
}

export function QuantityControl({ value, onChange, min, max, step, unit, presets, accessibilityLabel, testID }: QuantityControlProps) {
  const theme = useTheme();
  const { reduce } = useMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const latest = useRef(value);
  latest.current = value;

  function stepBy(direction: 1 | -1, multiplier: number) {
    const next = clamp(roundToStep(latest.current + direction * step * multiplier, step), min, max);
    if (next !== latest.current) {
      latest.current = next;
      onChange(next);
      tapSelection(reduce);
    }
  }

  function finishTyping() {
    const parsed = normalizeValue(draft, min, max, step);
    if (parsed !== null) onChange(parsed);
    setEditing(false);
    Keyboard.dismiss();
  }

  return (
    <View testID={testID} style={{ gap: spacing[3] }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: `${value}${unit !== undefined ? ` ${unit}` : ''}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') stepBy(1, 1);
          if (event.nativeEvent.actionName === 'decrement') stepBy(-1, 1);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <StepButton glyph="−" label="−" disabled={value <= min} onStep={(m) => stepBy(-1, m)} />
        {editing ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={finishTyping}
            onBlur={finishTyping}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
            style={{ flex: 1, textAlign: 'center', color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.numeric }}
          />
        ) : (
          <Pressable
            onPress={() => {
              setDraft(String(value));
              setEditing(true);
            }}
            style={{ flex: 1, alignItems: 'center' }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[1] }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.numeric, fontVariant: ['tabular-nums'] }}>{value}</Text>
              {unit !== undefined ? <Text style={{ color: theme.textMuted, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{unit}</Text> : null}
            </View>
          </Pressable>
        )}
        <StepButton glyph="+" label="+" disabled={value >= max} onStep={(m) => stepBy(1, m)} />
      </View>
      {presets !== undefined && presets.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
          {presets.map((preset) => {
            const active = preset.value === value;
            return (
              <Pressable
                key={`${preset.label}-${preset.value}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onChange(clamp(preset.value, min, max));
                  tapImpact(reduce);
                }}
                style={{
                  paddingVertical: spacing[2],
                  paddingHorizontal: spacing[3] + 2,
                  borderRadius: radius.pill,
                  backgroundColor: active ? theme.accent : theme.surfaceMuted,
                }}
              >
                <Text style={{ color: active ? theme.emphasisText : theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.label }}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
