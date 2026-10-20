import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseScaledInteger } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { formatCount, formatRiyadhWeekday, riyadhToday } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text, type CopyKey } from '../../src/i18n/copy';
import { fontFamily, radius, spacing, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, BottomSheet, DateSelector, ErrorState, LoadingSkeleton, SectionLabel, SurfaceCard } from '../../src/ui/kit';
import { GlowCard, GradientRing, MacroBar } from '../../src/ui/visual';
import { LOCAL_KEYS, useLocalValue } from '../../src/storage/local';
import type { MacroTargets } from '../../src/nutrition/targets';
import { logReadyMeal } from '../../src/nutrition/logFood';
import { stableRecordKey } from '../../src/lists/keys';
import { YazanCard, openYazanWithPrompt } from '../../src/ui/YazanCard';
import { yazanTip } from '../../src/training/yazanPresence';

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Entry = {
  id: string;
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
  source: string;
  label?: string | null;
  mealSlot?: string | null;
};
type Diary = {
  target: null;
  entries?: Entry[];
  summary: {
    consumed: { energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number; imageEstimateEnergyKcal: number };
    entryCount: number;
  };
};
type ReadyMeal = {
  id: string;
  slot: MealSlot;
  nameAr: string;
  nameEn: string;
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
  provenance: string;
  ingredients?: { nameAr: string; nameEn: string; quantityAr: string; quantityEn: string }[];
  prepAr?: string;
  prepEn?: string;
  servings?: number;
  tags?: string[];
};

const SLOTS: { id: MealSlot; copy: CopyKey }[] = [
  { id: 'breakfast', copy: 'mealBreakfast' },
  { id: 'lunch', copy: 'mealLunch' },
  { id: 'dinner', copy: 'mealDinner' },
  { id: 'snack', copy: 'mealSnacks' },
];

function recentDays(): string[] {
  const today = riyadhToday();
  const [year, month, day] = today.split('-').map(Number);
  const anchor = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1, 12));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
}

export default function NutritionScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const days = recentDays();
  const [day, setDay] = useState(days[6] ?? riyadhToday());
  const [manualOpen, setManualOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [librarySlot, setLibrarySlot] = useState<MealSlot | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<ReadyMeal | null>(null);
  const [logging, setLogging] = useState(false);
  const [energy, setEnergy] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [manualSlot, setManualSlot] = useState<MealSlot>('lunch');
  const targets = useLocalValue<MacroTargets | null>(LOCAL_KEYS.macroTargets, null);
  const diary = useQuery({
    queryKey: ['diary', day],
    queryFn: () => apiRequest<Diary>(`/v1/nutrition/diary?on=${day}`),
  });
  const ready = useQuery({
    queryKey: ['ready-meals'],
    queryFn: () => apiRequest<{ meals: ReadyMeal[]; inventedDishes: boolean }>('/v1/nutrition/ready-meals'),
  });

  const ar = locale === 'ar';
  const entries = useMemo(() => diary.data?.entries ?? [], [diary.data]);
  const bySlot = useMemo(() => {
    const map: Record<MealSlot | 'other', Entry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      other: [],
    };
    for (const entry of entries) {
      const slot = entry.mealSlot;
      if (slot === 'breakfast' || slot === 'lunch' || slot === 'dinner' || slot === 'snack') map[slot].push(entry);
      else map.other.push(entry);
    }
    return map;
  }, [entries]);

  function openFoodLog(slot: MealSlot) {
    router.push({ pathname: '/food-log', params: { day, mealSlot: slot } });
  }

  async function removeEntry(entryId: string) {
    await apiRequest(`/v1/nutrition/entries/${entryId}`, { method: 'DELETE' });
    await client.invalidateQueries({ queryKey: ['diary', day] });
    await client.invalidateQueries({ queryKey: ['home'] });
  }

  async function saveCustom() {
    setError('');
    try {
      await apiRequest('/v1/nutrition/foods', {
        method: 'POST',
        body: {
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim(),
          energyKcal: Number(energy),
          proteinMg: parseScaledInteger(protein.trim().length === 0 ? '0' : protein, 1000),
          carbohydrateMg: parseScaledInteger(carbs.trim().length === 0 ? '0' : carbs, 1000),
          fatMg: parseScaledInteger(fat.trim().length === 0 ? '0' : fat, 1000),
        },
      });
      setCustomOpen(false);
      setNameAr('');
      setNameEn('');
      openFoodLog(manualSlot);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    }
  }

  async function saveManual() {
    setError('');
    try {
      await apiRequest('/v1/nutrition/entries', {
        method: 'POST',
        body: {
          loggedOn: day,
          mealSlot: manualSlot,
          energyKcal: Number(energy),
          proteinMg: parseScaledInteger(protein.trim().length === 0 ? '0' : protein, 1000),
          carbohydrateMg: parseScaledInteger(carbs.trim().length === 0 ? '0' : carbs, 1000),
          fatMg: parseScaledInteger(fat.trim().length === 0 ? '0' : fat, 1000),
          source: 'manual',
        },
      });
      await client.invalidateQueries({ queryKey: ['diary', day] });
      await client.invalidateQueries({ queryKey: ['home'] });
      setManualOpen(false);
      setEnergy('');
      setProtein('');
      setCarbs('');
      setFat('');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    }
  }

  async function addReadyMeal(meal: ReadyMeal) {
    setLogging(true);
    try {
      await logReadyMeal({
        loggedOn: day,
        mealSlot: meal.slot,
        label: ar ? meal.nameAr : meal.nameEn,
        energyKcal: meal.energyKcal,
        proteinMg: meal.proteinMg,
        carbohydrateMg: meal.carbohydrateMg,
        fatMg: meal.fatMg,
      });
      await client.invalidateQueries({ queryKey: ['diary', day] });
      await client.invalidateQueries({ queryKey: ['home'] });
      setSelectedMeal(null);
      setLibrarySlot(null);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setLogging(false);
    }
  }

  if (diary.isPending) {
    return (
      <Screen>
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (diary.isError || diary.data === undefined) {
    const offline = diary.error instanceof ApiClientError && diary.error.code === 'OFFLINE';
    return (
      <Screen title={text(locale, 'nutrition')}>
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void diary.refetch()} />
      </Screen>
    );
  }

  const consumed = diary.data.summary.consumed;
  const target = targets.value;
  const g = ar ? 'غ' : 'g';
  const remainingKcal = target === null ? null : target.energyKcal - consumed.energyKcal;
  const libraryMeals = (ready.data?.meals ?? []).filter((meal) => librarySlot === null || meal.slot === librarySlot);

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={text(locale, 'nutrition')}
          subtitle={ar ? 'ماذا آكل؟ ماذا سجلت؟ ماذا بقي؟' : 'What to eat · what I logged · what remains'}
        />
        <YazanCard
          compact
          body={yazanTip(locale, {
            surface: 'nutrition',
            entryCount: diary.data.summary.entryCount,
          })}
          actions={[
            {
              label: ar ? 'سجّل وجبة' : 'Log a meal',
              onPress: () => router.push('/food-log'),
            },
            {
              label: text(locale, 'askCoach'),
              onPress: () =>
                openYazanWithPrompt(
                  ar
                    ? 'لاحظت نقص في تسجيل الوجبات. كيف أحافظ على المسار بدون تعقيد؟'
                    : 'I am missing meal logs. How do I stay on track without overcomplicating it?',
                ),
            },
          ]}
        />
        <DateSelector days={days} selected={day} onSelect={setDay} labelFor={(value) => formatRiyadhWeekday(value, locale)} />
        <View style={{ height: spacing[2] }} />
        <GlowCard glow={theme.ember}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <GradientRing
              size={120}
              stroke={12}
              progress={target === null ? (consumed.energyKcal > 0 ? 1 : 0) : consumed.energyKcal / Math.max(1, target.energyKcal)}
              from={theme.heroAccent}
              to={theme.ember}
              track="rgba(255,255,255,0.08)"
              accessibilityLabel={`${consumed.energyKcal} ${text(locale, 'kcal')}`}
            >
              <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums'] }}>
                {formatCount(consumed.energyKcal, locale)}
              </Text>
              <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium, fontSize: typeScale.micro }}>{text(locale, 'kcal')}</Text>
            </GradientRing>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <Text style={{ color: 'rgba(243,246,244,0.7)', fontFamily: fontFamily.medium, fontSize: typeScale.label }}>
                {text(locale, 'mealWhatLeft')}
              </Text>
              {target !== null && remainingKcal !== null ? (
                <Text style={{ color: remainingKcal >= 0 ? theme.heroText : theme.warning, fontFamily: fontFamily.bold, fontSize: typeScale.headline, fontVariant: ['tabular-nums'] }}>
                  {formatCount(Math.abs(remainingKcal), locale)} {text(locale, 'kcal')}
                </Text>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => router.push('/macros')}>
                  <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.bold }}>{ar ? 'اضبط هدفك اليومي' : 'Set a daily target'}</Text>
                </Pressable>
              )}
              <MacroBar inverse label={text(locale, 'protein')} value={consumed.proteinMg / 1000} target={target?.proteinG ?? null} unit={g} color={theme.heroAccent} />
            </View>
          </View>
        </GlowCard>

        <SectionLabel>{text(locale, 'mealWhatEaten')}</SectionLabel>
        {SLOTS.map((slot) => {
          const slotEntries = bySlot[slot.id];
          const slotKcal = slotEntries.reduce((sum, row) => sum + row.energyKcal, 0);
          return (
            <SurfaceCard key={slot.id} style={{ marginBottom: spacing[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] }}>
                <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card }}>{text(locale, slot.copy)}</Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontVariant: ['tabular-nums'] }}>
                  {formatCount(slotKcal, locale)} {text(locale, 'kcal')}
                </Text>
              </View>
              {slotEntries.length === 0 ? (
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginBottom: spacing[2] }}>{text(locale, 'mealEmptySlot')}</Text>
              ) : (
                slotEntries.map((entry) => (
                  <Pressable
                    key={stableRecordKey(entry.id)}
                    accessibilityRole="button"
                    onPress={() => void removeEntry(entry.id)}
                    style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border }}
                  >
                    <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>
                      {entry.label ?? label(locale, 'foodSource', entry.source)}
                    </Text>
                    <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 2 }}>
                      {formatCount(entry.energyKcal, locale)} {text(locale, 'kcal')} · {text(locale, 'deleteEntry')}
                    </Text>
                  </Pressable>
                ))
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing[2] }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openFoodLog(slot.id)}
                  style={{ flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: theme.emphasisText, fontFamily: fontFamily.bold }}>{text(locale, 'mealAddToSlot')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { setLibrarySlot(slot.id); setSelectedMeal(null); setError(''); }}
                  style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{text(locale, 'mealLibrary')}</Text>
                </Pressable>
              </View>
            </SurfaceCard>
          );
        })}

        {bySlot.other.length > 0 ? (
          <SurfaceCard style={{ marginBottom: spacing[3] }}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.bold, marginBottom: 8 }}>{ar ? 'بدون وجبة محددة' : 'Unspecified meal'}</Text>
            {bySlot.other.map((entry) => (
              <Text key={entry.id} style={{ color: theme.textMuted, marginBottom: 6 }}>
                {entry.label ?? label(locale, 'foodSource', entry.source)} · {formatCount(entry.energyKcal, locale)} {text(locale, 'kcal')}
              </Text>
            ))}
          </SurfaceCard>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/meal-builder', params: { day, mealSlot: manualSlot } })}
            style={{ flex: 1, minHeight: 48, borderRadius: radius.md, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}
          >
            <Text style={{ color: theme.emphasisText, fontFamily: fontFamily.bold }}>{text(locale, 'customMealBuilder')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => { setManualSlot('lunch'); setError(''); setManualOpen(true); }}
            style={{ flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{text(locale, 'manualEntry')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/scanner', params: { day } })}
            style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <SymbolView name={{ ios: 'barcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }} size={20} tintColor={theme.text} />
          </Pressable>
        </View>
      </ScreenBody>

      <BottomSheet visible={librarySlot !== null} onClose={() => { setLibrarySlot(null); setSelectedMeal(null); }}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.headline, marginBottom: 6 }}>
            {text(locale, 'mealLibrary')}
            {librarySlot ? ` · ${text(locale, SLOTS.find((s) => s.id === librarySlot)?.copy ?? 'mealLibrary')}` : ''}
          </Text>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginBottom: 14, lineHeight: 20 }}>
            {text(locale, 'mealLibraryHint')}
          </Text>
          {selectedMeal === null ? (
            libraryMeals.map((meal) => (
              <Pressable
                key={meal.id}
                accessibilityRole="button"
                onPress={() => setSelectedMeal(meal)}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}
              >
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{ar ? meal.nameAr : meal.nameEn}</Text>
                <Text style={{ color: theme.textMuted, marginTop: 4 }}>
                  {formatCount(meal.energyKcal, locale)} {text(locale, 'kcal')} · {meal.provenance}
                </Text>
              </Pressable>
            ))
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card }}>
                {ar ? selectedMeal.nameAr : selectedMeal.nameEn}
              </Text>
              <Text style={{ color: theme.textMuted }}>
                {formatCount(selectedMeal.energyKcal, locale)} {text(locale, 'kcal')} · P {formatCount(selectedMeal.proteinMg / 1000, locale)}{g} · C {formatCount(selectedMeal.carbohydrateMg / 1000, locale)}{g} · F {formatCount(selectedMeal.fatMg / 1000, locale)}{g}
              </Text>
              {(selectedMeal.ingredients?.length ?? 0) > 0 ? (
                <>
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{text(locale, 'mealIngredients')}</Text>
                  {selectedMeal.ingredients?.map((ing) => (
                    <Text key={`${ing.nameEn}-${ing.quantityEn}`} style={{ color: theme.textMuted }}>
                      · {ar ? ing.nameAr : ing.nameEn} — {ar ? ing.quantityAr : ing.quantityEn}
                    </Text>
                  ))}
                </>
              ) : null}
              {(ar ? selectedMeal.prepAr : selectedMeal.prepEn) ? (
                <>
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{text(locale, 'mealPrep')}</Text>
                  <Text style={{ color: theme.textMuted, lineHeight: 22 }}>{ar ? selectedMeal.prepAr : selectedMeal.prepEn}</Text>
                </>
              ) : null}
              {error.length > 0 ? <Body>{error}</Body> : null}
              <Button label={logging ? text(locale, 'loading') : text(locale, 'mealLogReady')} onPress={() => void addReadyMeal(selectedMeal)} />
              <Button label={text(locale, 'back')} variant="secondary" onPress={() => setSelectedMeal(null)} />
            </View>
          )}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={manualOpen} onClose={() => setManualOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {SLOTS.map((slot) => (
              <Pressable
                key={slot.id}
                onPress={() => setManualSlot(slot.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                  backgroundColor: manualSlot === slot.id ? theme.accent : theme.surfaceMuted,
                }}
              >
                <Text style={{ color: manualSlot === slot.id ? theme.emphasisText : theme.text, fontFamily: fontFamily.semibold }}>
                  {text(locale, slot.copy)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field label={text(locale, 'kcal')} value={energy} onChangeText={setEnergy} keyboardType="number-pad" />
          <Field label={`${text(locale, 'protein')} (${text(locale, 'grams')})`} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'carbs')} (${text(locale, 'grams')})`} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'fat')} (${text(locale, 'grams')})`} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
          {error.length > 0 ? <Body>{error}</Body> : null}
          <Button label={text(locale, 'save')} onPress={() => void saveManual()} />
          <View style={{ height: spacing[2] }} />
          <Button label={text(locale, 'customFood')} variant="secondary" onPress={() => { setManualOpen(false); setCustomOpen(true); }} />
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={customOpen} onClose={() => setCustomOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 }}>
          <Field label={text(locale, 'displayName')} value={nameAr} onChangeText={setNameAr} />
          <Field label={ar ? 'الاسم بالإنجليزية' : 'English name'} value={nameEn} onChangeText={setNameEn} />
          <Field label={`${text(locale, 'kcal')} / 100 g`} value={energy} onChangeText={setEnergy} keyboardType="number-pad" />
          <Field label={`${text(locale, 'protein')} (${text(locale, 'grams')})`} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'carbs')} (${text(locale, 'grams')})`} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'fat')} (${text(locale, 'grams')})`} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
          {error.length > 0 ? <Body>{error}</Body> : null}
          <Button label={text(locale, 'save')} onPress={() => void saveCustom()} />
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}
