import { useState } from 'react';
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
import { text } from '../../src/i18n/copy';
import { fontFamily, radius, spacing, typeScale } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';
import { AppHeader, BottomSheet, DateSelector, ErrorState, ListRow, LoadingSkeleton, SectionLabel } from '../../src/ui/kit';
import { GlowCard, GradientRing, MacroBar } from '../../src/ui/visual';
import { LOCAL_KEYS, useLocalValue } from '../../src/storage/local';
import type { MacroTargets } from '../../src/nutrition/targets';
import { stableRecordKey } from '../../src/lists/keys';

type Entry = { id: string; energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number; source: string; label?: string | null };
type Diary = {
  target: null;
  entries?: Entry[];
  summary: {
    consumed: { energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number; imageEstimateEnergyKcal: number };
    entryCount: number;
  };
};
type DiaryRange = {
  days: {
    loggedOn: string;
    energyKcal: number;
    proteinMg: number;
    carbohydrateMg: number;
    fatMg: number;
    entryCount: number;
  }[];
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
  const [manualOpen, setManualOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [energy, setEnergy] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const targets = useLocalValue<MacroTargets | null>(LOCAL_KEYS.macroTargets, null);
  const diary = useQuery({
    queryKey: ['diary', day],
    queryFn: () => apiRequest<Diary>(`/v1/nutrition/diary?on=${day}`),
  });
  const rangeStart = days[0] ?? day;
  const rangeEnd = days[days.length - 1] ?? day;
  const week = useQuery({
    queryKey: ['diary-range', rangeStart, rangeEnd],
    queryFn: () => apiRequest<DiaryRange>(`/v1/nutrition/diary-range?from=${rangeStart}&to=${rangeEnd}`),
  });

  function openFoodLog() {
    router.push({ pathname: '/food-log', params: { day } });
  }

  async function removeEntry(entryId: string) {
    await apiRequest(`/v1/nutrition/entries/${entryId}`, { method: 'DELETE' });
    await client.invalidateQueries({ queryKey: ['diary', day] });
    await client.invalidateQueries({ queryKey: ['diary-range'] });
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
      // The new food is now in "Your foods" — open search so it can be logged right away.
      openFoodLog();
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
      await client.invalidateQueries({ queryKey: ['diary-range'] });
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
  const entries = diary.data.entries ?? [];
  const totals = days.map((value) => week.data?.days.find((item) => item.loggedOn === value)?.energyKcal ?? 0);
  const peak = Math.max(0, ...totals);
  const ar = locale === 'ar';
  const target = targets.value;
  const g = ar ? 'غ' : 'g';
  const remainingKcal = target === null ? null : target.energyKcal - consumed.energyKcal;
  return (
    <Screen>
      <ScreenBody>
        <AppHeader title={text(locale, 'nutrition')} subtitle={ar ? 'وقود أدائك، يومًا بيوم' : 'Fuel your performance, one day at a time'} />
        <DateSelector days={days} selected={day} onSelect={setDay} labelFor={(value) => formatRiyadhWeekday(value, locale)} />
        <View style={{ height: spacing[2] }} />
        <GlowCard glow={theme.ember}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <GradientRing
              size={136}
              stroke={13}
              progress={target === null ? (consumed.energyKcal > 0 ? 1 : 0) : consumed.energyKcal / Math.max(1, target.energyKcal)}
              from={theme.heroAccent}
              to={theme.ember}
              track="rgba(255,255,255,0.08)"
              accessibilityLabel={`${consumed.energyKcal} ${text(locale, 'kcal')}`}
            >
              <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'] }}>{formatCount(consumed.energyKcal, locale)}</Text>
              <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium, fontSize: typeScale.micro }}>{text(locale, 'kcal')}</Text>
            </GradientRing>
            <View style={{ flex: 1, gap: spacing[1] }}>
              {target !== null && remainingKcal !== null ? (
                <>
                  <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium, fontSize: typeScale.label }}>
                    {remainingKcal >= 0 ? (ar ? 'متبقٍ اليوم' : 'Left today') : ar ? 'فوق هدفك' : 'Over target'}
                  </Text>
                  <Text style={{ color: remainingKcal >= 0 ? theme.heroText : theme.warning, fontFamily: fontFamily.bold, fontSize: typeScale.display, fontVariant: ['tabular-nums'] }}>
                    {formatCount(Math.abs(remainingKcal), locale)}
                  </Text>
                  <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.regular, fontSize: typeScale.micro }}>
                    {ar ? `من ${formatCount(target.energyKcal, locale)} · تقديرك الشخصي` : `of ${formatCount(target.energyKcal, locale)} · your estimate`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: theme.heroText, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{ar ? 'ما عندك هدف يومي بعد' : 'No daily target yet'}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/macros')} hitSlop={6}>
                    <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.bold, fontSize: typeScale.body }}>{ar ? 'احسب سعراتك وماكروزك ←' : 'Calculate calories & macros →'}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          <View style={{ gap: spacing[3], marginTop: spacing[4] }}>
            <MacroBar inverse label={text(locale, 'protein')} value={consumed.proteinMg / 1000} target={target?.proteinG ?? null} unit={g} color={theme.heroAccent} />
            <MacroBar inverse label={text(locale, 'carbs')} value={consumed.carbohydrateMg / 1000} target={target?.carbsG ?? null} unit={g} color={theme.ember} />
            <MacroBar inverse label={text(locale, 'fat')} value={consumed.fatMg / 1000} target={target?.fatG ?? null} unit={g} color={theme.violet} />
          </View>
          {target !== null ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/macros')} style={{ marginTop: spacing[3] }}>
              <Text style={{ color: theme.heroAccent, fontFamily: fontFamily.semibold, fontSize: typeScale.label }}>{ar ? 'تعديل الهدف' : 'Adjust target'}</Text>
            </Pressable>
          ) : null}
        </GlowCard>
        <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
          <Pressable
            accessibilityRole="button"
            onPress={openFoodLog}
            style={({ pressed }) => ({ flex: 1, flexDirection: 'row', gap: spacing[2], backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1, height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' })}
          >
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={17} tintColor={theme.emphasisText} />
            <Text style={{ color: theme.emphasisText, fontFamily: fontFamily.bold, fontSize: typeScale.body }}>{ar ? 'أضف طعاماً' : 'Add food'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ar ? 'مسح الباركود' : 'Scan barcode'}
            onPress={() => router.push({ pathname: '/scanner', params: { day } })}
            style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <SymbolView name={{ ios: 'barcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }} size={22} tintColor={theme.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text(locale, 'manualEntry')}
            onPress={() => { setError(''); setManualOpen(true); }}
            style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <SymbolView name={{ ios: 'square.and.pencil', android: 'edit', web: 'edit' }} size={20} tintColor={theme.text} />
          </Pressable>
        </View>
        {peak > 0 ? (
          <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 18, marginTop: 20, gap: 12 }}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 16 }}>{ar ? 'آخر ٧ أيام' : 'Last 7 days'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8 }}>
              {days.map((value, index) => (
                <View key={value} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <View style={{ width: '70%', height: Math.max(8, ((totals[index] ?? 0) / peak) * 92), backgroundColor: value === day ? theme.emphasis : theme.surfaceMuted, borderRadius: 10 }} />
                  <Text style={{ color: value === day ? theme.accent : theme.textMuted, fontSize: 11, fontFamily: fontFamily.medium }}>{formatRiyadhWeekday(value, locale).slice(0, 2)}</Text>
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
          </View>
        ) : entries.map((entry) => (
          <ListRow
            key={stableRecordKey(entry.id)}
            title={entry.label ?? label(locale, 'foodSource', entry.source)}
            meta={`${formatCount(entry.energyKcal, locale)} ${text(locale, 'kcal')}${entry.source === 'image_estimate' ? ` · ${text(locale, 'imageEstimate')}` : ''}`}
            trailing={text(locale, 'deleteEntry')}
            onPress={() => void removeEntry(entry.id)}
          />
        ))}
      </ScreenBody>
      <BottomSheet visible={manualOpen} onClose={() => setManualOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 }}>
          <Field label={text(locale, 'kcal')} value={energy} onChangeText={setEnergy} keyboardType="number-pad" />
          <Field label={`${text(locale, 'protein')} (${text(locale, 'grams')})`} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'carbs')} (${text(locale, 'grams')})`} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
          <Field label={`${text(locale, 'fat')} (${text(locale, 'grams')})`} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
          <Body>{text(locale, 'saudiHint')}</Body>
          {error.length > 0 ? <Body>{error}</Body> : null}
          <Button label={text(locale, 'save')} onPress={() => void save()} />
          <View style={{ height: spacing[2] }} />
          <Button label={text(locale, 'customFood')} variant="secondary" onPress={() => { setManualOpen(false); setCustomOpen(true); }} />
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
