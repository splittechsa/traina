// Targets from onboarding — not a second data-entry form.
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatCount } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, spacing, typeScale } from '../src/theme/tokens';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader } from '../src/ui/kit';
import { GlowCard, MacroBar } from '../src/ui/visual';
import { LOCAL_KEYS, useLocalValue } from '../src/storage/local';
import type { MacroTargets } from '../src/nutrition/targets';

export default function MacroTargetsScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const ar = locale === 'ar';
  const saved = useLocalValue<MacroTargets | null>(LOCAL_KEYS.macroTargets, null);
  const result = saved.value;
  const kcal = text(locale, 'kcal');
  const g = ar ? 'غ' : 'g';

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={ar ? 'أهدافك اليومية' : 'Your daily targets'}
          subtitle={ar ? 'محسوبة من بيانات الـ onboarding — مو حاسبة منفصلة' : 'From onboarding — not a separate calculator'}
          trailing={(
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{text(locale, 'back')}</Text>
            </Pressable>
          )}
        />

        {result === null ? (
          <View style={{ gap: spacing[3] }}>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, lineHeight: 22 }}>
              {ar
                ? 'ما في أهداف محفوظة بعد. أكمل التسجيل الأول مرة واحدة، ويحسب يزن الطاقة من بياناتك.'
                : 'No targets saved yet. Finish onboarding once — Yazan derives energy from your profile.'}
            </Text>
            <Button label={ar ? 'إكمال التسجيل' : 'Complete onboarding'} onPress={() => router.push('/(onboarding)')} />
          </View>
        ) : (
          <GlowCard>
            <View style={{ gap: spacing[4] }}>
              <View>
                <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium, fontSize: typeScale.label }}>
                  {ar ? 'الهدف اليومي من ملفك' : 'Daily target from your profile'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] }}>
                  <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 52, lineHeight: 60, fontVariant: ['tabular-nums'] }}>
                    {formatCount(result.energyKcal, locale)}
                  </Text>
                  <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium }}>{kcal}</Text>
                </View>
                <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.regular, fontSize: typeScale.label }}>
                  {ar
                    ? `الثبات ${formatCount(result.maintenanceKcal, locale)} · الوتيرة ${result.pace ?? '—'}`
                    : `Maintenance ${formatCount(result.maintenanceKcal, locale)} · Pace ${result.pace ?? '—'}`}
                </Text>
              </View>
              <MacroBar inverse label={text(locale, 'protein')} value={result.proteinG} target={null} unit={g} color={theme.heroAccent} />
              <MacroBar inverse label={text(locale, 'carbs')} value={result.carbsG} target={null} unit={g} color={theme.ember} />
              <MacroBar inverse label={text(locale, 'fat')} value={result.fatG} target={null} unit={g} color={theme.violet} />
              <Text style={{ color: 'rgba(243,246,244,0.7)', fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 20 }}>
                {ar
                  ? 'لتعديل الهدف: غيّر الوزن من التتبع، أو تواصل مع يزن. ما نعيد جمع العمر/الطول هنا.'
                  : 'To change targets: update weight tracking, or talk to Yazan. We do not re-collect age/height here.'}
              </Text>
            </View>
          </GlowCard>
        )}

        <View style={{ height: spacing[4] }} />
        <Button label={ar ? 'جدول الوجبات' : 'Meal plan'} variant="secondary" onPress={() => router.push('/meal-plan')} />
      </ScreenBody>
    </Screen>
  );
}
