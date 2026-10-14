import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, ImageBackground, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DISCIPLINES } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { formatCount, formatKg, formatRiyadhDate, riyadhToday } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { featuredSession, uniqueById } from '../../src/lists/unique';
import { plannedExercises } from '../../src/training/plan';
import { fontFamily } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { stableRecordKey } from '../../src/lists/keys';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, BottomSheet, ErrorState, ListRow, LoadingSkeleton, SectionLabel, SegmentedControl } from '../../src/ui/kit';

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
        <ImageBackground source={require('../../assets/editorial/strength.jpg')} imageStyle={{ borderRadius: 22 }} style={{ minHeight: 178, borderRadius: 22, overflow: 'hidden', padding: 20, justifyContent: 'flex-end', marginBottom: 18 }}>
          <View style={{ ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,14,20,0.67)' }} />
          <Text style={{ color: '#C7F36B', fontFamily: fontFamily.semibold, fontSize: 12, marginBottom: 4 }}>SAHHTI / TRAINING</Text>
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 25, lineHeight: 36 }}>{featured?.name ?? (locale === 'ar' ? 'ابنِ خطتك وابدأ' : 'Build your plan')}</Text>
          <Pressable accessibilityRole="button" onPress={() => featured ? router.push({ pathname: '/workout/[id]', params: { id: featured.id } }) : setOpen(true)} style={{ alignSelf: 'flex-start', backgroundColor: '#C7F36B', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 12 }}>
            <Text style={{ color: '#0A1717', fontFamily: fontFamily.bold }}>{featured ? text(locale, 'start') : text(locale, 'createPlan')}  ←</Text>
          </Pressable>
        </ImageBackground>
        <SegmentedControl
          value={filter}
          onChange={(id) => setFilter(id as (typeof filters)[number])}
          options={filters.map((item) => ({ id: item, label: item === 'all' ? text(locale, 'all') : label(locale, 'discipline', item) }))}
        />
        <SectionLabel>{text(locale, 'workout')}</SectionLabel>
        {featured === null ? <Body>{text(locale, 'noSessions')}</Body> : (
          <ListRow
            title={featured.name}
            meta={`${label(locale, 'discipline', featured.discipline)} · ${label(locale, 'session', featured.status)} · ${formatRiyadhDate(String(featured.scheduled_for), locale)}`}
            trailing={text(locale, 'start')}
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: featured.id } })}
          />
        )}
        {rest.length > 0 ? <SectionLabel>{text(locale, 'history')}</SectionLabel> : null}
        {rest.map((session) => (
          <ListRow
            key={session.id}
            title={session.name}
            meta={`${label(locale, 'discipline', session.discipline)} · ${label(locale, 'session', session.status)} · ${formatRiyadhDate(String(session.scheduled_for), locale)}`}
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: session.id } })}
          />
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}><SectionLabel>{text(locale, 'exercises')}</SectionLabel><Pressable onPress={() => router.push('/exercises')}><Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{locale === 'ar' ? 'عرض الكل ←' : 'See all →'}</Text></Pressable></View>
        {library.slice(0, 5).map((exercise) => (
          <ListRow
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
        {progress.data?.personalRecords.map((record) => (
          <ListRow
            key={stableRecordKey(record.id)}
            title={formatKg(Number(record.load_grams), locale)}
            meta={`${formatCount(Number(record.reps), locale)} · ${text(locale, 'kilograms')}`}
          />
        ))}
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
