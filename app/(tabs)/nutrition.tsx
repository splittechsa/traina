import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
        <AppHeader title={text(locale, 'nutrition')} subtitle={text(locale, 'noTarget')} />
        <DateSelector days={days} selected={day} onSelect={setDay} labelFor={(value) => formatRiyadhWeekday(value, locale)} />
        {peak > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 56, gap: 6, marginBottom: 8 }}>
            {days.map((value, index) => (
              <View
                key={value}
                style={{
                  flex: 1,
                  height: Math.max(6, ((totals[index] ?? 0) / peak) * 56),
                  backgroundColor: value === day ? theme.accent : theme.lime,
                  borderRadius: 6,
                }}
              />
            ))}
          </View>
        ) : null}
        {diary.data.summary.entryCount > 0 ? (
          <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.headline, lineHeight: 32 }}>
            {`${formatCount(consumed.energyKcal, locale)} ${text(locale, 'kcal')}`}
          </Text>
        ) : (
          <Text style={{ color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 24 }}>{text(locale, 'noMeals')}</Text>
        )}
        {hasMacros ? (
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 18, marginTop: 4 }}>
            {`${text(locale, 'protein')} ${formatGramsFromMg(consumed.proteinMg, locale)} ${text(locale, 'grams')} · ${text(locale, 'carbs')} ${formatGramsFromMg(consumed.carbohydrateMg, locale)} · ${text(locale, 'fat')} ${formatGramsFromMg(consumed.fatMg, locale)}`}
          </Text>
        ) : null}
        {hasMacros ? <MacroProgress protein={consumed.proteinMg} carbs={consumed.carbohydrateMg} fat={consumed.fatMg} /> : null}
        {consumed.imageEstimateEnergyKcal > 0 ? <Body>{text(locale, 'imageEstimate')}</Body> : null}
        <SectionLabel>{text(locale, 'foodSearch')}</SectionLabel>
        <ListRow title={text(locale, 'foodSearch')} meta={text(locale, 'saudiHint')} onPress={() => { setError(''); setSearchOpen(true); }} />
        <SectionLabel>{text(locale, 'history')}</SectionLabel>
        {entries.length === 0 ? <EmptyState compact title={text(locale, 'nutrition')} body={text(locale, 'noMeals')} /> : null}
        {entries.map((entry) => (
          <ListRow
            key={stableRecordKey(entry.id)}
            title={entry.label ?? label(locale, 'foodSource', entry.source)}
            meta={`${formatCount(entry.energyKcal, locale)} ${text(locale, 'kcal')}${entry.source === 'image_estimate' ? ` · ${text(locale, 'imageEstimate')}` : ''}`}
            trailing={text(locale, 'deleteEntry')}
            onPress={() => void removeEntry(entry.id)}
          />
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
