import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { motion, useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { useLocale } from '../i18n/LocaleProvider';
import { useKeyboardInset } from './keyboard';
import { tapImpact } from './haptics';
import { TrainaMark } from './brand';

export const editorialPhotos = {
  strength: require('../../assets/editorial/strength.jpg'),
  run: require('../../assets/editorial/run.jpg'),
  recovery: require('../../assets/editorial/recovery.jpg'),
  meal: require('../../assets/editorial/meal.jpg'),
  coach: require('../../assets/editorial/coach.jpg'),
} as const;

// Plain light-on-photo text for copy placed inside EditorialFrame/PhotoWash's dark wash — the
// shared Body/Muted components are calibrated for a light screen background and read as
// invisible or near-invisible over a photo.
export function EditorialHint({ children, tone = 'muted', style }: { children: string; tone?: 'muted' | 'danger'; style?: TextStyle }) {
  const { locale } = useLocale();
  const theme = useTheme();
  return (
    <Text
      style={[
        { color: tone === 'danger' ? theme.danger : theme.heroText, opacity: tone === 'danger' ? 1 : 0.78, fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 20, marginBottom: 8, writingDirection: locale === 'ar' ? 'rtl' : 'ltr', textAlign: locale === 'ar' ? 'right' : 'left' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// A low-emphasis text link for secondary navigation inside an EditorialFrame (e.g. "forgot
// password", "create an account") — deliberately not a bordered Button, so an auth screen
// reads as one primary action plus quiet links rather than a stack of equal-weight buttons.
export function EditorialLink({
  children,
  onPress,
  align = 'center',
}: {
  children: string;
  onPress: () => void;
  align?: 'center' | 'start';
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ paddingVertical: 10, alignItems: align === 'center' ? 'center' : 'flex-start' }}
    >
      <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: typeScale.label, writingDirection: 'auto' }}>
        {children}
      </Text>
    </Pressable>
  );
}

function PagerDot({ active }: { active: boolean }) {
  const theme = useTheme();
  const { reduce } = useMotion();
  const width = useSharedValue(active ? 22 : 6);
  useEffect(() => {
    width.value = withTiming(active ? 22 : 6, { duration: reduce ? 0 : motion.standard });
  }, [active, reduce, width]);
  const animated = useAnimatedStyle(() => ({ width: width.value }));
  return <Animated.View style={[styles.dot, animated, { opacity: active ? 1 : 0.4, backgroundColor: theme.heroAccent }]} />;
}

export function PhotoWash({
  source,
  height,
  children,
}: {
  source: ImageSource;
  height?: number;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const [box, setBox] = useState({ width: 0, height: 0 });
  return (
    <View
      onLayout={(event) => setBox({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      style={height === undefined ? StyleSheet.absoluteFill : [styles.hero, { height }]}
    >
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={motion.standard} />
      {box.width > 0 ? (
        <Svg width={box.width} height={box.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="trainaWash" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.hero} stopOpacity="0.04" />
              <Stop offset="0.38" stopColor={theme.hero} stopOpacity="0.24" />
              <Stop offset="1" stopColor={theme.hero} stopOpacity="0.98" />
            </LinearGradient>
          </Defs>
          <Rect width={box.width} height={box.height} fill="url(#trainaWash)" />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

export function EditorialFrame({
  source,
  kicker,
  title,
  body,
  index = 0,
  count = 0,
  action,
  onAction,
  secondary,
  onSecondary,
  disabled = false,
  children,
}: {
  source: ImageSource;
  kicker?: string;
  title: string;
  body?: string;
  index?: number;
  count?: number;
  action: string;
  onAction: () => void;
  secondary?: string;
  onSecondary?: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const { duration } = useMotion();
  const { locale } = useLocale();
  const theme = useTheme();
  const alignment = { textAlign: locale === 'ar' ? 'right' as const : 'left' as const, writingDirection: locale === 'ar' ? 'rtl' as const : 'ltr' as const };
  return (
    <View style={[styles.frame, { backgroundColor: theme.hero }]}>
      <PhotoWash source={source} />
      <View style={[styles.copy, { paddingTop: insets.top + spacing[4], paddingBottom: Math.max(insets.bottom, spacing[4]) + keyboard }]}>
        <View style={{ position: 'absolute', top: insets.top + spacing[3], start: spacing[5] }}>
          <TrainaMark size={38} inverse wordmark />
        </View>
        <View style={styles.copyBlock}>
          {kicker !== undefined ? <Text style={[styles.kicker, alignment, { color: theme.heroAccent }]}>{kicker}</Text> : null}
          <Text style={[styles.display, alignment, { color: theme.heroText }]} maxFontSizeMultiplier={1.2}>
            {title}
          </Text>
          {body !== undefined ? <Text style={[styles.support, alignment, { color: theme.heroText }]}>{body}</Text> : null}
          {children !== undefined ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.form} contentContainerStyle={{ paddingTop: spacing[3] }}>
              {children}
            </ScrollView>
          ) : null}
          {count > 1 ? (
            <View style={styles.pager}>
              {Array.from({ length: count }, (_, dot) => (
                <PagerDot key={dot} active={dot === index} />
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          {secondary !== undefined && onSecondary !== undefined ? (
            <Pressable accessibilityRole="button" onPress={onSecondary} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: theme.heroText }]}>{secondary}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => {
              if (disabled) return;
              tapImpact(duration(1) === 0);
              onAction();
            }}
            style={[styles.cta, { opacity: disabled ? 0.55 : 1, backgroundColor: theme.heroAccent }]}
          >
            <Text style={[styles.ctaLabel, { color: theme.goldInk }]}>{action}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  hero: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing[4] },
  copy: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing[5] },
  copyBlock: { marginBottom: spacing[4] },
  kicker: {
    fontFamily: fontFamily.semibold,
    fontSize: typeScale.label,
    letterSpacing: 0.4,
    marginBottom: spacing[2],
    writingDirection: 'auto',
  },
  display: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.display,
    lineHeight: typeScale.display * 1.28,
    writingDirection: 'auto',
  },
  support: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.body,
    lineHeight: 26,
    marginTop: spacing[3],
    writingDirection: 'auto',
  },
  pager: { flexDirection: 'row', gap: 6, marginTop: spacing[4] },
  form: { maxHeight: 340, flexGrow: 0 },
  dot: { height: 6, borderRadius: 3 },
  actions: { gap: spacing[2] },
  cta: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  ctaLabel: { fontFamily: fontFamily.bold, fontSize: typeScale.body },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontFamily: fontFamily.medium, fontSize: typeScale.body },
});
