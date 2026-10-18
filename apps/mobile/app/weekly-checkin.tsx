import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { fontFamily, radius, spacing, typeScale } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, LoadingSkeleton, SurfaceCard } from '../src/ui/kit';

type Score = 1 | 2 | 3 | 4 | 5;

type Preview = {
  consentStatus: string;
  disclosure: string;
  packet: {
    goals: string[];
    adherence: {
      mealDaysLogged: number;
      waterDaysLogged: number;
      sessionsCompleted: number;
      confirmedNonAdherence: boolean;
    };
    weightTrendGramsPerWeek: number | null;
    dataCompletenessBps: number;
    uncertaintyNotes: string[];
  };
};

type ReviewStatus = {
  hasAssignedCoach: boolean;
  noCoachMessage: string | null;
  review: { id: string; weekOf: string; status: string; updatedAt: string } | null;
  unreadHumanFeedback: { id: string; body: string; authorKind: string; createdAt: string }[];
};

type Recommendations = {
  recommendations: {
    id: string;
    category: string;
    status: string;
    summary: string;
    rationale: string;
    safetyClass?: string;
  }[];
};

function mondayOfWeek(day = new Date()): string {
  const d = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const weekday = d.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function reviewStatusLabel(status: string, locale: 'ar' | 'en'): string {
  const map: Record<string, { ar: string; en: string }> = {
    WEEKLY_REVIEW_DUE: { ar: 'مستحق', en: 'Due' },
    QUEUED_FOR_HUMAN: { ar: 'بانتظار المدرب', en: 'Pending coach' },
    ASSIGNED: { ar: 'مُسند', en: 'Assigned' },
    IN_REVIEW: { ar: 'قيد المراجعة', en: 'In review' },
    FEEDBACK_SENT: { ar: 'تم إرسال الملاحظة', en: 'Feedback sent' },
    COMPLETED: { ar: 'مكتمل', en: 'Completed' },
    OVERDUE: { ar: 'متأخر', en: 'Delayed / overdue' },
    ESCALATED: { ar: 'مُصعَّد', en: 'Escalated' },
    REASSIGNED: { ar: 'أُعيد التعيين', en: 'Reassigned' },
    FAILED: { ar: 'تعذّر الإكمال', en: 'Failed' },
  };
  return map[status]?.[locale] ?? status;
}

function ScoreRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Score;
  onChange: (next: Score) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityRole="adjustable" accessibilityLabel={label}>
      <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([1, 2, 3, 4, 5] as const).map((score) => {
          const active = value === score;
          return (
            <Pressable
              key={score}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} ${score}`}
              onPress={() => onChange(score)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? theme.emphasis : theme.surfaceMuted,
                borderWidth: 1,
                borderColor: active ? theme.emphasis : theme.border,
              }}
            >
              <Text style={{ color: active ? theme.emphasisText : theme.text, fontFamily: fontFamily.bold }}>{score}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function WeeklyCheckinScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const weekOf = useMemo(() => mondayOfWeek(), []);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [effort, setEffort] = useState<Score>(3);
  const [recovery, setRecovery] = useState<Score>(3);
  const [satisfaction, setSatisfaction] = useState<Score>(3);
  const [energy, setEnergy] = useState<Score>(3);
  const [sleep, setSleep] = useState<Score>(3);
  const [stress, setStress] = useState<Score>(2);
  const [hunger, setHunger] = useState<Score>(3);
  const [difficulties, setDifficulties] = useState('');
  const [questionForCoach, setQuestionForCoach] = useState('');
  const [planDiffById, setPlanDiffById] = useState<
    Record<string, { changes: string[]; beforeSets?: number; afterSets?: number; toVersion?: number }>
  >({});
  const isAr = locale === 'ar';

  const preview = useQuery({
    queryKey: ['weekly-share-preview', weekOf],
    queryFn: () => apiRequest<Preview>(`/v1/member/weekly-share-preview?weekOf=${weekOf}`),
  });
  const status = useQuery({
    queryKey: ['weekly-review-status'],
    queryFn: () => apiRequest<ReviewStatus>('/v1/member/weekly-review'),
  });
  const recommendations = useQuery({
    queryKey: ['member-recommendations'],
    queryFn: () => apiRequest<Recommendations>('/v1/member/recommendations'),
  });

  const grantConsent = useMutation({
    mutationFn: () => apiRequest('/v1/member/coach-share-consent', { method: 'POST' }),
    onSuccess: () => void preview.refetch(),
  });

  const submit = useMutation({
    mutationFn: () =>
      apiRequest<{ escalateToHuman: boolean; status: string }>('/v1/coach/weekly-brief', {
        method: 'POST',
        body: {
          weekOf,
          energy,
          sleep,
          stress,
          hunger,
          effort,
          recovery,
          satisfaction,
          difficulties,
          questionForCoach,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['weekly-review-status'] }),
        client.invalidateQueries({ queryKey: ['coach-messages'] }),
      ]);
      setStep(3);
    },
  });

  const advanceRecommendation = useMutation({
    mutationFn: (input: { id: string; status: 'APPROVED' | 'APPLIED' }) =>
      apiRequest<{
        applied?: boolean;
        programVersion?: number;
        diff?: {
          changes: string[];
          before: { sampleDayExercises: { sets: number }[] };
          after: { sampleDayExercises: { sets: number }[]; programVersion: number };
        };
      }>(`/v1/member/recommendations/${input.id}/advance`, {
        method: 'POST',
        body: { status: input.status },
      }),
    onSuccess: async (result, variables) => {
      if (result.diff) {
        setPlanDiffById((prev) => ({
          ...prev,
          [variables.id]: {
            changes: result.diff?.changes ?? [],
            beforeSets: result.diff?.before.sampleDayExercises[0]?.sets,
            afterSets: result.diff?.after.sampleDayExercises[0]?.sets,
            toVersion: result.programVersion ?? result.diff?.after.programVersion,
          },
        }));
      }
      await client.invalidateQueries({ queryKey: ['member-recommendations'] });
    },
  });

  const previewApply = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{
        diff: {
          changes: string[];
          before: { sampleDayExercises: { sets: number }[] };
          after: { sampleDayExercises: { sets: number }[]; programVersion: number };
        };
      }>(`/v1/member/recommendations/${id}/preview-apply`),
    onSuccess: (result, id) => {
      setPlanDiffById((prev) => ({
        ...prev,
        [id]: {
          changes: result.diff.changes,
          beforeSets: result.diff.before.sampleDayExercises[0]?.sets,
          afterSets: result.diff.after.sampleDayExercises[0]?.sets,
          toVersion: result.diff.after.programVersion,
        },
      }));
    },
  });

  const packet = preview.data?.packet;
  const errorMessage =
    submit.error instanceof ApiClientError
      ? messageFor(submit.error.code, locale, text(locale, 'error'))
      : submit.isError
        ? text(locale, 'error')
        : null;

  return (
    <Screen>
      <ScreenBody
        footer={
          step < 3 ? (
            <View style={{ gap: 10, paddingHorizontal: spacing[4], paddingTop: spacing[2] }}>
              {errorMessage ? <Text style={{ color: theme.danger, fontFamily: fontFamily.medium }}>{errorMessage}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {step > 0 ? (
                  <Button label={text(locale, 'back')} variant="secondary" onPress={() => setStep((step - 1) as 0 | 1 | 2)} />
                ) : (
                  <Button label={text(locale, 'back')} variant="secondary" onPress={() => router.back()} />
                )}
                {step < 2 ? (
                  <Button label={text(locale, 'continue')} onPress={() => setStep((step + 1) as 1 | 2)} />
                ) : (
                  <Button
                    label={text(locale, 'weeklySubmit')}
                    onPress={() => {
                      if (preview.data?.consentStatus !== 'granted') {
                        grantConsent.mutate(undefined, { onSuccess: () => submit.mutate() });
                      } else {
                        submit.mutate();
                      }
                    }}
                    disabled={submit.isPending || grantConsent.isPending}
                  />
                )}
              </View>
            </View>
          ) : (
            <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2] }}>
              <Button label={text(locale, 'home')} onPress={() => router.replace('/(tabs)/home')} />
            </View>
          )
        }
      >
        <AppHeader title={text(locale, 'weeklyCheckin')} subtitle={weekOf} showBack />

        {preview.isPending || status.isPending ? <LoadingSkeleton /> : null}
        {preview.isError ? <EmptyState title={text(locale, 'error')} body={text(locale, 'error')} /> : null}

        {status.data?.unreadHumanFeedback?.[0] !== undefined ? (
          <SurfaceCard tone="raised">
            <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, marginBottom: 6 }}>
              {text(locale, 'humanFeedbackReady')}
            </Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, marginBottom: 8 }}>
              {text(locale, 'humanCoachLabel')}
            </Text>
            <Text style={{ color: theme.text, fontFamily: fontFamily.regular, lineHeight: 22 }}>
              {status.data.unreadHumanFeedback[0].body}
            </Text>
          </SurfaceCard>
        ) : null}

        {step === 0 && packet !== undefined ? (
          <View style={{ gap: spacing[3] }}>
            <SurfaceCard>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, marginBottom: 8 }}>
                {text(locale, 'weeklySummaryTitle')}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, lineHeight: 22 }}>
                {isAr
                  ? `وجبات مسجّلة ${packet.adherence.mealDaysLogged} · ماء ${packet.adherence.waterDaysLogged} · حصص مكتملة ${packet.adherence.sessionsCompleted}`
                  : `Meals logged ${packet.adherence.mealDaysLogged} · water ${packet.adherence.waterDaysLogged} · sessions completed ${packet.adherence.sessionsCompleted}`}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 8, lineHeight: 20 }}>
                {text(locale, 'weeklyMissingHint')}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 8 }}>
                {packet.weightTrendGramsPerWeek === null
                  ? text(locale, 'weeklyWeightUnavailable')
                  : isAr
                    ? `اتجاه الوزن: ${packet.weightTrendGramsPerWeek} غ/أسبوع`
                    : `Weight trend: ${packet.weightTrendGramsPerWeek} g/week`}
              </Text>
            </SurfaceCard>
            {!status.data?.hasAssignedCoach ? (
              <EmptyState title={text(locale, 'weeklyNoCoachTitle')} body={status.data?.noCoachMessage ?? text(locale, 'weeklyNoCoachBody')} />
            ) : null}
            {status.data?.review !== null && status.data?.review !== undefined ? (
              <SurfaceCard tone={status.data.review.status === 'OVERDUE' ? 'raised' : 'muted'}>
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
                  {text(locale, 'weeklyStatus')}: {reviewStatusLabel(status.data.review.status, locale)}
                </Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 4 }}>
                  {status.data.review.weekOf}
                </Text>
              </SurfaceCard>
            ) : null}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={{ gap: spacing[4] }}>
            <ScoreRow label={text(locale, 'weeklyEffort')} value={effort} onChange={setEffort} />
            <ScoreRow label={text(locale, 'weeklyRecovery')} value={recovery} onChange={setRecovery} />
            <ScoreRow label={text(locale, 'weeklySatisfaction')} value={satisfaction} onChange={setSatisfaction} />
            <ScoreRow label={text(locale, 'weeklyEnergy')} value={energy} onChange={setEnergy} />
            <ScoreRow label={text(locale, 'weeklySleep')} value={sleep} onChange={setSleep} />
            <ScoreRow label={text(locale, 'weeklyStress')} value={stress} onChange={setStress} />
            <ScoreRow label={text(locale, 'weeklyHunger')} value={hunger} onChange={setHunger} />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: spacing[3] }}>
            <SurfaceCard>
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, marginBottom: 8 }}>
                {text(locale, 'weeklyDifficulties')}
              </Text>
              <TextInput
                value={difficulties}
                onChangeText={setDifficulties}
                multiline
                maxLength={500}
                placeholder={text(locale, 'weeklyDifficultiesHint')}
                placeholderTextColor={theme.textMuted}
                style={{
                  minHeight: 72,
                  color: theme.text,
                  fontFamily: fontFamily.regular,
                  textAlign: isAr ? 'right' : 'left',
                }}
              />
            </SurfaceCard>
            <SurfaceCard>
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, marginBottom: 8 }}>
                {text(locale, 'weeklyQuestion')}
              </Text>
              <TextInput
                value={questionForCoach}
                onChangeText={setQuestionForCoach}
                multiline
                maxLength={500}
                placeholder={text(locale, 'weeklyQuestionHint')}
                placeholderTextColor={theme.textMuted}
                style={{
                  minHeight: 72,
                  color: theme.text,
                  fontFamily: fontFamily.regular,
                  textAlign: isAr ? 'right' : 'left',
                }}
              />
            </SurfaceCard>
            <SurfaceCard tone="muted">
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, marginBottom: 8 }}>
                {text(locale, 'weeklyShareTitle')}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, lineHeight: 22 }}>
                {preview.data?.disclosure ?? text(locale, 'weeklyShareBody')}
              </Text>
            </SurfaceCard>
            {(recommendations.data?.recommendations ?? [])
              .filter(
                (row) =>
                  row.status === 'APPROVED' ||
                  row.status === 'REVIEW_REQUIRED' ||
                  row.status === 'MEMBER_CONFIRMATION_REQUIRED',
              )
              .slice(0, 3)
              .map((row) => (
                <SurfaceCard key={row.id}>
                  <Text style={{ color: theme.accent, fontFamily: fontFamily.medium, marginBottom: 4 }}>
                    {row.status === 'APPROVED'
                      ? text(locale, 'approvedRecommendation')
                      : row.status === 'MEMBER_CONFIRMATION_REQUIRED'
                        ? text(locale, 'memberConfirmNeeded')
                        : text(locale, 'pendingRecommendation')}
                  </Text>
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{row.summary}</Text>
                  <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 6, lineHeight: 20 }}>
                    {row.rationale}
                  </Text>
                  {row.status !== 'APPLIED' ? (
                    <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 6 }}>
                      {text(locale, 'guidanceOnlyRec')}
                    </Text>
                  ) : null}
                  {planDiffById[row.id] !== undefined ? (
                    <View style={{ marginTop: 10, gap: 4 }}>
                      <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>
                        {text(locale, 'planDiffTitle')}
                        {planDiffById[row.id]?.toVersion !== undefined
                          ? ` · v${planDiffById[row.id]?.toVersion}`
                          : ''}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, lineHeight: 20 }}>
                        {(planDiffById[row.id]?.changes ?? []).join(' · ')}
                      </Text>
                      {planDiffById[row.id]?.beforeSets !== undefined ? (
                        <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular }}>
                          sets {planDiffById[row.id]?.beforeSets} → {planDiffById[row.id]?.afterSets}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {row.category === 'training' ? (
                    <View style={{ marginTop: 10 }}>
                      <Button
                        label={text(locale, 'previewPlan')}
                        variant="secondary"
                        onPress={() => previewApply.mutate(row.id)}
                        disabled={previewApply.isPending}
                      />
                    </View>
                  ) : null}
                  {row.status === 'MEMBER_CONFIRMATION_REQUIRED' && row.category !== 'nutrition' ? (
                    <View style={{ marginTop: 10 }}>
                      <Button
                        label={text(locale, 'confirmRecommendation')}
                        onPress={() => advanceRecommendation.mutate({ id: row.id, status: 'APPROVED' })}
                        disabled={advanceRecommendation.isPending}
                      />
                    </View>
                  ) : null}
                  {row.status === 'APPROVED' && row.category === 'training' ? (
                    <View style={{ marginTop: 10 }}>
                      <Button
                        label={text(locale, 'applyRecommendation')}
                        onPress={() => advanceRecommendation.mutate({ id: row.id, status: 'APPLIED' })}
                        disabled={advanceRecommendation.isPending}
                      />
                    </View>
                  ) : null}
                  {row.status === 'APPROVED' &&
                  row.category !== 'training' &&
                  row.category !== 'nutrition' &&
                  row.safetyClass !== 'blocked_policy' ? (
                    <View style={{ marginTop: 10 }}>
                      <Button
                        label={text(locale, 'applyRecommendation')}
                        onPress={() => advanceRecommendation.mutate({ id: row.id, status: 'APPLIED' })}
                        disabled={advanceRecommendation.isPending}
                      />
                    </View>
                  ) : null}
                  {row.status === 'APPLIED' ? (
                    <Text style={{ color: theme.accent, fontFamily: fontFamily.medium, marginTop: 8 }}>
                      {text(locale, 'planApplied')}
                    </Text>
                  ) : null}
                </SurfaceCard>
              ))}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: spacing[3] }}>
            <SurfaceCard tone="raised">
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, marginBottom: 8 }}>
                {submit.data?.escalateToHuman === false
                  ? text(locale, 'weeklySavedYazan')
                  : text(locale, 'weeklySubmitted')}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, lineHeight: 22 }}>
                {submit.data?.escalateToHuman === false
                  ? text(locale, 'weeklySavedYazanBody')
                  : status.data?.hasAssignedCoach
                    ? text(locale, 'weeklySubmittedBody')
                    : text(locale, 'weeklyNoCoachBody')}
              </Text>
              {status.data?.review !== null && status.data?.review !== undefined ? (
                <Text style={{ color: theme.accent, fontFamily: fontFamily.medium, marginTop: 10 }}>
                  {reviewStatusLabel(status.data.review.status, locale)}
                </Text>
              ) : null}
            </SurfaceCard>
            {(recommendations.data?.recommendations ?? [])
              .filter((row) => row.status === 'APPROVED' || row.status === 'APPLIED' || row.status === 'MONITORED')
              .slice(0, 3)
              .map((row) => (
                <SurfaceCard key={row.id}>
                  <Text style={{ color: theme.accent, fontFamily: fontFamily.medium, marginBottom: 4 }}>
                    {row.status === 'APPLIED' || row.status === 'MONITORED'
                      ? text(locale, 'approvedRecommendation')
                      : text(locale, 'guidanceOnlyRec')}
                  </Text>
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{row.summary}</Text>
                  <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 6, lineHeight: 20 }}>
                    {row.rationale}
                  </Text>
                </SurfaceCard>
              ))}
          </View>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
