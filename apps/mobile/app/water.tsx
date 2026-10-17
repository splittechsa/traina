import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_WATER_GOAL_ML } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../src/api/client';
import { formatCount, riyadhToday } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily } from '../src/theme/tokens';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton } from '../src/ui/kit';
import { LOCAL_KEYS, useLocalValue } from '../src/storage/local';

type WaterDay = { milliliters: number; entries: { id: string; milliliters: number }[] };

export default function WaterScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const today = riyadhToday();
  const goal = useLocalValue<number>(LOCAL_KEYS.waterGoal, DEFAULT_WATER_GOAL_ML);
  const water = useQuery({
    queryKey: ['water', today],
    queryFn: () => apiRequest<WaterDay>(`/v1/water?on=${today}`),
  });
  const isAr = locale === 'ar';

  async function add(milliliters: number) {
    await apiRequest('/v1/water', { method: 'POST', body: { milliliters, loggedOn: today } });
    await client.invalidateQueries({ queryKey: ['water', today] });
    await client.invalidateQueries({ queryKey: ['home'] });
  }

  if (water.isPending) {
    return <Screen><LoadingSkeleton /></Screen>;
  }
  if (water.isError || water.data === undefined) {
    const offline = water.error instanceof ApiClientError && water.error.code === 'OFFLINE';
    return (
      <Screen title={text(locale, 'water')}>
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void water.refetch()} />
      </Screen>
    );
  }

  const total = water.data.milliliters;
  const liters = total / 1000;
  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={text(locale, 'water')}
          subtitle={text(locale, 'noBurnedCalories')}
          trailing={(
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{text(locale, 'back')}</Text>
            </Pressable>
          )}
        />
        <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 48 }}>
          {formatCount(Number(liters.toFixed(2)), locale)}
          <Text style={{ fontSize: 18, color: theme.textMuted }}> {text(locale, 'liters')}</Text>
        </Text>
        <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, marginBottom: 18 }}>
          {isAr ? `الهدف ${formatCount(goal.value / 1000, locale)} لتر · تقديرك على الجهاز` : `Goal ${formatCount(goal.value / 1000, locale)} L · your on-device estimate`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {[250, 500, 750].map((amount) => (
            <Pressable
              key={amount}
              accessibilityRole="button"
              onPress={() => void add(amount)}
              style={{ flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: theme.emphasisText, fontFamily: fontFamily.bold }}>{`+${formatCount(amount, locale)} ${text(locale, 'milliliters')}`}</Text>
            </Pressable>
          ))}
        </View>
        {(water.data.entries ?? []).map((entry) => (
          <Text key={entry.id} style={{ color: theme.textMuted, fontFamily: fontFamily.medium, marginBottom: 6 }}>
            {`+${formatCount(entry.milliliters, locale)} ${text(locale, 'milliliters')}`}
          </Text>
        ))}
        <Button label={text(locale, 'back')} variant="secondary" onPress={() => router.back()} />
      </ScreenBody>
    </Screen>
  );
}
