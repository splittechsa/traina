import { SetInputs } from '../../src/training/SetInputs';
import { Text } from '../../src/ui/Text';
import { ExercisePreview } from '../../src/training/ExercisePreview';
import { singleFlight, type Flight } from '../../src/offline/singleFlight';
import { saveDurableSet, refreshWorkoutDependents } from '../../src/training/saveFeedback';
import { perfMark } from '../../src/performance/lab';
import { useFormRecovery } from '../../src/storage/useFormRecovery';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import type { WorkoutSession, WorkoutSet } from '@sahhti/domain';
import { parseScaledInteger, workoutElapsedSeconds } from '@sahhti/domain';
import { completionTimestamp, finishWithReconciliation } from '../../src/training/completeWorkout';
import { messageFor } from '../../src/api/errors';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { formatCount, formatKg } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { Button, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton, SurfaceCard } from '../../src/ui/kit';

import { type LibraryExercise } from '../../src/training/library';
import { YazanCard, openYazanWithPrompt } from '../../src/ui/YazanCard';
import { yazanTip } from '../../src/training/yazanPresence';
import { fontFamily, radius, spacing, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useMotion } from '../../src/theme/motion';
import { tapSuccess } from '../../src/ui/haptics';
import { planOfflineSync, synchronizeOfflineSets, type PendingSetCommand } from '../../src/offline/queue';
import { acknowledgePendingSets, enqueuePendingSet, readPendingSets, readAccountSnapshot, writeAccountSnapshot, replaceConflictingSet } from '../../src/offline/sqlite';
import { adjustRestTimer, pauseRestTimer, remainingRest, resumeRestTimer, startRestTimer, type RestTimerState } from '../../src/training/restTimer';
import { accountScope, accountResource } from '../../src/offline/resource';
import { useSession } from '../../src/auth/SessionProvider';

type ExerciseMeta = Pick<LibraryExercise, 'id' | 'name_ar' | 'name_en' | 'movement_pattern' | 'equipment' | 'demonstrationMedia' | 'approvedDemonstration' | 'reviewStatus' | 'primary_muscles' | 'instructions_ar' | 'instructions_en'>;
type WorkoutProgress = {
  personalRecords: { exercise_id: string; load_grams: number; reps: number }[];
};

function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Only this label ticks; the form and set table do not rerender each second. */
function RestCountdown({ readState, paused, secondsAtChange, onExpire }: { readState: () => RestTimerState | null; paused: boolean; secondsAtChange: number; onExpire: () => void }) {
  const theme = useTheme();
  const [seconds, setSeconds] = useState(secondsAtChange);
  const expired = useRef(onExpire);
  useEffect(() => { expired.current = onExpire; }, [onExpire]);
  const read = useRef(readState);
  useEffect(() => { read.current = readState; }, [readState]);
  useEffect(() => {
    const state = read.current();
    const tick = () => { const left = remainingRest(state, Date.now()); setSeconds(left); if (left === 0) expired.current(); };
    tick();
    if (state?.paused || !state) return;
    const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [paused, secondsAtChange]);
  return <Text accessibilityLiveRegion="polite" style={{ color: theme.accent, fontFamily: fontFamily.bold, fontSize: 24, marginVertical: 2 }}>{formatRest(seconds)}</Text>;
}

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useLocale();
  const { reduce } = useMotion();
  const client = useQueryClient();
  const theme = useTheme();
  const { tokens } = useSession();
  const owner = tokens?.userId ? accountScope() : null;
  const [conflicts, setConflicts] = useState<PendingSetCommand[]>([]);
  const isAr = locale === 'ar';
  const [inputDirty, setInputDirty] = useState(false);
  const [reps, setReps] = useState('8');
  const [load, setLoad] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [rest, setRest] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [activeExerciseId, setActiveExerciseId] = useState('');
  const [editingBase, setEditingBase] = useState<WorkoutSet | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const restAnchor = useRef<RestTimerState | null>(null);

  const session = useQuery({
    queryKey: ['session', id, owner],
    gcTime: 60_000,
    enabled: typeof id === 'string' && owner !== null,
    queryFn: async () => {
      const fresh = await accountResource<{ session: WorkoutSession }>(`/v1/training/sessions/${id}`);
      const pending = await readPendingSets(owner!);
      return { session: planOfflineSync(fresh.session, pending).session };
    },
  });
  const exerciseLibrary = useQuery({
    queryKey: ['exercises'],
    queryFn: () => accountResource<{ exercises: ExerciseMeta[] }>('/v1/exercises'),
  });
  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: () => accountResource<WorkoutProgress>('/v1/progress'),
  });

  const syncing = useRef<Flight<boolean> | null>(null);
  const flushPending = useCallback((): Promise<boolean> => {
    if (typeof id !== 'string' || owner === null) return Promise.resolve(false);
    return singleFlight(syncing, owner + '|' + id, async () => {
    try {
      while (accountScope() === owner) {
      const pending = await readPendingSets(owner!);
      if (!pending.some(command => command.sessionId === id)) return true;
      // The query cache may include optimistic offline sets. Only server state can prove a replay.
      const fresh = await apiRequest<{ session: WorkoutSession }>(`/v1/training/sessions/${id}`);
      if (accountScope() !== owner) return false;
      let confirmed = fresh.session;
      const plan = planOfflineSync(fresh.session, pending);
      setConflicts(pending.filter(command => plan.conflicts.some(conflict => conflict.clientEventId === command.clientEventId)));
      const result = await synchronizeOfflineSets(fresh.session, pending, async command => {
        if (accountScope() !== owner) throw new Error('ACCOUNT_CHANGED');
        if (command.kind === 'replace') {
          confirmed = (await apiRequest<{ session: WorkoutSession }>(`/v1/training/sessions/${command.sessionId}/sets/${command.set.id}`, {
            method: 'PUT', body: { ...command.set, expectedSet: command.baseSet },
          })).session;
        } else {
          confirmed = (await apiRequest<{ session: WorkoutSession }>(`/v1/training/sessions/${command.sessionId}/sets`, { method: 'POST', body: command.set })).session;
        }
      });
      if (accountScope() !== owner) return false;
      // Keep a durable server snapshot before deleting replay commands, so offline reopen retains acknowledged sets.
      await writeAccountSnapshot(owner, 'resource:/v1/training/sessions/' + id, { session: confirmed });
      await acknowledgePendingSets(owner, pending, result.remaining);
      const remaining = await readPendingSets(owner!);
      if (result.hasConflicts) setNotice(text(locale, 'conflict'));
      if (accountScope() !== owner) return false;
      client.setQueryData(['session', id, owner], { session: planOfflineSync(confirmed, remaining).session });
      if (!remaining.some(command => command.sessionId === id)) return true;
      const original = new Set(pending.filter(command => command.sessionId === id).map(command => command.clientEventId));
      // Continue immediately for writes appended during this batch; never spin on a failed/conflicting write.
      if (result.hasConflicts || remaining.some(command => original.has(command.clientEventId))) return false;
      }
      return false;
    } catch {
      // Keep the durable queue intact on connection or storage failures.
      return false;
    }
    });
  }, [client, id, locale, owner]);

  useEffect(() => {
    const retry = setInterval(() => { if (AppState.currentState === 'active') void flushPending(); }, 15000);
    return () => clearInterval(retry);
  }, [flushPending]);

  useFocusEffect(
    useCallback(() => {
      void flushPending();
    }, [flushPending]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (restAnchor.current !== null && !restPaused) {
          const left = remainingRest(restAnchor.current, Date.now());
          setRest(left);
        }
        void flushPending();
      }
    });
    return () => sub.remove();
  }, [flushPending, restPaused]);

  const currentSession = session.data?.session;
  const results = useQuery({
    queryKey: ['session-results', id, owner],
    enabled: typeof id === 'string' && owner !== null && currentSession?.status === 'completed',
    gcTime: 60_000,
    queryFn: () => accountResource<{ improvements: { exerciseId:string;loadGrams:number;reps:number;previous:{loadGrams:number;reps:number} }[]; firstRecorded: {exerciseId:string;loadGrams:number;reps:number}[] }>(`/v1/training/sessions/${id}/results`),
  });
  const activeExercise =
    currentSession === undefined
      ? undefined
      : currentSession.plannedExercises.find((item) => item.exerciseId === activeExerciseId) ??
        currentSession.plannedExercises[0];
  const previousForActive =
    activeExercise === undefined
      ? undefined
      : progress.data?.personalRecords.find((record) => record.exercise_id === activeExercise.exerciseId);

  const [prefilledExercise, setPrefilledExercise] = useState('');
  if (activeExercise !== undefined && activeExercise.exerciseId !== prefilledExercise) {
    setPrefilledExercise(activeExercise.exerciseId);
    setLoad('');
    if (activeExercise.prescription.kind === 'strength') {
      setReps(String(activeExercise.prescription.reps));
      if (activeExercise.prescription.loadGrams !== null && activeExercise.prescription.loadGrams > 0) {
        setLoad(String(activeExercise.prescription.loadGrams / 1000));
      } else if (previousForActive !== undefined && previousForActive.load_grams > 0) {
        setLoad(String(previousForActive.load_grams / 1000));
      }
    }
  }

  const inputRecovery = useFormRecovery('workout-input:' + id, { reps, load, activeExerciseId: activeExercise?.exerciseId ?? activeExerciseId, editingSetId, editingBase }, draft => { setReps(draft.reps); setLoad(draft.load); setActiveExerciseId(draft.activeExerciseId); setPrefilledExercise(draft.activeExerciseId); setEditingSetId(draft.editingSetId); setEditingBase(draft.editingBase ?? null); setInputDirty(true); }, inputDirty, currentSession !== undefined);

  function startRest(seconds: number) {
    const state = startRestTimer(seconds, Date.now());
    setRest(remainingRest(state, Date.now()));
    setRestPaused(false);
    restAnchor.current = state;
    if (typeof id === 'string' && owner) void writeAccountSnapshot(owner, `rest:${id}`, state).catch(() => setNotice(text(locale, 'error')));
  }

  function toggleRest() {
    const state = restPaused
      ? resumeRestTimer(restAnchor.current, Date.now())
      : pauseRestTimer(restAnchor.current, Date.now());
    restAnchor.current = state;
    setRest(remainingRest(state, Date.now()));
    setRestPaused(state.paused === true);
    if (typeof id === 'string' && owner) void writeAccountSnapshot(owner, `rest:${id}`, state).catch(() => setNotice(text(locale, 'error')));
  }

  function adjustRest(delta: number) {
    const state = adjustRestTimer(restAnchor.current, delta, Date.now());
    restAnchor.current = state;
    setRest(remainingRest(state, Date.now()));
    setRestPaused(state.paused === true);
    if (typeof id === 'string' && owner) void writeAccountSnapshot(owner, `rest:${id}`, state).catch(() => setNotice(text(locale, 'error')));
  }

  function skipRest() {
    setRest(0);
    restAnchor.current = null;
    setRestPaused(false);
    if (typeof id === 'string' && owner) void writeAccountSnapshot(owner, `rest:${id}`, null).catch(() => setNotice(text(locale, 'error')));
  }

  useEffect(() => {
    if (typeof id !== 'string' || owner === null) return;
    let cancelled = false;
    void readAccountSnapshot<RestTimerState | null>(owner, `rest:${id}`).then(saved => {
      if (cancelled || saved === null || restAnchor.current !== null) return;
      const left = remainingRest(saved, Date.now());
      if (left <= 0) return;
      restAnchor.current = saved;
      setRest(left);
      setRestPaused(saved.paused === true);
    }).catch(() => setNotice(text(locale, 'error')));
    return () => { cancelled = true; };
  }, [id, owner, locale]);

  async function runAction(action: () => Promise<void>) {
    if (actionInFlight.current) return;
    const actionStarted = performance.now();
    actionInFlight.current = true; setBusy(true);
    try { await action(); }
    catch (error) { setNotice(error instanceof ApiClientError ? messageFor(error.code, locale, text(locale, 'error')) : text(locale, 'error')); }
    finally { actionInFlight.current = false; setBusy(false); perfMark('workout.action', 'input lock', performance.now() - actionStarted); }
  }

  async function start() {
    if (typeof id !== 'string') return;
    await runAction(async () => {
    await apiRequest(`/v1/training/sessions/${id}/start`, { method: 'POST', body: { at: new Date().toISOString() } });
    await client.invalidateQueries({ queryKey: ['session', id] });
    await client.invalidateQueries({ queryKey: ['home'] });
    });
  }

  async function pause() {
    if (typeof id !== 'string') return;
    await runAction(async () => {
    await apiRequest(`/v1/training/sessions/${id}/pause`, { method: 'POST', body: { at: new Date().toISOString() } });
    await client.invalidateQueries({ queryKey: ['session', id] });
    });
  }

  async function resume() {
    if (typeof id !== 'string') return;
    await runAction(async () => {
    await apiRequest(`/v1/training/sessions/${id}/resume`, { method: 'POST', body: { at: new Date().toISOString() } });
    await client.invalidateQueries({ queryKey: ['session', id] });
    });
  }

  async function complete() {
    if (typeof id !== 'string') return;
    await runAction(async () => {
    if (!(await flushPending())) {
      setNotice(isAr ? 'لم تُحفظ كل المجموعات بعد. اتصل بالإنترنت وأعد المحاولة قبل إنهاء التمرين.' : 'Some sets are still unsaved. Reconnect and retry before finishing.');
      return;
    }
    const finished = await finishWithReconciliation(
      () => apiRequest<{ session: WorkoutSession }>(`/v1/training/sessions/${id}/complete`, { method: 'POST', body: { at: completionTimestamp(session.data!.session, Date.now()) } }),
      () => apiRequest<{ session: WorkoutSession }>(`/v1/training/sessions/${id}`),
    );
    if (accountScope() !== owner) return;
    client.setQueryData(['session', id, owner], finished);
    skipRest(); setNotice('');
    // The POST is authoritative. Refreshing the same session and three dashboards must not hold the finish action.
    void writeAccountSnapshot(owner!, 'resource:/v1/training/sessions/' + id, finished).catch(() => {
      if (accountScope() === owner) setNotice(isAr ? 'حُفظت الجلسة على الخادم، وتعذر تحديث نسختها المحلية.' : 'Workout saved on the server; its local copy could not be updated.');
    });
    refreshWorkoutDependents(key => client.invalidateQueries({ queryKey: [key] }));
    });
  }

  async function keepLocalEdit(command: PendingSetCommand) {
    if (!owner || accountScope() !== owner) return;
    try {
      const fresh = await apiRequest<{ session: WorkoutSession }>(`/v1/training/sessions/${id}`);
      const baseSet = fresh.session.sets.find(set => set.id === command.set.id);
      if (fresh.session.status !== 'in_progress' || !baseSet || baseSet.exerciseId !== command.set.exerciseId || baseSet.setIndex !== command.set.setIndex) { setNotice(text(locale, 'conflict')); return; }
      await replaceConflictingSet(owner, command, { ...command, clientEventId: Crypto.randomUUID(), kind: 'replace', baseSet });
      await flushPending();
    } catch { setNotice(text(locale, 'error')); }
  }

  async function recordCommand(command: PendingSetCommand): Promise<void> {
    if (owner === null || accountScope() !== owner || session.data === undefined) throw new Error('OFFLINE_ACCOUNT_UNVERIFIED');
    const savedAt = performance.now();
    await saveDurableSet(command, {
      persist: () => enqueuePendingSet(owner, command),
      isCurrentAccount: () => accountScope() === owner,
      current: () => client.getQueryData<{ session: WorkoutSession }>(['session', id, owner])?.session ?? session.data!.session,
      publish: projected => {
        client.setQueryData(['session', id, owner], { session: projected });
        setInputDirty(false); setNotice(text(locale, 'queued'));
        perfMark('set.phase', 'durable save + feedback', performance.now() - savedAt);
      },
      clearDraft: () => inputRecovery.clear(),
      synchronize: async () => { const saved = await flushPending(); if (accountScope() === owner && saved) setNotice(''); },
      backgroundError: () => { if (accountScope() === owner) setNotice(text(locale, 'queued')); },
    });
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
    let loadGrams = 0;
    try { loadGrams = bodyweight || loadKg.trim().length === 0 ? 0 : parseScaledInteger(loadKg, 1000); }
    catch { setNotice(isAr ? 'أدخل وزنًا صالحًا بحد أقصى ٣ منازل عشرية.' : 'Enter a valid weight with at most 3 decimal places.'); return; }
    if (editingSetId !== null) {
      const existing = editingBase ?? session.data.session.sets.find((set) => set.id === editingSetId);
      if (existing === undefined || existing.exerciseId !== exerciseId) {
        setNotice(text(locale, 'error'));
        setEditingSetId(null);
        return;
      }
      const replaceCommand: PendingSetCommand = {
        clientEventId: Crypto.randomUUID(),
        sessionId: id,
        kind: 'replace',
        baseSet: existing,
        set: {
          id: editingSetId,
          exerciseId: existing.exerciseId,
          setIndex: existing.setIndex,
          reps: setReps,
          loadGrams,
          rpeTenths: existing.rpeTenths,
          completedAt: new Date().toISOString(),
        },
      };
      await runAction(async () => { await recordCommand(replaceCommand); setEditingSetId(null); tapSuccess(reduce); });
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
    await runAction(async () => {
      await recordCommand(command); tapSuccess(reduce);
      if (planned.prescription.kind === 'strength') startRest(planned.prescription.restSeconds);
    });
  }


  if (owner === null) return <Screen><ErrorState body={isAr ? 'سجّل الدخول مجددًا لتأكيد الحساب قبل استخدام التخزين المحلي.' : 'Sign in again to verify this account before using local storage.'} onRetry={() => router.push('/(auth)/login')} /></Screen>;
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

  const nextExercise = current.plannedExercises[activeIndex + 1];
  const activeTargetMet = editingSetId === null && active?.prescription.kind === 'strength' && loggedForActive.length >= plannedSets;
  const footer =
    isScheduled ? (
      <Button testID="workout-start" label={busy ? (isAr ? 'جارٍ البدء…' : 'Starting…') : text(locale, 'start')} disabled={busy} onPress={() => void start()} />
    ) : isPaused ? (
      <Button label={text(locale, 'resume')} disabled={busy} onPress={() => void resume()} />
    ) : isRunning && activeTargetMet && editingSetId === null ? (
      <Button testID={nextExercise ? 'workout-next' : 'workout-finish'} label={nextExercise ? (isAr ? 'التمرين التالي' : 'Next exercise') : text(locale, 'finish')} onPress={() => { if (nextExercise) { skipRest(); setActiveExerciseId(nextExercise.exerciseId); } else { Alert.alert(text(locale, 'finishWorkoutTitle'), text(locale, 'finishWorkoutBody'), [{ text: text(locale, 'stayWorkout'), style: 'cancel' }, { text: text(locale, 'finish'), onPress: () => void complete() }]); } }} />
    ) : isRunning && active !== undefined ? (
      <Button
        testID="workout-log-set"
        disabled={busy}
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
          title={isRunning || isPaused ? (isAr ? 'التمرين الحالي' : 'Current exercise') : current.name}
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

        {(isScheduled || isDone) ? (<YazanCard
          compact
          body={yazanTip(locale, {
            surface: 'workout',
            status: current.status,
            exerciseName: active === undefined ? current.name : exerciseName(active.exerciseId),
            setCount: isDone ? completedSets : loggedForActive.length,
          })}
          actions={[
            {
              label: text(locale, 'explainWorkout'),
              onPress: () =>
                openYazanWithPrompt(
                  isAr
                    ? `اشرح لي جلسة ${current.name} ولماذا هذه التمارين بهذا الترتيب`
                    : `Explain the ${current.name} session and why these exercises are in this order`,
                ),
            },
            ...(active !== undefined
              ? [
                  {
                    label: text(locale, 'whyThisExercise'),
                    onPress: () =>
                      openYazanWithPrompt(
                        isAr
                          ? `لماذا تمرين ${exerciseName(active.exerciseId)}؟ وما العضلات المستهدفة ونصائح الفورم؟`
                          : `Why ${exerciseName(active.exerciseId)}? What muscles does it target and what form cues matter?`,
                      ),
                  },
                  {
                    label: text(locale, 'replaceExercise'),
                    onPress: () => router.push('/programs'),
                  },
                ]
              : []),
          ]}
        />) : null}

        {isScheduled ? <Text style={{ color: theme.textMuted, lineHeight: 22, marginBottom: 12 }}>{isAr ? 'راجع ترتيب التمارين، ثم ابدأ. يمكنك تعديل الوزن والتكرارات وتسجيل كل مجموعة أثناء الجلسة.' : 'Review your exercises, then start. Adjust weight and reps and record each set during the session.'}</Text> : null}
        {(isScheduled || isDone) ? (
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
        ) : null}

        {rest > 0 && isRunning ? (
          <SurfaceCard style={{ marginBottom: spacing[3], borderColor: theme.accent, borderWidth: 1 }}>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium }}>{text(locale, 'restTimer')}</Text>
            <RestCountdown readState={() => restAnchor.current} paused={restPaused} secondsAtChange={rest} onExpire={() => { setRest(0); restAnchor.current = null; }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button variant="secondary" label={isAr ? '+١٥ ثانية' : '+15 seconds'} onPress={() => adjustRest(15)} />
              <Pressable
                accessibilityRole="button"
                testID="workout-pause-rest"
                onPress={toggleRest}
                style={{ flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
                  {restPaused ? text(locale, 'resumeRest') : text(locale, 'pauseRest')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="workout-skip-rest"
                onPress={skipRest}
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
                accessibilityLabel={isAr ? 'التمرين السابق' : 'Previous exercise'}
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
                accessibilityLabel={isAr ? 'التمرين التالي' : 'Next exercise'}
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
            <Text style={{ color: theme.textMuted, marginBottom: 10 }}>
              {isAr ? 'المجموعة' : 'Set'} {Math.min(loggedForActive.length + 1, plannedSets)} / {plannedSets} · {targetReps} {text(locale, 'reps')}
            </Text>


            <ExercisePreview key={active.exerciseId} exerciseId={active.exerciseId} asset={demo?.approvedDemonstration} instructions={isAr ? demo?.instructions_ar : demo?.instructions_en} reviewed={demo?.reviewStatus==='reviewed'} />
            {previous !== undefined ? (
              <Text style={{ color: theme.textMuted, marginBottom: 10 }}>
                {text(locale, 'previousBest')}:{' '}
                {previous.load_grams > 0
                  ? `${formatKg(previous.load_grams, locale)} × ${formatCount(previous.reps, locale)}`
                  : `${formatCount(previous.reps, locale)} ${text(locale, 'reps')}`}
              </Text>
            ) : null}

            {isRunning && editingSetId === null ? <SetInputs reps={reps} load={load} weighted={active.prescription.kind === 'strength'} onReps={value => { setReps(value); setInputDirty(true); }} onLoad={value => { setLoad(value); setInputDirty(true); }} /> : null}
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
                  <View key={`set-row-${index}`}>
                  <Pressable
                    accessibilityRole={logged ? 'button' : undefined}
                    accessibilityLabel={logged ? text(locale, 'editLoggedSet') + ' ' + (index + 1) : undefined}
                    accessibilityState={{ expanded: isEditing, disabled: !logged || !isRunning }}
                    disabled={!logged || !isRunning}
                    onPress={() => {
                      if (logged === undefined || !isRunning) return;
                      setEditingSetId(logged.id);
                      setEditingBase(logged);
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
                  {isEditing ? <><SetInputs reps={reps} load={load} weighted={active.prescription.kind === 'strength'} onReps={value => { setReps(value); setInputDirty(true); }} onLoad={value => { setLoad(value); setInputDirty(true); }} /><Button variant="secondary" label={isAr ? 'إلغاء التعديل' : 'Cancel edit'} onPress={() => { setEditingSetId(null); setEditingBase(null); setNotice(''); }} /></> : null}
                  </View>
                );
              })}
            </SurfaceCard>


            <Button variant="secondary" label={isAr ? 'اسأل يزن عن هذا التمرين' : 'Ask Yazan about this exercise'} onPress={() => openYazanWithPrompt(isAr ? `كيف أنفّذ تمرين ${exerciseName(active.exerciseId)}؟ سجلت ${loggedForActive.length} مجموعات.` : `How do I perform ${exerciseName(active.exerciseId)}? I have logged ${loggedForActive.length} sets.`)} />
            <Text style={{ color: theme.textMuted, marginVertical: 12 }}>{demo?.demonstrationMedia?.reviewStatus === 'reviewed' ? text(locale, 'techniqueHint') : (isAr ? 'العرض الحركي غير متاح حاليًا. راجع تعليمات التمرين أو اطلب مساعدة مدرب.' : 'Movement demonstration is unavailable. Check exercise instructions or ask a coach.')}</Text>
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
            <Text style={{ color: theme.accent, marginBottom: 8 }}>{isAr ? 'أحسنت، تم حفظ جلستك' : 'Well done, your session is saved'} · {formatRest(workoutElapsedSeconds(current, current.completedAt!))}</Text>
            <Text style={{ color: theme.textMuted, lineHeight: 22 }}>
              {isAr
                ? `${completedSets} مجموعات · ${new Set(current.sets.map(set => set.exerciseId)).size} تمارين مسجّلة${volumeGrams > 0 ? ` · حجم ${formatKg(volumeGrams, locale)}` : ''}`
                : `${completedSets} sets · ${new Set(current.sets.map(set => set.exerciseId)).size} exercises logged${volumeGrams > 0 ? ` · volume ${formatKg(volumeGrams, locale)}` : ''}`}
            </Text>
          </SurfaceCard>
        ) : null}

        {isDone ? <SurfaceCard style={{marginBottom:12}}>
          <Text style={{color:theme.accent,fontFamily:fontFamily.semibold}}>{isAr?'التقدّم مقارنة بما قبل الجلسة':'Progress against your pre-workout best'}</Text>
          {results.isPending?<Text style={{color:theme.textMuted}}>{isAr?'نراجع سجلك…':'Checking your history…'}</Text>:null}
          {results.isError?<Text style={{color:theme.textMuted}}>{isAr?'جلستك محفوظة. مقارنة الأرقام غير متاحة الآن.':'Your workout is saved. Record comparisons are unavailable right now.'}</Text>:null}
          {results.data?.improvements.map(record=><Text key={record.exerciseId} style={{color:theme.text,lineHeight:24}}>{exerciseName(record.exerciseId)} · {formatKg(record.previous.loadGrams,locale)} × {record.previous.reps} → {formatKg(record.loadGrams,locale)} × {record.reps}</Text>)}
          {results.data?.firstRecorded.map(record=><Text key={record.exerciseId} style={{color:theme.textMuted,lineHeight:24}}>{exerciseName(record.exerciseId)} · {isAr?'خط أساس جديد':'First recorded baseline'} · {formatKg(record.loadGrams,locale)} × {record.reps}</Text>)}
          {results.data&&results.data.improvements.length===0&&results.data.firstRecorded.length===0?<Text style={{color:theme.textMuted}}>{isAr?'تم تسجيل عملك اليوم. لا توجد زيادة على أفضل أرقامك السابقة.':'Today’s work is recorded. No increase over your prior best.'}</Text>:null}
          <Button variant="secondary" label={isAr?'العودة إلى سجل التمارين':'Back to workout history'} onPress={()=>router.replace('/(tabs)/training')} />
        </SurfaceCard>:null}

        {conflicts.length > 0 ? <SurfaceCard>
          <Text style={{ color: theme.text }}>{isAr ? 'تعارض في المزامنة. السجلات المحلية محفوظة. أعد المحاولة أو اعتمد سجل الخادم.' : 'Sync conflict. Local records are retained. Retry or keep the server records.'}</Text>
          {conflicts.filter((command, index, all) => all.findLastIndex(item => item.set.id === command.set.id) === index).map(command => <View key={command.clientEventId}><Text style={{ color: theme.textMuted }}>{isAr ? 'مجموعة محلية' : 'Local set'} {command.set.setIndex}: {command.set.reps} × {command.set.loadGrams / 1000} kg</Text>
            <Button label={isAr ? 'اعتماد تعديلي المحلي' : 'Keep my edit'} variant="secondary" onPress={() => Alert.alert(isAr ? 'اعتماد التعديل؟' : 'Keep this edit?', isAr ? 'سيستبدل القيم الحالية إذا كان التمرين قابلاً للتحرير.' : 'Replace the current values if this workout is still editable.', [
              { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' }, { text: isAr ? 'تأكيد' : 'Confirm', onPress: () => void keepLocalEdit(command) },
            ])} /></View>)} 
          <Button label={isAr ? 'إعادة المحاولة' : 'Retry'} onPress={() => void flushPending()} />
          <Button label={isAr ? 'اعتماد سجل الخادم' : 'Keep server records'} variant="secondary" onPress={() => Alert.alert(isAr ? 'تجاهل التغييرات المتعارضة؟' : 'Discard conflicting local changes?', isAr ? 'لن تتغير مجموعات الخادم.' : 'Server sets will remain unchanged.', [
            { text: isAr ? 'متابعة التحرير' : 'Continue editing', style: 'cancel' },
            { text: isAr ? 'تجاهل المحلي' : 'Discard local', style: 'destructive', onPress: () => { void (async () => {
              if (accountScope() !== owner) return;
              const pending = await readPendingSets(owner); const setIds = new Set(conflicts.map(command => command.set.id));
              await acknowledgePendingSets(owner, pending, pending.filter(command => command.sessionId !== id || !setIds.has(command.set.id)));
              setConflicts([]); await client.invalidateQueries({ queryKey: ['session', id] });
            })().catch(() => setNotice(text(locale, 'error'))); } },
          ])} />
        </SurfaceCard> : null}
        {notice ? (
          <Text accessibilityRole="alert" style={{ color: theme.warning, fontFamily: fontFamily.medium, marginBottom: 12 }}>
            {notice}
          </Text>
        ) : null}

        {isRunning ? <Button label={text(locale, 'pause')} disabled={busy} variant="secondary" onPress={() => void pause()} /> : null}
        {(isRunning || isPaused) ? (
          <Button
            disabled={busy}
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
