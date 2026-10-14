import { router } from 'expo-router';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, NavRow, SegmentedControl } from '../src/ui/kit';
import { useTheme } from '../src/theme/ThemeProvider';

export default function SettingsScreen() {
  const { locale, setLocale } = useLocale();
  const theme = useTheme();
  return (
    <Screen>
      <ScreenBody>
        <AppHeader title={text(locale, 'settings')} subtitle={text(locale, 'region')} />
        <AppHeader title={text(locale, 'appearance')} />
        <SegmentedControl
          value={theme.preference}
          onChange={(id) => theme.setPreference(id as 'system' | 'light' | 'dark')}
          options={[
            { id: 'system', label: text(locale, 'system') },
            { id: 'light', label: text(locale, 'light') },
            { id: 'dark', label: text(locale, 'dark') },
          ]}
        />
        <AppHeader title={text(locale, 'language')} />
        <SegmentedControl
          value={locale}
          onChange={(id) => setLocale(id === 'en' ? 'en' : 'ar')}
          options={[
            { id: 'ar', label: text(locale, 'arabic') },
            { id: 'en', label: text(locale, 'english') },
          ]}
        />
        <NavRow label={text(locale, 'account')} onPress={() => router.push('/account')} />
        <NavRow label={text(locale, 'progress')} onPress={() => router.push('/(tabs)/progress')} />
        <NavRow label={text(locale, 'community')} onPress={() => router.push('/(tabs)/community')} />
        <NavRow label={text(locale, 'weightTracking')} onPress={() => router.push('/weight')} />
        <NavRow label={text(locale, 'activity')} onPress={() => router.push('/activity')} />
        <NavRow label={text(locale, 'exercises')} onPress={() => router.push('/exercises')} />
        <NavRow label={text(locale, 'membership')} onPress={() => router.push('/membership')} />
        <NavRow label={text(locale, 'gyms')} onPress={() => router.push('/gyms')} />
        <NavRow label={text(locale, 'notifications')} onPress={() => router.push('/notifications')} />
        <NavRow label={text(locale, 'supplements')} onPress={() => router.push('/supplements')} />
        <NavRow label={text(locale, 'help')} onPress={() => router.push('/help')} />
      </ScreenBody>
    </Screen>
  );
}
