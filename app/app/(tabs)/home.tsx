import { Pressable, Text, View, StyleSheet, ImageBackground } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
import { useMotion } from '../../src/theme/motion';
import { fontFamily, spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button, Screen, ScreenBody } from '../../src/ui/Screen';
import {
  AppHeader,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  ProfileAvatar,
  Sparkline,
} from '../../src/ui/kit';

type HomeResponse =
  | { onboarded: false; dashboard: null }
  | { onboarded: true; dashboard: HomeDashboard; authoritativeCalorieTarget: null };

type Me = { onboardingCompleted?: boolean; profile: { display_name?: string | null; height_mm?: number | null } | null; goals?: string[] };
type Progress = { weights: { id: string; weight_grams: number; recorded_on: string }[]; completedWorkouts: number };

export default function HomeScreen() {
  const { locale } = useLocale();
  const { tokens } = useSession();
  const theme = useTheme();
  const { reduce } = useMotion();
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
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (home.error instanceof ApiClientError && home.error.code === 'OFFLINE') {
    return (
      <Screen title={text(locale, 'home')}>
        <ErrorState body={text(locale, 'offline')} onRetry={() => void home.refetch()} />
      </Screen>
    );
  }
  if (home.isError || home.data === undefined) {
    return (
      <Screen title={text(locale, 'home')}>
        <ErrorState body={text(locale, 'error')} onRetry={() => void home.refetch()} />
      </Screen>
    );
  }
  if (!home.data.onboarded || home.data.dashboard === null) {
    if (me.isPending || profileIsComplete(me.data)) {
      return (
        <Screen title={text(locale, 'home')}>
          <LoadingSkeleton />
          <Button label={text(locale, 'tryAgain')} onPress={() => void Promise.all([home.refetch(), me.refetch()])} />
        </Screen>
      );
    }
    return (
      <Screen title={text(locale, 'home')}>
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
    [text(locale, 'askCoach'), () => router.push('/(tabs)/coach')],
    [text(locale, 'foodManual'), () => router.push('/(tabs)/nutrition')],
    [text(locale, 'schedule'), () => router.push('/(tabs)/training')],
    [text(locale, 'logWeight'), () => router.push('/weight')],
  ] as const;

  const calories = nutrition?.consumed.energyKcal ?? 0;
  const protein = nutrition?.consumed.proteinMg ?? 0;
  const workoutAction = () => {
    if (today === null) router.push('/(tabs)/training');
    else router.push({ pathname: '/workout/[id]', params: { id: today.id } });
  };

  return (
    <Screen>
      <ScreenBody>
        <Animated.View entering={reduce ? undefined : FadeInDown.duration(280)}>
          <AppHeader
            title={dashboard.greeting}
            subtitle={`${formatRiyadhDate(dashboard.date, locale)}${goal === null ? '' : ` · ${goal}`}`}
            trailing={<ProfileAvatar name={name} onPress={() => router.push('/account')} />}
          />
          <ImageBackground source={require('../../assets/editorial/strength.jpg')} imageStyle={{ borderRadius: 24 }} style={[styles.hero, { backgroundColor: theme.hero, borderColor: theme.border }]}>
            <View pointerEvents="none" style={styles.heroScrim} />
            <Text style={[styles.eyebrow, { color: '#C7F36B', fontFamily: fontFamily.semibold }]}>SAHHTI  /  صحتي</Text>
            <Text style={[styles.heroTitle, { color: theme.heroText, fontFamily: fontFamily.bold }]}>كل يوم، أقوى.</Text>
            <Text style={[styles.heroCaption, { color: '#E8F2F0', fontFamily: fontFamily.regular }]}>
              {today === null ? 'ابدأ بخطة تناسب رياضتك ومستواك.' : `${today.name} · ${label(locale, 'discipline', today.discipline)}`}
            </Text>
            <Pressable accessibilityRole="button" onPress={workoutAction} style={[styles.heroButton, { backgroundColor: theme.accent }]}>
              <Text style={[styles.heroButtonText, { color: theme.emphasisText, fontFamily: fontFamily.bold }]}>
                {today === null ? text(locale, 'createPlan') : text(locale, 'start')}  ←
              </Text>
            </Pressable>
          </ImageBackground>
          <View style={styles.quickRow}>
            {actions.map(([actionLabel, onPress]) => (
              <Pressable key={actionLabel} accessibilityRole="button" onPress={onPress}
                style={[styles.quickAction, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text numberOfLines={2} style={[styles.quickLabel, { color: theme.text, fontFamily: fontFamily.semibold }]}>{actionLabel}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: fontFamily.bold }]}>نظرة اليوم</Text>
          <Text style={[styles.sectionCaption, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>تقدمك الحقيقي</Text>
        </View>
        <View style={styles.metricRow}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/nutrition')}
            style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.metricLabel, { color: theme.textMuted, fontFamily: fontFamily.medium }]}>{text(locale, 'nutrition')}</Text>
            <Text style={[styles.metricNumber, { color: theme.text, fontFamily: fontFamily.bold }]}>{formatCount(calories, locale)}</Text>
            <Text style={[styles.metricSub, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>{text(locale, 'kcal')} · {formatGramsFromMg(protein, locale)} {text(locale, 'grams')} {text(locale, 'protein')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/progress')}
            style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.metricLabel, { color: theme.textMuted, fontFamily: fontFamily.medium }]}>{text(locale, 'adherence')}</Text>
            <Text style={[styles.metricNumber, { color: theme.text, fontFamily: fontFamily.bold }]}>
              {adherence !== null && adherence.planned > 0 ? `${formatCount(adherence.completed, locale)}/${formatCount(adherence.planned, locale)}` : '—'}
            </Text>
            <Text style={[styles.metricSub, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>{text(locale, 'completedOf')}</Text>
          </Pressable>
        </View>
        <View style={[styles.featureCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.metricLabel, { color: theme.textMuted, fontFamily: fontFamily.medium }]}>{text(locale, 'weightTracking')}</Text>
            <Text style={[styles.featureNumber, { color: theme.text, fontFamily: fontFamily.bold }]}>{latest === null ? '—' : formatKg(Number(latest.weight_grams), locale)}</Text>
            <Text style={[styles.metricSub, { color: theme.textMuted, fontFamily: fontFamily.regular }]}>{latest === null ? 'سجّل وزنك لمتابعة التغيّر' : formatRiyadhDate(String(latest.recorded_on), locale)}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/weight')}
            style={[styles.smallButton, { borderColor: theme.border }]}>
            <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>+ {text(locale, 'logWeight')}</Text>
          </Pressable>
        </View>
        {weights.length >= 2 ? <View style={{ marginTop: spacing[3] }}><Sparkline values={weights.map((row) => Number(row.weight_grams))} /></View> : null}
        <View style={{ height: spacing[4] }} />
      </ScreenBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderWidth: 0, borderRadius: 24, padding: 22, paddingTop: 44, minHeight: 255, marginTop: 8, marginBottom: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,14,18,0.70)', borderRadius: 24 },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, marginBottom: 8 },
  heroTitle: { fontSize: 31, lineHeight: 43, marginBottom: 4 },
  heroCaption: { fontSize: 14, lineHeight: 23, marginBottom: 20 },
  heroButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroButtonText: { fontSize: 16 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  quickAction: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: 14, minHeight: 50, justifyContent: 'center', paddingHorizontal: 12, alignItems: 'center' },
  quickLabel: { fontSize: 13, textAlign: 'center' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 21 },
  sectionCaption: { fontSize: 12 },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  metricCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 16, minHeight: 124 },
  metricLabel: { fontSize: 13, marginBottom: 8 },
  metricNumber: { fontSize: 29, lineHeight: 38 },
  metricSub: { fontSize: 11, lineHeight: 18, marginTop: 4 },
  featureCard: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureNumber: { fontSize: 25, marginTop: 4 },
  smallButton: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 44, justifyContent: 'center' },
});
