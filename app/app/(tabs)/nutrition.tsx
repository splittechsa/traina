import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient, useQueries } from '@tanstack/react-query';
import { parseScaledInteger } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { formatCount, formatGramsFromMg, formatRiyadhWeekday, riyadhToday } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { fontFamily, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, BottomSheet, DateSelector, EmptyState, ErrorState, ListRow, LoadingSkeleton, MacroProgress, SectionLabel } from '../../src/ui/kit';
import { stableRecordKey } from '../../src/lists/keys';

type Entry = { id: string; energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number; source: string; label?: string | null };
type FoodHit = { id: string; name_ar: string; name_en: string; energy_kcal: number; per_quantity: string };
type Diary = {
  target: null;
  entries?: Entry[];
  summary: {
    consumed: { energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number; imageEstimateEnergyKcal: number };
    entryCount: number;
  };
};

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [energy, setEnergy] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState('');
  const [foodQuery, setFoodQuery] = useState('');
  const [grams, setGrams] = useState('100');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const foods = useQuery({
    queryKey: ['foods', foodQuery],
    enabled: foodQuery.trim().length >= 2,
    queryFn: () => apiRequest<{ foods: FoodHit[]; referenceDatabase: boolean }>(`/v1/nutrition/foods?q=${encodeURIComponent(foodQuery.trim())}`),
  });
  const week = useQueries({
    queries: days.map((value) => ({
      queryKey: ['diary', value],
      queryFn: () => apiRequest<Diary>(`/v1/nutrition/diary?on=${value}`),
    })),
  });
  const diary = week[days.indexOf(day)];

  async function logPortion(foodId: string) {
    setError('');
    const quantityGrams = Number(grams);
    if (!Number.isInteger(quantityGrams) || quantityGrams < 1 || quantityGrams > 2000) {
      setError(text(locale, 'portion'));
      return;
    }
    try {
      await apiRequest('/v1/nutrition/portions', { method: 'POST', body: { foodItemId: foodId, quantityGrams, loggedOn: day } });
      await client.invalidateQueries({ queryKey: ['diary', day] });
      await client.invalidateQueries({ queryKey: ['home'] });
      setSearchOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    }
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
      setFoodQuery(nameEn.trim().length >= 2 ? nameEn.trim() : nameAr.trim());
      setSearchOpen(true);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    }
  }

  async function save() {
    setError('');
    try {
      await apiRequest('/v1/nutrition/entries', {
        method: 'POST',
        body: {
          loggedOn: day,
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

  if (diary === undefined || diary.isPending) {
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
  const entries = diary.data.entries ?? [];
  const totals = week.map((item) => item.data?.summary.consumed.energyKcal ?? 0);
  const peak = Math.max(0, ...totals);
  const hasMacros = consumed.proteinMg + consumed.carbohydrateMg + consumed.fatMg > 0;
  const gramsNumber = Number(grams);
  return (
    <Screen>
      <ScreenBody
        footer={
          <Button
            label={text(locale, 'foodManual')}
            onPress={() => {
              setError('');
              setSearchOpen(true);
            }}
          />
        }
      >
        <AppHeader title={text(locale, 'nutrition')} subtitle={locale === 'ar' ? 'وقود أدائك، يومًا بيوم' : 'Fuel your performance, one day at a time'} />
        <DateSelector days={days} selected={day} onSelect={setDay} labelFor={(value) => formatRiyadhWeekday(value, locale)} />
        <View style={{ backgroundColor: theme.hero, borderRadius: 26, padding: 22, gap: 14, marginTop: 8 }}>
          <Text style={{ color: theme.heroText, fontFamily: fontFamily.medium, fontSize: 13, textAlign: locale === 'ar' ? 'right' : 'left' }}>{locale === 'ar' ? 'السعرات المسجلة اليوم' : 'Calories logged today'}</Text>
          <View style={{ flexDirection: locale === 'ar' ? 'row-reverse' : 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 43, lineHeight: 55 }}>{formatCount(consumed.energyKcal, locale)}</Text>
            <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.medium, fontSize: 14 }}>{text(locale, 'kcal')}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.14)' }} />
          <View style={{ flexDirection: locale === 'ar' ? 'row-reverse' : 'row', gap: 8 }}>
            {([
              [text(locale, 'protein'), consumed.proteinMg],
              [text(locale, 'carbs'), consumed.carbohydrateMg],
              [text(locale, 'fat'), consumed.fatMg],
            ] as const).map(([name, amount]) => (
              <View key={name} style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12, fontFamily: fontFamily.medium, textAlign: locale === 'ar' ? 'right' : 'left' }}>{name}</Text>
                <Text style={{ color: theme.heroText, fontFamily: fontFamily.semibold, fontSize: 18, textAlign: locale === 'ar' ? 'right' : 'left' }}>{formatGramsFromMg(amount, locale)} <Text style={{ fontSize: 11 }}>{text(locale, 'grams')}</Text></Text>
              </View>
            ))}
          </View>
          {diary.data.target === null ? <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12, fontFamily: fontFamily.regular, textAlign: locale === 'ar' ? 'right' : 'left' }}>{locale === 'ar' ? 'لم يتم تحديد هدف غذائي بعد — الأرقام المعروضة مسجلة وليست مستهدفة.' : 'No nutrition target set — these are logged amounts, not targets.'}</Text> : null}
        </View>
        <View style={{ flexDirection: locale === 'ar' ? 'row-reverse' : 'row', gap: 10, marginTop: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => { setError(''); setSearchOpen(true); }} style={{ flex: 1, backgroundColor: theme.accent, paddingVertical: 16, borderRadius: 18, alignItems: 'center' }}>
            <Text style={{ color: theme.emphasisText, fontFamily: fontFamily.bold, fontSize: 14 }}>{locale === 'ar' ? '+ ابحث عن طعام' : '+ Find food'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setError(''); setManualOpen(true); }} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 16, borderRadius: 18, alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 14 }}>{text(locale, 'manualEntry')}</Text>
          </Pressable>
        </View>
        {peak > 0 ? (
          <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 18, marginTop: 20, gap: 12 }}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 16, textAlign: locale === 'ar' ? 'right' : 'left' }}>{locale === 'ar' ? 'آخر ٧ أيام' : 'Last 7 days'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 75, gap: 9 }}>
              {days.map((value, index) => (
                <View key={value} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                  <View style={{ width: '100%', height: Math.max(5, ((totals[index] ?? 0) / peak) * 51), backgroundColor: value === day ? theme.accent : theme.surfaceMuted, borderRadius: 7 }} />
                  <Text style={{ color: theme.textMuted, fontSize: 10 }}>{formatRiyadhWeekday(value, locale).slice(0, 2)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {consumed.imageEstimateEnergyKcal > 0 ? <Body>{text(locale, 'imageEstimate')}</Body> : null}
        <SectionLabel>{locale === 'ar' ? 'سجل الوجبات' : 'Food diary'}</SectionLabel>
        {entries.length === 0 ? (
          <View style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 22, padding: 24, alignItems: 'center', gap: 10 }}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 17 }}>{locale === 'ar' ? 'ابدأ بأول وجبة' : 'Start with your first meal'}</Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: 13, textAlign: 'center', lineHeight: 22 }}>{locale === 'ar' ? 'سجل ما أكلته لتشوف استهلاكك الحقيقي وتتابع تغذيتك.' : 'Log what you eat to see your actual intake.'}</Text>
            <Button label={locale === 'ar' ? 'إضافة وجبة' : 'Add a meal'} onPress={() => setSearchOpen(true)} variant="secondary" />
          </View>
        ) : entries.map((entry) => (
          <View key={stableRecordKey(entry.id)} style={{ backgroundColor: theme.surface, borderRadius: 18, marginBottom: 8, overflow: 'hidden' }}>
            <ListRow title={entry.label ?? label(locale, 'foodSource', entry.source)} meta={`${formatCount(entry.energyKcal, locale)} ${text(locale, 'kcal')}${entry.source === 'image_estimate' ? ` · ${text(locale, 'imageEstimate')}` : ''}`} trailing={text(locale, 'deleteEntry')} onPress={() => void removeEntry(entry.id)} />
          </View>
        ))}
      </ScreenBody>
      <BottomSheet visible={searchOpen} onClose={() => setSearchOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 12 }}>
          <Field label={text(locale, 'foodSearch')} value={foodQuery} onChangeText={setFoodQuery} />
          <Field label={text(locale, 'portion')} value={grams} onChangeText={setGrams} keyboardType="number-pad" />
          {foods.data?.referenceDatabase === false && foodQuery.trim().length >= 2 ? <Body>{text(locale, 'foodSearchEmpty')}</Body> : null}
          {foods.data !== undefined && foods.data.foods.length === 0 && foodQuery.trim().length >= 2 ? <Body>{text(locale, 'noFoodMatch')}</Body> : null}
          {foods.data?.foods.map((food) => (
            <ListRow
              key={stableRecordKey(food.id)}
              title={locale === 'ar' ? food.name_ar : food.name_en}
              meta={Number.isInteger(gramsNumber) && gramsNumber > 0 ? `${formatCount(Math.floor((food.energy_kcal * gramsNumber) / 100), locale)} ${text(locale, 'kcal')}` : text(locale, 'portion')}
              onPress={() => void logPortion(food.id)}
            />
          ))}
          {error.length > 0 ? <Body>{error}</Body> : null}
          <Button label={text(locale, 'manualEntry')} variant="secondary" onPress={() => { setSearchOpen(false); setManualOpen(true); }} />
          <Button label={text(locale, 'customFood')} variant="secondary" onPress={() => { setSearchOpen(false); setCustomOpen(true); }} />
        </ScrollView>
      </BottomSheet>
      <BottomSheet visible={manualOpen} onClose={() => setManualOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 }}>
          <Field label={text(locale, 'kcal')} value={energy} onChangeText={setEnergy} keyboardType="number-pad" />
          <Field label={`${text(locale, 'protein')} (${text(locale, 'grams')})`} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'carbs')} (${text(locale, 'grams')})`} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'fat')} (${text(locale, 'grams')})`} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
          <Body>{text(locale, 'saudiHint')}</Body>
          {error.length > 0 ? <Body>{error}</Body> : null}
          <Button label={text(locale, 'save')} onPress={() => void save()} />
        </ScrollView>
      </BottomSheet>
      <BottomSheet visible={customOpen} onClose={() => setCustomOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 }}>
          <Field label={text(locale, 'displayName')} value={nameAr} onChangeText={setNameAr} />
          <Field label="English" value={nameEn} onChangeText={setNameEn} />
          <Field label={`${text(locale, 'kcal')} / 100 g`} value={energy} onChangeText={setEnergy} keyboardType="number-pad" />
          <Field label={`${text(locale, 'protein')} (${text(locale, 'grams')})`} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'carbs')} (${text(locale, 'grams')})`} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'fat')} (${text(locale, 'grams')})`} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
          <Body>{text(locale, 'saudiHint')}</Body>
          {error.length > 0 ? <Body>{error}</Body> : null}
          <Button label={text(locale, 'save')} onPress={() => void saveCustom()} />
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}
