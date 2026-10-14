import { useEffect, useState } from 'react';
import { Pressable, Text, View, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import type { WorkoutSession } from '@sahhti/domain';
import { parseScaledInteger } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { formatCount, formatKg } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, ErrorState, ListRow, LoadingSkeleton } from '../../src/ui/kit';
import { fontFamily, radius, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useMotion } from '../../src/theme/motion';
import { tapSuccess } from '../../src/ui/haptics';
import { planOfflineSync, type PendingSetCommand } from '../../src/offline/queue';
import { readPendingSets, writePendingSets } from '../../src/offline/sqlite';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useLocale();
  const { reduce } = useMotion();
  const client = useQueryClient();
  const theme = useTheme();
  const [reps, setReps] = useState('8');
  const [load, setLoad] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [rest, setRest] = useState(0);
  const [activeExerciseId, setActiveExerciseId] = useState('');
  const session = useQuery({
    queryKey: ['session', id],
    enabled: typeof id === 'string',
    queryFn: () => apiRequest<{ session: WorkoutSession }>(`/v1/training/sessions/${id}`),
  });

  useEffect(() => {
    if (rest <= 0) {
      return;
    }
    const timer = setInterval(() => setRest((current) => (current <= 1 ? 0 : current - 1)), 1000);
    return () => clearInterval(timer);
  }, [rest]);

  async function start() {
    if (typeof id !== 'string') return;
    await apiRequest(`/v1/training/sessions/${id}/start`, { method: 'POST', body: { at: new Date().toISOString() } });
    await client.invalidateQueries({ queryKey: ['session', id] });
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

  async function logSet() {
    if (typeof id !== 'string' || session.data === undefined || busy) return;
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
    const command: PendingSetCommand = {
      clientEventId: Crypto.randomUUID(),
      sessionId: id,
      set: {
        id: Crypto.randomUUID(),
        exerciseId: planned.exerciseId,
        setIndex: session.data.session.sets.length + 1,
        reps: Number(reps),
        loadGrams: bodyweight || load.trim().length === 0 ? 0 : parseScaledInteger(load, 1000),
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
        setRest(planned.prescription.restSeconds);
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

  async function sync() {
    if (typeof id !== 'string' || session.data === undefined) return;
    const pending = await readPendingSets();
    const mine = pending.filter((command) => command.sessionId === id);
    const others = pending.filter((command) => command.sessionId !== id);
    const plan = planOfflineSync(session.data.session, mine);
    const remaining = [...others];
    if (plan.conflicts.length > 0) {
      setNotice(text(locale, 'conflict'));
    }
    for (const command of plan.send) {
      try {
        await apiRequest(`/v1/training/sessions/${command.sessionId}/sets`, { method: 'POST', body: command.set });
      } catch (caught) {
        if (caught instanceof ApiClientError && caught.status === 409) {
          setNotice(text(locale, 'conflict'));
          continue;
        }
        remaining.push(command);
      }
    }
    await writePendingSets(remaining);
    await client.invalidateQueries({ queryKey: ['session', id] });
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
  const active =
    current.plannedExercises.find((item) => item.exerciseId === activeExerciseId) ?? current.plannedExercises[0];
  const primary =
    current.status === 'scheduled'
      ? { label: text(locale, 'start'), onPress: () => void start() }
      : current.status === 'paused'
        ? { label: text(locale, 'resume'), onPress: () => void resume() }
        : current.status === 'in_progress'
          ? { label: text(locale, 'logSet'), onPress: () => void logSet() }
          : null;
  const isAr = locale === 'ar';
  const completedSets = current.sets.length;
  const totalExercises = current.plannedExercises.length;
  const isRunning = current.status === 'in_progress';
  const isDone = current.status === 'completed';
  const tile = { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 14 } as const;
  const titleStyle = { color: theme.text, fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 30 } as const;
  const mutedStyle = { color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 22 } as const;
  const activeIndex = Math.max(0, current.plannedExercises.findIndex((item) => item.exerciseId === (activeExerciseId || current.plannedExercises[0]?.exerciseId)));
  return (
    <Screen>
      <ScreenBody footer={primary === null ? undefined : (
        <View style={{ paddingHorizontal: 18, paddingTop: 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Button label={busy ? (isAr ? 'جارٍ حفظ المجموعة…' : 'Saving set…') : primary.label} onPress={() => { if (!busy) primary.onPress(); }} />
        </View>
      )}>
        <View style={{ paddingHorizontal: 18, paddingTop: 10 }}>
          <AppHeader title={current.name} subtitle={label(locale, 'session', current.status)} />
          <View style={{ backgroundColor: theme.hero, borderRadius: 26, padding: 22, marginTop: 10, marginBottom: 16 }}>
            <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: 12, letterSpacing: 1 }}>SAHHTI  /  SESSION</Text>
            <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 27, lineHeight: 39, marginTop: 8 }}>{isDone ? (isAr ? 'إنجاز يُحسب لك' : 'Session complete') : isRunning ? (isAr ? 'كل مجموعة تقرّبك' : 'One set at a time') : (isAr ? 'جاهز تبدأ؟' : 'Ready to train?')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              {[{ n: String(totalExercises), label: isAr ? 'تمارين' : 'Exercises' }, { n: String(completedSets), label: isAr ? 'مجموعات مسجلة' : 'Logged sets' }].map((stat) => (
                <View key={stat.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.09)', padding: 14, borderRadius: 16 }}>
                  <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 26 }}>{stat.n}</Text>
                  <Text style={{ color: theme.heroText, opacity: 0.78, fontFamily: fontFamily.medium, fontSize: 12 }}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
          {rest > 0 && isRunning ? (
            <View style={{ ...tile, borderColor: theme.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View><Text style={mutedStyle}>{isAr ? 'استراحة بين المجموعات' : 'Rest between sets'}</Text><Text style={{ ...titleStyle, color: theme.accent, fontSize: 32 }}>{`${Math.floor(rest / 60).toString().padStart(2, '0')}:${(rest % 60).toString().padStart(2, '0')}`}</Text></View>
              <Pressable accessibilityRole="button" onPress={() => setRest(0)} style={{ padding: 12, backgroundColor: theme.surfaceMuted, borderRadius: 14 }}><Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{isAr ? 'تخطي' : 'Skip'}</Text></Pressable>
            </View>
          ) : null}
          <Text style={{ ...titleStyle, marginBottom: 12 }}>{isAr ? 'خطة الجلسة' : 'Session plan'}</Text>
          {current.plannedExercises.map((planned, index) => {
            const selected = index === activeIndex;
            const logged = current.sets.filter((set) => set.exerciseId === planned.exerciseId).length;
            const prescription = planned.prescription;
            const detail = prescription.kind === 'strength' ? `${prescription.sets} × ${prescription.reps}` : prescription.kind === 'crossfit' ? prescription.format : prescription.progression;
            return (
              <Pressable key={planned.exerciseId} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setActiveExerciseId(planned.exerciseId); setNotice(''); }} style={{ ...tile, borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.surfaceMuted : theme.surface, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ height: 42, width: 42, borderRadius: 14, backgroundColor: selected ? theme.accent : theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: selected ? theme.emphasisText : theme.text, fontFamily: fontFamily.bold }}>{String(index + 1).padStart(2, '0')}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 15 }}>{isAr ? `التمرين ${index + 1}` : `Exercise ${index + 1}`}</Text><Text style={mutedStyle}>{detail} · {isAr ? `${logged} مجموعات مسجلة` : `${logged} sets logged`}</Text></View>
                <Text style={{ color: selected ? theme.accent : theme.textMuted, fontSize: 18 }}>{selected ? '●' : '○'}</Text>
              </Pressable>
            );
          })}
          {isRunning && active !== undefined ? (
            <View style={{ ...tile, marginTop: 4 }}>
              <Text style={{ ...mutedStyle, color: theme.accent }}>{isAr ? `تسجيل التمرين ${activeIndex + 1}` : `LOG EXERCISE ${activeIndex + 1}`}</Text>
              <Text style={{ ...titleStyle, marginTop: 6, marginBottom: 16 }}>{isAr ? 'سجّل مجموعتك' : 'Log your set'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['5', '8', '10', '12'].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: reps === value }} onPress={() => setReps(value)} style={{ flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: reps === value ? theme.accent : theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: reps === value ? theme.emphasisText : theme.text, fontFamily: fontFamily.bold }}>{value}</Text></Pressable>)}
              </View>
              <Field label={active.prescription.kind === 'crossfit' ? text(locale, 'rounds') : active.prescription.kind === 'calisthenics' && active.prescription.holdSeconds !== null ? text(locale, 'hold') : text(locale, 'reps')} value={reps} onChangeText={setReps} keyboardType="number-pad" />
              {active.prescription.kind === 'strength' ? <Field label={`${text(locale, 'load')} (${text(locale, 'kilograms')})`} value={load} onChangeText={setLoad} keyboardType="decimal-pad" /> : null}
            </View>
          ) : null}
          {current.sets.length > 0 ? <Text style={{ ...titleStyle, marginTop: 10, marginBottom: 12 }}>{isAr ? 'سجل المجموعات' : 'Logged sets'}</Text> : null}
          {current.sets.slice().reverse().map((set) => <View key={set.id} style={{ ...tile, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}><Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{set.loadGrams === 0 ? formatCount(set.reps, locale) : `${formatCount(set.reps, locale)} × ${formatKg(set.loadGrams, locale)}`}</Text><Text style={mutedStyle}>{text(locale, 'sets')} {formatCount(set.setIndex, locale)} ✓</Text></View>)}
          {notice ? <Text accessibilityRole="alert" style={{ color: theme.warning, fontFamily: fontFamily.medium, marginBottom: 14 }}>{notice}</Text> : null}
          {isRunning ? <Button label={text(locale, 'pause')} variant="secondary" onPress={() => void pause()} /> : null}
          {(isRunning || current.status === 'paused') ? <Button label={text(locale, 'finish')} variant="secondary" onPress={() => Alert.alert(isAr ? 'إنهاء التمرين؟' : 'Finish workout?', isAr ? 'سيتم حفظ الجلسة والمجموعات المسجلة.' : 'Your session and logged sets will be saved.', [{ text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' }, { text: isAr ? 'إنهاء' : 'Finish', onPress: () => void complete() }])} /> : null}
          <Button label={text(locale, 'sync')} variant="secondary" onPress={() => void sync()} />
          <View style={{ height: 22 }} />
        </View>
      </ScreenBody>
    </Screen>
  );
}
