import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { useLocale } from '../i18n/LocaleProvider';
import { text } from '../i18n/copy';
import { Button, Card, Muted } from './Screen';
import { useKeyboardInset } from './keyboard';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function AppHeader({
  title,
  subtitle,
  trailing,
  large = false,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  large?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: fontFamily.bold, fontSize: large ? typeScale.title : typeScale.headline, lineHeight: large ? 42 : 34 }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

export function ProfileAvatar({ name, onPress }: { name: string; onPress?: () => void }) {
  const theme = useTheme();
  const letter = name.trim().slice(0, 1) || 'ص';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={[styles.avatar, { backgroundColor: theme.lime }]}
    >
      <Text style={{ color: theme.limeInk, fontFamily: fontFamily.bold, fontSize: typeScale.card }}>{letter}</Text>
    </Pressable>
  );
}

export function ActivityRing({
  progress,
  label,
  caption,
  color,
  size = 92,
}: {
  progress: number | null;
  label: string;
  caption: string;
  color?: string;
  size?: number;
}) {
  const theme = useTheme();
  const { reduce } = useMotion();
  const stroke = 9;
  const radiusPx = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const clamped = progress === null ? 0 : Math.min(1, Math.max(0, progress));
  const offset = useSharedValue(circumference);
  useEffect(() => {
    const next = circumference * (1 - clamped);
    offset.value = reduce ? next : withTiming(next, { duration: 700 });
  }, [clamped, circumference, offset, reduce]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const ring = color ?? theme.accent;
  return (
    <View style={styles.ringWrap} accessibilityRole="image" accessibilityLabel={`${caption} ${label}`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radiusPx} stroke={theme.ringTrack} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={ring}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringLabel} pointerEvents="none">
        <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.label, fontVariant: ['tabular-nums'] }}>{label}</Text>
      </View>
      <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.regular, textAlign: 'center' }]}>{caption}</Text>
    </View>
  );
}

export function Sparkline({ values }: { values: readonly number[] }) {
  const theme = useTheme();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 280;
  const height = 72;
  const step = width / (values.length - 1);
  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - 8 - ((value - min) / span) * (height - 16);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityRole="image">
      <Path d={path} stroke={theme.lime} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: theme.surface }]}>
      <View style={{ width: 28, height: 3, borderRadius: radius.pill, backgroundColor: theme.lime, marginBottom: 8 }} />
      <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.2}
        style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.headline, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      {hint !== undefined ? <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>{hint}</Text> : null}
    </View>
  );
}

export function MacroProgress({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const theme = useTheme();
  const { locale } = useLocale();
  const total = protein + carbs + fat;
  const parts = [
    { key: 'protein', share: total === 0 ? 0 : protein / total, color: theme.accent },
    { key: 'carbs', share: total === 0 ? 0 : carbs / total, color: theme.lime },
    { key: 'fat', share: total === 0 ? 0 : fat / total, color: theme.violet },
  ] as const;
  return (
    <View>
      <Muted>{text(locale, 'distribution')}</Muted>
      <View style={[styles.bar, { backgroundColor: theme.ringTrack }]}>
        {parts.map((part) => (
          <View key={part.key} style={{ flex: part.share, backgroundColor: part.color, minWidth: part.share > 0 ? 4 : 0 }} />
        ))}
      </View>
    </View>
  );
}

export function DateSelector({
  days,
  selected,
  onSelect,
  labelFor,
}: {
  days: readonly string[];
  selected: string;
  onSelect: (day: string) => void;
  labelFor: (day: string) => string;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
      {days.map((day) => {
        const active = day === selected;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(day)}
            style={[styles.day, { backgroundColor: active ? theme.hero : theme.surface, borderColor: active ? theme.hero : theme.border }]}
          >
            <Text numberOfLines={1} style={{ color: active ? theme.heroAccent : theme.text, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>
              {labelFor(day)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function WeeklyCalendar(props: {
  days: readonly string[];
  selected: string;
  onSelect: (day: string) => void;
  labelFor: (day: string) => string;
}) {
  return <DateSelector {...props} />;
}

export function WorkoutCard({
  title,
  meta,
  action,
  onPress,
}: {
  title: string;
  meta: string;
  action?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.workout, { backgroundColor: theme.hero }]}>
      <View style={[styles.swatch, { backgroundColor: theme.heroAccent }]} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: typeScale.card }}>{title}</Text>
        <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.regular, fontSize: typeScale.label, marginTop: 4 }}>{meta}</Text>
        {action !== undefined ? (
          <Text style={{ color: theme.heroText, fontFamily: fontFamily.semibold, marginTop: spacing[3] }}>{action}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ExerciseCard({
  title,
  meta,
  onPress,
}: {
  title: string;
  meta: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const mark = title.trim().slice(0, 1);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.exercise, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.mark, { backgroundColor: theme.surfaceMuted }]}>
        <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, fontSize: typeScale.headline }}>{mark}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{title}</Text>
        <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, marginTop: 4 }}>{meta}</Text>
      </View>
    </Pressable>
  );
}

export function MealCard({ title, detail, note }: { title: string; detail: string; note?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.exercise, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.mark, { backgroundColor: theme.violet }]}>
        <Text style={{ color: theme.limeInk, fontFamily: fontFamily.bold }}>{title.slice(0, 1)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{title}</Text>
        <Text style={{ color: theme.text, fontFamily: fontFamily.medium, fontVariant: ['tabular-nums'], marginTop: 4 }}>{detail}</Text>
        {note !== undefined ? <Text style={{ color: theme.warning, fontFamily: fontFamily.regular, fontSize: typeScale.label, marginTop: 4 }}>{note}</Text> : null}
      </View>
    </View>
  );
}

export function AIChatBubble({ role, text: message, note }: { role: 'user' | 'coach'; text: string; note?: string }) {
  const theme = useTheme();
  const mine = role === 'user';
  return (
    <View style={[styles.bubble, { alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? theme.hero : theme.surface, borderColor: mine ? theme.hero : theme.border }]}>
      <Text style={{ color: mine ? theme.heroText : theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 24 }}>{message}</Text>
      {note !== undefined ? <Text style={{ color: mine ? theme.heroAccent : theme.warning, fontFamily: fontFamily.regular, fontSize: typeScale.label, marginTop: 6 }}>{note}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  const theme = useTheme();
  if (compact) {
    return (
      <View style={{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: radius.md, paddingVertical: spacing[2], paddingHorizontal: spacing[3] }}>
        <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.label, marginBottom: 2 }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 18 }} numberOfLines={2}>
          {body}
        </Text>
      </View>
    );
  }
  return (
    <Card tone="muted">
      <Muted>{title}</Muted>
      <Text style={{ color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 24 }}>{body}</Text>
    </Card>
  );
}

export function ErrorState({ body, onRetry }: { body: string; onRetry?: () => void }) {
  const { locale } = useLocale();
  const theme = useTheme();
  return (
    <Card>
      <Text style={{ color: theme.danger, fontFamily: fontFamily.medium, marginBottom: spacing[2] }}>{body}</Text>
      {onRetry !== undefined ? <Button label={text(locale, 'retry')} onPress={onRetry} variant="secondary" /> : null}
    </Card>
  );
}

export function LoadingSkeleton() {
  const theme = useTheme();
  const { reduce } = useMotion();
  const entering = reduce ? undefined : FadeIn.duration(180);
  return (
    <Animated.View entering={entering}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.skeleton, { backgroundColor: theme.surfaceMuted }]} />
      ))}
    </Animated.View>
  );
}

export function PrimaryButton(props: { label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'lime' | 'violet' | 'danger' }) {
  return <Button {...props} />;
}

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, marginBottom: spacing[3] }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingEnd: spacing[4] }}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={[styles.segment, { backgroundColor: selected ? theme.lime : theme.surface, borderColor: selected ? theme.lime : theme.border, minHeight: 44 }]}
          >
            <Text style={{ color: selected ? theme.limeInk : theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.label }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  const { locale, direction } = useLocale();
  const { reduce } = useMotion();
  const keyboard = useKeyboardInset();
  return (
    <Modal visible={visible} transparent animationType={reduce ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.sheetFrame, { marginBottom: keyboard }]}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={text(locale, 'back')} />
        <View style={[styles.sheet, { backgroundColor: theme.background, direction }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.textMuted, fontFamily: fontFamily.semibold, fontSize: typeScale.label, marginTop: spacing[5], marginBottom: spacing[2] }}>
      {children}
    </Text>
  );
}

export function ListRow({
  title,
  meta,
  onPress,
  trailing,
}: {
  title: string;
  meta?: string;
  onPress?: () => void;
  trailing?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={onPress === undefined}
      onPress={onPress}
      style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, paddingVertical: spacing[3] }}
    >
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body, lineHeight: 24 }}>{title}</Text>
        {meta !== undefined ? (
          <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 18, marginTop: 2 }}>{meta}</Text>
        ) : null}
      </View>
      {trailing !== undefined ? <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: typeScale.label }}>{trailing}</Text> : null}
    </Pressable>
  );
}

export function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, { borderColor: theme.border }]}>
      <Text style={{ color: theme.text, fontFamily: fontFamily.medium, fontSize: typeScale.body }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  headerTitle: { writingDirection: 'auto' },
  caption: { fontSize: typeScale.label, lineHeight: 18, writingDirection: 'auto' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', width: 110 },
  ringLabel: { position: 'absolute', top: 36, left: 0, right: 0, alignItems: 'center' },
  metric: { alignSelf: 'stretch', borderRadius: radius.lg, padding: spacing[3], minWidth: 104 },
  bar: { height: 10, borderRadius: radius.pill, overflow: 'hidden', flexDirection: 'row', marginBottom: spacing[3] },
  rail: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  railContent: { gap: spacing[2], alignItems: 'center' },
  day: { borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing[2], paddingHorizontal: spacing[3], alignItems: 'center' },
  workout: { borderRadius: radius.lg, padding: spacing[4], marginBottom: spacing[3], flexDirection: 'row', gap: spacing[3] },
  swatch: { width: 8, borderRadius: radius.pill },
  exercise: { borderWidth: 1, borderRadius: radius.lg, padding: spacing[3], marginBottom: spacing[2], flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  mark: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '86%', borderWidth: 1, borderRadius: radius.lg, padding: spacing[3], marginBottom: spacing[2] },
  skeleton: { height: 88, borderRadius: radius.lg, marginBottom: spacing[3] },
  segment: { borderWidth: 1, borderRadius: radius.pill, paddingVertical: spacing[2], paddingHorizontal: spacing[3], flexGrow: 0, flexShrink: 1, maxWidth: '100%' },
  sheetFrame: { flex: 1, justifyContent: 'flex-end' },
  scrim: { flex: 1, backgroundColor: 'rgba(17,22,20,0.45)' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing[4], maxHeight: '86%' },
  handle: { width: 42, height: 4, borderRadius: radius.pill, alignSelf: 'center', marginBottom: spacing[3] },
  row: { borderBottomWidth: 1, paddingVertical: spacing[4] },
});
