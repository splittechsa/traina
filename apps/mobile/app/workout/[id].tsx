import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import type { WorkoutSession } from '@sahhti/domain';
import { compareSessionLoad, parseScaledInteger, workoutElapsedSeconds } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { formatCount, formatDuration, formatKg } from '../../src/format';
import { useSteps } from '../../src/activity/useSteps';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton } from '../../src/ui/kit';
import { type LibraryExercise } from '../../src/training/library';
import { fontFamily } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useMotion } from '../../src/theme/motion';
import { tapSuccess } from '../../src/ui/haptics';
import { planOfflineSync, type PendingSetCommand } from '../../src/offline/queue';
import { readPendingSets, writePendingSets } from '../../src/offline/sqlite';

type ExerciseMeta = Pick<LibraryExercise, 'id' | 'name_ar' | 'name_en' | 'movement_pattern' | 'equipment' | 'demonstrationMedia'>;
type WorkoutProgress = {
  personalRecords: { exercise_id: string; load_grams: number; reps: number }[];
};

function sessionIdOf(id: string | string[] | undefined): string | null {
  if (typeof id === 'string' && id.length > 0) return id;
  if (Array.isArray(id) && typeof id[0] === 'string' && id[0].length > 0) return id[0];
  return null;
}

function leaveToTraining() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/(tabs)/training');
}

export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ id: string; select?: string }>();
  const id = sessionIdOf(params.id);
  const select = typeof params.select === 'string' ? params.select : undefined;
  const { locale } = useLocale();
  const { reduce } = useMotion();
  const client = useQueryClient();
  const theme = useTheme();
  const [reps, setReps] = useState('8');
  const [load, setLoad] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeExerciseId, setActiveExerciseId] = useState('');
  const [tick, setTick] = useState(() => Date.now());
  const [logOpen, setLogOpen] = useState(false);
  const autoStarted = useRef(false);
  const { state: stepsState } = useSteps(7);
  const session = useQuery({
    queryKey: ['session', id],
    enabled: id !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => apiRequest<{ session: WorkoutSession }>(`/v1/training/sessions/${id}`),
  });
  const exerciseLibrary = useQuery({
    queryKey: ['exercises'],
    queryFn: () => apiRequest<{ exercises: ExerciseMeta[] }>('/v1/exercises'),
  });
  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: () => apiRequest<WorkoutProgress>('/v1/progress'),
  });

  async function command(path: 'start' | 'resume' | 'complete') {
    if (id === null) return;
    const next = await apiRequest<{ session: WorkoutSession }>(`/v1/training/sessions/${id}/${path}`, {
      method: 'POST',
      body: { at: new Date().toISOString() },
    });
    client.setQueryData(['session', id], { session: next.session });
    await client.invalidateQueries({ queryKey: ['sessions'] });
    if (path === 'complete') {
      await client.invalidateQueries({ queryKey: ['home'] });
      await client.invalidateQueries({ queryKey: ['progress'] });
    }
    return next.session;
  }

  async function start() {
    setNotice('');
    try {
      await command('start');
    } catch (caught) {
      setNotice(caught instanceof ApiClientError ? caught.message : text(locale, 'error'));
    }
  }

  async function complete() {
    setNotice('');
    setBusy(true);
    try {
      const status = session.data?.session.status;
      if (status === 'scheduled' || status === 'paused') {
        await command('start');
      }
      await command('complete');
      leaveToTraining();
    } catch {
      setNotice(text(locale, 'error'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const status = session.data?.session.status;
    if (status !== 'in_progress' && status !== 'paused') return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session.data?.session.status]);

  useEffect(() => {
    if (id === null || session.data?.session.status !== 'scheduled' || autoStarted.current) return;
    autoStarted.current = true;
    void start();
  }, [id, session.data?.session.status]);

  useEffect(() => {
    if (select === undefined || select.length === 0 || session.data === undefined) return;
    const inPlan = session.data.session.plannedExercises.some((item) => item.exerciseId === select);
    if (inPlan) {
      setActiveExerciseId(select);
      return;
    }
    router.replace({ pathname: '/exercises', params: { select } });
  }, [select, session.data]);

  async function logSet() {
    if (id === null || session.data === undefined || busy) return;
    if (!Number.isInteger(Number(reps)) || Number(reps) <= 0 || Number(reps) > 10000 || (load.trim() !== '' && (!Number.isFinite(Number(load)) || Number(load) < 0))) {
      setNotice(locale === 'ar' ? 'تحقق من التكرارات والوزن قبل التسجيل' : 'Check reps and weight before logging');
      return;
    }
    const planned =
      session.data.session.plannedExercises.find((item) => item.exerciseId === activeExerciseId) ??
      session.data.session.plannedExercises[0];
    if (planned === undefined) {
      setNotice(text(locale, 'empty'));
      return;
    }
    const bodyweight = planned.prescription.kind !== 'strength';
    const pendingSet: PendingSetCommand = {
      clientEventId: Crypto.randomUUID(),
      sessionId: id,
      set: {
        id: Crypto.randomUUID(),
        exerciseId: planned.exerciseId,
        setIndex: session.data.session.sets.filter((set) => set.exerciseId === planned.exerciseId).length + 1,
        reps: Number(reps),
        loadGrams: bodyweight || load.trim().length === 0 ? 0 : parseScaledInteger(load, 1000),
        rpeTenths: null,
        completedAt: new Date().toISOString(),
      },
    };
    setBusy(true);
    try {
      await apiRequest(`/v1/training/sessions/${id}/sets`, { method: 'POST', body: pendingSet.set });
      await client.invalidateQueries({ queryKey: ['session', id] });
      setNotice('');
      tapSuccess(reduce);
    } catch (caught) {
      if (!(caught instanceof ApiClientError) || caught.code !== 'OFFLINE') {
        setNotice(text(locale, 'error'));
        return;
      }
      const pending = await readPendingSets();
      const others = pending.filter((item) => item.sessionId !== id);
      const plan = planOfflineSync(session.data.session, [...pending.filter((item) => item.sessionId === id), pendingSet]);
      if (plan.conflicts.some((conflict) => conflict.clientEventId === pendingSet.clientEventId)) {
        setNotice(text(locale, 'conflict'));
        return;
      }
      await writePendingSets([...others, ...plan.send]);
      setNotice(text(locale, 'queued'));
    } finally {
      setBusy(false);
    }
  }

  if (session.isPending) {
    return (
      <Screen>
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (session.isError || session.data === undefined) {
    const offline = session.error instanceof ApiClientError && session.error.code === 'OFFLINE';
    return (
      <Screen title={text(locale, 'workout')}>
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void session.refetch()} />
        <Button label={text(locale, 'leaveWorkout')} variant="secondary" onPress={leaveToTraining} />
      </Screen>
    );
  }

  const current = session.data.session;
  const isAr = locale === 'ar';
  const isRunning = current.status === 'in_progress';
  const isPaused = current.status === 'paused';
  const isDone = current.status === 'completed';
  const isOpen = current.status === 'scheduled' || isRunning || isPaused;
  const elapsed = workoutElapsedSeconds(current, new Date(tick).toISOString());
  const comparison = compareSessionLoad(
    [{ completed_at: current.completedAt ?? new Date(tick).toISOString(), discipline: current.discipline, duration_seconds: elapsed }],
    stepsState.status === 'ready' ? stepsState.today : 0,
  );
  const active =
    current.plannedExercises.find((item) => item.exerciseId === activeExerciseId) ?? current.plannedExercises[0];
  const exerciseName = (exerciseId: string): string => {
    const exercise = exerciseLibrary.data?.exercises.find((item) => item.id === exerciseId);
    return exercise === undefined ? (isAr ? 'تمرين' : 'Exercise') : isAr ? exercise.name_ar : exercise.name_en;
  };
  const tile = { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 10 } as const;
  const primary = isDone
    ? { label: text(locale, 'backToTraining'), onPress: leaveToTraining }
    : isOpen
      ? { label: isPaused ? text(locale, 'resume') : isRunning ? text(locale, 'finish') : text(locale, 'start'), onPress: () => void (isRunning ? complete() : start()) }
      : { label: text(locale, 'startFresh'), onPress: leaveToTraining };

  return (
    <Screen>
      <ScreenBody footer={(
        <View style={{ gap: 8 }}>
          {notice ? <Text accessibilityRole="alert" style={{ color: theme.warning, fontFamily: fontFamily.medium, textAlign: isAr ? 'right' : 'left' }}>{notice}</Text> : null}
          <Button label={busy ? text(locale, 'saving') : primary.label} disabled={busy} onPress={primary.onPress} />
          <Button label={text(locale, 'leaveWorkout')} variant="secondary" onPress={leaveToTraining} />
        </View>
      )}>
        <AppHeader
          title={current.name}
          subtitle={isDone ? text(locale, 'doneForToday') : text(locale, 'exerciseGuide')}
          trailing={(
            <Pressable accessibilityRole="button" onPress={leaveToTraining} hitSlop={10}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{text(locale, 'leaveWorkout')}</Text>
            </Pressable>
          )}
        />
        <View style={{ backgroundColor: theme.hero, borderRadius: 26, padding: 22, marginTop: 8, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: 12 }}>{text(locale, 'elapsedTime')}</Text>
          <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 64, lineHeight: 72, marginTop: 4 }}>{formatDuration(elapsed)}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontFamily: fontFamily.regular, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
            {isRunning ? text(locale, 'finish') : isPaused ? text(locale, 'resume') : text(locale, 'timeOnlyHint')}
          </Text>
        </View>
        {isDone ? (
          <View style={{ ...tile, flexDirection: 'row' }}>
            {[
              [text(locale, 'strengthTime'), formatDuration(comparison.strengthSeconds)],
              [text(locale, 'cardioTime'), formatDuration(comparison.cardioSeconds)],
              [text(locale, 'stepsToday'), formatCount(comparison.steps, locale)],
            ].map(([caption, value]) => (
              <View key={String(caption)} style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 18 }}>{value}</Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 11, marginTop: 3 }}>{caption}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 16, marginBottom: 10, textAlign: isAr ? 'right' : 'left' }}>
          {isAr ? 'تمارين اليوم' : "Today's exercises"}
        </Text>
        {current.plannedExercises.map((planned, index) => {
          const logged = current.sets.filter((set) => set.exerciseId === planned.exerciseId).length;
          return (
            <View key={`${planned.exerciseId}-${index}`} style={tile}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{`${index + 1}. ${exerciseName(planned.exerciseId)}`}</Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 12, marginTop: 4 }}>
                {planned.prescription.kind === 'strength'
                  ? `${planned.prescription.sets} × ${planned.prescription.reps}`
                  : planned.prescription.kind === 'crossfit'
                    ? planned.prescription.format
                    : planned.prescription.progression}
                {logged > 0 ? ` · ${formatCount(logged, locale)}` : ''}
              </Text>
            </View>
          );
        })}
        {isRunning ? (
          <Pressable accessibilityRole="button" onPress={() => setLogOpen((open) => !open)} style={{ ...tile, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{text(locale, 'optionalSets')}</Text>
            <Text style={{ color: theme.accent, fontFamily: fontFamily.bold }}>{logOpen ? (isAr ? 'إخفاء' : 'Hide') : formatCount(current.sets.length, locale)}</Text>
          </Pressable>
        ) : null}
        {logOpen && isRunning && active !== undefined ? (
          <View style={tile}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {current.plannedExercises.map((planned) => (
                <Pressable
                  key={planned.exerciseId}
                  accessibilityRole="button"
                  onPress={() => setActiveExerciseId(planned.exerciseId)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    backgroundColor: planned.exerciseId === active.exerciseId ? theme.accent : theme.surfaceMuted,
                  }}
                >
                  <Text style={{ color: planned.exerciseId === active.exerciseId ? theme.emphasisText : theme.text, fontFamily: fontFamily.semibold, fontSize: 12 }}>
                    {exerciseName(planned.exerciseId)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, marginBottom: 10 }}>{exerciseName(active.exerciseId)}</Text>
            {(() => {
              const previous = progress.data?.personalRecords.find((record) => record.exercise_id === active.exerciseId);
              if (previous === undefined) return null;
              const reference = previous.load_grams > 0
                ? `${formatKg(previous.load_grams, locale)} × ${formatCount(previous.reps, locale)}`
                : `${formatCount(previous.reps, locale)} ${text(locale, 'reps')}`;
              return <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginBottom: 10 }}>{isAr ? `أفضل أداء سابق: ${reference}` : `Previous best: ${reference}`}</Text>;
            })()}
            <Field label={text(locale, 'reps')} value={reps} onChangeText={setReps} keyboardType="number-pad" />
            {active.prescription.kind === 'strength' ? (
              <Field label={`${text(locale, 'load')} (${text(locale, 'kilograms')})`} value={load} onChangeText={setLoad} keyboardType="decimal-pad" />
            ) : null}
            <Button label={text(locale, 'logSet')} disabled={busy} onPress={() => void logSet()} />
          </View>
        ) : null}
        <View style={{ height: 12 }} />
      </ScreenBody>
    </Screen>
  );
}
