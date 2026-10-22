import { Tabs } from 'expo-router';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { BottomTabBar } from '../../src/ui/TabBar';

export default function TabLayout() {
  const { locale } = useLocale();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        animation: 'fade',
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: locale === 'ar' ? 'اليوم' : 'Today' }} />
      <Tabs.Screen name="training" options={{ title: text(locale, 'training') }} />
      <Tabs.Screen name="nutrition" options={{ title: text(locale, 'nutrition') }} />
      <Tabs.Screen name="progress" options={{ title: text(locale, 'progress') }} />
      <Tabs.Screen name="coach" options={{ title: locale === 'ar' ? 'يزن' : 'Yazan' }} />
      <Tabs.Screen name="community" options={{ title: text(locale, 'community'), href: null }} />
    </Tabs>
  );
}
