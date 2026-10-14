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
import { AppHeader, BottomSheet, ErrorState, ExerciseCard, ListRow, LoadingSkeleton, SectionLabel, SegmentedControl } from '../../src/ui/kit';

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

type Exercise = {
  id: string;
  name_ar: string;
  name_en: string;
  primary_muscles?: string[];
  equipment: string[] | string;
  difficulty?: string;
  instructions_ar?: string[];
  instructions_en?: string[];
  demonstrationMedia?: null;
};
type SessionRow = { id: string; name: string; status: string; discipline: string; scheduled_for: string };
type Progress = { personalRecords: { id: string; exercise_id: string; load_grams: number; reps: number }[] };

const filters = ['all', ...DISCIPLINES] as const;

export default function TrainingScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const [filter, setFilter] = useState<(typeof filters)[number]>('all');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState<(typeof DISCIPLINES)[number]>('general_fitness');
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
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiRequest<{ sessions: SessionRow[] }>('/v1/training/sessions'),
  });
  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: () => apiRequest<Progress>('/v1/progress'),
  });

  const rows = useMemo(() => {
    const unique = uniqueById(sessions.data?.sessions ?? []);
    return filter === 'all' ? unique : unique.filter((session) => session.discipline === filter);
  }, [filter, sessions.data?.sessions]);
  const featured = featuredSession(rows, riyadhToday());
  const rest = rows.filter((session) => session.id !== featured?.id);

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
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (sessions.isError || exercises.isError) {
    const offline = sessions.error instanceof ApiClientError && sessions.error.code === 'OFFLINE';
    return (
      <Screen title={text(locale, 'training')}>
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void sessions.refetch()} />
      </Screen>
    );
  }

  const library = exercises.data?.exercises ?? [];
  return (
    <Screen>
      <ScreenBody footer={<Button label={text(locale, 'createPlan')} onPress={() => setOpen(true)} />}>
        <AppHeader title={text(locale, 'training')} subtitle={locale === 'ar' ? 'خطتك، قوتك، وتقدمك في مكان واحد' : 'Your plan, strength and progress'} />

        {/* A real training photo instead of a flat color block — Home's hero already owns that
            composition, so Training reaches for movement and texture instead of repeating it. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => (featured ? router.push({ pathname: '/workout/[id]', params: { id: featured.id } }) : setOpen(true))}
        >
          <PhotoWash source={editorialPhotos[photoFor(featured?.discipline ?? 'general_fitness')]} height={204}>
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: 11, letterSpacing: 1.2, marginBottom: 6 }}>
                {locale === 'ar' ? 'جلستك' : 'YOUR SESSION'}
              </Text>
              <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 23, lineHeight: 29, marginBottom: 4 }} numberOfLines={2}>
                {featured?.name ?? (locale === 'ar' ? 'ابنِ خطتك وابدأ' : 'Build your plan')}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
                {featured === null ? (locale === 'ar' ? 'اختر رياضتك وابدأ أول جلسة' : 'Choose a sport and start the first session') : `${label(locale, 'discipline', featured.discipline)} · ${label(locale, 'session', featured.status)}`}
              </Text>
              <View style={{ minHeight: 42, borderRadius: 13, backgroundColor: theme.heroAccent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, alignSelf: 'flex-start' }}>
                <Text style={{ color: theme.hero, fontFamily: fontFamily.bold, fontSize: 14 }}>{featured ? text(locale, 'start') : text(locale, 'createPlan')}</Text>
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

        <SegmentedControl
          value={filter}
          onChange={(id) => setFilter(id as (typeof filters)[number])}
          options={filters.map((item) => ({ id: item, label: item === 'all' ? text(locale, 'all') : label(locale, 'discipline', item) }))}
        />
        {rest.length > 0 ? <SectionLabel>{text(locale, 'history')}</SectionLabel> : null}
        {rest.map((session) => (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: session.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 18, padding: 12, marginBottom: 10 }}
          >
            <Image source={editorialPhotos[photoFor(session.discipline)]} style={{ width: 64, height: 64, borderRadius: 14 }} contentFit="cover" cachePolicy="memory-disk" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 16 }}>{session.name}</Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: 12, marginTop: 4 }}>{`${label(locale, 'discipline', session.discipline)} · ${formatRiyadhDate(String(session.scheduled_for), locale)}`}</Text>
            </View>
            <Text style={{ color: theme.accent, fontFamily: fontFamily.bold }}>{text(locale, 'start')}</Text>
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}><SectionLabel>{text(locale, 'exercises')}</SectionLabel><Pressable onPress={() => router.push('/exercises')}><Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{locale === 'ar' ? 'عرض الكل ←' : 'See all →'}</Text></Pressable></View>
        {library.slice(0, 5).map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            title={locale === 'ar' ? exercise.name_ar : exercise.name_en}
            meta={[
              label(locale, 'equipment', Array.isArray(exercise.equipment) ? exercise.equipment[0] ?? '' : exercise.equipment),
              exercise.difficulty === undefined ? '' : label(locale, 'experience', exercise.difficulty),
              (exercise.primary_muscles ?? []).slice(0, 2).join(' · '),
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
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <Field label={text(locale, 'workout')} value={name} onChangeText={setName} />
          <SegmentedControl
            value={discipline}
            onChange={(id) => setDiscipline(id as (typeof DISCIPLINES)[number])}
            options={DISCIPLINES.map((item) => ({ id: item, label: label(locale, 'discipline', item) }))}
          />
          <Body>{text(locale, 'chooseExercise')}</Body>
          {library.map((exercise) => (
            <ListRow
              key={exercise.id}
              title={locale === 'ar' ? exercise.name_ar : exercise.name_en}
              meta={label(locale, 'equipment', Array.isArray(exercise.equipment) ? exercise.equipment[0] ?? '' : exercise.equipment)}
              trailing={selected.includes(exercise.id) ? '✓' : undefined}
              onPress={() => setSelected((current) => (current.includes(exercise.id) ? current.filter((id) => id !== exercise.id) : [...current, exercise.id].slice(0, 8)))}
            />
          ))}
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
      </BottomSheet>
    </Screen>
  );
}
