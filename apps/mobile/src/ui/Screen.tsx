import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { motion, useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { useLocale } from '../i18n/LocaleProvider';
import { text, type CopyKey } from '../i18n/copy';
import { useKeyboardInset } from './keyboard';
import { useTabBarInset } from './TabBar';
import { tapImpact } from './haptics';
import { perfMark } from '../performance/lab';

export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  const { direction, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const segments=useSegments();
  const inTabs = segments[0] === '(tabs)';
  useEffect(()=>{perfMark('screen.render',segments.join('/'));});
  return (
    <SafeAreaView
      onLayout={()=>perfMark('screen.layout',segments.join('/'))}
      style={[
        styles.screen,
        { backgroundColor: theme.background, direction, paddingBottom: inTabs ? 0 : insets.bottom },
      ]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {title !== undefined ? (
        <Text style={[styles.title, { color: theme.text, fontFamily: fontFamily.bold, textAlign: locale === 'ar' ? 'right' : 'left' }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
      ) : null}
      {children}
    </SafeAreaView>
  );
}

export function ScreenBody({
  children,
  footer,
  refreshControl,
  scrollRef,
  onContentSizeChange,
}: {
  children: ReactNode;
  footer?: ReactNode;
  refreshControl?: ScrollView['props']['refreshControl'];
  scrollRef?: RefObject<ScrollView | null>;
  onContentSizeChange?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const inTabs = useSegments()[0] === '(tabs)';
  const tabInset = useTabBarInset();
  const keyboard = useKeyboardInset();
  const keyboardLift = keyboard > 0 ? Math.max(0, keyboard - (inTabs ? 0 : insets.bottom)) : 0;
  const resting = inTabs ? tabInset : 0;
  const occupied = keyboard > 0 ? keyboardLift : resting;
  return (
    <View style={styles.fill}>
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={{
          paddingBottom:
            (footer === undefined ? occupied : keyboard > 0 ? spacing[6] : spacing[2]) +
            spacing[3] +
            (inTabs ? spacing[6] : 0),
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        onContentSizeChange={onContentSizeChange}
      >
        {children}
      </ScrollView>
      {footer !== undefined ? <View style={{ paddingBottom: occupied }}>{footer}</View> : null}
    </View>
  );
}

export function Card({ children, tone = 'surface' }: { children: ReactNode; tone?: 'surface' | 'muted' | 'hero' }) {
  const theme = useTheme();
  const background = tone === 'hero' ? theme.hero : tone === 'muted' ? theme.surfaceMuted : theme.surface;
  const border = tone === 'hero' ? theme.hero : theme.border;
  return <View style={[styles.card, { backgroundColor: background, borderColor: border }]}>{children}</View>;
}

export function Body({ children, inverse = false }: { children: string; inverse?: boolean }) {
  const theme = useTheme();
  const { locale } = useLocale();
  return (
    <Text style={[styles.body, { color: inverse ? theme.heroText : theme.text, fontFamily: fontFamily.regular, textAlign: locale === 'ar' ? 'right' : 'left' }]}>{children}</Text>
  );
}

export function Muted({ children, inverse = false }: { children: string; inverse?: boolean }) {
  const theme = useTheme();
  const { locale } = useLocale();
  return (
    <Text style={[styles.muted, { color: inverse ? theme.heroAccent : theme.textMuted, fontFamily: fontFamily.regular, textAlign: locale === 'ar' ? 'right' : 'left' }]}>
      {children}
    </Text>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  textContentType,
  autoComplete,
  autoCapitalize = 'none',
  inverse = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'decimal-pad';
  textContentType?: 'emailAddress' | 'password' | 'newPassword' | 'oneTimeCode' | 'name';
  autoComplete?: 'email' | 'password' | 'new-password' | 'name' | 'off';
  autoCapitalize?: 'none' | 'words';
  // Set when the field sits over a dark photo wash (EditorialFrame) rather than the
  // standard light screen background, so the label stays legible.
  inverse?: boolean;
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  const [hidden, setHidden] = useState(secureTextEntry);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Muted inverse={inverse}>{label}</Muted>
      <View style={{ position: 'relative' }}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          secureTextEntry={hidden}
          textContentType={textContentType}
          autoComplete={autoComplete}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: focused ? theme.lime : theme.border,
              backgroundColor: theme.surface,
              fontFamily: fontFamily.regular,
              textAlign: locale === 'ar' ? 'right' : 'left',
              writingDirection: locale === 'ar' ? 'rtl' : 'ltr',
              paddingEnd: secureTextEntry ? 72 : spacing[3],
            },
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text(locale, hidden ? 'showPassword' : 'hidePassword')}
            onPress={() => setHidden((current) => !current)}
            style={{ position: 'absolute', top: 0, bottom: 0, end: 8, justifyContent: 'center', paddingHorizontal: 8 }}
          >
            <Text style={{ color: theme.lime, fontFamily: fontFamily.semibold, fontSize: typeScale.label }}>
              {text(locale, hidden ? 'showPassword' : 'hidePassword')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'lime' | 'violet' | 'danger';
  testID?: string;
}) {
  const theme = useTheme();
  const { duration } = useMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fill =
    variant === 'secondary' || variant === 'danger'
      ? 'transparent'
      : variant === 'lime'
        ? theme.lime
        : variant === 'violet'
          ? theme.violet
          : theme.emphasis;
  const color =
    variant === 'danger' ? theme.danger : variant === 'secondary' ? theme.text : variant === 'primary' ? theme.emphasisText : theme.limeInk;
  return (
    <Animated.View style={animated}>
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tapImpact(duration(1) === 0);
        onPress();
      }}
      onPressIn={() => {
        // Reanimated shared values are intentionally mutable event-state.
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withTiming(duration(1) === 0 ? 1 : 0.97, { duration: duration(motion.fast) });
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withTiming(1, { duration: duration(motion.standard) });
      }}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? theme.surfaceMuted : fill,
          borderColor: variant === 'secondary' || variant === 'danger' ? theme.border : fill,
        },
      ]}
    >
      <Text
        style={[styles.buttonLabel, { color: disabled ? theme.textMuted : color, fontFamily: fontFamily.semibold, textAlign: 'center' }]}
        maxFontSizeMultiplier={1.3}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
    </Animated.View>
  );
}

export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { locale } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderColor: selected ? theme.emphasis : theme.border,
          backgroundColor: selected ? theme.emphasis : theme.surface,
        },
      ]}
    >
      <Text style={{ color: selected ? theme.emphasisText : theme.text, fontFamily: fontFamily.medium, textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: locale === 'ar' ? 'rtl' : 'ltr' }}>{label}</Text>
    </Pressable>
  );
}

export function StatusLine({ state }: { state: 'loading' | 'empty' | 'error' | 'offline' }) {
  const { locale } = useLocale();
  const key: CopyKey = state;
  return <Muted>{text(locale, key)}</Muted>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  title: { fontSize: typeScale.headline, lineHeight: typeScale.headline * 1.35, marginBottom: spacing[4], writingDirection: 'auto' },
  fill: { flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, padding: spacing[4], marginBottom: spacing[3] },
  body: { fontSize: typeScale.body, lineHeight: 24, marginBottom: spacing[2], writingDirection: 'auto' },
  muted: { fontSize: typeScale.label, lineHeight: 18, marginBottom: spacing[2], writingDirection: 'auto' },
  field: { marginBottom: spacing[3] },
  input: { borderWidth: 1, borderRadius: radius.md, minHeight: 52, padding: spacing[3], fontSize: typeScale.body, writingDirection: 'auto' },
  button: { borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingVertical: spacing[3], paddingHorizontal: spacing[3], alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  buttonLabel: { fontSize: typeScale.body },
  choice: { borderWidth: 1, borderRadius: radius.pill, paddingVertical: spacing[2], paddingHorizontal: spacing[3], margin: spacing[1] },
});
