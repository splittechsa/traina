import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTIVITY_KINDS, type ActivityKind } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../src/api/client';
import { formatCount, formatDuration, riyadhToday } from '../src/format';
import { label } from '../src/i18n/labels';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily } from '../src/theme/tokens';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton } from '../src/ui/kit';

type ActivityDay = { activities: { id: string; kind: string; durationSeconds: number }[] };

const icons: Record<ActivityKind, ComponentProps<typeof SymbolView>['name']> = {
  walking: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
  running: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
  cycling: { ios: 'bicycle', android: 'pedal_bike', web: 'pedal_bike' },
  football: { ios: 'soccerball', android: 'sports_soccer', web: 'sports_soccer' },
  basketball: { ios: 'basketball.fill', android: 'sports_basketball', web: 'sports_basketball' },
  tennis: { ios: 'tennisball.fill', android: 'sports_tennis', web: 'sports_tennis' },
  boxing: { ios: 'figure.boxing', android: 'sports_mma', web: 'sports_mma' },
  swimming: { ios: 'figure.pool.swim', android: 'pool', web: 'pool' },
  dance: { ios: 'figure.dance', android: 'nightlife', web: 'nightlife' },
  elliptical: { ios: 'figure.elliptical', android: 'directions_run', web: 'directions_run' },
  jump_rope: { ios: 'figure.jumprope', android: 'fitness_center', web: 'fitness_center' },
  hiit: { ios: 'figure.highintensity.intervaltraining', android: 'bolt', web: 'bolt' },
  other: { ios: 'figure.mixed.cardio', android: 'sports', web: 'sports' },
};

export default function QuickActivityScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const today = riyadhToday();
  const [kind, setKind] = useState<ActivityKind>('walking');
  const [minutes, setMinutes] = useState(30);
  const [notice, setNotice] = useState('');
  const logs = useQuery({
    queryKey: ['activity', today],
    queryFn: () => apiRequest<ActivityDay>(`/v1/activity?on=${today}`),
  });
  const isAr = locale === 'ar';

  async function save() {
    setNotice('');
    try {
      await apiRequest('/v1/activity', {
        method: 'POST',
        body: { kind, durationSeconds: minutes * 60, loggedOn: today },
      });
      await client.invalidateQueries({ queryKey: ['activity', today] });
      setNotice(text(locale, 'saved'));
    } catch (caught) {
      setNotice(caught instanceof ApiClientError ? caught.message : text(locale, 'error'));
    }
  }

  if (logs.isPending) {
    return <Screen><LoadingSkeleton /></Screen>;
  }
  if (logs.isError) {
    return (
      <Screen title={text(locale, 'logActivityQuick')}>
        <ErrorState body={text(locale, 'error')} onRetry={() => void logs.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenBody footer={<Button label={text(locale, 'save')} onPress={() => void save()} />}>
        <AppHeader
          title={text(locale, 'logActivityQuick')}
          subtitle={text(locale, 'noBurnedCalories')}
          trailing={(
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{text(locale, 'back')}</Text>
            </Pressable>
          )}
        />
        {ACTIVITY_KINDS.map((item) => {
          const selected = kind === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => setKind(item)}
              style={{
                minHeight: 56,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: selected ? theme.accent : theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <SymbolView name={icons[item]} size={20} tintColor={selected ? theme.emphasisText : theme.accent} />
                </View>
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, flex: 1, textAlign: isAr ? 'right' : 'left' }}>
                  {label(locale, 'activityKind', item)}
                </Text>
              </View>
              {selected ? <Text style={{ color: theme.accent, fontFamily: fontFamily.bold }}>{formatCount(minutes, locale)}</Text> : null}
            </Pressable>
          );
        })}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 }}>
          {[15, 30, 45, 60].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setMinutes(value)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 14,
                backgroundColor: minutes === value ? theme.accent : theme.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: minutes === value ? theme.emphasisText : theme.text, fontFamily: fontFamily.bold }}>{formatCount(value, locale)}</Text>
            </Pressable>
          ))}
        </View>
        {notice ? <Text style={{ color: theme.warning, fontFamily: fontFamily.medium, marginTop: 8 }}>{notice}</Text> : null}
        {(logs.data?.activities ?? []).map((row) => (
          <Text key={row.id} style={{ color: theme.text, fontFamily: fontFamily.medium, marginTop: 10, textAlign: isAr ? 'right' : 'left' }}>
            {`${label(locale, 'activityKind', row.kind)} · ${formatDuration(row.durationSeconds)}`}
          </Text>
        ))}
      </ScreenBody>
    </Screen>
  );
}
