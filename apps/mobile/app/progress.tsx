import { View, Text, Pressable, ScrollView } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useQuery } from '@tanstack/react-query';
import { fontFamily } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { router } from 'expo-router';
import { ApiClientError, apiRequest } from '../src/api/client';
import { formatCount, formatKg, formatRiyadhDate, riyadhToday } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton, Sparkline, WeekBars } from '../src/ui/kit';
import { stableRecordKey } from '../src/lists/keys';

type Progress = {
  weights: { id: string; weight_grams: number; recorded_on: string }[];
  personalRecords: { id: string; exercise_id: string; load_grams: number; reps: number; achieved_at?: string }[];
  completedWorkouts: number;
  completedSessionDates: string[];
  exerciseSets: { exercise_id: string; date: string; load_grams: number; reps: number }[];
};
type Exercise = { id: string; name_ar: string; name_en: string };

// Rolling 8-week window, Riyadh-anchored to match the date math used on Home/Training
// (today's calendar day in Asia/Riyadh, projected back in whole weeks).
function weekAnchors(): string[] {
  const todayIso = riyadhToday();
  const [year, month, day] = todayIso.split('-').map(Number);
  const anchor = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1, 12));
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() - (7 - index) * 7);
    return date.toISOString().slice(0, 10);
  });
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const from = Date.UTC(fy ?? 2026, (fm ?? 1) - 1, fd ?? 1);
  const to = Date.UTC(ty ?? 2026, (tm ?? 1) - 1, td ?? 1);
  return Math.round((to - from) / 86_400_000);
}

function shortLabel(iso: string, locale: 'ar' | 'en'): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    timeZone: 'Asia/Riyadh',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export default function ProgressScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const isAr = locale === 'ar';
  const progress = useQuery({ queryKey: ['progress'], queryFn: () => apiRequest<Progress>('/v1/progress') });
  const exercises = useQuery({
    queryKey: ['exercises'],
    queryFn: () => apiRequest<{ exercises: Exercise[] }>('/v1/exercises'),
  });
  if (progress.isPending) {
    return (
      <Screen>
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (progress.isError || progress.data === undefined) {
    const offline = progress.error instanceof ApiClientError && progress.error.code === 'OFFLINE';
    return (
      <Screen title={text(locale, 'progress')}>
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void progress.refetch()} />
      </Screen>
    );
  }
  // Defensive against an API server that predates these fields (completedSessionDates /
  // exerciseSets were added alongside this screen's new frequency/progression sections):
  // if the deployed services/api build is stale, the response still has weights /
  // personalRecords / completedWorkouts but these two arrays come back undefined, which
  // crashed the loop below with "Cannot convert undefined value to object" on a real device.
  const safeWeights = progress.data.weights ?? [];
  const safePersonalRecords = progress.data.personalRecords ?? [];
  const safeCompletedSessionDates = progress.data.completedSessionDates ?? [];
  const safeExerciseSets = progress.data.exerciseSets ?? [];

  if (safeWeights.length === 0 && safePersonalRecords.length === 0 && progress.data.completedWorkouts === 0) {
    return (
      <Screen>
        <ScreenBody footer={<Button label={text(locale, 'createPlan')} onPress={() => router.push('/(tabs)/training')} />}>
          <AppHeader title={text(locale, 'progress')} />
          <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24, marginTop: 18, marginBottom: 18 }}>
            <Text style={{ fontSize: 42, color: theme.accent, marginBottom: 12 }}>↗</Text>
            <Text style={{ fontSize: 24, lineHeight: 36, fontFamily: fontFamily.bold, color: theme.text }}>
              {isAr ? 'كل إنجاز يبدأ بأول تمرين' : 'Every achievement starts with a session'}
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 26, fontFamily: fontFamily.regular, color: theme.textMuted, marginTop: 10 }}>
              {isAr
                ? 'بعد إنهاء أول جلسة ستظهر هنا نتائجك الفعلية، وأرقامك الشخصية، وتطورك بمرور الوقت.'
                : 'Complete your first session to unlock real progress and personal records.'}
            </Text>
          </View>
        </ScreenBody>
      </Screen>
    );
  }

  const data = {
    ...progress.data,
    weights: safeWeights,
    personalRecords: safePersonalRecords,
    completedSessionDates: safeCompletedSessionDates,
    exerciseSets: safeExerciseSets,
  };
  const library = exercises.data?.exercises ?? [];
  const nameFor = (exerciseId: string): string => {
    const match = library.find((item) => item.id === exerciseId);
    if (match === undefined) return isAr ? 'تمرين' : 'Exercise';
    return isAr ? match.name_ar : match.name_en;
  };

  const latestWeight = [...data.weights].sort((a, b) => String(b.recorded_on).localeCompare(String(a.recorded_on)))[0];
  const firstWeight = [...data.weights].sort((a, b) => String(a.recorded_on).localeCompare(String(b.recorded_on)))[0];
  const weightDelta =
    latestWeight && firstWeight && latestWeight.id !== firstWeight.id
      ? Number(latestWeight.weight_grams) - Number(firstWeight.weight_grams)
      : null;

  // Training frequency: real completed-session timestamps bucketed into the same 8 rolling
  // weeks shown on the chart, anchored to Riyadh local time.
  const anchors = weekAnchors();
  const weekCounts = anchors.map(() => 0);
  for (const timestamp of data.completedSessionDates) {
    const day = riyadhToday(new Date(timestamp));
    for (let index = anchors.length - 1; index >= 0; index--) {
      const diff = daysBetween(anchors[index] ?? day, day);
      if (diff >= 0 && diff < 7) {
        weekCounts[index] = (weekCounts[index] ?? 0) + 1;
        break;
      }
    }
  }
  const totalInWindow = weekCounts.reduce((sum, value) => sum + value, 0);
  const weeksWithData = Math.max(1, anchors.length);
  const weeklyAverage = totalInWindow / weeksWithData;
  let streak = 0;
  for (let index = weekCounts.length - 1; index >= 0; index--) {
    const value = weekCounts[index];
    if (index === weekCounts.length - 1 && value === 0) continue; // the open current week doesn't break a streak
    if (value !== undefined && value > 0) streak += 1;
    else break;
  }
  const weekBars = anchors.map((start, index) => ({ label: shortLabel(start, locale), value: weekCounts[index] ?? 0 }));

  // Exercise progression: group the real per-session top sets by exercise, keep the exercises
  // with the most logged sessions, most-trained first.
  const byExercise = new Map<string, { date: string; loadGrams: number; reps: number }[]>();
  for (const row of data.exerciseSets) {
    const list = byExercise.get(row.exercise_id) ?? [];
    list.push({ date: row.date, loadGrams: Number(row.load_grams), reps: Number(row.reps) });
    byExercise.set(row.exercise_id, list);
  }
  const progressionRows = Array.from(byExercise.entries())
    .map(([exerciseId, points]) => ({ exerciseId, points: points.sort((a, b) => a.date.localeCompare(b.date)) }))
    .filter((row) => row.points.length >= 2)
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, 6);

  const card = { backgroundColor: theme.surface, borderRadius: 20, padding: 16 } as const;

  return (
    <Screen>
      <ScreenBody>
        <View style={{ paddingHorizontal: 18 }}>
          <AppHeader title={text(locale, 'progress')} subtitle={isAr ? 'ما أُنجز فعلياً' : 'What you have actually completed'} />

          <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: 18 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12 }}>{isAr ? 'جلسات' : 'Sessions'}</Text>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 30, marginTop: 2 }}>{formatCount(data.completedWorkouts, locale)}</Text>
            </View>
            <View style={{ flex: 1, borderStartWidth: 1, borderStartColor: theme.border, paddingStart: 14 }}>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12 }}>{text(locale, 'streak')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 30 }}>{formatCount(streak, locale)}</Text>
                <SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} size={16} tintColor={theme.ember} />
              </View>
            </View>
            <View style={{ flex: 1, borderStartWidth: 1, borderStartColor: theme.border, paddingStart: 14 }}>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12 }}>{isAr ? 'أرقام شخصية' : 'Records'}</Text>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 30, marginTop: 2 }}>{formatCount(data.personalRecords.length, locale)}</Text>
            </View>
          </View>

          <View style={{ ...card, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 16 }}>{text(locale, 'trainingFrequency')}</Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12 }}>
                {weeklyAverage.toFixed(1)} {text(locale, 'perWeekAvg')}
              </Text>
            </View>
            <WeekBars data={weekBars} />
          </View>

          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 16, marginBottom: 10 }}>{text(locale, 'exerciseProgression')}</Text>
          {progressionRows.length === 0 ? (
            <View style={{ ...card, marginBottom: 16 }}>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular }}>{text(locale, 'exerciseProgressionEmpty')}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 10 }}>
              {progressionRows.map((row) => {
                const first = row.points[0];
                const last = row.points[row.points.length - 1];
                const delta = first !== undefined && last !== undefined ? last.loadGrams - first.loadGrams : 0;
                return (
                  <View key={row.exerciseId} style={{ ...card, width: 176, padding: 14 }}>
                    <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 13 }}>{nameFor(row.exerciseId)}</Text>
                    {last !== undefined ? (
                      <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 20, marginTop: 4 }}>
                        {last.loadGrams === 0 ? `${formatCount(last.reps, locale)} ${text(locale, 'reps')}` : formatKg(last.loadGrams, locale)}
                      </Text>
                    ) : null}
                    {delta !== 0 ? (
                      <Text style={{ color: delta > 0 ? theme.success : theme.textMuted, fontFamily: fontFamily.semibold, fontSize: 11, marginBottom: 6 }}>
                        {delta > 0 ? '+' : ''}{formatKg(delta, locale)}
                      </Text>
                    ) : (
                      <View style={{ marginBottom: 6 }} />
                    )}
                    <Sparkline values={row.points.map((point) => point.loadGrams)} />
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={{ ...card, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 16 }}>{text(locale, 'weightTracking')}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/weight')}>
                <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: 13 }}>{isAr ? 'تسجيل وزن ←' : 'Log weight →'}</Text>
              </Pressable>
            </View>
            {latestWeight ? (
              <>
                <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 28 }}>{formatKg(Number(latestWeight.weight_grams), locale)}</Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: 12 }}>{formatRiyadhDate(String(latestWeight.recorded_on), locale)}</Text>
              </>
            ) : (
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular }}>{isAr ? 'سجّل وزنك الأول لبدء متابعة التغير.' : 'Log your first weigh-in to see your trend.'}</Text>
            )}
            {weightDelta !== null ? (
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, marginTop: 6, fontSize: 13 }}>
                {weightDelta > 0 ? '+' : ''}{formatKg(weightDelta, locale)} {isAr ? 'من أول تسجيل' : 'since first entry'}
              </Text>
            ) : null}
            {data.weights.length > 1 ? (
              <View style={{ marginTop: 12 }}>
                <Sparkline values={[...data.weights].sort((a, b) => String(a.recorded_on).localeCompare(String(b.recorded_on))).map((row) => Number(row.weight_grams))} />
              </View>
            ) : null}
          </View>

          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 16, marginBottom: 10 }}>{text(locale, 'achievements')}</Text>
          {data.personalRecords.length === 0 ? (
            <View style={{ ...card, marginBottom: 12 }}>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular }}>
                {isAr ? 'أكمل تمارينك وسجّل مجموعاتك حتى تبدأ أرقامك الشخصية بالظهور.' : 'Complete workouts and log sets to start tracking personal records.'}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 10 }}>
              {data.personalRecords.slice(0, 10).map((row) => (
                <View key={stableRecordKey(row.id)} style={{ backgroundColor: theme.surfaceMuted, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', minWidth: 112 }}>
                  <SymbolView name={{ ios: 'trophy.fill', android: 'military_tech', web: 'military_tech' }} size={18} tintColor={theme.ember} />
                  <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 12, marginTop: 6 }}>{nameFor(row.exercise_id)}</Text>
                  <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 11, marginTop: 2 }}>
                    {Number(row.load_grams) === 0 ? `${formatCount(Number(row.reps), locale)} ${text(locale, 'reps')}` : `${formatKg(Number(row.load_grams), locale)} × ${formatCount(Number(row.reps), locale)}`}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <Button label={isAr ? 'العودة إلى التمارين' : 'Go to training'} onPress={() => router.push('/(tabs)/training')} />
          <View style={{ height: 24 }} />
        </View>
      </ScreenBody>
    </Screen>
  );
}
