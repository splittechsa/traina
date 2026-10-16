// Calorie & macro calculator. Inputs are tappable tiles that open the right native control
// (wheel for numbers, chips for choices) instead of a column of text fields; the result
// recomputes live at the top. Saved on-device as a personal estimate (see targets.ts for why
// this is not written to the API as an authoritative target).
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../src/api/client';
import { formatCount } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { useTheme } from '../src/theme/ThemeProvider';
import { useMotion } from '../src/theme/motion';
import { fontFamily, radius, spacing, typeScale } from '../src/theme/tokens';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, BottomSheet, SectionLabel } from '../src/ui/kit';
import { GlowCard, MacroBar } from '../src/ui/visual';
import { NumberWheel } from '../src/ui/pickers/NumberWheel';
import { tapSelection, tapSuccess } from '../src/ui/haptics';
import { LOCAL_KEYS, useLocalValue } from '../src/storage/local';
import {
  activityFromSteps,
  estimateTargets,
  LIMITS,
  type ActivityLevel,
  type Goal,
  type MacroTargets,
  type Sex,
  type TargetInput,
} from '../src/nutrition/targets';
import { useSteps } from '../src/activity/useSteps';

type Field = 'age' | 'height' | 'weight' | null;

const ACTIVITY_COPY: Record<ActivityLevel, { ar: string; en: string; arHint: string; enHint: string }> = {
  sedentary: { ar: 'خامل', en: 'Sedentary', arHint: 'عمل مكتبي، حركة قليلة', enHint: 'Desk job, little movement' },
  light: { ar: 'خفيف', en: 'Light', arHint: 'تمرين ١–٣ أيام', enHint: 'Training 1–3 days' },
  moderate: { ar: 'متوسط', en: 'Moderate', arHint: 'تمرين ٣–٥ أيام', enHint: 'Training 3–5 days' },
  very: { ar: 'عالٍ', en: 'Very active', arHint: 'تمرين ٦–٧ أيام', enHint: 'Training 6–7 days' },
  athlete: { ar: 'رياضي', en: 'Athlete', arHint: 'تمرينان يومياً أو عمل بدني', enHint: 'Twice daily or physical job' },
};

function Tile({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexBasis: '47%',
        flexGrow: 1,
        backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
        borderRadius: radius.lg,
        padding: spacing[4],
        gap: 4,
      })}
    >
      <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{label}</Text>
      <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.title, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </Pressable>
  );
}

function Chip({ label, selected, onPress, hint }: { label: string; selected: boolean; onPress: () => void; hint?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
        borderRadius: radius.md,
        backgroundColor: selected ? theme.accent : theme.surface,
        borderWidth: 1,
        borderColor: selected ? theme.accent : theme.border,
        minWidth: 108,
        gap: 2,
      }}
    >
      <Text style={{ color: selected ? theme.emphasisText : theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{label}</Text>
      {hint !== undefined ? (
        <Text style={{ color: selected ? theme.emphasisText : theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.micro }}>{hint}</Text>
      ) : null}
    </Pressable>
  );
}

export default function MacroCalculatorScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const { reduce } = useMotion();
  const ar = locale === 'ar';
  const saved = useLocalValue<MacroTargets | null>(LOCAL_KEYS.macroTargets, null);
  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: () => apiRequest<{ weights?: { weight_grams: number }[] }>('/v1/progress'),
  });
  const { state: steps } = useSteps(7);

  const [input, setInput] = useState<TargetInput>({ sex: 'male', ageYears: 28, heightCm: 172, weightKg: 75, activity: 'moderate', goal: 'maintain' });
  const [prefilled, setPrefilled] = useState(false);
  const [field, setField] = useState<Field>(null);
  const [draft, setDraft] = useState(0);

  // Prefill once: a previously saved estimate wins; otherwise the latest logged weight.
  useEffect(() => {
    if (prefilled || !saved.ready) return;
    if (saved.value !== null) {
      setInput(saved.value.input);
      setPrefilled(true);
      return;
    }
    const weights = progress.data?.weights ?? [];
    const latest = weights[weights.length - 1];
    if (latest !== undefined) setInput((current) => ({ ...current, weightKg: Math.round(Number(latest.weight_grams) / 100) / 10 }));
    if (progress.isFetched) setPrefilled(true);
  }, [prefilled, saved.ready, saved.value, progress.data, progress.isFetched]);

  const suggested = steps.status === 'ready' && steps.historySupported ? activityFromSteps(steps.week.slice(0, -1)) : null;
  const result = useMemo(() => {
    try {
      return estimateTargets(input);
    } catch {
      return null;
    }
  }, [input]);

  function update(patch: Partial<TargetInput>) {
    setInput((current) => ({ ...current, ...patch }));
    tapSelection(reduce);
  }

  function openField(next: Exclude<Field, null>) {
    setDraft(next === 'age' ? input.ageYears : next === 'height' ? input.heightCm : input.weightKg);
    setField(next);
  }

  function commitField() {
    if (field === 'age') update({ ageYears: draft });
    if (field === 'height') update({ heightCm: draft });
    if (field === 'weight') update({ weightKg: draft });
    setField(null);
  }

  const kcal = text(locale, 'kcal');
  const g = ar ? 'غ' : 'g';

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={ar ? 'حاسبة السعرات والماكروز' : 'Calorie & macro calculator'}
          subtitle={ar ? 'تقدير شخصي بمعادلة Mifflin–St Jeor' : 'Personal estimate · Mifflin–St Jeor'}
          trailing={
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{text(locale, 'back')}</Text>
            </Pressable>
          }
        />

        <GlowCard>
          {result === null ? (
            <Text style={{ color: theme.heroText, fontFamily: fontFamily.medium }}>{ar ? 'تحقق من القيم' : 'Check your values'}</Text>
          ) : (
            <View style={{ gap: spacing[4] }}>
              <View>
                <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{ar ? 'هدفك اليومي التقديري' : 'Estimated daily target'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] }}>
                  <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 52, lineHeight: 60, fontVariant: ['tabular-nums'] }}>{formatCount(result.energyKcal, locale)}</Text>
                  <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium, fontSize: typeScale.body }}>{kcal}</Text>
                </View>
                <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.regular, fontSize: typeScale.label }}>
                  {ar
                    ? `الثبات ${formatCount(result.maintenanceKcal, locale)} · الأيض الأساسي ${formatCount(result.bmrKcal, locale)}`
                    : `Maintenance ${formatCount(result.maintenanceKcal, locale)} · BMR ${formatCount(result.bmrKcal, locale)}`}
                </Text>
              </View>
              <MacroBar inverse label={text(locale, 'protein')} value={result.proteinG} target={null} unit={g} color={theme.heroAccent} />
              <MacroBar inverse label={text(locale, 'carbs')} value={result.carbsG} target={null} unit={g} color={theme.ember} />
              <MacroBar inverse label={text(locale, 'fat')} value={result.fatG} target={null} unit={g} color={theme.violet} />
              {result.floored ? (
                <Text style={{ color: theme.warning, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>
                  {ar ? 'رفعنا الهدف للحد الأدنى الآمن؛ لا ننصح بعجز أكبر دون متابعة مختص.' : "Raised to a safe minimum — we don't suggest a bigger deficit without professional guidance."}
                </Text>
              ) : null}
            </View>
          )}
        </GlowCard>

        <SectionLabel>{ar ? 'بياناتك' : 'About you'}</SectionLabel>
        <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] }}>
          <Chip label={ar ? 'ذكر' : 'Male'} selected={input.sex === 'male'} onPress={() => update({ sex: 'male' as Sex })} />
          <Chip label={ar ? 'أنثى' : 'Female'} selected={input.sex === 'female'} onPress={() => update({ sex: 'female' as Sex })} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
          <Tile label={ar ? 'العمر' : 'Age'} value={`${input.ageYears}`} onPress={() => openField('age')} />
          <Tile label={ar ? 'الطول' : 'Height'} value={`${input.heightCm} ${ar ? 'سم' : 'cm'}`} onPress={() => openField('height')} />
          <Tile label={ar ? 'الوزن' : 'Weight'} value={`${input.weightKg.toFixed(1)} ${ar ? 'كغ' : 'kg'}`} onPress={() => openField('weight')} />
        </View>

        <SectionLabel>{ar ? 'مستوى نشاطك' : 'Activity level'}</SectionLabel>
        {suggested !== null ? (
          <Pressable accessibilityRole="button" onPress={() => update({ activity: suggested })} style={{ marginBottom: spacing[2] }}>
            <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: typeScale.label }}>
              {ar ? `حسب خطواتك هذا الأسبوع: ${ACTIVITY_COPY[suggested].ar} — اضغط للاختيار` : `From your steps this week: ${ACTIVITY_COPY[suggested].en} — tap to use`}
            </Text>
          </Pressable>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
          {(Object.keys(ACTIVITY_COPY) as ActivityLevel[]).map((level) => (
            <Chip
              key={level}
              label={ar ? ACTIVITY_COPY[level].ar : ACTIVITY_COPY[level].en}
              hint={ar ? ACTIVITY_COPY[level].arHint : ACTIVITY_COPY[level].enHint}
              selected={input.activity === level}
              onPress={() => update({ activity: level })}
            />
          ))}
        </ScrollView>

        <SectionLabel>{ar ? 'هدفك' : 'Your goal'}</SectionLabel>
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          {(['lose', 'maintain', 'gain'] as Goal[]).map((goal) => (
            <View key={goal} style={{ flex: 1 }}>
              <Chip
                label={goal === 'lose' ? (ar ? 'تنشيف' : 'Lose fat') : goal === 'maintain' ? (ar ? 'ثبات' : 'Maintain') : ar ? 'تضخيم' : 'Build'}
                hint={goal === 'lose' ? '−20%' : goal === 'gain' ? '+10%' : '±0'}
                selected={input.goal === goal}
                onPress={() => update({ goal })}
              />
            </View>
          ))}
        </View>

        <View style={{ height: spacing[5] }} />
        <Button
          label={ar ? 'اعتمد كهدفي اليومي' : 'Use as my daily target'}
          disabled={result === null}
          onPress={() => {
            if (result === null) return;
            void saved.save(result);
            tapSuccess(reduce);
            router.back();
          }}
        />
        <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, marginTop: spacing[3], lineHeight: 20 }}>
          {ar
            ? 'هذا تقدير عام يُحفظ على جهازك فقط وليس توصية طبية. إن كان لديك حالة صحية أو حمل، استشر مختصاً.'
            : "A general estimate, stored only on this device — not medical advice. If you have a health condition or are pregnant, consult a professional."}
        </Text>
      </ScreenBody>

      <BottomSheet visible={field !== null} onClose={() => setField(null)}>
        <View style={{ gap: spacing[4], paddingBottom: spacing[3] }}>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.headline, textAlign: 'center' }}>
            {field === 'age' ? (ar ? 'العمر' : 'Age') : field === 'height' ? (ar ? 'الطول' : 'Height') : ar ? 'الوزن' : 'Weight'}
          </Text>
          {field === 'age' ? (
            <NumberWheel value={draft} onChange={setDraft} min={LIMITS.ageYears.min} max={LIMITS.ageYears.max} locale={locale} suffix={ar ? 'سنة' : 'yrs'} accessibilityLabel={ar ? 'العمر' : 'Age'} />
          ) : null}
          {field === 'height' ? (
            <NumberWheel value={draft} onChange={setDraft} min={LIMITS.heightCm.min} max={LIMITS.heightCm.max} locale={locale} suffix={ar ? 'سم' : 'cm'} accessibilityLabel={ar ? 'الطول' : 'Height'} />
          ) : null}
          {field === 'weight' ? (
            <NumberWheel
              value={draft}
              onChange={setDraft}
              min={LIMITS.weightKg.min}
              max={LIMITS.weightKg.max}
              step={0.1}
              locale={locale}
              suffix={ar ? 'كغ' : 'kg'}
              accessibilityLabel={ar ? 'الوزن' : 'Weight'}
            />
          ) : null}
          <Button label={ar ? 'تم' : 'Done'} onPress={commitField} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
