import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { fontFamily } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useLocale } from '../i18n/LocaleProvider';
import { useMotion } from '../theme/motion';
import { tabBarClearance } from './insets';
import { tapSelection } from './haptics';

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
    setMeasured(measuredTabBarHeight);
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

export function BottomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const { direction } = useLocale();
  const { reduce } = useMotion();
  const insets = useSafeAreaInsets();
  return (
    <View
      onLayout={(event) => publishTabBarHeight(event.nativeEvent.layout.height)}
      style={[
        styles.bar,
        {
          direction,
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = descriptors[route.key]?.options.title ?? route.name;
        const icon = icons[route.name as keyof typeof icons] ?? icons.home;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                tapSelection(reduce);
                navigation.navigate(route.name);
              }
            }}
            style={styles.item}
          >
            <SymbolView name={icon} size={22} tintColor={focused ? theme.emphasis : theme.textMuted} />
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.15}
              style={{
                color: focused ? theme.text : theme.textMuted,
                fontFamily: focused ? fontFamily.semibold : fontFamily.regular,
                fontSize: 11,
                lineHeight: 16,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 52, paddingHorizontal: 2 },
});
