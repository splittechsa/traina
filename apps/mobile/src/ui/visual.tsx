import { Text } from './Text';
// Visual primitives for the redesigned activity / nutrition surfaces: gradient progress
// rings, a glowing hero card, and labelled macro bars. Built on react-native-svg (already a
// dependency) so they render identically in Expo Go and in a dev build.
import { useEffect, useId, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { motion, useMotion } from '../theme/motion';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { TrainaMotif } from './brand';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function GradientRing({
  progress,
  size = 220,
  stroke = 18,
  from,
  to,
  track,
  children,
  accessibilityLabel,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  from: string;
  to: string;
  track?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const { reduce } = useMotion();
  const gradientId = `ring-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const offset = useSharedValue(circumference);
  useEffect(() => {
    const next = circumference * (1 - clamped);
    offset.value = reduce ? next : withTiming(next, { duration: motion.ambient });
  }, [circumference, clamped, offset, reduce]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? theme.ringTrack} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Signature performance surface: deep green, earned-gold light and a sparse Traina route motif. */
export function HeroPanel({
  children,
  glow,
  padding = spacing[5],
  motif = true,
}: {
  children: ReactNode;
  glow?: string;
  padding?: number;
  motif?: boolean;
}) {
  const theme = useTheme();
  const gradientId = `glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={{ borderRadius: radius.hero, overflow: 'hidden', backgroundColor: theme.hero }}>
      <Svg style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={glow ?? theme.heroAccent} stopOpacity={0.28} />
            <Stop offset="0.55" stopColor={glow ?? theme.heroAccent} stopOpacity={0.04} />
            <Stop offset="1" stopColor={theme.hero} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      {motif ? <View style={{ position: 'absolute', top: spacing[2], end: -spacing[5] }}><TrainaMotif width={190} opacity={0.12} inverse /></View> : null}
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

export function GlowCard(props: { children: ReactNode; glow?: string; padding?: number }) {
  return <HeroPanel {...props} />;
}

export function MacroBar({
  label,
  value,
  target,
  unit,
  color,
  inverse = false,
}: {
  label: string;
  value: number;
  target: number | null;
  unit: string;
  color: string;
  inverse?: boolean;
}) {
  const theme = useTheme();
  const share = target !== null && target > 0 ? Math.min(1, value / target) : 0;
  const over = target !== null && value > target;
  const textColor = inverse ? theme.heroText : theme.text;
  const mutedColor = inverse ? 'rgba(255,249,239,0.68)' : theme.textMuted;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: mutedColor, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{label}</Text>
        <Text style={{ color: over ? theme.warning : textColor, fontFamily: fontFamily.semibold, fontSize: typeScale.label, fontVariant: ['tabular-nums'] }}>
          {target !== null ? `${Math.round(value)} / ${Math.round(target)} ${unit}` : `${Math.round(value)} ${unit}`}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: inverse ? 'rgba(255,255,255,0.10)' : theme.ringTrack, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round((target === null ? (value > 0 ? 1 : 0) : share) * 100)}%`, height: '100%', borderRadius: radius.pill, backgroundColor: over ? theme.warning : color }} />
      </View>
    </View>
  );
}

export function StatChip({ label, value, inverse = false }: { label: string; value: string; inverse?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[3],
        borderRadius: radius.md,
        backgroundColor: inverse ? 'rgba(255,255,255,0.07)' : theme.surface,
        gap: 2,
      }}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: inverse ? theme.heroText : theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.headline, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text numberOfLines={1} style={{ color: inverse ? 'rgba(255,249,239,0.68)' : theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.micro }}>
        {label}
      </Text>
    </View>
  );
}
