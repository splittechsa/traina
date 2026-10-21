import { Text } from '../src/ui/Text';
import { useFormRecovery } from '../src/storage/useFormRecovery';
import type { ProgramDayDocument } from '@sahhti/domain';
import { editedProgramDays, strengthDraftValues, strengthInputKey, type StrengthInputs } from '../src/training/programDraft';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { fontFamily, radius, spacing } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Body, Button, Field, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, BottomSheet, ErrorState, LoadingSkeleton, SectionLabel, SurfaceCard } from '../src/ui/kit';
import { YazanCard, openYazanWithPrompt } from '../src/ui/YazanCard';
import { asLibraryList, type LibraryExercise } from '../src/training/library';

type DayDraft = ProgramDayDocument;

type ProgramsResponse = {
  active: {
    id: string;
    name: string;
    version: number;
    discipline: string;
    days: DayDraft[];
  } | null;
};

export default function ProgramEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const isAr = locale === 'ar';
  const [name, setName] = useState('');
  const [initialDraft, setInitialDraft] = useState('');
  const [strengthInputs, setStrengthInputs] = useState<StrengthInputs>({});
  const [draftVersion, setDraftVersion] = useState<number | undefined>(undefined);
  const [days, setDays] = useState<DayDraft[]>([]);
  const [message, setMessage] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [replaceAt, setReplaceAt] = useState<{ day: number; exercise: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const programs = useQuery({
    queryKey: ['program-detail', id],
    queryFn: async () => {
      if (typeof id === 'string') { const response = await apiRequest<{ program: NonNullable<ProgramsResponse['active']> }>(`/v1/training/programs/${id}`); return { active: response.program }; }
      return apiRequest<ProgramsResponse>('/v1/training/programs');
    },
  });
  const exercises = useQuery({
    queryKey: ['exercises'],
    queryFn: () => apiRequest<{ exercises: LibraryExercise[] }>('/v1/exercises'),
  });

  const active = programs.data?.active ?? null;
  const library = useMemo(() => exercises.data?.exercises ?? [], [exercises.data]);
  const byId = useMemo(() => new Map(library.map((row) => [row.id, row])), [library]);

  const [initializedProgramId, setInitializedProgramId] = useState<string | null>(null);
  if (active !== null && active.id !== initializedProgramId && (typeof id !== 'string' || active.id === id)) {
    setInitializedProgramId(active.id);
    setDraftVersion(active.version);
    setName(active.name);
    const initialDays = active.days.map((day) => ({
        name_ar: day.name_ar,
        name_en: day.name_en,
        exerciseIds: [...day.exerciseIds],
        strengthOverrides: day.strengthOverrides,
      }));
    setDays(initialDays);
    setInitialDraft(JSON.stringify({ name: active.name, days: initialDays }));
  }

  const recovery = useFormRecovery('program:' + id, { name, days, strengthInputs, draftVersion }, draft => { setName(draft.name); setDays(draft.days); setStrengthInputs(draft.strengthInputs); setDraftVersion(draft.draftVersion); }, initialDraft !== '' && (JSON.stringify({ name, days }) !== initialDraft || Object.keys(strengthInputs).length > 0), initializedProgramId !== null);

  const currentExerciseId =
    replaceAt === null ? null : days[replaceAt.day]?.exerciseIds[replaceAt.exercise] ?? null;

  const substitutions = useQuery({
    queryKey: ['exercise-substitutions', currentExerciseId],
    enabled: currentExerciseId !== null && pickerOpen,
    queryFn: () =>
      apiRequest<{ alternatives: (LibraryExercise & { score: number })[] }>(
        `/v1/exercises/${currentExerciseId}/substitutions`,
      ),
  });

  const save = useMutation({
    mutationFn: () => {
      if (active === null) throw new Error('no program');
      return apiRequest(`/v1/training/programs/${active.id}`, {
        method: 'PUT',
        body: { expectedVersion: draftVersion, name: name.trim().length > 0 ? name.trim() : undefined, days: editedProgramDays(days, strengthInputs) },
      });
    },
    onSuccess: async () => {
      await recovery.clear();
      setMessage('');
      await client.invalidateQueries({ queryKey: ['training-programs'] });
      await client.invalidateQueries({ queryKey: ['program-detail'] });
      await client.invalidateQueries({ queryKey: ['program-history'] });
      router.back();
    },
    onError: (caught) => {
      setMessage(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : caught instanceof Error && caught.message === 'INVALID_STRENGTH_OVERRIDE' ? (isAr ? 'راجع أرقام المجموعات والتكرارات والراحة في جميع الأيام.' : 'Review sets, reps, and rest values on every day.') : text(locale, 'error'));
    },
  });

  if (programs.isPending || exercises.isPending) {
    return (
      <Screen>
        <AppHeader title={text(locale, 'customizePlan')} />
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (programs.isError || active === null || (typeof id === 'string' && active.id !== id)) {
    return (
      <Screen>
        <AppHeader title={text(locale, 'customizePlan')} />
        <ErrorState body={text(locale, 'error')} onRetry={() => void programs.refetch()} />
      </Screen>
    );
  }

  let settingsInvalid = false;
  try { editedProgramDays(days, strengthInputs); } catch { settingsInvalid = true; }
  const strengthProgram = active.discipline !== 'crossfit' && active.discipline !== 'calisthenics';
  const day = days[dayIndex];
  const altRows = substitutions.data?.alternatives ?? [];

  function exerciseLabel(exerciseId: string): string {
    const row = byId.get(exerciseId);
    if (row === undefined) return exerciseId.slice(0, 8);
    return isAr ? row.name_ar : row.name_en;
  }

  function moveExercise(from: number, direction: -1 | 1) {
    if (day === undefined) return;
    const to = from + direction;
    if (to < 0 || to >= day.exerciseIds.length) return;
    setDays((current) =>
      current.map((item, index) => {
        if (index !== dayIndex) return item;
        const next = [...item.exerciseIds];
        const tmp = next[from]!;
        next[from] = next[to]!;
        next[to] = tmp;
        return { ...item, exerciseIds: next };
      }),
    );
  }

  function removeExercise(exerciseIndex: number) {
    if (day === undefined || day.exerciseIds.length <= 1) {
      setMessage(isAr ? 'كل يوم يحتاج تمرين واحد على الأقل' : 'Each day needs at least one exercise');
      return;
    }
    setDays((current) =>
      current.map((item, index) =>
        index === dayIndex
          ? { ...item, exerciseIds: item.exerciseIds.filter((_, i) => i !== exerciseIndex) }
          : item,
      ),
    );
  }

  function applyReplacement(nextId: string) {
    if (replaceAt === null) return;
    setDays((current) =>
      current.map((item, index) => {
        if (index !== replaceAt.day) return item;
        const next = [...item.exerciseIds];
        next[replaceAt.exercise] = nextId;
        return { ...item, exerciseIds: next };
      }),
    );
    setPickerOpen(false);
    setReplaceAt(null);
  }

  function addExercise(nextId: string) {
    setDays((current) =>
      current.map((item, index) => {
        if (index !== dayIndex) return item;
        if (item.exerciseIds.includes(nextId) || item.exerciseIds.length >= 20) return item;
        return { ...item, exerciseIds: [...item.exerciseIds, nextId] };
      }),
    );
    setPickerOpen(false);
    setReplaceAt(null);
  }

  return (
    <Screen>
      <ScreenBody
        footer={
          <Button
            label={save.isPending ? text(locale, 'saving') : text(locale, 'saveCustomPlan')}
            disabled={save.isPending || days.length === 0 || settingsInvalid}
            onPress={() => save.mutate()}
          />
        }
      >
        <AppHeader
          title={text(locale, 'customizePlan')}
          subtitle={isAr ? 'استبدل · رتّب · احفظ نسختك' : 'Swap · reorder · save your version'}
          showBack
        />

        <YazanCard
          body={
            isAr
              ? 'استبدل التمرين ببديل لنفس المجموعة العضلية. أقدر أساعدك تختار البديل الأنسب لمعداتك.'
              : 'Swap an exercise for an alternative that hits the same muscle. I can help pick the best fit for your equipment.'
          }
          actions={[
            {
              label: text(locale, 'replaceExercise'),
              onPress: () =>
                openYazanWithPrompt(
                  isAr
                    ? 'ساعدني أستبدل تمرين في خطتي ببديل مناسب لنفس العضلة والمعدات'
                    : 'Help me replace an exercise in my plan with a suitable alternative for the same muscle and equipment',
                ),
            },
          ]}
        />

        <Field label={isAr ? 'اسم النسخة' : 'Custom name'} value={name} onChangeText={setName} />

        <SectionLabel>{text(locale, 'programDays')}</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {days.map((item, index) => (
            <Pressable
              key={`${item.name_en}-${index}`}
              accessibilityRole="button"
              onPress={() => setDayIndex(index)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: radius.md,
                backgroundColor: dayIndex === index ? theme.text : theme.surfaceMuted,
              }}
            >
              <Text
                style={{
                  color: dayIndex === index ? theme.background : theme.text,
                  fontFamily: fontFamily.semibold,
                  fontSize: 12,
                }}
              >
                {isAr ? item.name_ar : item.name_en}
              </Text>
            </Pressable>
          ))}
        </View>

        {settingsInvalid ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{isAr ? 'راجع الأرقام: المجموعات 1–20، التكرارات 1–100، الراحة 0–1800 ثانية.' : 'Use whole numbers: sets 1–20, reps 1–100, rest 0–1800 seconds.'}</Text> : null}
        {day === undefined ? null : (
          <SurfaceCard>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 16, marginBottom: 8 }}>
              {isAr ? day.name_ar : day.name_en}
            </Text>
            {day.exerciseIds.map((exerciseId, exerciseIndex) => {
              const row = byId.get(exerciseId);
              const muscles = row === undefined ? [] : asLibraryList(row.primary_muscles).slice(0, 2);
              return (
                <View
                  key={`${exerciseId}-${exerciseIndex}`}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: exerciseIndex === day.exerciseIds.length - 1 ? 0 : 1,
                    borderBottomColor: theme.border,
                    gap: 8,
                  }}
                >
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
                    {exerciseLabel(exerciseId)}
                  </Text>
                  {muscles.length > 0 ? (
                    <Text style={{ color: theme.textMuted, fontSize: 12 }}>{muscles.join(' · ')}</Text>
                  ) : null}
                  {strengthProgram ? (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                        {isAr ? 'القيم الأساسية. تبقى تعديلات الاستشفاء المعتمدة سارية.' : 'Base values. Approved recovery adjustments still apply.'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(['sets', 'reps', 'restSeconds'] as const).map(field => {
                          const key = strengthInputKey(dayIndex, exerciseId);
                          const values = strengthInputs[key] ?? strengthDraftValues(day, exerciseId);
                          const label = field === 'sets' ? (isAr ? 'المجموعات' : 'Sets') : field === 'reps' ? (isAr ? 'التكرارات' : 'Reps') : (isAr ? 'الراحة بالثواني' : 'Rest seconds');
                          return <View key={field} style={{ flex: 1 }}><Field label={label} value={values[field]} keyboardType="number-pad"
                            onChangeText={value => setStrengthInputs(current => ({ ...current, [key]: { ...values, [field]: value } }))} /></View>;
                        })}
                      </View>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setReplaceAt({ day: dayIndex, exercise: exerciseIndex });
                        setPickerOpen(true);
                      }}
                      style={chipStyle(theme)}
                    >
                      <Text style={chipText(theme)}>{text(locale, 'replaceExercise')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => moveExercise(exerciseIndex, -1)}
                      style={chipStyle(theme)}
                    >
                      <Text style={chipText(theme)}>{isAr ? 'أعلى' : 'Up'}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => moveExercise(exerciseIndex, 1)}
                      style={chipStyle(theme)}
                    >
                      <Text style={chipText(theme)}>{isAr ? 'أسفل' : 'Down'}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => removeExercise(exerciseIndex)}
                      style={chipStyle(theme)}
                    >
                      <Text style={chipText(theme)}>{isAr ? 'احذف' : 'Remove'}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        openYazanWithPrompt(
                          isAr
                            ? `لماذا تمرين ${exerciseLabel(exerciseId)} في هذا اليوم؟ وما الذي يستهدفه؟`
                            : `Why is ${exerciseLabel(exerciseId)} in this day, and what does it target?`,
                        )
                      }
                      style={chipStyle(theme)}
                    >
                      <Text style={chipText(theme)}>{text(locale, 'whyThisExercise')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <View style={{ marginTop: 12 }}>
              <Button
                label={isAr ? 'أضف تمرين' : 'Add exercise'}
                variant="secondary"
                onPress={() => {
                  setReplaceAt(null);
                  setPickerOpen(true);
                }}
              />
            </View>
          </SurfaceCard>
        )}

        {message.length > 0 ? <Body>{message}</Body> : null}
      </ScreenBody>

      {pickerOpen ? (
        <BottomSheet visible onClose={() => { setPickerOpen(false); setReplaceAt(null); }}>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 18, marginBottom: 8 }}>
            {replaceAt !== null ? text(locale, 'replaceExercise') : isAr ? 'أضف تمرين' : 'Add exercise'}
          </Text>
          {replaceAt !== null ? (
            <>
              <SectionLabel>{isAr ? 'بدائل ذكية' : 'Smart alternatives'}</SectionLabel>
              {substitutions.isPending ? <LoadingSkeleton /> : null}
              {altRows.length === 0 && !substitutions.isPending ? (
                <Body>{isAr ? 'لا توجد بدائل قوية — اختر من المكتبة.' : 'No strong alternatives — pick from the library.'}</Body>
              ) : null}
              {altRows.map((row) => (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  onPress={() => applyReplacement(row.id)}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}
                >
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
                    {isAr ? row.name_ar : row.name_en}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                    {asLibraryList(row.primary_muscles).slice(0, 2).join(' · ')} · score {row.score}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}
          <SectionLabel>{text(locale, 'workoutLibrary')}</SectionLabel>
          {library.slice(0, 40).map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => (replaceAt !== null ? applyReplacement(row.id) : addExercise(row.id))}
              style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}
            >
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
                {isAr ? row.name_ar : row.name_en}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                {asLibraryList(row.primary_muscles).slice(0, 2).join(' · ')}
              </Text>
            </Pressable>
          ))}
          <View style={{ height: spacing[6] }} />
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

function chipStyle(theme: { surfaceMuted: string; border: string }) {
  return {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  } as const;
}

function chipText(theme: { text: string }) {
  return { color: theme.text, fontFamily: fontFamily.semibold, fontSize: 11 } as const;
}
