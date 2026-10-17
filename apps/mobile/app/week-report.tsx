import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { compareSessionLoad } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { formatCount, formatDuration, riyadhToday } from '../src/format';
import { useSteps } from '../src/activity/useSteps';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, radius, spacing, typeScale } from '../src/theme/tokens';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton, SectionLabel, SurfaceCard } from '../src/ui/kit';

type Progress = {
  completedWorkouts: number;
  sessionLoads?: { completed_at: string; discipline: string; duration_seconds: number }[];
};
type DiaryRange = { days: { loggedOn: string; energyKcal: number; entryCount: number }[] };

function lastSeven(): string[] {
  const today = riyadhToday();
  const [year, month, day] = today.split('-').map(Number);
  const anchor = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1, 12));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
}

function ScoreRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: spacing[3] }}>
      <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable
            key={score}
            accessibilityRole="button"
            accessibilityState={{ selected: value === score }}
            onPress={() => onChange(score)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.md,
              alignItems: 'center',
              backgroundColor: value === score ? theme.accent : theme.surfaceMuted,
            }}
          >
            <Text style={{ color: value === score ? theme.emphasisText : theme.text, fontFamily: fontFamily.bold }}>{score}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function WeekReportScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const days = lastSeven();
  const weekOf = days[0] ?? riyadhToday();
  const { state } = useSteps(7);
  const progress = useQuery({ queryKey: ['progress'], queryFn: () => apiRequest<Progress>('/v1/progress') });
  const diary = useQuery({
    queryKey: ['diary-range', days[0], days[6]],
    queryFn: () => apiRequest<DiaryRange>(`/v1/nutrition/diary-range?from=${days[0]}&to=${days[6]}`),
  });
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [stress, setStress] = useState(3);
  const [hunger, setHunger] = useState(3);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const isAr = locale === 'ar';

  const submit = useMutation({
    mutationFn: () =>
      apiRequest('/v1/coach/weekly-brief', {
        method: 'POST',
        body: { weekOf, energy, sleep, stress, hunger, notes },
      }),
    onSuccess: async () => {
      setError('');
      await client.invalidateQueries({ queryKey: ['coach-messages'] });
      await client.invalidateQueries({ queryKey: ['coach-weekly-brief'] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    },
  });

  if (progress.isPending) {
    return <Screen><LoadingSkeleton /></Screen>;
  }
  if (progress.isError) {
    const offline = progress.error instanceof ApiClientError && progress.error.code === 'OFFLINE';
    return (
      <Screen title={text(locale, 'weekReport')}>
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void progress.refetch()} />
      </Screen>
    );
  }

  const windowLoads = (progress.data.sessionLoads ?? []).filter((row) => days.includes(riyadhToday(new Date(row.completed_at))));
  const load = compareSessionLoad(windowLoads, state.status === 'ready' ? state.today : 0);
  const foodKcal = (diary.data?.days ?? []).reduce((sum, row) => sum + row.energyKcal, 0);

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={text(locale, 'weekReport')}
          subtitle={text(locale, 'weekSurveyHint')}
          trailing={(
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{text(locale, 'back')}</Text>
            </Pressable>
          )}
        />
        <SurfaceCard padding={16} style={{ marginBottom: 12 }}>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium }}>{isAr ? 'جلسات مكتملة' : 'Completed sessions'}</Text>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 32 }}>{formatCount(windowLoads.length, locale)}</Text>
        </SurfaceCard>
        <SurfaceCard padding={16} style={{ marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, marginBottom: 8 }}>{text(locale, 'vsSteps')}</Text>
          <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
            {`${text(locale, 'strengthTime')} ${formatDuration(load.strengthSeconds)} · ${text(locale, 'cardioTime')} ${formatDuration(load.cardioSeconds)} · ${text(locale, 'stepsToday')} ${formatCount(load.steps, locale)}`}
          </Text>
        </SurfaceCard>
        <SurfaceCard padding={16} style={{ marginBottom: 12 }}>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium }}>{text(locale, 'calories')}</Text>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 28 }}>{formatCount(foodKcal, locale)}</Text>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 4 }}>{isAr ? 'من الوجبات المسجّلة هذا الأسبوع فقط' : 'From logged meals this week only'}</Text>
        </SurfaceCard>

        <SectionLabel>{isAr ? 'استطلاع للمتدرب' : 'Athlete survey'}</SectionLabel>
        <ScoreRow label={isAr ? 'الطاقة' : 'Energy'} value={energy} onChange={setEnergy} />
        <ScoreRow label={isAr ? 'النوم' : 'Sleep'} value={sleep} onChange={setSleep} />
        <ScoreRow label={isAr ? 'الضغط' : 'Stress'} value={stress} onChange={setStress} />
        <ScoreRow label={isAr ? 'الجوع' : 'Hunger'} value={hunger} onChange={setHunger} />
        <TextInput
          accessibilityLabel={isAr ? 'ملاحظات' : 'Notes'}
          value={notes}
          onChangeText={setNotes}
          placeholder={isAr ? 'ملاحظات لمدرب بشري (اختياري)' : 'Notes for a human coach (optional)'}
          placeholderTextColor={theme.textMuted}
          multiline
          style={{
            minHeight: 80,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: radius.lg,
            padding: spacing[3],
            color: theme.text,
            fontFamily: fontFamily.regular,
            fontSize: typeScale.body,
            marginBottom: spacing[3],
            textAlignVertical: 'top',
          }}
        />
        {error.length > 0 ? <Text style={{ color: theme.danger, fontFamily: fontFamily.medium, marginBottom: 8 }}>{error}</Text> : null}
        {submit.isSuccess ? (
          <Text style={{ color: theme.success, fontFamily: fontFamily.semibold, marginBottom: 8 }}>{text(locale, 'weekSurveySent')}</Text>
        ) : null}
        <Button
          label={submit.isPending ? text(locale, 'saving') : text(locale, 'weekSurveySend')}
          onPress={() => submit.mutate()}
          disabled={submit.isPending}
        />
        <View style={{ height: spacing[2] }} />
        <Button label={text(locale, 'back')} variant="secondary" onPress={() => router.back()} />
      </ScreenBody>
    </Screen>
  );
}
