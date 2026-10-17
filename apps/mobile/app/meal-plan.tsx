import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MEAL_SLOTS, type MealSlot } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { formatCount, riyadhToday } from '../src/format';
import { label } from '../src/i18n/labels';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { LOCAL_KEYS, useLocalValue } from '../src/storage/local';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, radius, spacing } from '../src/theme/tokens';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton, SectionLabel } from '../src/ui/kit';
import type { MacroTargets } from '../src/nutrition/targets';

type ReadyMeal = {
  id: string;
  slot: MealSlot;
  nameAr: string;
  nameEn: string;
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
};

type PlanSlot = {
  slot: MealSlot;
  templateId: string | null;
  customLabel: string | null;
  energyKcal: number;
};

type PlanResponse = {
  loggedOn: string;
  plan: { targetKcal: number; plannedKcal: number; remainingKcal: number; slots: PlanSlot[] } | null;
  readyMeals: ReadyMeal[];
};

export default function MealPlanScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = typeof params.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : riyadhToday();
  const targets = useLocalValue<MacroTargets | null>(LOCAL_KEYS.macroTargets, null);
  const [picks, setPicks] = useState<Partial<Record<MealSlot, string>>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const ar = locale === 'ar';

  const plan = useQuery({
    queryKey: ['meal-plan', day],
    queryFn: () => apiRequest<PlanResponse>(`/v1/nutrition/meal-plan?on=${day}`),
  });

  const targetKcal = targets.value?.energyKcal ?? plan.data?.plan?.targetKcal ?? 2000;
  const meals = plan.data?.readyMeals ?? [];

  useEffect(() => {
    const slots = plan.data?.plan?.slots;
    if (slots === undefined) return;
    const next: Partial<Record<MealSlot, string>> = {};
    for (const slot of slots) {
      if (slot.templateId !== null) next[slot.slot] = slot.templateId;
    }
    setPicks(next);
  }, [plan.data?.plan?.slots, day]);

  const preview = useMemo(() => {
    let planned = 0;
    for (const slot of MEAL_SLOTS) {
      const id = picks[slot];
      const meal = meals.find((item) => item.id === id);
      if (meal !== undefined) planned += meal.energyKcal;
    }
    return { planned, remaining: targetKcal - planned };
  }, [picks, meals, targetKcal]);

  async function save() {
    setError('');
    setSaving(true);
    try {
      const slots = MEAL_SLOTS.flatMap((slot) => {
        const id = picks[slot];
        return id === undefined ? [] : [{ slot, templateId: id }];
      });
      await apiRequest('/v1/nutrition/meal-plan', {
        method: 'PUT',
        body: { loggedOn: day, targetKcal, slots },
      });
      await client.invalidateQueries({ queryKey: ['meal-plan', day] });
      await client.invalidateQueries({ queryKey: ['diary', day] });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setSaving(false);
    }
  }

  if (plan.isPending) {
    return (
      <Screen>
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (plan.isError) {
    const offline = plan.error instanceof ApiClientError && plan.error.code === 'OFFLINE';
    return (
      <Screen title={text(locale, 'mealPlan')}>
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void plan.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={text(locale, 'mealPlan')}
          subtitle={text(locale, 'mealPlanHint')}
          trailing={(
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{text(locale, 'back')}</Text>
            </Pressable>
          )}
        />
        <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 28, marginBottom: 4 }}>
          {formatCount(preview.planned, locale)}
          <Text style={{ fontSize: 14, color: theme.textMuted }}> / {formatCount(targetKcal, locale)} {text(locale, 'kcal')}</Text>
        </Text>
        <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, marginBottom: spacing[4] }}>
          {ar
            ? `متبقٍ للخطة ${formatCount(preview.remaining, locale)} · اختر وجبات جاهزة أو خصّص لاحقاً`
            : `${formatCount(preview.remaining, locale)} left on the plan · pick ready meals or customize later`}
        </Text>

        {MEAL_SLOTS.map((slot) => {
          const options = meals.filter((meal) => meal.slot === slot);
          return (
            <View key={slot} style={{ marginBottom: spacing[4] }}>
              <SectionLabel>{label(locale, 'meal', slot)}</SectionLabel>
              {options.map((meal) => {
                const selected = picks[slot] === meal.id;
                return (
                  <Pressable
                    key={meal.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setPicks((current) => ({ ...current, [slot]: selected ? undefined : meal.id }))}
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? theme.accent : theme.border,
                      backgroundColor: selected ? theme.surfaceMuted : theme.surface,
                      borderRadius: radius.lg,
                      padding: spacing[3],
                      marginBottom: spacing[2],
                    }}
                  >
                    <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{ar ? meal.nameAr : meal.nameEn}</Text>
                    <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, marginTop: 4 }}>
                      {`${formatCount(meal.energyKcal, locale)} ${text(locale, 'kcal')} · P ${formatCount(meal.proteinMg / 1000, locale)} · C ${formatCount(meal.carbohydrateMg / 1000, locale)} · F ${formatCount(meal.fatMg / 1000, locale)}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {error.length > 0 ? <Text style={{ color: theme.danger, fontFamily: fontFamily.medium, marginBottom: spacing[2] }}>{error}</Text> : null}
        <Button label={saving ? text(locale, 'saving') : text(locale, 'save')} onPress={() => void save()} disabled={saving} />
        <View style={{ height: spacing[2] }} />
        <Button label={ar ? 'تخصيص من سجل الطعام' : 'Customize from food log'} variant="secondary" onPress={() => router.push({ pathname: '/food-log', params: { day } })} />
      </ScreenBody>
    </Screen>
  );
}
