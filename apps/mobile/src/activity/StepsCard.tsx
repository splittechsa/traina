import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { formatCount } from '../format';
import { useLocale } from '../i18n/LocaleProvider';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { GradientRing } from '../ui/visual';
import { LOCAL_KEYS, useLocalValue } from '../storage/local';
import { DEFAULT_STEP_GOAL, estimateDistanceKm, goalProgress } from './steps';
import { useSteps } from './useSteps';

/** Home card: today's live step count against the goal; taps through to the Activity screen. */
export function StepsCard() {
  const { locale } = useLocale();
  const theme = useTheme();
  const ar = locale === 'ar';
  const { state } = useSteps(1);
  const goal = useLocalValue<number>(LOCAL_KEYS.stepGoal, DEFAULT_STEP_GOAL);
  const ready = state.status === 'ready';
  const steps = ready ? state.today : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ready ? (ar ? `${steps} خطوة اليوم` : `${steps} steps today`) : ar ? 'الخطوات' : 'Steps'}
      onPress={() => router.push('/activity')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[4],
        backgroundColor: theme.surface,
        borderRadius: radius.lg + 2,
        padding: spacing[4],
        marginBottom: spacing[4],
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <GradientRing size={76} stroke={9} progress={ready ? goalProgress(steps, goal.value) : 0} from={theme.accent} to={theme.ember}>
        <SymbolView name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }} size={24} tintColor={theme.text} />
      </GradientRing>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{ar ? 'خطوات اليوم' : 'Steps today'}</Text>
        {ready ? (
          <>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.title, fontVariant: ['tabular-nums'] }}>
              {formatCount(steps, locale)}
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{`  / ${formatCount(goal.value, locale)}`}</Text>
            </Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.micro }}>
              {ar ? `≈ ${formatCount(estimateDistanceKm(steps), locale)} كم` : `≈ ${formatCount(estimateDistanceKm(steps), locale)} km`}
            </Text>
          </>
        ) : (
          <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>
            {state.status === 'loading' ? '…' : ar ? 'فعّل عدّاد الخطوات' : 'Turn on step counting'}
          </Text>
        )}
      </View>
      <SymbolView name={{ ios: ar ? 'chevron.left' : 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={13} tintColor={theme.textMuted} />
    </Pressable>
  );
}
