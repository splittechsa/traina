import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { label } from '../src/i18n/labels';
import { fontFamily, spacing } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, SectionLabel, SurfaceCard } from '../src/ui/kit';
import { YazanCard, openYazanWithPrompt } from '../src/ui/YazanCard';
import { TrainingFamilyCards, type TrainingFamily } from '../src/training/filterCards';

type Audience = {
  goal_ar: string;
  goal_en: string;
  experience_ar: string;
  experience_en: string;
  durationMin: number;
  equipment_ar: string;
  equipment_en: string;
};

type Template = {
  id: string;
  family: string;
  split: string;
  daysPerWeek: number;
  discipline: string;
  environment: string;
  name_ar: string;
  name_en: string;
  summary_ar: string;
  summary_en: string;
  recommended?: boolean;
  audience?: Audience | null;
  days: { name_ar: string; name_en: string; exerciseCount: number; exerciseIds: string[] }[];
};

type ProgramsResponse = {
  active: {
    id: string;
    templateId: string | null;
    name: string;
    version: number;
    days: Template['days'];
  } | null;
  templates: Template[];
  recommended: { id: string; score: number; reason_ar: string; reason_en: string }[];
};

function familyOf(template: Template): TrainingFamily {
  if (template.family === 'crossfit') return 'crossfit';
  if (template.family === 'calisthenics') return 'calisthenics';
  return 'strength';
}

export default function ProgramsScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const isAr = locale === 'ar';
  const [filter, setFilter] = useState<TrainingFamily>('all');
  const [message, setMessage] = useState('');
  const [startingDay, setStartingDay] = useState<number | null>(null);

  const programs = useQuery({
    queryKey: ['training-programs'],
    queryFn: () => apiRequest<ProgramsResponse>('/v1/training/programs'),
  });

  const activate = useMutation({
    mutationFn: (templateId: string) =>
      apiRequest<{ program: { id: string } }>('/v1/training/programs', {
        method: 'POST',
        body: { templateId },
      }),
    onSuccess: async () => {
      setMessage('');
      await client.invalidateQueries({ queryKey: ['training-programs'] });
      await client.invalidateQueries({ queryKey: ['home'] });
    },
    onError: (caught) => {
      setMessage(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    },
  });

  const templates = useMemo(() => {
    const rows = programs.data?.templates ?? [];
    if (filter === 'all') return rows;
    return rows.filter((item) => familyOf(item) === filter);
  }, [filter, programs.data?.templates]);

  const recommended = useMemo(() => {
    const ranked = programs.data?.recommended ?? [];
    const byId = new Map((programs.data?.templates ?? []).map((item) => [item.id, item]));
    return ranked
      .slice(0, 3)
      .map((item) => ({ ...item, template: byId.get(item.id) }))
      .filter((item): item is typeof item & { template: Template } => item.template !== undefined);
  }, [programs.data]);

  const active = programs.data?.active ?? null;

  async function startDay(dayIndex: number) {
    if (active === null || startingDay !== null) return;
    setStartingDay(dayIndex);
    setMessage('');
    try {
      const result = await apiRequest<{ session: { id: string } }>(
        `/v1/training/programs/${active.id}/start-day`,
        { method: 'POST', body: { dayIndex, startNow: true } },
      );
      await client.invalidateQueries({ queryKey: ['sessions'] });
      await client.invalidateQueries({ queryKey: ['home'] });
      router.push({ pathname: '/workout/[id]', params: { id: result.session.id } });
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setStartingDay(null);
    }
  }

  if (programs.isPending) {
    return (
      <Screen>
        <AppHeader title={text(locale, 'explorePrograms')} />
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (programs.isError || programs.data === undefined) {
    const offline = programs.error instanceof ApiClientError && programs.error.code === 'OFFLINE';
    return (
      <Screen>
        <AppHeader title={text(locale, 'explorePrograms')} />
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void programs.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={text(locale, 'explorePrograms')}
          subtitle={isAr ? 'قوالب جاهزة · خصّص ثم ابدأ' : 'Ready templates · customize then start'}
        />

        <YazanCard
          body={
            recommended[0] === undefined
              ? isAr
                ? 'أخبرني هدفك وأيامك ومكانك، وأقترح لك التقسيم الأنسب.'
                : 'Tell me your goal, days, and place — I’ll suggest the best split.'
              : isAr
                ? recommended[0].reason_ar
                : recommended[0].reason_en
          }
          actions={[
            {
              label: text(locale, 'suggestPlan'),
              onPress: () =>
                openYazanWithPrompt(
                  isAr
                    ? 'اقترح لي خطة تدريب حسب هدفي وأيامي ومعداتي'
                    : 'Suggest a training plan based on my goal, days, and equipment',
                ),
            },
            {
              label: text(locale, 'askCoach'),
              onPress: () => router.push('/(tabs)/coach'),
            },
          ]}
        />

        {active !== null ? (
          <SurfaceCard style={{ marginBottom: 14 }}>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12, marginBottom: 4 }}>
              {text(locale, 'myActivePlan')}
            </Text>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 18 }}>{active.name}</Text>
            <Text style={{ color: theme.textMuted, marginTop: 4, fontFamily: fontFamily.regular, fontSize: 13 }}>
              {isAr ? `إصدار ${active.version}` : `Version ${active.version}`} · {active.days.length}{' '}
              {isAr ? 'أيام' : 'days'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <Button
                label={text(locale, 'customizePlan')}
                variant="secondary"
                onPress={() => router.push({ pathname: '/program-edit', params: { id: active.id } })}
              />
            </View>
            <SectionLabel>{text(locale, 'programDays')}</SectionLabel>
            {active.days.map((day, index) => (
              <Pressable
                key={`${day.name_en}-${index}`}
                accessibilityRole="button"
                onPress={() => void startDay(index)}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: index === active.days.length - 1 ? 0 : 1,
                  borderBottomColor: theme.border,
                }}
              >
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
                  {isAr ? day.name_ar : day.name_en}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                  {day.exerciseCount} {isAr ? 'تمارين' : 'exercises'} ·{' '}
                  {startingDay === index ? text(locale, 'saving') : text(locale, 'startProgramDay')}
                </Text>
              </Pressable>
            ))}
          </SurfaceCard>
        ) : (
          <EmptyState
            title={text(locale, 'myActivePlan')}
            body={text(locale, 'noActivePlanHint')}
          />
        )}

        {recommended.length > 0 ? (
          <>
            <SectionLabel>{text(locale, 'recommendedForYou')}</SectionLabel>
            {recommended.map((item) => (
              <SurfaceCard key={item.id} style={{ marginBottom: 10 }}>
                <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, fontSize: 12, marginBottom: 4 }}>
                  {text(locale, 'recommendedForYou')}
                </Text>
                <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 17 }}>
                  {isAr ? item.template.name_ar : item.template.name_en}
                </Text>
                <Text style={{ color: theme.textMuted, marginTop: 4, lineHeight: 20 }}>
                  {isAr ? item.reason_ar : item.reason_en}
                </Text>
                <View style={{ marginTop: 10 }}>
                  <Button
                    label={activate.isPending ? text(locale, 'saving') : text(locale, 'startFromTemplate')}
                    disabled={activate.isPending}
                    onPress={() => activate.mutate(item.id)}
                  />
                </View>
              </SurfaceCard>
            ))}
          </>
        ) : null}

        <SectionLabel>{text(locale, 'explorePrograms')}</SectionLabel>
        <TrainingFamilyCards value={filter} onChange={setFilter} />
        {templates.map((template) => {
          const audience = template.audience;
          return (
            <SurfaceCard key={template.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] }}>
                <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 17, flex: 1 }}>
                  {isAr ? template.name_ar : template.name_en}
                </Text>
                {template.recommended ? (
                  <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: 11 }}>
                    {text(locale, 'recommendedForYou')}
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: theme.textMuted, marginTop: 6, lineHeight: 20 }}>
                {isAr ? template.summary_ar : template.summary_en}
              </Text>
              <Text style={{ color: theme.textMuted, marginTop: 8, fontSize: 12, lineHeight: 18 }}>
                {template.daysPerWeek} {isAr ? 'أيام/أسبوع' : 'days/week'} ·{' '}
                {label(locale, 'discipline', template.discipline)} ·{' '}
                {isAr
                  ? template.environment === 'home'
                    ? 'منزل'
                    : template.environment === 'outdoor'
                      ? 'خارج'
                      : 'نادي'
                  : template.environment}
                {audience != null
                  ? ` · ${isAr ? audience.goal_ar : audience.goal_en} · ${audience.durationMin} ${isAr ? 'د' : 'min'}`
                  : ''}
              </Text>
              {audience != null ? (
                <Text style={{ color: theme.textMuted, marginTop: 4, fontSize: 12 }}>
                  {isAr ? audience.experience_ar : audience.experience_en} ·{' '}
                  {isAr ? audience.equipment_ar : audience.equipment_en}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <Button
                  label={activate.isPending ? text(locale, 'saving') : text(locale, 'startFromTemplate')}
                  disabled={activate.isPending}
                  onPress={() => activate.mutate(template.id)}
                />
                <Button
                  label={isAr ? 'اشرح هذا التقسيم' : 'Explain this split'}
                  variant="secondary"
                  onPress={() =>
                    openYazanWithPrompt(
                      isAr
                        ? `اشرح لي برنامج ${template.name_ar}: لمن يناسبه، وما فائدته، وما المعدات المطلوبة`
                        : `Explain the ${template.name_en} program: who it is for, benefits, and equipment needed`,
                    )
                  }
                />
              </View>
            </SurfaceCard>
          );
        })}
        {message.length > 0 ? (
          <Text style={{ color: theme.danger, fontFamily: fontFamily.medium, marginBottom: 12 }}>{message}</Text>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
