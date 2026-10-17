import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DISCIPLINES, nextProgramDayIndex } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { formatCount, formatDuration, formatRiyadhDate, riyadhToday } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { uniqueById } from '../../src/lists/unique';
import { plannedExercises } from '../../src/training/plan';
import { fontFamily } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, BottomSheet, ErrorState, ExerciseCard, LoadingSkeleton, SectionLabel, SegmentedControl } from '../../src/ui/kit';
import {
  filterExerciseLibrary,
  type DifficultyFilter,
  type EquipmentBrand,
  type EquipmentKind,
  type EquipmentManufacturer,
  type LibraryExercise,
  type MuscleGroup,
  type TrainingEnvironment,
} from '../../src/training/library';
import { DifficultyChips, EnvironmentCards, EquipmentBrandCards, EquipmentKindChips, MuscleGroupChips, TrainingFamilyCards, familyForDiscipline } from '../../src/training/filterCards';

function lastSevenDays(): string[] {
  const todayIso = riyadhToday();
  const [year, month, day] = todayIso.split('-').map(Number);
  const anchor = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1, 12));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
}

type Exercise = LibraryExercise;
type SessionRow = {
  id: string;
  name: string;
  status: string;
  discipline: string;
  scheduled_for: string;
  duration_seconds?: number;
  completed_at?: string | null;
};
type ProgramDay = { name_ar: string; name_en: string; exerciseCount: number };
type ProgramTemplate = {
  id: string;
  discipline: string;
  name_ar: string;
  name_en: string;
  summary_ar: string;
  summary_en: string;
  daysPerWeek?: number;
  recommended?: boolean;
  days: ProgramDay[];
};
type ProgramRecommendation = { id: string; score: number; reason_ar: string; reason_en: string };
type ProgramsPayload = {
  templates: ProgramTemplate[];
  recommended?: ProgramRecommendation[];
  active: { id: string; templateId: string | null; name: string; discipline: string; days: ProgramDay[] } | null;
};

export default function TrainingScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const isAr = locale === 'ar';
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState<(typeof DISCIPLINES)[number]>('general_fitness');
  const [environment, setEnvironment] = useState<TrainingEnvironment>('all');
  const [equipmentBrand, setEquipmentBrand] = useState<EquipmentBrand | 'all'>('all');
  const [muscle, setMuscle] = useState<MuscleGroup>('all');
  const [equipmentKind, setEquipmentKind] = useState<EquipmentKind>('all');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [builderQuery, setBuilderQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<'amrap' | 'emom' | 'for_time'>('amrap');
  const [minutes, setMinutes] = useState('12');
  const [rounds, setRounds] = useState('5');
  const [progression, setProgression] = useState('full');
  const [hold, setHold] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8');
  const [message, setMessage] = useState('');
  const [programOpen, setProgramOpen] = useState(false);
  const [programBusy, setProgramBusy] = useState(false);
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
    queryKey: ['programs'],
    queryFn: () => apiRequest<ProgramsPayload>('/v1/training/programs'),
  });

  const allRows = useMemo(() => uniqueById(sessions.data?.sessions ?? []), [sessions.data?.sessions]);
  const liveSession = allRows.find((session) => session.status === 'in_progress') ?? allRows.find((session) => session.status === 'paused');
  const history = allRows.filter((session) => session.id !== liveSession?.id).slice(0, 5);
  const recentSet = new Set(lastSevenDays());
  const completedThisWeek = allRows.filter((session) => session.status === 'completed' && recentSet.has(String(session.scheduled_for).slice(0, 10))).length;
  const nextDay = nextProgramDayIndex(completedThisWeek, programs.data?.active?.days.length ?? 0);
  const active = programs.data?.active ?? null;
  const templates = programs.data?.templates ?? [];
  const recommended = (programs.data?.recommended ?? [])
    .map((item) => templates.find((template) => template.id === item.id))
    .filter((template): template is ProgramTemplate => template !== undefined);
  const picks = recommended.length > 0 ? recommended.slice(0, 4) : templates.slice(0, 4);
  const todayDay = active?.days[nextDay];

  async function openSession(sessionId: string) {
    await client.invalidateQueries({ queryKey: ['sessions'] });
    await client.invalidateQueries({ queryKey: ['session'] });
    await client.invalidateQueries({ queryKey: ['home'] });
    router.push({ pathname: '/workout/[id]', params: { id: sessionId } });
  }

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
    const planned = plannedExercises({
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
          exercises: planned,
          startNow: true,
        },
      });
      setOpen(false);
      setName('');
      setSelected([]);
      await openSession(created.session.id);
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setSaving(false);
    }
  }

  async function startProgramDay(dayIndex: number) {
    if (programBusy || active === null) return;
    setProgramBusy(true);
    setMessage('');
    try {
      const created = await apiRequest<{ session: { id: string } }>(`/v1/training/programs/${active.id}/start-day`, {
        method: 'POST',
        body: { dayIndex, startNow: true },
      });
      if (created.session?.id === undefined) {
        setMessage(text(locale, 'error'));
        return;
      }
      setProgramOpen(false);
      await openSession(created.session.id);
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setProgramBusy(false);
    }
  }

  async function startTemplate(templateId: string) {
    if (programBusy) return;
    setProgramBusy(true);
    setMessage('');
    try {
      const activated = await apiRequest<{ program: { id: string } }>('/v1/training/programs', {
        method: 'POST',
        body: { templateId },
      });
      await client.invalidateQueries({ queryKey: ['programs'] });
      const created = await apiRequest<{ session: { id: string } }>(`/v1/training/programs/${activated.program.id}/start-day`, {
        method: 'POST',
        body: { dayIndex: 0, startNow: true },
      });
      if (created.session?.id === undefined) {
        setMessage(text(locale, 'error'));
        return;
      }
      setProgramOpen(false);
      await openSession(created.session.id);
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setProgramBusy(false);
    }
  }

  async function finishLive() {
    if (programBusy || liveSession === undefined) return;
    setProgramBusy(true);
    setMessage('');
    const at = new Date().toISOString();
    try {
      if (liveSession.status !== 'in_progress') {
        await apiRequest(`/v1/training/sessions/${liveSession.id}/start`, { method: 'POST', body: { at } });
      }
      await apiRequest(`/v1/training/sessions/${liveSession.id}/complete`, { method: 'POST', body: { at: new Date().toISOString() } });
      await client.invalidateQueries({ queryKey: ['sessions'] });
      await client.invalidateQueries({ queryKey: ['session'] });
      await client.invalidateQueries({ queryKey: ['home'] });
      await client.invalidateQueries({ queryKey: ['progress'] });
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setProgramBusy(false);
    }
  }

  function startToday() {
    if (active !== null) {
      void startProgramDay(nextDay);
      return;
    }
    const first = picks[0];
    if (first !== undefined) void startTemplate(first.id);
    else setProgramOpen(true);
  }

  if (sessions.isPending) {
    return (
      <Screen>
        <AppHeader title={text(locale, 'training')} subtitle={text(locale, 'timeOnlyHint')} />
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (sessions.isError) {
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
    query: builderQuery,
    discipline,
    environment,
    brand: equipmentBrand,
    muscle,
    equipmentKind,
    difficulty,
  });
  const builderFamily = familyForDiscipline(discipline);
  const card = { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 10 } as const;
  const primaryLabel = liveSession !== undefined
    ? text(locale, 'continueWorkout')
    : programBusy
      ? text(locale, 'saving')
      : text(locale, 'start');

  return (
    <Screen>
      <ScreenBody footer={(
        <View style={{ gap: 8 }}>
          {message.length > 0 ? <Text style={{ color: theme.warning, fontFamily: fontFamily.medium, textAlign: isAr ? 'right' : 'left' }}>{message}</Text> : null}
          {liveSession !== undefined ? (
            <>
              <Button
                label={text(locale, 'continueWorkout')}
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: liveSession.id } })}
              />
              <Button
                label={programBusy ? text(locale, 'saving') : text(locale, 'finish')}
                disabled={programBusy}
                onPress={() => void finishLive()}
              />
            </>
          ) : (
            <Button label={primaryLabel} disabled={programBusy || programs.isPending} onPress={startToday} />
          )}
        </View>
      )}>
        <AppHeader title={text(locale, 'training')} subtitle={text(locale, 'timeOnlyHint')} />

        {liveSession !== undefined ? (
          <View style={{ backgroundColor: theme.hero, borderRadius: 26, padding: 22, marginBottom: 16 }}>
            <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: 12 }}>{text(locale, 'liveNow')}</Text>
            <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, marginTop: 6 }}>{liveSession.name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.regular, fontSize: 13, marginTop: 8 }}>{text(locale, 'exerciseGuide')}</Text>
          </View>
        ) : active !== null ? (
          <View style={{ backgroundColor: theme.hero, borderRadius: 26, padding: 22, marginBottom: 16 }}>
            <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: 12 }}>{text(locale, 'recommendedForYou')}</Text>
            <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, marginTop: 6 }}>
              {isAr ? (todayDay?.name_ar ?? active.name) : (todayDay?.name_en ?? active.name)}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.regular, fontSize: 13, marginTop: 8 }}>
              {todayDay === undefined
                ? text(locale, 'timeOnlyHint')
                : isAr
                  ? `${formatCount(todayDay.exerciseCount, locale)} تمارين · اضغط ابدأ`
                  : `${formatCount(todayDay.exerciseCount, locale)} exercises · tap Start`}
            </Text>
          </View>
        ) : (
          <View style={{ backgroundColor: theme.hero, borderRadius: 26, padding: 22, marginBottom: 16 }}>
            <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: 12 }}>{text(locale, 'pickSplit')}</Text>
            <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, marginTop: 6 }}>
              {isAr ? 'ابدأ جدول جاهز' : 'Start a ready split'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.regular, fontSize: 13, marginTop: 8 }}>{text(locale, 'timeOnlyHint')}</Text>
          </View>
        )}

        {liveSession === undefined && active !== null ? (
          <View style={{ marginBottom: 8 }}>
            {active.days.map((day, index) => (
              <Pressable
                key={`${day.name_en}-${index}`}
                accessibilityRole="button"
                onPress={() => void startProgramDay(index)}
                style={{ ...card, borderColor: index === nextDay ? theme.accent : theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{isAr ? day.name_ar : day.name_en}</Text>
                  <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12 }}>
                    {isAr ? `${formatCount(day.exerciseCount, locale)} تمارين` : `${formatCount(day.exerciseCount, locale)} exercises`}
                  </Text>
                </View>
                <Text style={{ color: theme.accent, fontFamily: fontFamily.bold }}>
                  {programBusy ? text(locale, 'saving') : index === nextDay ? text(locale, 'start') : text(locale, 'startDay')}
                </Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setProgramOpen(true)} style={{ marginBottom: 16 }}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, textAlign: isAr ? 'right' : 'left' }}>{text(locale, 'switchProgram')}</Text>
            </Pressable>
          </View>
        ) : null}

        {liveSession === undefined && active === null ? (
          <View style={{ marginBottom: 8 }}>
            {picks.map((template) => (
              <Pressable
                key={template.id}
                accessibilityRole="button"
                onPress={() => void startTemplate(template.id)}
                style={card}
              >
                <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: 11 }}>{text(locale, 'suggestedForYou')}</Text>
                <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 18, marginTop: 4 }}>{isAr ? template.name_ar : template.name_en}</Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 4, lineHeight: 20 }}>
                  {isAr ? template.summary_ar : template.summary_en}
                </Text>
                <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, marginTop: 10 }}>
                  {programBusy ? text(locale, 'saving') : text(locale, 'start')}
                </Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setProgramOpen(true)} style={{ marginBottom: 16 }}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, textAlign: isAr ? 'right' : 'left' }}>{text(locale, 'chooseProgram')}</Text>
            </Pressable>
          </View>
        ) : null}

        {history.length > 0 ? <SectionLabel>{text(locale, 'history')}</SectionLabel> : null}
        {history.map((row) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            onPress={() => {
              if (row.status === 'completed') return;
              if (row.status === 'abandoned') {
                startToday();
                return;
              }
              router.push({ pathname: '/workout/[id]', params: { id: row.id } });
            }}
            style={{ ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{row.name}</Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12 }}>
                {`${label(locale, 'discipline', row.discipline)} · ${formatRiyadhDate(String(row.scheduled_for), locale)}`}
              </Text>
            </View>
            <Text style={{ color: theme.accent, fontFamily: fontFamily.bold }}>
              {row.status === 'completed'
                ? formatDuration(Number(row.duration_seconds ?? 0))
                : row.status === 'in_progress' || row.status === 'paused'
                  ? text(locale, 'continueWorkout')
                  : row.status === 'abandoned'
                    ? text(locale, 'startFresh')
                    : text(locale, 'start')}
            </Text>
          </Pressable>
        ))}

        <Pressable accessibilityRole="button" onPress={() => router.push('/exercises')} style={{ marginTop: 8 }}>
          <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, textAlign: isAr ? 'right' : 'left' }}>{text(locale, 'exercises')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ marginTop: 8, marginBottom: 20 }}>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.semibold, textAlign: isAr ? 'right' : 'left' }}>{text(locale, 'customSession')}</Text>
        </Pressable>
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
          <SectionLabel>{locale === 'ar' ? 'العضلة' : 'Muscle'}</SectionLabel>
          <MuscleGroupChips value={muscle} onChange={(next) => { setMuscle(next); setSelected([]); }} />
          <SectionLabel>{locale === 'ar' ? 'الأداة' : 'Equipment'}</SectionLabel>
          <EquipmentKindChips value={equipmentKind} onChange={(next) => { setEquipmentKind(next); setSelected([]); }} />
          <SectionLabel>{locale === 'ar' ? 'المستوى' : 'Level'}</SectionLabel>
          <DifficultyChips value={difficulty} onChange={(next) => { setDifficulty(next); setSelected([]); }} />
          <SectionLabel>{locale === 'ar' ? 'مكان التدريب' : 'Training place'}</SectionLabel>
          <EnvironmentCards
            value={environment}
            onChange={(next) => {
              setEnvironment(next);
              setSelected([]);
              if (next !== 'gym') setEquipmentBrand('all');
            }}
          />
          <Field label={locale === 'ar' ? 'بحث في التمارين' : 'Search exercises'} value={builderQuery} onChangeText={setBuilderQuery} />
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
          <Button
            label={text(locale, 'scanGym')}
            variant="secondary"
            onPress={() => {
              setOpen(false);
              router.push({ pathname: '/scanner', params: { intent: 'exercise' } });
            }}
          />
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
          <Button label={saving ? text(locale, 'saving') : text(locale, 'startNow')} disabled={saving} onPress={() => void schedule()} />
        </ScrollView>
      </BottomSheet> : null}
      {programOpen ? <BottomSheet visible onClose={() => setProgramOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          <AppHeader title={text(locale, 'programs')} subtitle={text(locale, 'programHint')} />
          {[...templates].sort((left, right) => Number(right.recommended) - Number(left.recommended)).map((template) => (
            <Pressable
              key={template.id}
              accessibilityRole="button"
              onPress={() => void startTemplate(template.id)}
              style={{ borderWidth: 1, borderColor: active?.templateId === template.id ? theme.accent : theme.border, backgroundColor: theme.surface, borderRadius: 18, padding: 16, marginBottom: 10 }}
            >
              {template.recommended ? (
                <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: 11, marginBottom: 4 }}>{text(locale, 'suggestedForYou')}</Text>
              ) : null}
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 16, textAlign: isAr ? 'right' : 'left' }}>
                {isAr ? template.name_ar : template.name_en}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 20, marginTop: 4, textAlign: isAr ? 'right' : 'left' }}>
                {isAr ? template.summary_ar : template.summary_en}
              </Text>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, marginTop: 8 }}>
                {programBusy ? text(locale, 'saving') : text(locale, 'start')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet> : null}
    </Screen>
  );
}
