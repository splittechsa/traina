import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_WATER_GOAL_ML } from '@sahhti/domain';
import { apiRequest } from '../api/client';
import { useSteps } from '../activity/useSteps';
import { formatCount, riyadhToday } from '../format';
import { useLocale } from '../i18n/LocaleProvider';
import { text } from '../i18n/copy';
import { LOCAL_KEYS, useLocalValue } from '../storage/local';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, radius, spacing } from '../theme/tokens';

type WaterDay = { milliliters?: number };

export function DailyGlance({ calories }: { calories: number | null }) {
  const { locale } = useLocale();
  const theme = useTheme();
  const today = riyadhToday();
  const goal = useLocalValue<number>(LOCAL_KEYS.waterGoal, DEFAULT_WATER_GOAL_ML);
  const water = useQuery({
    queryKey: ['water', today],
    queryFn: () => apiRequest<WaterDay>(`/v1/water?on=${today}`),
  });
  const { state } = useSteps(1);
  const milliliters = typeof water.data?.milliliters === 'number' ? water.data.milliliters : 0;
  const steps = state.status === 'ready' ? state.today : null;
  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/water')} style={card}>
          <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.medium }]}>{text(locale, 'water')}</Text>
          <Text style={[styles.value, { color: theme.text, fontFamily: fontFamily.bold }]}>
            {formatCount(milliliters / 1000, locale)}
            <Text style={[styles.unit, { color: theme.textMuted }]}>{` ${text(locale, 'liters')}`}</Text>
          </Text>
          <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>
            {`${text(locale, 'addWater')} · ${formatCount(goal.value / 1000, locale)}`}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/activity')} style={card}>
          <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.medium }]}>{text(locale, 'stepsToday')}</Text>
          <Text style={[styles.value, { color: theme.text, fontFamily: fontFamily.bold }]}>
            {steps === null ? '—' : formatCount(steps, locale)}
          </Text>
          <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>{text(locale, 'activity')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/nutrition')} style={card}>
          <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.medium }]}>{text(locale, 'calories')}</Text>
          <Text style={[styles.value, { color: theme.text, fontFamily: fontFamily.bold }]}>
            {calories === null ? '—' : formatCount(calories, locale)}
          </Text>
          <Text style={[styles.caption, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>{text(locale, 'kcal')}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/week-report')} style={{ marginBottom: spacing[3] }}>
        <Text style={{ color: theme.accent, fontFamily: fontFamily.bold }}>{text(locale, 'weekReport')}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  card: { flex: 1, minHeight: 96, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], justifyContent: 'space-between' },
  caption: { fontSize: 11, lineHeight: 14 },
  value: { fontSize: 22, lineHeight: 26 },
  unit: { fontSize: 12 },
});
