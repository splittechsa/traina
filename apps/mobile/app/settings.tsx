import { useEffect } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Screen, ScreenBody } from '../src/ui/Screen';
import { SectionLabel, SegmentedControl, SettingsGroup, SettingsRow } from '../src/ui/kit';
import { useTheme } from '../src/theme/ThemeProvider';

export default function SettingsScreen() {
  const { locale, setLocale, restartRequired } = useLocale();
  const theme = useTheme();

  useEffect(() => {
    if (!restartRequired) return;
    Alert.alert(text(locale, 'restartRequiredTitle'), text(locale, 'restartRequiredBody'), [
      { text: text(locale, 'ok') },
    ]);
  }, [restartRequired, locale]);

  return (
    <Screen title={text(locale, 'settings')}>
      <ScreenBody>
        <SectionLabel>{text(locale, 'appearance')}</SectionLabel>
        <SegmentedControl
          value={theme.preference}
          onChange={(id) => theme.setPreference(id as 'system' | 'light' | 'dark')}
          options={[
            { id: 'system', label: text(locale, 'system') },
            { id: 'light', label: text(locale, 'light') },
            { id: 'dark', label: text(locale, 'dark') },
          ]}
        />
        <SectionLabel>{text(locale, 'language')}</SectionLabel>
        <SegmentedControl
          value={locale}
          onChange={(id) => setLocale(id === 'en' ? 'en' : 'ar')}
          options={[
            { id: 'ar', label: text(locale, 'arabic') },
            { id: 'en', label: text(locale, 'english') },
          ]}
        />
        <SettingsGroup>
          <SettingsRow
            icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
            title={text(locale, 'account')}
            onPress={() => router.push('/account')}
          />
          <SettingsRow
            icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            title={text(locale, 'coachTitle')}
            onPress={() => router.push('/(tabs)/coach')}
          />
          <SettingsRow
            icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }}
            title={text(locale, 'progress')}
            onPress={() => router.push('/(tabs)/progress')}
            last
          />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow
            icon={{ ios: 'scalemass.fill', android: 'monitor_weight', web: 'monitor_weight' }}
            title={text(locale, 'weightTracking')}
            onPress={() => router.push('/weight')}
          />
          <SettingsRow
            icon={{ ios: 'chart.pie.fill', android: 'pie_chart', web: 'pie_chart' }}
            tint="#C76A3A"
            title={locale === 'ar' ? 'أهدافك اليومية' : 'Daily targets'}
            onPress={() => router.push('/macros')}
          />
          <SettingsRow
            icon={{ ios: 'figure.run', android: 'directions_run', web: 'directions_run' }}
            title={text(locale, 'activity')}
            onPress={() => router.push('/activity')}
          />
          <SettingsRow
            icon={{ ios: 'pills.fill', android: 'medication', web: 'medication' }}
            title={text(locale, 'supplements')}
            onPress={() => router.push('/supplements')}
          />
          <SettingsRow
            icon={{ ios: 'building.2.fill', android: 'apartment', web: 'apartment' }}
            title={text(locale, 'gyms')}
            onPress={() => router.push('/gyms')}
            last
          />
        </SettingsGroup>
      </ScreenBody>
    </Screen>
  );
}
