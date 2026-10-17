import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_WATER_GOAL_ML, coachingDirectives, type CoachingDirective } from '@sahhti/domain';
import { apiRequest } from '../api/client';
import { formatCount, riyadhToday } from '../format';
import { useLocale } from '../i18n/LocaleProvider';
import { text } from '../i18n/copy';
import { LOCAL_KEYS, useLocalValue } from '../storage/local';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';

type WaterDay = { milliliters?: number };
type TodayStatus = 'none' | 'scheduled' | 'in_progress' | 'completed';

function hrefFor(directive: CoachingDirective): '/water' | '/(tabs)/nutrition' | '/(tabs)/training' | '/supplements' | '/macros' | null {
  if (directive.href === 'water') return '/water';
  if (directive.href === 'nutrition') return '/(tabs)/nutrition';
  if (directive.href === 'training') return '/(tabs)/training';
  if (directive.href === 'supplements') return '/supplements';
  if (directive.href === 'macros') return '/macros';
  return null;
}

function lineFor(
  directive: CoachingDirective,
  locale: 'ar' | 'en',
  values: { waterMl: number; waterGoalMl: number; sessionsCompleted: number; sessionsPlanned: number; waterDaysLoggedLast14: number | null },
): { title: string; body: string } {
  const ar = locale === 'ar';
  const water = `${formatCount(values.waterMl / 1000, locale)} / ${formatCount(values.waterGoalMl / 1000, locale)}`;
  switch (directive.key) {
    case 'water_low':
      return {
        title: ar ? 'ماء اليوم ناقص' : 'Water is behind',
        body: ar ? `سجّلت ${water} لتر. كمّل الشرب — ما نختلق صوديوم أو حرق.` : `Logged ${water} L. Keep drinking. We do not invent sodium or burn.`,
      };
    case 'water_streak_missed':
      return {
        title: ar ? 'موية آخر أسبوعين ضعيفة' : 'Water logging is weak',
        body: ar
          ? `سجّلت الموية ${formatCount(values.waterDaysLoggedLast14 ?? 0, locale)} يوم من ١٤. الجدول يتأثر — كمّل التسجيل عشان الذكاء يضبط الخطة.`
          : `Water logged ${formatCount(values.waterDaysLoggedLast14 ?? 0, locale)} of 14 days. The plan reacts — keep logging so AI can adjust.`,
      };
    case 'plan_needs_review':
      return {
        title: ar ? 'في اقتراح على جدولك' : 'Your plan needs a look',
        body: ar
          ? 'من وزنك وانضباطك آخر أسبوعين — راجع الاقتراح قبل ما يتأكد.'
          : 'From your weight and last two weeks of discipline — review before it is confirmed.',
      };
    case 'meals_empty':
      return {
        title: ar ? 'ما سجّلت وجبة' : 'No meal logged',
        body: ar ? 'التدريب الشخصي يتحرك من اللي دخلته، مو من تذكير فاضي.' : 'Personal training moves from what you logged, not an empty reminder.',
      };
    case 'sessions_behind':
      return {
        title: ar ? 'حصص الأسبوع ناقصة' : 'Sessions this week are behind',
        body: ar
          ? `${formatCount(values.sessionsCompleted, locale)} من ${formatCount(values.sessionsPlanned, locale)}. ابدأ جلسة عشان الوقت ينحفظ.`
          : `${formatCount(values.sessionsCompleted, locale)} of ${formatCount(values.sessionsPlanned, locale)}. Start a session so the time is saved.`,
      };
    case 'session_live':
      return {
        title: ar ? 'جلسة شغّالة' : 'Live session',
        body: ar ? 'أنهاء لما تخلّص. الوقت هو سجل التمرين.' : 'Finish when you are done. Elapsed time is the workout record.',
      };
    case 'supplement_due':
      return {
        title: ar ? `اليوم: ${directive.name ?? text(locale, 'supplements')}` : `Today: ${directive.name ?? text(locale, 'supplements')}`,
        body: ar ? 'هذا من قائمتك أنت. سجّله إذا أخذته — مو كتالوج مخترع.' : 'This is from your list. Log it if you took it — not an invented catalog.',
      };
    default:
      return {
        title: ar ? 'يومك متماسك' : 'Today is holding',
        body: ar ? 'اللي سجّلته يكفي عشان نحرّك الجدول من الحقيقة، مو من التخمين.' : 'What you logged is enough to move the plan from facts, not guesses.',
      };
  }
}

type SupplementDay = { items: { name: string; taken: boolean }[] };
type DisciplineResponse = {
  discipline?: { waterDaysLogged?: number; status?: string };
  alert?: boolean;
};

export function CoachingDesk({
  mealCount,
  sessionsCompleted,
  sessionsPlanned,
  todaySessionStatus,
}: {
  mealCount: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  todaySessionStatus: TodayStatus;
}) {
  const { locale } = useLocale();
  const theme = useTheme();
  const today = riyadhToday();
  const goal = useLocalValue<number>(LOCAL_KEYS.waterGoal, DEFAULT_WATER_GOAL_ML);
  const water = useQuery({
    queryKey: ['water', today],
    queryFn: () => apiRequest<WaterDay>(`/v1/water?on=${today}`),
  });
  const supplements = useQuery({
    queryKey: ['supplements', today],
    queryFn: () => apiRequest<SupplementDay>(`/v1/supplements?on=${today}`),
  });
  const discipline = useQuery({
    queryKey: ['nutrition-discipline'],
    queryFn: () => apiRequest<DisciplineResponse>('/v1/nutrition/discipline'),
  });
  const milliliters = typeof water.data?.milliliters === 'number' ? water.data.milliliters : 0;
  const waterDaysLoggedLast14 =
    typeof discipline.data?.discipline?.waterDaysLogged === 'number' ? discipline.data.discipline.waterDaysLogged : null;
  const items = supplements.data?.items ?? [];
  const directives = coachingDirectives({
    waterMl: milliliters,
    waterGoalMl: goal.value,
    mealCount,
    sessionsCompleted,
    sessionsPlanned,
    todaySessionStatus,
    supplementsDue: items.map((item) => item.name),
    supplementsLogged: items.filter((item) => item.taken).map((item) => item.name),
    waterDaysLoggedLast14,
    nutritionPlanAlert: discipline.data?.alert === true,
  });
  const values = {
    waterMl: milliliters,
    waterGoalMl: goal.value,
    sessionsCompleted,
    sessionsPlanned,
    waterDaysLoggedLast14,
  };

  return (
    <View style={{ marginBottom: spacing[4], gap: 8 }}>
      <Text style={{ color: theme.textMuted, fontFamily: fontFamily.semibold, fontSize: typeScale.micro, letterSpacing: 0.6 }}>
        {locale === 'ar' ? 'تدريب اليوم' : 'TODAY’S COACHING'}
      </Text>
      {directives.map((directive) => {
        const copy = lineFor(directive, locale, values);
        const href = hrefFor(directive);
        return (
          <Pressable
            key={`${directive.key}:${directive.name ?? ''}`}
            accessibilityRole="button"
            disabled={href === null}
            onPress={() => {
              if (href !== null) router.push(href);
            }}
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: directive.status === 'act' ? theme.accent : theme.border,
              borderRadius: radius.lg,
              padding: spacing[3],
              gap: 4,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.body }}>{copy.title}</Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 20 }}>
              {copy.body}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
