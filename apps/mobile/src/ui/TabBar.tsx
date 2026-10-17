import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useLocale } from '../i18n/LocaleProvider';
import { text } from '../i18n/copy';
import { useMotion } from '../theme/motion';
import { tabBarClearance } from './insets';
import { tapSelection } from './haptics';
import { QuickActionsSheet } from '../daily/QuickActions';

let measuredTabBarHeight = 0;
const tabBarSubscribers = new Set<(height: number) => void>();

function publishTabBarHeight(height: number): void {
  if (height <= 0 || height === measuredTabBarHeight) return;
  measuredTabBarHeight = height;
  for (const subscriber of tabBarSubscribers) subscriber(height);
}

export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  const [measured, setMeasured] = useState(measuredTabBarHeight);
  useEffect(() => {
    tabBarSubscribers.add(setMeasured);
    return () => {
      tabBarSubscribers.delete(setMeasured);
    };
  }, []);
  return tabBarClearance(insets.bottom, measured);
}

const icons = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  training: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  nutrition: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  progress: { ios: 'chart.line.uptrend.xyaxis', android: 'monitoring', web: 'monitoring' },
  coach: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  community: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
} as const;

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

function TabButton({
  route,
  focused,
  label,
  onPress,
}: {
  route: { key: string; name: string };
  focused: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const icon = icons[route.name as keyof typeof icons] ?? icons.home;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.item}
    >
      <View style={[styles.iconWrap, { backgroundColor: focused ? theme.accent : 'transparent' }]}>
        <SymbolView name={icon} size={20} tintColor={focused ? theme.emphasisText : theme.textMuted} />
      </View>
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.15}
        style={{
          color: focused ? theme.accent : theme.textMuted,
          fontFamily: focused ? fontFamily.semibold : fontFamily.regular,
          fontSize: typeScale.micro,
          lineHeight: 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const { direction, locale } = useLocale();
  const { reduce } = useMotion();
  const insets = useSafeAreaInsets();
  const [quick, setQuick] = useState(false);
  const visible = state.routes.filter((route) => route.name !== 'community' && route.name !== 'coach');
  const left = visible.slice(0, 2);
  const right = visible.slice(2);

  function press(route: { key: string; name: string }) {
    const index = state.routes.findIndex((entry) => entry.key === route.key);
    const focused = state.index === index;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      tapSelection(reduce);
      navigation.navigate(route.name);
    }
  }

  return (
    <>
      <View
        onLayout={(event) => publishTabBarHeight(event.nativeEvent.layout.height + spacing[2])}
        style={[
          styles.bar,
          {
            direction,
            backgroundColor: theme.surfaceRaised,
            borderColor: theme.border,
            paddingBottom: Math.max(insets.bottom, spacing[2]),
            shadowColor: theme.shadow,
          },
        ]}
      >
        {left.map((route) => (
          <TabButton
            key={route.key}
            route={route}
            focused={state.index === state.routes.findIndex((entry) => entry.key === route.key)}
            label={descriptors[route.key]?.options.title ?? route.name}
            onPress={() => press(route)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text(locale, 'quickActions')}
          onPress={() => {
            tapSelection(reduce);
            setQuick(true);
          }}
          style={styles.fabSlot}
        >
          <View style={[styles.fab, { backgroundColor: theme.accent }]}>
            <Text style={{ color: theme.emphasisText, fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 30 }}>+</Text>
          </View>
        </Pressable>
        {right.map((route) => (
          <TabButton
            key={route.key}
            route={route}
            focused={state.index === state.routes.findIndex((entry) => entry.key === route.key)}
            label={descriptors[route.key]?.options.title ?? route.name}
            onPress={() => press(route)}
          />
        ))}
      </View>
      <QuickActionsSheet visible={quick} onClose={() => setQuick(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[2],
    zIndex: 10,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingTop: 9,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 12,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52, paddingHorizontal: 2 },
  iconWrap: { width: 46, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  fabSlot: { width: 64, alignItems: 'center', justifyContent: 'center' },
  fab: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: -18 },
});
