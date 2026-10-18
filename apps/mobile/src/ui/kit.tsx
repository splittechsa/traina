import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { motion, useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { useLocale } from '../i18n/LocaleProvider';
import { text } from '../i18n/copy';
import { Button, Card, Muted } from './Screen';
import { useKeyboardInset } from './keyboard';
import { TrainaMark, TrainaMotif } from './brand';

type SettingsIcon = ComponentProps<typeof SymbolView>['name'];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Native-style back control. With I18nManager RTL, the first flex child sits on the
 * trailing edge (right in Arabic). The chevron points "back" along the reading axis:
 * Arabic → chevron.right, English → chevron.left.
 */
export function StackBackControl({
  label,
  onPress,
  confirmUnsaved,
}: {
  label?: string;
  onPress?: () => void;
  /** When true, confirm before leaving (workout / form sessions). */
  confirmUnsaved?: { title: string; body: string; leave: string; stay: string };
} = {}) {
  const theme = useTheme();
  const { locale, direction } = useLocale();
  const rtl = direction === 'rtl';

  function goBack() {
    if (onPress !== undefined) {
      onPress();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  }

  function handlePress() {
    if (confirmUnsaved === undefined) {
      goBack();
      return;
    }
    // Lazy require avoids circular imports with Alert-only callers.
    const { Alert } = require('react-native') as typeof import('react-native');
    Alert.alert(confirmUnsaved.title, confirmUnsaved.body, [
      { text: confirmUnsaved.stay, style: 'cancel' },
      { text: confirmUnsaved.leave, style: 'destructive', onPress: goBack },
    ]);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? text(locale, 'back')}
      onPress={handlePress}
      hitSlop={12}
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
        backgroundColor: theme.surfaceMuted,
      }}
    >
      <SymbolView
        name={{
          ios: rtl ? 'chevron.right' : 'chevron.left',
          android: rtl ? 'chevron_right' : 'chevron_left',
          web: rtl ? 'chevron_right' : 'chevron_left',
        }}
        size={18}
        tintColor={theme.accent}
      />
    </Pressable>
  );
}

export function AppHeader({
  title,
  subtitle,
  trailing,
  large = false,
  branded = true,
  showBack = false,
  onBack,
  confirmUnsaved,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  large?: boolean;
  branded?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  confirmUnsaved?: { title: string; body: string; leave: string; stay: string };
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  const size = large ? typeScale.hero : typeScale.title;
  const align = locale === 'ar' ? 'right' as const : 'left' as const;
  // Rely on native RTL flex mirroring: leading slot = start edge (right in ar, left in en).
  const leading = showBack ? (
    <StackBackControl onPress={onBack} confirmUnsaved={confirmUnsaved} />
  ) : branded ? (
    <TrainaMark size={large ? 42 : 34} />
  ) : (
    <View style={{ width: 44 }} />
  );
  return (
    <View style={styles.header} accessibilityRole="header">
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            styles.headerTitle,
            {
              color: theme.text,
              fontFamily: fontFamily.bold,
              fontSize: size,
              lineHeight: size * 1.22,
              writingDirection: 'auto',
              textAlign: align,
            },
          ]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.2}
        >
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text
            style={[
              styles.caption,
              {
                color: theme.textMuted,
                fontFamily: fontFamily.medium,
                marginTop: 2,
                writingDirection: 'auto',
                textAlign: align,
              },
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (showBack ? <View style={{ width: 44 }} /> : null)}
    </View>
  );
}

export function SurfaceCard({
  children,
  tone = 'surface',
  padding = spacing[4],
  style,
}: {
  children: ReactNode;
  tone?: 'surface' | 'muted' | 'raised';
  padding?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const backgroundColor = tone === 'muted' ? theme.surfaceMuted : tone === 'raised' ? theme.surfaceRaised : theme.surface;
  return (
    <View
      style={[
        {
          borderRadius: radius.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          backgroundColor,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const theme = useTheme();
  const { locale } = useLocale();
  return (
    <View style={{ minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[4], marginBottom: spacing[2] }}>
      <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, textAlign: locale === 'ar' ? 'right' : 'left' }}>{title}</Text>
      {action !== undefined && onAction !== undefined ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: typeScale.label }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function DirectionChevron({ size = 14 }: { size?: number }) {
  const theme = useTheme();
  const { locale } = useLocale();
  return (
    <SymbolView
      name={{ ios: locale === 'ar' ? 'chevron.left' : 'chevron.right', android: locale === 'ar' ? 'chevron_left' : 'chevron_right', web: locale === 'ar' ? 'chevron_left' : 'chevron_right' }}
      size={size}
      tintColor={theme.textMuted}
    />
  );
}

export function MediaRow({
  title,
  meta,
  leading,
  trailing,
  onPress,
}: {
  title: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingVertical: spacing[2],
        opacity: pressed ? 0.76 : 1,
      })}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body, textAlign: locale === 'ar' ? 'right' : 'left' }}>{title}</Text>
        {meta !== undefined ? <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, marginTop: 3, textAlign: locale === 'ar' ? 'right' : 'left' }}>{meta}</Text> : null}
      </View>
      {trailing ?? (onPress !== undefined ? <DirectionChevron /> : null)}
    </Pressable>
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
  trackColor,
  labelColor,
  captionColor,
}: {
  progress: number | null;
  label: string;
  caption: string;
  color?: string;
  size?: number;
  /** Override the unfilled ring track — pass theme.heroText-derived color when placing
   *  the ring on a dark hero surface instead of the default background. */
  trackColor?: string;
  labelColor?: string;
  captionColor?: string;
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
        <Circle cx={size / 2} cy={size / 2} r={radiusPx} stroke={trackColor ?? theme.ringTrack} strokeWidth={stroke} fill="none" />
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
        <Text style={{ color: labelColor ?? theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.label, fontVariant: ['tabular-nums'] }}>{label}</Text>
      </View>
      <Text style={[styles.caption, { color: captionColor ?? theme.textMuted, fontFamily: fontFamily.regular, textAlign: 'center' }]}>{caption}</Text>
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

export function WeekBars({ data, color }: { data: { label: string; value: number }[]; color?: string }) {
  const theme = useTheme();
  const max = Math.max(1, ...data.map((item) => item.value));
  const tint = color ?? theme.accent;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }} accessibilityRole="image">
      {data.map((item, index) => (
        <View key={`${item.label}-${index}`} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 11, opacity: item.value > 0 ? 1 : 0 }}>
            {item.value}
          </Text>
          <View style={{ height: 56, width: '100%', maxWidth: 26, justifyContent: 'flex-end' }}>
            <View
              style={{
                width: '100%',
                height: Math.max(4, (item.value / max) * 56),
                borderRadius: 8,
                backgroundColor: item.value > 0 ? tint : theme.ringTrack,
              }}
            />
          </View>
          <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 10 }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
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
  index = 0,
  selected = false,
}: {
  title: string;
  meta: string;
  onPress?: () => void;
  index?: number;
  selected?: boolean;
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  const { reduce, duration } = useMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.delay(index * 55).duration(duration(260))}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 78,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
          borderColor: selected ? theme.accent : theme.border,
          borderWidth: selected ? 2 : 1,
          borderRadius: radius.card,
          padding: spacing[3],
          marginBottom: spacing[2],
          opacity: pressed ? 0.86 : 1,
        })}
      >
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: selected ? theme.accent : theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name={selected ? { ios: 'checkmark', android: 'check', web: 'check' } : { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }} size={21} tintColor={selected ? theme.emphasisText : theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body, textAlign: locale === 'ar' ? 'right' : 'left' }}>{title}</Text>
          <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, marginTop: 4, textAlign: locale === 'ar' ? 'right' : 'left' }}>{meta}</Text>
        </View>
        {selected ? <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={18} tintColor={theme.accent} /> : <DirectionChevron size={13} />}
      </Pressable>
    </Animated.View>
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

function TypingDot({ delayMs, color, reduce }: { delayMs: number; color: string; reduce: boolean }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      return;
    }
    lift.value = withDelay(delayMs, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1, false));
  }, [reduce, delayMs, lift]);
  const style = useAnimatedStyle(() => ({ opacity: reduce ? 0.6 : 0.35 + lift.value * 0.65, transform: [{ translateY: reduce ? 0 : -lift.value * 3 }] }));
  return <Animated.View style={[{ height: 6, width: 6, borderRadius: 3, backgroundColor: color }, style]} />;
}

function TypingIndicator({ color }: { color: string }) {
  const { reduce } = useMotion();
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 2 }}>
      <TypingDot delayMs={0} color={color} reduce={reduce} />
      <TypingDot delayMs={120} color={color} reduce={reduce} />
      <TypingDot delayMs={240} color={color} reduce={reduce} />
    </View>
  );
}

export function AIChatBubble({
  role,
  text: message,
  note,
  pending = false,
}: {
  role: 'user' | 'coach';
  text: string;
  note?: string;
  pending?: boolean;
}) {
  const theme = useTheme();
  const mine = role === 'user';
  return (
    <View style={[styles.bubble, { alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? theme.emphasis : theme.surface }]}>
      {pending ? (
        <TypingIndicator color={mine ? theme.emphasisText : theme.textMuted} />
      ) : (
        <Text style={{ color: mine ? theme.emphasisText : theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 24 }}>{message}</Text>
      )}
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
    <SurfaceCard tone="muted" style={{ overflow: 'hidden', minHeight: 148, justifyContent: 'flex-end' }}>
      <View style={{ position: 'absolute', top: spacing[2], end: -spacing[5] }}><TrainaMotif width={180} opacity={0.1} /></View>
      <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, marginBottom: spacing[1] }}>{title}</Text>
      <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 24 }}>{body}</Text>
    </SurfaceCard>
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

function SkeletonLine({ index, color, reduce }: { index: number; color: string; reduce: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    pulse.value = withDelay(
      index * 110,
      withRepeat(
        withSequence(withTiming(1, { duration: motion.ambient }), withTiming(0, { duration: motion.ambient })),
        -1,
        false,
      ),
    );
  }, [index, pulse, reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: reduce ? 0.7 : 0.42 + pulse.value * 0.48,
    transform: [{ scaleX: reduce ? 1 : 0.985 + pulse.value * 0.015 }],
  }));
  return <Animated.View style={[styles.skeleton, { backgroundColor: color }, style]} />;
}

export function LoadingSkeleton() {
  const theme = useTheme();
  const { reduce } = useMotion();
  const entering = reduce ? undefined : FadeIn.duration(motion.standard);
  return (
    <Animated.View entering={entering}>
      {[0, 1, 2].map((item) => <SkeletonLine key={item} index={item} color={theme.surfaceMuted} reduce={reduce} />)}
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
        <Pressable style={[styles.scrim, { backgroundColor: theme.overlay }]} onPress={onClose} accessibilityLabel={text(locale, 'back')} />
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
  const { locale } = useLocale();
  return (
    <Text style={{ color: theme.textMuted, fontFamily: fontFamily.semibold, fontSize: typeScale.label, marginTop: spacing[5], marginBottom: spacing[2], textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: locale === 'ar' ? 'rtl' : 'ltr' }}>
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
  const { locale } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={onPress === undefined}
      onPress={onPress}
      style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, paddingVertical: spacing[3] }}
    >
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body, lineHeight: 24, textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: locale === 'ar' ? 'rtl' : 'ltr' }}>{title}</Text>
        {meta !== undefined ? (
          <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 18, marginTop: 2, textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: locale === 'ar' ? 'rtl' : 'ltr' }}>{meta}</Text>
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

// A native iOS-Settings-style inset card: group SettingsRows inside this to get a single
// rounded surface with hairline separators between rows, instead of a flat stack of
// full-width bordered buttons.
export function SettingsGroup({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg, marginBottom: spacing[4], overflow: 'hidden' }}>
      {children}
    </View>
  );
}

export function SettingsRow({
  icon,
  tint,
  title,
  value,
  onPress,
  destructive = false,
  showChevron = true,
  last = false,
}: {
  icon?: SettingsIcon;
  tint?: string;
  title: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  last?: boolean;
}) {
  const theme = useTheme();
  const { direction } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={onPress === undefined}
      onPress={onPress}
      style={{
        // Plain row: the RTL root already starts it on the right. 'row-reverse' here was
        // flipping Arabic settings rows back to left-to-right.
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        minHeight: 52,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
      }}
    >
      {icon !== undefined ? (
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: tint ?? theme.accent, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name={icon} size={15} tintColor="#FFFFFF" />
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        style={{ flex: 1, color: destructive ? theme.danger : theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, writingDirection: 'auto' }}
      >
        {title}
      </Text>
      {value !== undefined ? (
        <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.body, writingDirection: 'auto' }}>
          {value}
        </Text>
      ) : null}
      {showChevron && onPress !== undefined ? (
        <SymbolView
          name={{ ios: direction === 'rtl' ? 'chevron.left' : 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={13}
          tintColor={theme.textMuted}
        />
      ) : null}
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
  bubble: { maxWidth: '86%', borderWidth: 0, borderRadius: 20, padding: spacing[4], marginBottom: spacing[2] },
  skeleton: { height: 88, borderRadius: radius.lg, marginBottom: spacing[3] },
  segment: { borderWidth: 1, borderRadius: radius.pill, paddingVertical: spacing[2], paddingHorizontal: spacing[3], flexGrow: 0, flexShrink: 1, maxWidth: '100%' },
  sheetFrame: { flex: 1, justifyContent: 'flex-end' },
  scrim: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: spacing[4], maxHeight: '86%' },
  handle: { width: 42, height: 4, borderRadius: radius.pill, alignSelf: 'center', marginBottom: spacing[3] },
  row: { borderBottomWidth: 1, paddingVertical: spacing[4] },
});
