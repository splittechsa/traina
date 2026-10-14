import { View, Text, Pressable } from 'react-native';
import { fontFamily } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { formatCount, formatKg, formatRiyadhDate } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, ErrorState, ListRow, LoadingSkeleton, Sparkline } from '../src/ui/kit';
import { stableRecordKey } from '../src/lists/keys';

type Progress = {
  weights: { id: string; weight_grams: number; recorded_on: string }[];
  personalRecords: { id: string; exercise_id: string; load_grams: number; reps: number; achieved_at?: string }[];
  completedWorkouts: number;
};

export default function ProgressScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const progress = useQuery({ queryKey: ['progress'], queryFn: () => apiRequest<Progress>('/v1/progress') });
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
  if (progress.data.weights.length === 0 && progress.data.personalRecords.length === 0 && progress.data.completedWorkouts === 0) {
    return (
      <Screen>
        <ScreenBody footer={<Button label={text(locale, 'createPlan')} onPress={() => router.push('/(tabs)/training')} />}>
          <AppHeader title={text(locale, 'progress')} />
          <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24, marginTop: 18, marginBottom: 18 }}><Text style={{ fontSize: 42, color: theme.accent, marginBottom: 12 }}>↗</Text><Text style={{ fontSize: 24, lineHeight: 36, fontFamily: fontFamily.bold, color: theme.text }}>{locale === 'ar' ? 'كل إنجاز يبدأ بأول تمرين' : 'Every achievement starts with a session'}</Text><Text style={{ fontSize: 15, lineHeight: 26, fontFamily: fontFamily.regular, color: theme.textMuted, marginTop: 10 }}>{locale === 'ar' ? 'بعد إنهاء أول جلسة ستظهر هنا نتائجك الفعلية، وأرقامك الشخصية، وتطورك بمرور الوقت.' : 'Complete your first session to unlock real progress and personal records.'}</Text></View>
        </ScreenBody>
      </Screen>
    );
  }
  const latestWeight = [...progress.data.weights].sort((a, b) => String(b.recorded_on).localeCompare(String(a.recorded_on)))[0];
  const firstWeight = [...progress.data.weights].sort((a, b) => String(a.recorded_on).localeCompare(String(b.recorded_on)))[0];
  const weightDelta = latestWeight && firstWeight && latestWeight.id !== firstWeight.id ? Number(latestWeight.weight_grams) - Number(firstWeight.weight_grams) : null;
  const card = { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 22, padding: 19 } as const;
  return (
    <Screen>
      <ScreenBody>
        <View style={{ paddingHorizontal: 18 }}>
          <AppHeader title={text(locale, 'progress')} subtitle={locale === 'ar' ? 'أرقامك الحقيقية، خطوة بخطوة' : 'Your actual performance, over time'} />
          <View style={{ backgroundColor: theme.hero, borderRadius: 26, padding: 22, marginTop: 12, marginBottom: 16 }}>
            <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: 12, letterSpacing: 1 }}>SAHHTI / PERFORMANCE</Text>
            <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 41, marginTop: 7 }}>{locale === 'ar' ? 'تقدمك يستاهل تشوفه' : 'Progress worth seeing'}</Text>
            <Text style={{ color: theme.heroText, opacity: 0.72, fontFamily: fontFamily.regular, marginTop: 6 }}>{locale === 'ar' ? 'كل جلسة تنهيها تبني قصتك الرياضية.' : 'Every completed session adds to your story.'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <View style={{ ...card, flex: 1 }}><Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12 }}>{locale === 'ar' ? 'جلسات مكتملة' : 'Sessions'}</Text><Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 34, marginTop: 6 }}>{formatCount(progress.data.completedWorkouts, locale)}</Text></View>
            <View style={{ ...card, flex: 1 }}><Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12 }}>{locale === 'ar' ? 'أرقام شخصية' : 'Personal records'}</Text><Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 34, marginTop: 6 }}>{formatCount(progress.data.personalRecords.length, locale)}</Text></View>
          </View>
          <View style={{ ...card, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 19 }}>{locale === 'ar' ? 'تتبع الوزن' : 'Weight tracking'}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/weight')}><Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{locale === 'ar' ? 'تسجيل وزن ←' : 'Log weight →'}</Text></Pressable>
            </View>
            {latestWeight ? <><Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 34 }}>{formatKg(Number(latestWeight.weight_grams), locale)}</Text><Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: 12 }}>{formatRiyadhDate(String(latestWeight.recorded_on), locale)}</Text></> : <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular }}>{locale === 'ar' ? 'سجّل وزنك الأول لبدء متابعة التغير.' : 'Log your first weigh-in to see your trend.'}</Text>}
            {weightDelta !== null ? <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, marginTop: 8 }}>{weightDelta > 0 ? '+' : ''}{formatKg(weightDelta, locale)} {locale === 'ar' ? 'من أول تسجيل' : 'since first entry'}</Text> : null}
            {progress.data.weights.length > 1 ? <View style={{ marginTop: 16 }}><Sparkline values={[...progress.data.weights].sort((a,b) => String(a.recorded_on).localeCompare(String(b.recorded_on))).map((row) => Number(row.weight_grams))} /></View> : null}
          </View>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 19, marginBottom: 12 }}>{locale === 'ar' ? 'أحدث الأرقام الشخصية' : 'Recent personal records'}</Text>
          {progress.data.personalRecords.length === 0 ? <View style={{ ...card, marginBottom: 16 }}><Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular }}>{locale === 'ar' ? 'أكمل تمارينك وسجّل مجموعاتك حتى تبدأ أرقامك الشخصية بالظهور.' : 'Complete workouts and log sets to start tracking personal records.'}</Text></View> : progress.data.personalRecords.slice(0, 8).map((row) => <ListRow key={stableRecordKey(row.id)} title={formatKg(Number(row.load_grams), locale)} meta={`${formatCount(Number(row.reps), locale)} ${text(locale, 'reps')}`} />)}
          <View style={{ height: 12 }} />
          <Button label={locale === 'ar' ? 'العودة إلى التمارين' : 'Go to training'} onPress={() => router.push('/(tabs)/training')} />
          <View style={{ height: 24 }} />
        </View>
      </ScreenBody>
    </Screen>
  );
}
