import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocale } from '../i18n/LocaleProvider';
import { motion, useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily } from '../theme/tokens';

export function TrainaMark({
  size = 34,
  inverse = false,
  wordmark = false,
}: {
  size?: number;
  inverse?: boolean;
  wordmark?: boolean;
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  const { reduce, duration } = useMotion();
  const ink = inverse ? theme.heroText : theme.text;
  const accent = inverse ? theme.heroAccent : theme.gold;
  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(duration(motion.emphasis))}>
    <View
      accessibilityRole="image"
      accessibilityLabel={locale === 'ar' ? 'شعار ترينا' : 'traina logo'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Math.max(7, size * 0.22) }}
    >
      <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: inverse ? 'rgba(255,249,239,0.1)' : theme.surfaceMuted, borderWidth: 1, borderColor: inverse ? 'rgba(255,249,239,0.15)' : theme.border, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 32 32">
          <Path d="M5 22.5L11.2 12.2L16 19.1L23.7 7.4L27 11.5" fill="none" stroke={accent} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M6 26H26" fill="none" stroke={ink} strokeWidth="2.7" strokeLinecap="round" opacity="0.92" />
          <Circle cx="26.8" cy="8.7" r="2.4" fill={ink} />
        </Svg>
      </View>
      {wordmark ? (
        <View>
          <Text style={{ color: ink, fontFamily: fontFamily.bold, fontSize: size * 0.5, lineHeight: size * 0.58, letterSpacing: locale === 'ar' ? 0 : -0.4 }}>
            {locale === 'ar' ? 'ترينا' : 'traina'}
          </Text>
          <Text style={{ color: accent, fontFamily: fontFamily.medium, fontSize: Math.max(8, size * 0.24), lineHeight: Math.max(10, size * 0.29), letterSpacing: locale === 'ar' ? 0 : 1.4 }}>
            {locale === 'ar' ? 'تدريب • غذاء • تقدّم' : 'TRAIN • FUEL • PROGRESS'}
          </Text>
        </View>
      ) : null}
    </View>
    </Animated.View>
  );
}

/**
 * A quiet route-and-rhythm motif derived from the Traina mark.
 * It is intentionally sparse so it reads as a signature, never as wallpaper.
 */
export function TrainaMotif({
  width = 180,
  opacity = 0.16,
  inverse = false,
}: {
  width?: number;
  opacity?: number;
  inverse?: boolean;
}) {
  const theme = useTheme();
  const line = inverse ? theme.heroText : theme.accent;
  const point = inverse ? theme.heroAccent : theme.gold;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={width} height={width * 0.44} viewBox="0 0 180 80" opacity={opacity}>
        <Path d="M8 61C34 61 38 19 64 19C90 19 91 61 118 61C142 61 148 37 172 37" fill="none" stroke={line} strokeWidth="2.4" strokeLinecap="round" />
        <Path d="M8 70C37 70 42 34 67 34C92 34 95 70 121 70C143 70 154 52 172 52" fill="none" stroke={point} strokeWidth="1.5" strokeLinecap="round" />
        <Circle cx="64" cy="19" r="4" fill={point} />
        <Circle cx="172" cy="37" r="3" fill={line} />
      </Svg>
    </View>
  );
}
