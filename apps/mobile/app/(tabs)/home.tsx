import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { HomeDashboard } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { profileIsComplete } from '../../src/auth/gate';
import { useSession } from '../../src/auth/SessionProvider';
import { formatCount, formatGramsFromMg, formatKg, formatRiyadhDate } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { fontFamily, radius, spacing, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button, Screen, ScreenBody } from '../../src/ui/Screen';
import {
  ActivityRing,
  AppHeader,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  ProfileAvatar,
  SectionTitle,
  Sparkline,
  SurfaceCard,
} from '../../src/ui/kit';
import { StepsCard } from '../../src/activity/StepsCard';
import { HeroPanel } from '../../src/ui/visual';

type HomeResponse =
  | { onboarded: false; dashboard: null }
  | { onboarded: true; dashboard: HomeDashboard; authoritativeCalorieTarget: null };

type Me = { onboardingCompleted?: boolean; profile: { display_name?: string | null; height_mm?: number | null } | null; goals?: string[] };
type Progress = { weights: { id: string; weight_grams: number; recorded_on: string }[]; completedWorkouts: number };

export default function HomeScreen() {
  const { locale } = useLocale();
  const { tokens } = useSession();
  const theme = useTheme();
  const home = useQuery({ queryKey: ['home', locale], queryFn: () => apiRequest<HomeResponse>('/v1/home') });
  const me = useQuery({
    queryKey: ['me', tokens?.accessToken],
    enabled: tokens !== null,
    queryFn: () => apiRequest<Me>('/v1/me'),
  });
  const progress = useQuery({ queryKey: ['progress'], queryFn: () => apiRequest<Progress>('/v1/progress') });

  if (home.isPending) {
    return (
      <Screen>
        <AppHeader title={text(locale, 'brand')} subtitle={text(locale, 'home')} />
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (home.error instanceof ApiClientError && home.error.code === 'OFFLINE') {
    return (
      <Screen>
        <AppHeader title={text(locale, 'home')} />
        <ErrorState body={text(locale, 'offline')} onRetry={() => void home.refetch()} />
      </Screen>
    );
  }
  if (home.isError || home.data === undefined) {
    return (
      <Screen>
        <AppHeader title={text(locale, 'home')} />
        <ErrorState body={text(locale, 'error')} onRetry={() => void home.refetch()} />
      </Screen>
    );
  }
  if (!home.data.onboarded || home.data.dashboard === null) {
    if (me.isPending || profileIsComplete(me.data)) {
      return (
        <Screen>
          <AppHeader title={text(locale, 'home')} />
          <LoadingSkeleton />
          <Button label={text(locale, 'tryAgain')} onPress={() => void Promise.all([home.refetch(), me.refetch()])} />
        </Screen>
      );
    }
    return (
      <Screen>
        <AppHeader title={text(locale, 'home')} />
        <EmptyState title={text(locale, 'empty')} body={text(locale, 'welcomeBody')} />
        <Button label={text(locale, 'onboarding')} onPress={() => router.replace('/(onboarding)')} />
      </Screen>
    );
  }

  const dashboard = home.data.dashboard;
  const nutrition = dashboard.nutrition.status === 'ready' ? dashboard.nutrition.data : null;
  const adherence = dashboard.adherence.status === 'ready' ? dashboard.adherence.data : null;
  const name = me.data?.profile?.display_name?.trim() || text(locale, 'brand');
  const weights = progress.data?.weights ?? [];
  const latest = weights.length === 0 ? null : weights[weights.length - 1];
  const goal = dashboard.goal.status === 'ready' ? label(locale, 'goal', dashboard.goal.data) : null;
  const today = dashboard.todayWorkout.status === 'ready' ? dashboard.todayWorkout.data : null;
  const actions = [
    [text(locale, 'askCoach'), { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }, () => router.push('/(tabs)/coach')],
    [text(locale, 'weeklyCheckin'), { ios: 'clipboard.fill', android: 'assignment', web: 'assignment' }, () => router.push('/weekly-checkin')],
    [text(locale, 'foodManual'), { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }, () => router.push('/food-log')],
    [text(locale, 'logWeight'), { ios: 'scalemass.fill', android: 'monitor_weight', web: 'monitor_weight' }, () => router.push('/weight')],
  ] as const;

  const logged = nutrition !== null && nutrition.entryCount > 0;
  const calories = logged && nutrition !== null ? nutrition.consumed.energyKcal : null;
  const protein = logged && nutrition !== null ? nutrition.consumed.proteinMg : null;
  const workoutAction = () => {
    if (today === null) router.push('/(tabs)/training');
    else router.push({ pathname: '/workout/[id]', params: { id: today.id } });
  };

  const weekAdherence = adherence !== null && adherence.planned > 0 ? adherence : null;
  const isAr = locale === 'ar';

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={dashboard.greeting}
          subtitle={`${formatRiyadhDate(dashboard.date, locale)}${goal === null ? '' : ` · ${goal}`}`}
          trailing={<ProfileAvatar name={name} onPress={() => router.push('/account')} />}
        />

        {/* Primary daily call to action — what the member should do right now, paired with a
            real weekly-adherence ring so the hero carries earned data, not decoration. */}
        <Pressable accessibilityRole="button" onPress={workoutAction} style={styles.hero}>
          <HeroPanel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <View style={{ flex: 1 }}>
            <Text style={[styles.heroEyebrow, { color: theme.heroAccent, fontFamily: fontFamily.semibold }]}>
              {isAr ? 'الخطوة التالية' : 'UP NEXT'}
            </Text>
            <Text style={[styles.heroTitle, { color: theme.heroText, fontFamily: fontFamily.bold }]} numberOfLines={2}>
              {today === null ? (isAr ? 'جاهز تبدأ؟' : 'Ready to train?') : today.name}
            </Text>
            <Text style={[styles.heroCaption, { color: theme.heroText, fontFamily: fontFamily.regular }]} numberOfLines={2}>
              {today === null
                ? isAr
                  ? 'ابدأ بخطة تناسب رياضتك ومستواك.'
                  : 'Start a plan that fits your sport and level.'
                : label(locale, 'discipline', today.discipline)}
            </Text>
            <View style={[styles.heroButton, { backgroundColor: theme.heroAccent }]}>
              <Text style={[styles.heroButtonText, { color: theme.goldInk, fontFamily: fontFamily.bold }]}>
                {today === null ? text(locale, 'createPlan') : text(locale, 'start')}
              </Text>
            </View>
            </View>
          {weekAdherence !== null ? (
            <ActivityRing
              progress={weekAdherence.completed / weekAdherence.planned}
              label={`${formatCount(weekAdherence.completed, locale)}/${formatCount(weekAdherence.planned, locale)}`}
              caption={isAr ? 'هذا الأسبوع' : 'This week'}
              color={theme.heroAccent}
              trackColor="rgba(255,255,255,0.18)"
              labelColor={theme.heroText}
              captionColor={theme.heroText}
              size={84}
            />
          ) : null}
            </View>
          </HeroPanel>
        </Pressable>

        <View style={styles.quickGrid}>
          {actions.map(([actionLabel, icon, onPress]) => (
            <Pressable key={actionLabel} accessibilityRole="button" onPress={onPress} style={[styles.quickItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.quickIcon, { backgroundColor: theme.surfaceMuted }]}>
                <SymbolView name={icon} size={20} tintColor={theme.accent} />
              </View>
              <Text numberOfLines={2} style={[styles.quickLabel, { color: theme.text, fontFamily: fontFamily.semibold }]}>{actionLabel}</Text>
            </Pressable>
          ))}
        </View>

        <StepsCard />

        <SectionTitle title={locale === 'ar' ? 'ملخص اليوم' : "Today's summary"} />
        <SurfaceCard style={styles.summaryStrip}>
          {([
            { icon: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }, value: calories === null ? '—' : formatCount(calories, locale), caption: text(locale, 'kcal') },
            { icon: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }, value: protein === null ? '—' : formatGramsFromMg(protein, locale), caption: text(locale, 'protein') },
            { icon: { ios: 'scalemass.fill', android: 'monitor_weight', web: 'monitor_weight' }, value: latest === null ? '—' : formatKg(Number(latest.weight_grams), locale), caption: text(locale, 'weight') },
          ] as const).map((item, index) => (
            <View key={item.caption} style={[styles.stat, index > 0 ? { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: theme.border } : null]}>
              <SymbolView name={item.icon} size={17} tintColor={theme.accent} />
              <Text style={[styles.statValue, { color: theme.text, fontFamily: fontFamily.bold }]}>{item.value}</Text>
              <Text numberOfLines={1} style={[styles.statCaption, { color: theme.textMuted, fontFamily: fontFamily.medium }]}>{item.caption}</Text>
            </View>
          ))}
        </SurfaceCard>

        {weights.length >= 2 ? (
          <SurfaceCard style={styles.chartCard}>
            <Text style={[styles.statCaption, { color: theme.textMuted, fontFamily: fontFamily.medium, marginBottom: 8 }]}>{text(locale, 'weightTracking')}</Text>
            <Sparkline values={weights.map((row) => Number(row.weight_grams))} />
          </SurfaceCard>
        ) : null}
        <View style={{ height: spacing[4] }} />
      </ScreenBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryStrip: { paddingVertical: spacing[4], paddingHorizontal: spacing[2], flexDirection: 'row', marginBottom: spacing[4] },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  statValue: { fontSize: typeScale.body, lineHeight: 22 },
  statCaption: { fontSize: typeScale.micro, lineHeight: 14 },
  hero: { marginTop: spacing[3], marginBottom: spacing[4] },
  heroEyebrow: { fontSize: typeScale.micro, letterSpacing: 1.1, marginBottom: spacing[2] },
  heroTitle: { fontSize: typeScale.title, lineHeight: 34, marginBottom: spacing[1] },
  heroCaption: { fontSize: typeScale.label, lineHeight: 20, opacity: 0.78, marginBottom: spacing[4] },
  heroButton: { minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[4], alignSelf: 'flex-start' },
  heroButtonText: { fontSize: typeScale.label },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  quickItem: { width: '48.5%', minHeight: 64, padding: spacing[2], borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', flexDirection: 'row', gap: spacing[2] },
  quickIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { flex: 1, fontSize: typeScale.label, lineHeight: 18, textAlign: 'auto' },
  chartCard: { padding: spacing[4], marginBottom: spacing[3] },
});
