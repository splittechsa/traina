import { useFormRecovery } from '../src/storage/useFormRecovery';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { formatCount } from '../src/format';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, radius, spacing, typeScale } from '../src/theme/tokens';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, BottomSheet, EmptyState, LoadingSkeleton, SectionLabel } from '../src/ui/kit';
import { GlowCard, GradientRing, StatChip } from '../src/ui/visual';
import { NumberWheel } from '../src/ui/pickers/NumberWheel';
import { useSteps } from '../src/activity/useSteps';
import { averageSteps, DEFAULT_STEP_GOAL, estimateDistanceKm, goalProgress, goalStreak, lastDays, STEP_GOAL_RANGE } from '../src/activity/steps';
import { LOCAL_KEYS, useLocalValue } from '../src/storage/local';
import { tapSuccess } from '../src/ui/haptics';
import { useMotion } from '../src/theme/motion';

function weekdayLabel(date: Date, locale: 'ar' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { weekday: 'short' }).format(date);
}

export default function ActivityScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const { reduce } = useMotion();
  const { state, refresh } = useSteps(7);
  const goal = useLocalValue<number>(LOCAL_KEYS.stepGoal, DEFAULT_STEP_GOAL);
  const [editingGoal, setEditingGoal] = useState(false);
  const [draftGoal, setDraftGoal] = useState(DEFAULT_STEP_GOAL);
  const ar = locale === 'ar';

  const recovery = useFormRecovery('step-goal', { draftGoal }, draft => { setDraftGoal(draft.draftGoal); setEditingGoal(true); }, editingGoal && draftGoal !== goal.value, goal.ready);
  const header = (
    <AppHeader
      title={ar ? 'الخطوات والنشاط' : 'Steps & activity'}
      subtitle={ar ? 'من مستشعر الحركة في جوالك' : "From your phone's motion sensor"}
      trailing={
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{text(locale, 'back')}</Text>
        </Pressable>
      }
    />
  );

  if (state.status === 'loading') {
    return (
      <Screen>
        <ScreenBody>
          {header}
          <LoadingSkeleton />
        </ScreenBody>
      </Screen>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <Screen>
        <ScreenBody>
          {header}
          <EmptyState
            title={ar ? 'عدّاد الخطوات غير متاح' : 'Step counting unavailable'}
            body={ar ? 'هذا الجهاز لا يوفّر بيانات الخطوات (مثلاً في المحاكي).' : "This device doesn't provide step data (for example, a simulator)."}
          />
        </ScreenBody>
      </Screen>
    );
  }

  if (state.status === 'denied') {
    return (
      <Screen>
        <ScreenBody>
          {header}
          <EmptyState
            title={ar ? 'نحتاج إذن الحركة واللياقة' : 'Motion & Fitness access needed'}
            body={
              ar
                ? 'فعّل "الحركة واللياقة" لترينا من الإعدادات لنعرض خطواتك الحقيقية. لا نرسل خطواتك لأي جهة.'
                : 'Turn on Motion & Fitness for traina in Settings to show your real steps. Steps stay on your phone.'
            }
          />
          <Button label={ar ? 'فتح الإعدادات' : 'Open Settings'} onPress={() => void Linking.openSettings()} />
          <View style={{ height: spacing[3] }} />
          <Button label={ar ? 'إعادة المحاولة' : 'Try again'} variant="secondary" onPress={() => void refresh()} />
        </ScreenBody>
      </Screen>
    );
  }

  const target = goal.value;
  const progress = goalProgress(state.today, target);
  const remaining = Math.max(0, target - state.today);
  const days = lastDays(new Date(), state.week.length);
  const peak = Math.max(target, ...state.week);
  const streak = goalStreak(state.week, target);

  return (
    <Screen>
      <ScreenBody>
        {header}
        <GlowCard>
          <View style={{ alignItems: 'center', gap: spacing[4] }}>
            <GradientRing
              progress={progress}
              from={theme.heroAccent}
              to={theme.ember}
              track="rgba(255,255,255,0.08)"
              accessibilityLabel={ar ? `${state.today} خطوة من ${target}` : `${state.today} of ${target} steps`}
            >
              <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 46, lineHeight: 54, fontVariant: ['tabular-nums'] }}>
                {formatCount(state.today, locale)}
              </Text>
              <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium, fontSize: typeScale.label }}>
                {ar ? 'خطوة اليوم' : 'steps today'}
              </Text>
            </GradientRing>
            <Text style={{ color: theme.heroText, fontFamily: fontFamily.semibold, fontSize: typeScale.body, textAlign: 'center' }}>
              {progress >= 1
                ? ar
                  ? 'حققت هدفك اليوم'
                  : 'Goal reached today'
                : ar
                  ? `باقي ${formatCount(remaining, locale)} خطوة على هدفك`
                  : `${formatCount(remaining, locale)} steps to your goal`}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[2], alignSelf: 'stretch' }}>
              <StatChip inverse label={ar ? 'كم (تقديري)' : 'km (est.)'} value={formatCount(estimateDistanceKm(state.today), locale)} />
              <StatChip inverse label={ar ? 'متوسط ٧ أيام' : '7-day avg'} value={formatCount(averageSteps(state.week), locale)} />
              <StatChip inverse label={ar ? 'أيام متتالية' : 'Day streak'} value={formatCount(streak, locale)} />
            </View>
          </View>
        </GlowCard>

        <SectionLabel>{ar ? 'آخر ٧ أيام' : 'Last 7 days'}</SectionLabel>
        <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg, padding: spacing[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: spacing[2] }}>
            {state.week.map((value, index) => {
              const met = value >= target;
              const isToday = index === state.week.length - 1;
              const day = days[index];
              return (
                <View key={day?.start.toISOString() ?? index} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <View
                      style={{
                        width: '72%',
                        height: `${Math.max(4, Math.round((value / peak) * 100))}%`,
                        borderRadius: 8,
                        backgroundColor: met ? theme.accent : isToday ? theme.ember : theme.surfaceMuted,
                      }}
                    />
                  </View>
                  <Text style={{ color: isToday ? theme.text : theme.textMuted, fontFamily: isToday ? fontFamily.bold : fontFamily.medium, fontSize: typeScale.micro }}>
                    {day !== undefined ? weekdayLabel(day.start, locale) : ''}
                  </Text>
                </View>
              );
            })}
          </View>
          {!state.historySupported ? (
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, marginTop: spacing[3] }}>
              {ar ? 'السجل اليومي متاح على آيفون فقط؛ هنا نعدّ خطوات هذه الجلسة.' : 'Daily history is iPhone-only; this device counts steps for this session.'}
            </Text>
          ) : null}
        </View>

        <SectionLabel>{ar ? 'هدفك اليومي' : 'Daily goal'}</SectionLabel>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setDraftGoal(target);
            setEditingGoal(true);
          }}
          style={{ backgroundColor: theme.surface, borderRadius: radius.lg, padding: spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.title, fontVariant: ['tabular-nums'] }}>
            {formatCount(target, locale)} <Text style={{ color: theme.textMuted, fontSize: typeScale.body, fontFamily: fontFamily.medium }}>{ar ? 'خطوة' : 'steps'}</Text>
          </Text>
          <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{ar ? 'تعديل' : 'Edit'}</Text>
        </Pressable>
        <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, marginTop: spacing[3], lineHeight: 20 }}>
          {ar
            ? 'الخطوات من معالج الحركة في جوالك وتُحدَّث مباشرة. المسافة تقدير من متوسط طول الخطوة.'
            : 'Steps come from your phone’s motion coprocessor and update live. Distance is estimated from an average stride.'}
        </Text>
      </ScreenBody>

      <BottomSheet visible={editingGoal} onClose={() => setEditingGoal(false)}>
        <View style={{ gap: spacing[4], paddingBottom: spacing[3] }}>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.headline, textAlign: 'center' }}>{ar ? 'هدف الخطوات اليومي' : 'Daily step goal'}</Text>
          <NumberWheel
            value={draftGoal}
            onChange={setDraftGoal}
            min={STEP_GOAL_RANGE.min}
            max={STEP_GOAL_RANGE.max}
            step={STEP_GOAL_RANGE.step}
            locale={locale}
            suffix={ar ? 'خطوة' : 'steps'}
            accessibilityLabel={ar ? 'هدف الخطوات' : 'Step goal'}
          />
          <Button
            label={text(locale, 'save')}
            onPress={() => {
              void goal.save(draftGoal).then(() => recovery.clear());
              tapSuccess(reduce);
              setEditingGoal(false);
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
