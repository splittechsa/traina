import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, TextInput, View, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import type { WorkoutSession } from '@sahhti/domain';
import { parseScaledInteger } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { formatCount, formatKg } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { Button, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton, SurfaceCard } from '../../src/ui/kit';
import { MovementDemo3D } from '../../src/training/MovementDemo3D';
import { asLibraryList, type LibraryExercise } from '../../src/training/library';
import { fontFamily, radius, spacing, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useMotion } from '../../src/theme/motion';
import { tapSuccess } from '../../src/ui/haptics';
import { planOfflineSync, type PendingSetCommand } from '../../src/offline/queue';
import { readPendingSets, writePendingSets } from '../../src/offline/sqlite';

type ExerciseMeta = Pick<LibraryExercise, 'id' | 'name_ar' | 'name_en' | 'movement_pattern' | 'equipment' | 'demonstrationMedia'>;
type WorkoutProgress = {
  personalRecords: { exercise_id: string; load_grams: number; reps: number }[];
};

function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useLocale();
  const { reduce } = useMotion();
  const client = useQueryClient();
  const theme = useTheme();
  const isAr = locale === 'ar';
  const [reps, setReps] = useState('8');
  const [load, setLoad] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [rest, setRest] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [activeExerciseId, setActiveExerciseId] = useState('');
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const restAnchor = useRef<{ endsAt: number } | null>(null);

  const session = useQuery({
    queryKey: ['session', id],
    enabled: typeof id === 'string',
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

  const flushPending = useCallback(async () => {
    if (typeof id !== 'string' || session.data === undefined) return;
    const pending = await readPendingSets();
    const mine = pending.filter((command) => command.sessionId === id);
    if (mine.length === 0) return;
    const others = pending.filter((command) => command.sessionId !== id);
    const plan = planOfflineSync(session.data.session, mine);
    const remaining = [...others];
    for (const command of plan.send) {
      try {
        await apiRequest(`/v1/training/sessions/${command.sessionId}/sets`, { method: 'POST', body: command.set });
      } catch (caught) {
        if (caught instanceof ApiClientError && caught.status === 409) continue;
        remaining.push(command);
      }
    }
    await writePendingSets(remaining);
    await client.invalidateQueries({ queryKey: ['session', id] });
  }, [client, id, session.data]);

  useFocusEffect(
    useCallback(() => {
      void flushPending();
    }, [flushPending]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (restAnchor.current !== null && !restPaused) {
          const left = Math.max(0, Math.ceil((restAnchor.current.endsAt - Date.now()) / 1000));
          setRest(left);
        }
        void flushPending();
      }
    });
    return () => sub.remove();
  }, [flushPending, restPaused]);

  useEffect(() => {
    if (rest <= 0 || restPaused) return;
    const timer = setInterval(() => {
      setRest((current) => {
        if (current <= 1) {
          restAnchor.current = null;
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rest, restPaused]);

  const currentSession = session.data?.session;
  const activeExercise =
    currentSession === undefined
      ? undefined
      : currentSession.plannedExercises.find((item) => item.exerciseId === activeExerciseId) ??
        currentSession.plannedExercises[0];
  const previousForActive =
    activeExercise === undefined
      ? undefined
      : progress.data?.personalRecords.find((record) => record.exercise_id === activeExercise.exerciseId);

  useEffect(() => {
    if (activeExercise?.prescription.kind === 'strength') {
      setReps(String(activeExercise.prescription.reps));
      if (activeExercise.prescription.loadGrams !== null && activeExercise.prescription.loadGrams > 0) {
        setLoad(String(activeExercise.prescription.loadGrams / 1000));
      } else if (previousForActive !== undefined && previousForActive.load_grams > 0) {
        setLoad(String(previousForActive.load_grams / 1000));
      }
    }
  }, [activeExercise?.exerciseId, activeExercise?.prescription, previousForActive]);

  function startRest(seconds: number) {
    const duration = Math.max(0, seconds);
    setRest(duration);
    setRestPaused(false);
    restAnchor.current = { endsAt: Date.now() + duration * 1000 };
  }

  async function start() {
    if (typeof id !== 'string') return;
    await apiRequest(`/v1/training/sessions/${id}/start`, { method: 'POST', body: { at: new Date().toISOString() } });
    await client.invalidateQueries({ queryKey: ['session', id] });
    await client.invalidateQueries({ queryKey: ['home'] });
  }

  async function pause() {
    if (typeof id !== 'string') return;
    await apiRequest(`/v1/training/sessions/${id}/pause`, { method: 'POST', body: { at: new Date().toISOString() } });
    await client.invalidateQueries({ queryKey: ['session', id] });
  }

  async function resume() {
    if (typeof id !== 'string') return;
    await apiRequest(`/v1/training/sessions/${id}/resume`, { method: 'POST', body: { at: new Date().toISOString() } });
    await client.invalidateQueries({ queryKey: ['session', id] });
  }

  async function complete() {
    if (typeof id !== 'string') return;
    await apiRequest(`/v1/training/sessions/${id}/complete`, { method: 'POST', body: { at: new Date().toISOString() } });
    await client.invalidateQueries({ queryKey: ['session', id] });
    await client.invalidateQueries({ queryKey: ['sessions'] });
    await client.invalidateQueries({ queryKey: ['home'] });
    await client.invalidateQueries({ queryKey: ['progress'] });
  }

  async function logSetForExercise(exerciseId: string, setReps: number, loadKg: string) {
    if (typeof id !== 'string' || session.data === undefined || busy) return;
    if (!Number.isInteger(setReps) || setReps <= 0 || setReps > 10000 || (loadKg.trim() !== '' && (!Number.isFinite(Number(loadKg)) || Number(loadKg) < 0))) {
      setNotice(isAr ? 'تحقق من التكرارات والوزن قبل التسجيل' : 'Check reps and weight before logging');
      return;
    }
    const planned = session.data.session.plannedExercises.find((item) => item.exerciseId === exerciseId);
    if (planned === undefined) {
      setNotice(text(locale, 'empty'));
      return;
    }
    const bodyweight = planned.prescription.kind !== 'strength';
    const loadGrams = bodyweight || loadKg.trim().length === 0 ? 0 : parseScaledInteger(loadKg, 1000);
    if (editingSetId !== null) {
      const existing = session.data.session.sets.find((set) => set.id === editingSetId);
      if (existing === undefined || existing.exerciseId !== exerciseId) {
        setNotice(text(locale, 'error'));
        setEditingSetId(null);
        return;
      }
      setBusy(true);
      try {
        await apiRequest(`/v1/training/sessions/${id}/sets/${editingSetId}`, {
          method: 'PUT',
          body: {
            id: editingSetId,
            exerciseId: existing.exerciseId,
            setIndex: existing.setIndex,
            reps: setReps,
            loadGrams,
            rpeTenths: existing.rpeTenths,
            completedAt: new Date().toISOString(),
          },
        });
        await client.invalidateQueries({ queryKey: ['session', id] });
        setEditingSetId(null);
        setNotice('');
        tapSuccess(reduce);
      } catch {
        setNotice(text(locale, 'error'));
      } finally {
        setBusy(false);
      }
      return;
    }
    const command: PendingSetCommand = {
      clientEventId: Crypto.randomUUID(),
      sessionId: id,
      set: {
        id: Crypto.randomUUID(),
        exerciseId: planned.exerciseId,
        setIndex: session.data.session.sets.filter((set) => set.exerciseId === planned.exerciseId).length + 1,
        reps: setReps,
        loadGrams,
        rpeTenths: null,
        completedAt: new Date().toISOString(),
      },
    };
    setBusy(true);
    try {
      await apiRequest(`/v1/training/sessions/${id}/sets`, { method: 'POST', body: command.set });
      await client.invalidateQueries({ queryKey: ['session', id] });
      setNotice('');
      tapSuccess(reduce);
      if (planned.prescription.kind === 'strength') {
        startRest(planned.prescription.restSeconds);
      }
    } catch (caught) {
      if (!(caught instanceof ApiClientError) || caught.code !== 'OFFLINE') {
        setNotice(text(locale, 'error'));
        return;
      }
      const pending = await readPendingSets();
      const others = pending.filter((item) => item.sessionId !== id);
      const plan = planOfflineSync(session.data.session, [...pending.filter((item) => item.sessionId === id), command]);
      if (plan.conflicts.some((conflict) => conflict.clientEventId === command.clientEventId)) {
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
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} />
      </Screen>
    );
  }

  const current = session.data.session;
  const active = activeExercise;
  const isRunning = current.status === 'in_progress';
  const isDone = current.status === 'completed';
  const isPaused = current.status === 'paused';
  const isScheduled = current.status === 'scheduled';
  const activeIndex = Math.max(0, current.plannedExercises.findIndex((item) => item.exerciseId === (active?.exerciseId ?? '')));
  const completedSets = current.sets.length;
  const plannedSetTotal = current.plannedExercises.reduce((sum, row) => {
    if (row.prescription.kind === 'strength') return sum + row.prescription.sets;
    return sum + 1;
  }, 0);
  const volumeGrams = current.sets.reduce((sum, set) => sum + set.loadGrams * set.reps, 0);

  const exerciseName = (exerciseId: string): string => {
    const exercise = exerciseLibrary.data?.exercises.find((item) => item.id === exerciseId);
    return exercise === undefined ? (isAr ? 'تمرين' : 'Exercise') : isAr ? exercise.name_ar : exercise.name_en;
  };

  const demo = active === undefined ? undefined : exerciseLibrary.data?.exercises.find((item) => item.id === active.exerciseId);
  const loggedForActive = active === undefined ? [] : current.sets.filter((set) => set.exerciseId === active.exerciseId);
  const plannedSets = active?.prescription.kind === 'strength' ? active.prescription.sets : Math.max(3, loggedForActive.length + 1);
  const targetReps = active?.prescription.kind === 'strength' ? active.prescription.reps : Number(reps) || 8;
  const previous = previousForActive;

  const footer =
    isScheduled ? (
      <Button label={text(locale, 'start')} onPress={() => void start()} />
    ) : isPaused ? (
      <Button label={text(locale, 'resume')} onPress={() => void resume()} />
    ) : isRunning && active !== undefined ? (
      <Button
        label={
          busy
            ? isAr
              ? 'جارٍ الحفظ…'
              : 'Saving…'
            : editingSetId !== null
              ? text(locale, 'updateSet')
              : `${text(locale, 'doneCol')} · ${text(locale, 'setTableHeader')} ${loggedForActive.length + 1}`
        }
        onPress={() => {
          if (!busy) void logSetForExercise(active.exerciseId, Number(reps), load);
        }}
      />
    ) : undefined;

  return (
    <Screen>
      <ScreenBody
        footer={
          footer === undefined ? undefined : (
            <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2], backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
              {footer}
            </View>
          )
        }
      >
        <AppHeader
          title={current.name}
          subtitle={label(locale, 'session', current.status)}
          showBack
          confirmUnsaved={
            isRunning || isPaused
              ? {
                  title: text(locale, 'leaveWorkoutTitle'),
                  body: text(locale, 'leaveWorkoutBody'),
                  leave: text(locale, 'leaveWorkoutConfirm'),
                  stay: text(locale, 'stayWorkout'),
                }
              : undefined
          }
        />

        <SurfaceCard tone="raised" style={{ marginBottom: spacing[3] }}>
          <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: typeScale.label, marginBottom: 6 }}>
            {isDone ? (isAr ? 'جلسة مكتملة' : 'Session complete') : isRunning ? (isAr ? 'جلسة نشطة' : 'Active session') : isPaused ? (isAr ? 'متوقفة مؤقتاً' : 'Paused') : (isAr ? 'جاهز للبدء' : 'Ready to start')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              [String(current.plannedExercises.length), isAr ? 'تمارين' : 'Exercises'],
              [`${completedSets}/${plannedSetTotal}`, isAr ? 'مجموعات' : 'Sets'],
              [volumeGrams > 0 ? formatKg(volumeGrams, locale) : '—', isAr ? 'حجم' : 'Volume'],
            ].map(([n, caption]) => (
              <View key={String(caption)} style={{ flex: 1, backgroundColor: theme.surfaceMuted, borderRadius: radius.md, padding: 12 }}>
                <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 20 }}>{n}</Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 11 }}>{caption}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>

        {rest > 0 && isRunning ? (
          <SurfaceCard style={{ marginBottom: spacing[3], borderColor: theme.accent, borderWidth: 1 }}>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium }}>{text(locale, 'restTimer')}</Text>
            <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, fontSize: 36, marginVertical: 4 }}>{formatRest(rest)}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (restPaused) {
                    restAnchor.current = { endsAt: Date.now() + rest * 1000 };
                    setRestPaused(false);
                  } else {
                    setRestPaused(true);
                  }
                }}
                style={{ flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
                  {restPaused ? text(locale, 'resumeRest') : text(locale, 'pauseRest')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => { setRest(0); restAnchor.current = null; setRestPaused(false); }}
                style={{ flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: theme.emphasisText, fontFamily: fontFamily.semibold }}>{text(locale, 'skipRest')}</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        ) : null}

        {(isRunning || isPaused) && active !== undefined ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Pressable
                accessibilityRole="button"
                disabled={activeIndex <= 0}
                onPress={() => {
                  const prev = current.plannedExercises[activeIndex - 1];
                  if (prev) setActiveExerciseId(prev.exerciseId);
                }}
                style={{ opacity: activeIndex <= 0 ? 0.35 : 1, padding: 8 }}
              >
                <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, fontSize: 22 }}>{isAr ? '›' : '‹'}</Text>
              </Pressable>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium }}>
                {activeIndex + 1} / {current.plannedExercises.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={activeIndex >= current.plannedExercises.length - 1}
                onPress={() => {
                  const next = current.plannedExercises[activeIndex + 1];
                  if (next) setActiveExerciseId(next.exerciseId);
                }}
                style={{ opacity: activeIndex >= current.plannedExercises.length - 1 ? 0.35 : 1, padding: 8 }}
              >
                <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, fontSize: 22 }}>{isAr ? '‹' : '›'}</Text>
              </Pressable>
            </View>

            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.headline, marginBottom: 6 }}>
              {exerciseName(active.exerciseId)}
            </Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginBottom: 10, lineHeight: 20 }}>
              {text(locale, 'techniqueHint')}
            </Text>

            {demo?.demonstrationMedia != null ? (
              <MovementDemo3D
                compact
                profile={demo.demonstrationMedia.profile ?? demo.movement_pattern ?? 'neutral'}
                equipment={asLibraryList(demo.equipment)}
              />
            ) : (
              <SurfaceCard tone="muted" style={{ marginBottom: spacing[3] }}>
                <Text style={{ color: theme.textMuted }}>{text(locale, 'demoUnavailable')}</Text>
              </SurfaceCard>
            )}

            {previous !== undefined ? (
              <Text style={{ color: theme.textMuted, marginBottom: 10 }}>
                {text(locale, 'previousBest')}:{' '}
                {previous.load_grams > 0
                  ? `${formatKg(previous.load_grams, locale)} × ${formatCount(previous.reps, locale)}`
                  : `${formatCount(previous.reps, locale)} ${text(locale, 'reps')}`}
              </Text>
            ) : null}

            <SurfaceCard style={{ marginBottom: spacing[3] }}>
              <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <Text style={{ flex: 1, color: theme.textMuted, fontFamily: fontFamily.semibold }}>{text(locale, 'setTableHeader')}</Text>
                <Text style={{ flex: 1.2, color: theme.textMuted, fontFamily: fontFamily.semibold }}>{text(locale, 'weightCol')}</Text>
                <Text style={{ flex: 1, color: theme.textMuted, fontFamily: fontFamily.semibold }}>{text(locale, 'repsCol')}</Text>
                <Text style={{ width: 52, color: theme.textMuted, fontFamily: fontFamily.semibold, textAlign: 'center' }}>{text(locale, 'doneCol')}</Text>
              </View>
              {Array.from({ length: plannedSets }, (_, index) => {
                const logged = loggedForActive[index];
                const isNext = logged === undefined && loggedForActive.length === index && editingSetId === null;
                const isEditing = logged !== undefined && editingSetId === logged.id;
                return (
                  <Pressable
                    key={`set-row-${index}`}
                    accessibilityRole={logged ? 'button' : undefined}
                    accessibilityLabel={logged ? text(locale, 'editLoggedSet') : undefined}
                    disabled={!logged || !isRunning}
                    onPress={() => {
                      if (logged === undefined || !isRunning) return;
                      setEditingSetId(logged.id);
                      setReps(String(logged.reps));
                      setLoad(logged.loadGrams > 0 ? String(logged.loadGrams / 1000) : '');
                      setNotice(text(locale, 'editLoggedSet'));
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderBottomWidth: index === plannedSets - 1 ? 0 : StyleSheetHairline,
                      borderBottomColor: theme.border,
                      opacity: logged ? 1 : isNext ? 1 : 0.55,
                      backgroundColor: isEditing ? theme.surfaceMuted : 'transparent',
                      borderRadius: isEditing ? radius.sm : 0,
                    }}
                  >
                    <Text style={{ flex: 1, color: theme.text, fontFamily: fontFamily.bold }}>{index + 1}</Text>
                    <Text style={{ flex: 1.2, color: theme.text, fontFamily: fontFamily.medium, fontVariant: ['tabular-nums'] }}>
                      {logged
                        ? logged.loadGrams > 0
                          ? formatKg(logged.loadGrams, locale)
                          : '—'
                        : isNext
                          ? load.trim().length > 0
                            ? `${load} ${text(locale, 'kilograms')}`
                            : '—'
                          : '—'}
                    </Text>
                    <Text style={{ flex: 1, color: theme.text, fontFamily: fontFamily.medium, fontVariant: ['tabular-nums'] }}>
                      {logged ? formatCount(logged.reps, locale) : isNext ? reps : String(targetReps)}
                    </Text>
                    <View style={{ width: 52, alignItems: 'center' }}>
                      <Text style={{ color: logged ? theme.success : theme.textMuted, fontFamily: fontFamily.bold }}>
                        {logged ? (isEditing ? '✎' : '✓') : isNext ? '○' : '·'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </SurfaceCard>

            {isRunning ? (
              <View style={{ gap: 10, marginBottom: spacing[3] }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['5', '8', '10', '12'].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: reps === value }}
                      onPress={() => setReps(value)}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        borderRadius: radius.md,
                        backgroundColor: reps === value ? theme.accent : theme.surfaceMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: reps === value ? theme.emphasisText : theme.text, fontFamily: fontFamily.bold }}>{value}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel={text(locale, 'reps')}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  placeholder={text(locale, 'reps')}
                  placeholderTextColor={theme.textMuted}
                  style={{
                    minHeight: 48,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: theme.border,
                    paddingHorizontal: 14,
                    color: theme.text,
                    fontFamily: fontFamily.semibold,
                    textAlign: isAr ? 'right' : 'left',
                  }}
                />
                {active.prescription.kind === 'strength' ? (
                  <>
                    <TextInput
                      accessibilityLabel={text(locale, 'load')}
                      value={load}
                      onChangeText={setLoad}
                      keyboardType="decimal-pad"
                      placeholder={`${text(locale, 'load')} (${text(locale, 'kilograms')})`}
                      placeholderTextColor={theme.textMuted}
                      style={{
                        minHeight: 48,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: theme.border,
                        paddingHorizontal: 14,
                        color: theme.text,
                        fontFamily: fontFamily.semibold,
                        textAlign: isAr ? 'right' : 'left',
                      }}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[-5, -2.5, 2.5, 5].map((delta) => (
                        <Pressable
                          key={delta}
                          accessibilityRole="button"
                          onPress={() => {
                            const loadNow = Number(load) || 0;
                            const next = Math.max(0, loadNow + delta);
                            setLoad(Number.isInteger(next) ? String(next) : next.toFixed(1));
                          }}
                          style={{ flex: 1, minHeight: 40, borderRadius: radius.md, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{delta > 0 ? `+${delta}` : delta}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ gap: 10, marginBottom: spacing[3] }}>
            {current.plannedExercises.map((planned, index) => {
              const logged = current.sets.filter((set) => set.exerciseId === planned.exerciseId).length;
              const prescription = planned.prescription;
              const detail =
                prescription.kind === 'strength'
                  ? `${prescription.sets} × ${prescription.reps}`
                  : prescription.kind === 'crossfit'
                    ? prescription.format
                    : prescription.progression;
              return (
                <SurfaceCard key={planned.exerciseId}>
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
                    {String(index + 1).padStart(2, '0')} · {exerciseName(planned.exerciseId)}
                  </Text>
                  <Text style={{ color: theme.textMuted, marginTop: 4 }}>
                    {detail} · {isAr ? `${logged} مسجّلة` : `${logged} logged`}
                  </Text>
                </SurfaceCard>
              );
            })}
          </View>
        )}

        {isDone ? (
          <SurfaceCard tone="raised" style={{ marginBottom: spacing[3] }}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, marginBottom: 8 }}>
              {isAr ? 'ملخص الجلسة' : 'Session summary'}
            </Text>
            <Text style={{ color: theme.textMuted, lineHeight: 22 }}>
              {isAr
                ? `${completedSets} مجموعات · ${current.plannedExercises.length} تمارين${volumeGrams > 0 ? ` · حجم ${formatKg(volumeGrams, locale)}` : ''}`
                : `${completedSets} sets · ${current.plannedExercises.length} exercises${volumeGrams > 0 ? ` · volume ${formatKg(volumeGrams, locale)}` : ''}`}
            </Text>
          </SurfaceCard>
        ) : null}

        {notice ? (
          <Text accessibilityRole="alert" style={{ color: theme.warning, fontFamily: fontFamily.medium, marginBottom: 12 }}>
            {notice}
          </Text>
        ) : null}

        {isRunning ? <Button label={text(locale, 'pause')} variant="secondary" onPress={() => void pause()} /> : null}
        {(isRunning || isPaused) ? (
          <Button
            label={text(locale, 'finish')}
            variant="secondary"
            onPress={() =>
              Alert.alert(text(locale, 'finishWorkoutTitle'), text(locale, 'finishWorkoutBody'), [
                { text: text(locale, 'stayWorkout'), style: 'cancel' },
                { text: text(locale, 'finish'), onPress: () => void complete() },
              ])
            }
          />
        ) : null}
        <View style={{ height: 24 }} />
      </ScreenBody>
    </Screen>
  );
}

const StyleSheetHairline = 1;
