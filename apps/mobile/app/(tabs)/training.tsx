import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DISCIPLINES, type Discipline } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { formatCount, formatKg, formatRiyadhDate, formatRiyadhWeekday, riyadhToday } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { featuredSession, uniqueById } from '../../src/lists/unique';
import { editorialPhotos, PhotoWash } from '../../src/ui/editorial';
import { plannedExercises } from '../../src/training/plan';
import { fontFamily } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { stableRecordKey } from '../../src/lists/keys';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, BottomSheet, ErrorState, ExerciseCard, ListRow, LoadingSkeleton, MediaRow, SectionLabel, SectionTitle, SegmentedControl, SurfaceCard } from '../../src/ui/kit';
import {
  asLibraryList,
  filterExerciseLibrary,
  type EquipmentBrand,
  type EquipmentManufacturer,
  type LibraryExercise,
  type TrainingEnvironment,
} from '../../src/training/library';
import { EnvironmentCards, EquipmentBrandCards, TrainingFamilyCards, familyForDiscipline, type TrainingFamily } from '../../src/training/filterCards';

// Every discipline gets a deliberate photo instead of every history row reusing the same
// running shot regardless of what was actually trained.
const disciplinePhoto: Record<Discipline, keyof typeof editorialPhotos> = {
  bodybuilding: 'strength',
  powerlifting: 'strength',
  crossfit: 'run',
  calisthenics: 'recovery',
  functional_training: 'run',
  general_fitness: 'strength',
  hybrid: 'strength',
};

function photoFor(discipline: string): keyof typeof editorialPhotos {
  return (disciplinePhoto as Record<string, keyof typeof editorialPhotos>)[discipline] ?? 'strength';
}

function weekDays(): string[] {
  const todayIso = riyadhToday();
  const [year, month, day] = todayIso.split('-').map(Number);
  const anchor = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1, 12));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() - 3 + index);
    return date.toISOString().slice(0, 10);
  });
}

type Exercise = LibraryExercise;
type SessionRow = { id: string; name: string; status: string; discipline: string; scheduled_for: string };
type Progress = { personalRecords: { id: string; exercise_id: string; load_grams: number; reps: number }[] };

export default function TrainingScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const [filter, setFilter] = useState<TrainingFamily>('all');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState<(typeof DISCIPLINES)[number]>('general_fitness');
  const [environment, setEnvironment] = useState<TrainingEnvironment>('all');
  const [equipmentBrand, setEquipmentBrand] = useState<EquipmentBrand | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<'amrap' | 'emom' | 'for_time'>('amrap');
  const [minutes, setMinutes] = useState('12');
  const [rounds, setRounds] = useState('5');
  const [progression, setProgression] = useState('full');
  const [hold, setHold] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8');
  const [message, setMessage] = useState('');
  const exercises = useQuery({
    queryKey: ['exercises'],
    queryFn: () => apiRequest<{ exercises: Exercise[] }>('/v1/exercises'),
  });
  const manufacturers = useQuery({
    queryKey: ['equipment-manufacturers'],
    queryFn: () => apiRequest<{ manufacturers: EquipmentManufacturer[] }>('/v1/equipment/manufacturers'),
  });
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiRequest<{ sessions: SessionRow[] }>('/v1/training/sessions'),
  });
  const programs = useQuery({
    queryKey: ['training-programs'],
    queryFn: () =>
      apiRequest<{
        active: { id: string; name: string; templateId: string | null } | null;
        templates: { id: string; nameAr?: string; nameEn?: string; name?: string }[];
      }>('/v1/training/programs'),
  });
  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: () => apiRequest<Progress>('/v1/progress'),
  });

  const allRows = useMemo(() => uniqueById(sessions.data?.sessions ?? []), [sessions.data?.sessions]);
  const rows = useMemo(
    () => filter === 'all' ? allRows : allRows.filter((session) => familyForDiscipline(session.discipline) === filter),
    [allRows, filter],
  );
  const sessionFamilyCounts = useMemo(() => ({
    all: allRows.length,
    strength: allRows.filter((session) => familyForDiscipline(session.discipline) === 'strength').length,
    crossfit: allRows.filter((session) => familyForDiscipline(session.discipline) === 'crossfit').length,
    calisthenics: allRows.filter((session) => familyForDiscipline(session.discipline) === 'calisthenics').length,
  }), [allRows]);
  const featured = featuredSession(rows, riyadhToday());
  const inProgress = allRows.find((session) => session.status === 'in_progress' || session.status === 'paused') ?? null;
  const rest = rows.filter((session) => session.id !== featured?.id && session.id !== inProgress?.id);
  const today = riyadhToday();
  const todayCount = rows.filter((session) => String(session.scheduled_for).slice(0, 10) === today).length;
  const completedCount = rows.filter((session) => session.status === 'completed').length;
  const activeCount = rows.filter((session) => session.status === 'in_progress' || session.status === 'paused').length;
  const activePlan = programs.data?.active ?? null;

  async function schedule() {
    if (saving) return;
    setMessage('');
    if (selected.length === 0) {
      setMessage(text(locale, 'chooseExercise'));
      return;
    }
    if (discipline === 'calisthenics' && progression.trim().length === 0) {
      setMessage(text(locale, 'progression'));
      return;
    }
    if (![sets, reps, minutes, rounds].every((value) => Number.isFinite(Number(value)))) {
      setMessage(text(locale, 'error'));
      return;
    }
    const exercises = plannedExercises({
      discipline,
      exerciseIds: selected,
      sets: Number(sets),
      reps: Number(reps),
      format,
      minutes: Number(minutes),
      rounds: Number(rounds),
      progression: progression.trim(),
      holdSeconds: hold.trim().length === 0 ? null : Number(hold),
    });
    setSaving(true);
    try {
      const created = await apiRequest<{ session: { id: string } }>('/v1/training/sessions', {
        method: 'POST',
        body: {
          name: name.trim().length > 0 ? name.trim() : text(locale, 'workout'),
          discipline,
          scheduledFor: new Date().toISOString(),
          exercises,
        },
      });
      await client.invalidateQueries({ queryKey: ['sessions'] });
      await client.invalidateQueries({ queryKey: ['home'] });
      setOpen(false);
      setName('');
      setSelected([]);
      router.push({ pathname: '/workout/[id]', params: { id: created.session.id } });
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setSaving(false);
    }
  }

  if (sessions.isPending || exercises.isPending) {
    return (
      <Screen>
        <AppHeader title={text(locale, 'training')} subtitle={locale === 'ar' ? 'نجهّز جلستك' : 'Preparing your session'} />
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (sessions.isError || exercises.isError) {
    const offline = sessions.error instanceof ApiClientError && sessions.error.code === 'OFFLINE';
    return (
      <Screen>
        <AppHeader title={text(locale, 'training')} />
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void sessions.refetch()} />
      </Screen>
    );
  }

  const library = exercises.data?.exercises ?? [];
  const builderLibrary = filterExerciseLibrary(library, {
    query: '',
    discipline,
    environment,
    brand: equipmentBrand,
  });
  const builderFamily = familyForDiscipline(discipline);
  return (
    <Screen>
      <ScreenBody
        footer={
          <Button
            label={activePlan === null ? text(locale, 'createOrCustomizePlan') : text(locale, 'createPlan')}
            onPress={() => setOpen(true)}
          />
        }
      >
        <AppHeader
          title={text(locale, 'training')}
          subtitle={activePlan === null ? text(locale, 'noActivePlanHint') : text(locale, 'hasActivePlanHint')}
        />

        <SurfaceCard style={{ marginBottom: 12 }}>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12, marginBottom: 4 }}>
            {text(locale, 'myActivePlan')}
          </Text>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 18 }}>
            {activePlan?.name ?? (locale === 'ar' ? 'لا توجد خطة نشطة' : 'No active plan')}
          </Text>
        </SurfaceCard>

        {inProgress !== null ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: inProgress.id } })}
            style={{ marginBottom: 14 }}
          >
            <SurfaceCard tone="raised">
              <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, marginBottom: 4 }}>
                {text(locale, 'resumeWorkout')}
              </Text>
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{inProgress.name}</Text>
              <Text style={{ color: theme.textMuted, marginTop: 4 }}>
                {label(locale, 'session', inProgress.status)}
              </Text>
            </SurfaceCard>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {[
            [locale === 'ar' ? 'اليوم' : 'Today', todayCount],
            [locale === 'ar' ? 'مكتملة' : 'Completed', completedCount],
            [locale === 'ar' ? 'نشطة' : 'Active', activeCount],
          ].map(([caption, value]) => (
            <SurfaceCard key={String(caption)} padding={12} style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 28 }}>{formatCount(Number(value), locale)}</Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 11, marginTop: 3 }}>{caption}</Text>
            </SurfaceCard>
          ))}
        </View>

        <SectionLabel>{text(locale, 'todayWorkout')}</SectionLabel>
        <Pressable
          accessibilityRole="button"
          onPress={() => (featured ? router.push({ pathname: '/workout/[id]', params: { id: featured.id } }) : setOpen(true))}
        >
          <PhotoWash source={editorialPhotos[photoFor(featured?.discipline ?? 'general_fitness')]} height={204}>
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: 11, letterSpacing: 1.2, marginBottom: 6 }}>
                {locale === 'ar' ? 'تمرين اليوم' : 'TODAY'}
              </Text>
              <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 23, lineHeight: 29, marginBottom: 4 }} numberOfLines={2}>
                {featured?.name
                  ?? (activePlan !== null
                    ? (locale === 'ar' ? 'لا يوجد تمرين مجدول اليوم' : 'No workout scheduled today')
                    : (locale === 'ar' ? 'ابنِ خطتك وابدأ' : 'Build your plan'))}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
                {featured === null
                  ? (activePlan !== null
                    ? (locale === 'ar' ? 'يمكنك إنشاء جلسة سريعة من خطتك' : 'You can start a quick session from your plan')
                    : text(locale, 'noActivePlanHint'))
                  : `${label(locale, 'discipline', featured.discipline)} · ${label(locale, 'session', featured.status)}`}
              </Text>
              <View style={{ minHeight: 42, borderRadius: 16, backgroundColor: theme.heroAccent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, alignSelf: 'flex-start' }}>
                <Text style={{ color: theme.goldInk, fontFamily: fontFamily.bold, fontSize: 14 }}>
                  {featured ? text(locale, 'start') : activePlan !== null ? text(locale, 'createPlan') : text(locale, 'createOrCustomizePlan')}
                </Text>
              </View>
            </View>
          </PhotoWash>
        </Pressable>

        {/* Real schedule, not decoration — a day is filled only when a session actually exists on it. */}
        <View style={{ flexDirection: 'row', marginBottom: 18 }}>
          {weekDays().map((day) => {
            const has = rows.some((session) => String(session.scheduled_for).slice(0, 10) === day);
            const isToday = day === riyadhToday();
            return (
              <View key={day} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Text style={{ color: isToday ? theme.text : theme.textMuted, fontFamily: fontFamily.medium, fontSize: 11 }}>{formatRiyadhWeekday(day, locale).slice(0, 2)}</Text>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: has ? theme.accent : theme.border }} />
              </View>
            );
          })}
        </View>

        <TrainingFamilyCards value={filter} onChange={setFilter} counts={sessionFamilyCounts} />
        {rest.length > 0 ? <SectionLabel>{text(locale, 'workoutHistory')}</SectionLabel> : null}
        {rest.map((session) => (
          <SurfaceCard key={session.id} padding={8} style={{ marginBottom: 10 }}>
            <MediaRow
              title={session.name}
              meta={`${label(locale, 'discipline', session.discipline)} · ${formatRiyadhDate(String(session.scheduled_for), locale)}`}
              leading={<Image source={editorialPhotos[photoFor(session.discipline)]} style={{ width: 56, height: 56, borderRadius: 16 }} contentFit="cover" cachePolicy="memory-disk" />}
              trailing={<Text style={{ color: theme.accent, fontFamily: fontFamily.bold }}>{text(locale, 'start')}</Text>}
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: session.id } })}
            />
          </SurfaceCard>
        ))}
        <SectionTitle title={text(locale, 'workoutLibrary')} action={locale === 'ar' ? 'عرض الكل' : 'See all'} onAction={() => router.push('/exercises')} />
        {library.slice(0, 5).map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            index={index}
            title={locale === 'ar' ? exercise.name_ar : exercise.name_en}
            meta={[
              label(locale, 'equipment', Array.isArray(exercise.equipment) ? exercise.equipment[0] ?? '' : exercise.equipment),
              exercise.difficulty === undefined ? '' : label(locale, 'experience', exercise.difficulty),
              asLibraryList(exercise.primary_muscles).slice(0, 2).join(' · '),
            ].filter((part) => part.length > 0).join(' · ')}
            onPress={() => {
              setSelected((current) => (current.includes(exercise.id) ? current : [...current, exercise.id].slice(0, 8)));
              setOpen(true);
            }}
          />
        ))}
        {(progress.data?.personalRecords.length ?? 0) === 0 ? null : <SectionLabel>{text(locale, 'records')}</SectionLabel>}
        {progress.data?.personalRecords.map((record) => {
          const exercise = library.find((item) => item.id === record.exercise_id);
          const exerciseName = exercise === undefined ? (locale === 'ar' ? 'تمرين' : 'Exercise') : locale === 'ar' ? exercise.name_ar : exercise.name_en;
          return (
            <ListRow
              key={stableRecordKey(record.id)}
              title={exerciseName}
              meta={`${formatKg(Number(record.load_grams), locale)} × ${formatCount(Number(record.reps), locale)}`}
            />
          );
        })}
      </ScreenBody>
      {open ? <BottomSheet visible onClose={() => setOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <Field label={text(locale, 'workout')} value={name} onChangeText={setName} />
          <TrainingFamilyCards
            value={builderFamily}
            onChange={(family) => {
              setDiscipline(family === 'strength' ? 'bodybuilding' : family === 'crossfit' ? 'crossfit' : family === 'calisthenics' ? 'calisthenics' : 'general_fitness');
              setSelected([]);
            }}
          />
          {builderFamily === 'strength' ? (
            <SegmentedControl
              value={discipline}
              onChange={(id) => {
                setDiscipline(id as 'bodybuilding' | 'powerlifting');
                setSelected([]);
              }}
              options={[
                { id: 'bodybuilding', label: label(locale, 'discipline', 'bodybuilding') },
                { id: 'powerlifting', label: label(locale, 'discipline', 'powerlifting') },
              ]}
            />
          ) : null}
          <SectionLabel>{locale === 'ar' ? 'مكان التدريب' : 'Training place'}</SectionLabel>
          <EnvironmentCards
            value={environment}
            onChange={(next) => {
              setEnvironment(next);
              setSelected([]);
              if (next !== 'gym') setEquipmentBrand('all');
            }}
          />
          {environment === 'gym' ? (
            <>
              <SectionLabel>{locale === 'ar' ? 'شركة الأجهزة' : 'Equipment brand'}</SectionLabel>
              <EquipmentBrandCards
                value={equipmentBrand}
                manufacturers={manufacturers.data?.manufacturers ?? []}
                onChange={(next) => {
                  setEquipmentBrand(next);
                  setSelected([]);
                }}
              />
            </>
          ) : null}
          <View style={{ backgroundColor: theme.surfaceMuted, borderRadius: 18, padding: 14, marginBottom: 12 }}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 16, textAlign: locale === 'ar' ? 'right' : 'left' }}>
              {locale === 'ar' ? 'اختيار ذكي للبداية' : 'Smart starting selection'}
            </Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 20, marginTop: 3, textAlign: locale === 'ar' ? 'right' : 'left' }}>
              {locale === 'ar' ? 'نختار تمارين متوافقة مع رياضتك ومكانك، ويمكنك تعديلها قبل الحفظ.' : 'Pick exercises that match your sport and place, then edit before saving.'}
            </Text>
            <Button
              label={locale === 'ar' ? 'اقترح لي تمارين' : 'Suggest exercises'}
              variant="secondary"
              disabled={builderLibrary.length === 0}
              onPress={() => setSelected(builderLibrary.slice(0, discipline === 'crossfit' || discipline === 'calisthenics' ? 4 : 6).map((exercise) => exercise.id))}
            />
          </View>
          <Body>{`${text(locale, 'chooseExercise')} · ${formatCount(selected.length, locale)}`}</Body>
          {builderLibrary.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              index={index}
              title={locale === 'ar' ? exercise.name_ar : exercise.name_en}
              meta={label(locale, 'equipment', Array.isArray(exercise.equipment) ? exercise.equipment[0] ?? '' : exercise.equipment)}
              selected={selected.includes(exercise.id)}
              onPress={() => setSelected((current) => (current.includes(exercise.id) ? current.filter((id) => id !== exercise.id) : [...current, exercise.id].slice(0, 8)))}
            />
          ))}
          {builderLibrary.length === 0 ? (
            <Body>{locale === 'ar' ? 'لا توجد تمارين مطابقة لهذه التصفية.' : 'No exercises match these filters.'}</Body>
          ) : null}
          {discipline === 'crossfit' ? (
            <>
              <SegmentedControl
                value={format}
                onChange={(id) => setFormat(id as 'amrap' | 'emom' | 'for_time')}
                options={[
                  { id: 'amrap', label: 'AMRAP' },
                  { id: 'emom', label: 'EMOM' },
                  { id: 'for_time', label: 'For time' },
                ]}
              />
              <Field label={text(locale, 'minutes')} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
              <Field label={text(locale, 'rounds')} value={rounds} onChangeText={setRounds} keyboardType="number-pad" />
            </>
          ) : discipline === 'calisthenics' ? (
            <>
              <Field label={text(locale, 'progression')} value={progression} onChangeText={setProgression} />
              <Field label={text(locale, 'reps')} value={reps} onChangeText={setReps} keyboardType="number-pad" />
              <Field label={text(locale, 'hold')} value={hold} onChangeText={setHold} keyboardType="number-pad" />
            </>
          ) : (
            <>
              <Field label={text(locale, 'sets')} value={sets} onChangeText={setSets} keyboardType="number-pad" />
              <Field label={text(locale, 'reps')} value={reps} onChangeText={setReps} keyboardType="number-pad" />
            </>
          )}
          {message.length > 0 ? <Body>{message}</Body> : null}
          <Button label={saving ? text(locale, 'saving') : text(locale, 'save')} disabled={saving} onPress={() => void schedule()} />
          <View />
        </ScrollView>
      </BottomSheet> : null}
    </Screen>
  );
}
