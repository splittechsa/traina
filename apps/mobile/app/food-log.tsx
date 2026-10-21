import { Text } from '../src/ui/Text';
import { useFormRecovery } from '../src/storage/useFormRecovery';
// Search-first food logging: type (or scan) → pick → adjust grams → see calories & macros
// update instantly → one tap to add. Combines the member's own foods with the global Open
// Food Facts library. Logging goes through the existing API contracts (see logFood.ts).
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { formatCount, riyadhToday } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { useTheme } from '../src/theme/ThemeProvider';
import { useMotion } from '../src/theme/motion';
import { fontFamily, radius, spacing, typeScale } from '../src/theme/tokens';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, BottomSheet, EmptyState, SectionLabel } from '../src/ui/kit';
import { QuantityControl } from '../src/ui/pickers/QuantityControl';
import { tapSuccess } from '../src/ui/haptics';
import { lookupBarcode, normalizeLocalFood, searchGlobalFoods, type LibraryFood, type LocalFoodRow } from '../src/nutrition/foodLibrary';
import { logLibraryFood, readRecentFoods } from '../src/nutrition/logFood';
import { macroEnergyShares, MAX_PORTION_GRAMS, MIN_PORTION_GRAMS, portionPresets, previewPortion } from '../src/nutrition/portion';

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function grams(mg: number): number {
  return Math.round(mg / 100) / 10;
}

function FoodThumb({ food, size = 48 }: { food: LibraryFood; size?: number }) {
  const theme = useTheme();
  if (food.imageUrl !== undefined) {
    return (
      <Image
        source={{ uri: food.imageUrl }}
        style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: theme.surfaceMuted }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        recyclingKey={food.key}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} size={size * 0.42} tintColor={theme.textMuted} />
    </View>
  );
}

function FoodRow({ food, onPress }: { food: LibraryFood; onPress: () => void }) {
  const theme = useTheme();
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const name = ar ? food.nameAr : food.nameEn;
  const p = food.per100g;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${p.energyKcal} ${text(locale, 'kcal')} / 100 g`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[3],
        borderRadius: radius.md,
        backgroundColor: pressed ? theme.surfaceMuted : 'transparent',
      })}
    >
      <FoodThumb food={food} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body, writingDirection: 'auto' }}>
          {name}
        </Text>
        <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label }}>
          {[food.brand, ar ? `ب ${grams(p.proteinMg)} · ك ${grams(p.carbohydrateMg)} · د ${grams(p.fatMg)}` : `P ${grams(p.proteinMg)} · C ${grams(p.carbohydrateMg)} · F ${grams(p.fatMg)}`]
            .filter(Boolean)
            .join('  •  ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, fontVariant: ['tabular-nums'] }}>{formatCount(p.energyKcal, locale)}</Text>
        <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.micro }}>{ar ? 'سعرة/١٠٠غ' : 'kcal/100g'}</Text>
      </View>
    </Pressable>
  );
}

function PortionSheet({
  food,
  day,
  mealSlot,
  onClose,
}: {
  food: LibraryFood | null;
  day: string;
  mealSlot?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  onClose: () => void;
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  const { reduce } = useMotion();
  const client = useQueryClient();
  const ar = locale === 'ar';
  const [amount, setAmount] = useState(food?.servingGrams ?? 100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');


  const recovery = useFormRecovery('portion:' + day + ':' + food?.key, { amount }, draft => setAmount(draft.amount), food !== null && amount !== (food?.servingGrams ?? 100), food !== null);
  if (food === null) return null;
  const preview = previewPortion(food, amount);
  const shares = preview === null ? { protein: 0, carbs: 0, fat: 0 } : macroEnergyShares(preview);

  async function add() {
    if (food === null || preview === null) return;
    setSaving(true);
    setError('');
    try {
      await logLibraryFood(food, amount, day, mealSlot);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['diary', day] }),
        client.invalidateQueries({ queryKey: ['home'] }),
        client.invalidateQueries({ queryKey: ['local'] }),
      ]);
      await recovery.clear();
      tapSuccess(reduce);
      onClose();
      router.back();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setSaving(false);
    }
  }

  const macros = [
    { key: 'p', label: text(locale, 'protein'), value: preview?.proteinMg ?? 0, share: shares.protein, color: theme.accent },
    { key: 'c', label: text(locale, 'carbs'), value: preview?.carbohydrateMg ?? 0, share: shares.carbs, color: theme.ember },
    { key: 'f', label: text(locale, 'fat'), value: preview?.fatMg ?? 0, share: shares.fat, color: theme.violet },
  ];

  return (
    <View style={{ gap: spacing[4], paddingBottom: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <FoodThumb food={food} size={56} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, writingDirection: 'auto' }}>
            {ar ? food.nameAr : food.nameEn}
          </Text>
          {food.brand !== undefined ? <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label }}>{food.brand}</Text> : null}
        </View>
      </View>

      <QuantityControl
        value={amount}
        onChange={setAmount}
        min={MIN_PORTION_GRAMS}
        max={MAX_PORTION_GRAMS}
        step={1}
        unit={ar ? 'غ' : 'g'}
        presets={portionPresets(food, locale)}
        accessibilityLabel={ar ? 'الكمية بالغرام' : 'Amount in grams'}
      />

      <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg, padding: spacing[4], gap: spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing[1] }}>
          <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 40, lineHeight: 48, fontVariant: ['tabular-nums'] }}>
            {formatCount(preview?.energyKcal ?? 0, locale)}
          </Text>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.body }}>{text(locale, 'kcal')}</Text>
        </View>
        <View style={{ height: 10, borderRadius: radius.pill, overflow: 'hidden', flexDirection: 'row', backgroundColor: theme.ringTrack }}>
          {macros.map((m) => (
            <View key={m.key} style={{ flex: m.share, backgroundColor: m.color }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row' }}>
          {macros.map((m) => (
            <View key={m.key} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{m.label}</Text>
              </View>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, fontVariant: ['tabular-nums'] }}>
                {formatCount(grams(m.value), locale)} {ar ? 'غ' : 'g'}
              </Text>
            </View>
          ))}
        </View>
        {!food.complete ? (
          <Text style={{ color: theme.warning, fontFamily: fontFamily.medium, fontSize: typeScale.label, textAlign: 'center' }}>
            {ar ? 'المصدر لا يذكر كل المغذيات لهذا المنتج؛ الناقص يظهر صفراً.' : "The source doesn't list every nutrient for this product; missing values show as zero."}
          </Text>
        ) : null}
      </View>

      {error.length > 0 ? <Text style={{ color: theme.danger, fontFamily: fontFamily.medium, fontSize: typeScale.label, textAlign: 'center' }}>{error}</Text> : null}
      <Button label={saving ? (ar ? 'جارٍ الإضافة…' : 'Adding…') : ar ? 'أضف إلى يومياتي' : 'Add to diary'} onPress={() => void add()} disabled={saving || preview === null} />
    </View>
  );
}

export default function FoodLogScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const ar = locale === 'ar';
  const params = useLocalSearchParams<{ day?: string; code?: string; mealSlot?: string }>();
  const day = typeof params.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : riyadhToday();
  const code = typeof params.code === 'string' ? params.code : undefined;
  const mealSlot =
    params.mealSlot === 'breakfast' || params.mealSlot === 'lunch' || params.mealSlot === 'dinner' || params.mealSlot === 'snack'
      ? params.mealSlot
      : undefined;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LibraryFood | null>(null);
  const term = useDebounced(query.trim(), 420);
  const searching = term.length >= 2;

  const recents = useQuery({ queryKey: ['local', 'sahhti.recentFoods'], queryFn: readRecentFoods, staleTime: Infinity });
  const mine = useQuery({
    queryKey: ['foods', term],
    enabled: searching,
    queryFn: () => apiRequest<{ foods: LocalFoodRow[] }>(`/v1/nutrition/foods?q=${encodeURIComponent(term)}`),
  });
  const global = useQuery({
    queryKey: ['off-search', term],
    enabled: searching,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: ({ signal }) => searchGlobalFoods(term, signal),
  });
  const scanned = useQuery({
    queryKey: ['off-barcode', code],
    enabled: code !== undefined,
    staleTime: Infinity,
    queryFn: ({ signal }) => lookupBarcode(code ?? '', signal),
  });

  const [previousScan, setPreviousScan] = useState<LibraryFood | null | undefined>(undefined);
  if (scanned.data !== previousScan) {
    setPreviousScan(scanned.data);
    if (scanned.data != null) setSelected(scanned.data);
  }

  const mineFoods = useMemo(() => (mine.data?.foods ?? []).map(normalizeLocalFood), [mine.data]);
  // Hide global hits the member already saved under the same name to avoid duplicates.
  const globalFoods = useMemo(() => {
    const names = new Set(mineFoods.map((food) => food.nameEn.toLowerCase()));
    return (global.data ?? []).filter((food) => !names.has(food.nameEn.toLowerCase()));
  }, [global.data, mineFoods]);

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={ar ? 'أضف طعاماً' : 'Add food'}
          subtitle={
            mealSlot === 'breakfast' ? text(locale, 'mealBreakfast')
              : mealSlot === 'lunch' ? text(locale, 'mealLunch')
                : mealSlot === 'dinner' ? text(locale, 'mealDinner')
                  : mealSlot === 'snack' ? text(locale, 'mealSnacks')
                    : ar ? 'ابحث، اختر الكمية، وأضف' : 'Search, set the amount, add'
          }
          showBack
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              backgroundColor: theme.surface,
              borderRadius: radius.pill,
              paddingHorizontal: spacing[4],
              height: 48,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={17} tintColor={theme.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus={code === undefined}
              placeholder={ar ? 'مثال: لبن المراعي، رز، صدر دجاج' : 'e.g. laban, rice, chicken breast'}
              placeholderTextColor={theme.textMuted}
              returnKeyType="search"
              autoCorrect={false}
              style={{ flex: 1, color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, writingDirection: ar ? 'rtl' : 'ltr' }}
              accessibilityLabel={ar ? 'ابحث عن طعام' : 'Search food'}
            />
            {query.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={ar ? 'مسح' : 'Clear'} onPress={() => setQuery('')} hitSlop={8}>
                <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={17} tintColor={theme.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ar ? 'مسح الباركود' : 'Scan barcode'}
            onPress={() => router.push({ pathname: '/scanner', params: { day } })}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}
          >
            <SymbolView name={{ ios: 'barcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }} size={22} tintColor={theme.emphasisText} />
          </Pressable>
        </View>

        {code !== undefined && scanned.isPending ? (
          <View style={{ paddingVertical: spacing[5], alignItems: 'center', gap: spacing[2] }}>
            <ActivityIndicator color={theme.accent} />
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular }}>{ar ? 'نبحث عن المنتج…' : 'Looking up product…'}</Text>
          </View>
        ) : null}
        {code !== undefined && scanned.isSuccess && scanned.data === null ? (
          <EmptyState
            compact
            title={ar ? 'المنتج غير موجود في المكتبة' : 'Product not in the library'}
            body={ar ? `الباركود ${code} غير مسجّل بقيم غذائية كافية. ابحث بالاسم أو أضفه كطعام خاص من صفحة التغذية.` : `Barcode ${code} has no usable nutrition data. Search by name, or add it as a custom food from Nutrition.`}
          />
        ) : null}

        {!searching ? (
          <>
            <SectionLabel>{ar ? 'أضفتها مؤخراً' : 'Recent'}</SectionLabel>
            {(recents.data ?? []).length === 0 ? (
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, lineHeight: 20 }}>
                {ar ? 'اكتب اسم الطعام أو امسح الباركود. الأطعمة التي تضيفها تظهر هنا للوصول السريع.' : 'Type a food name or scan a barcode. Foods you add show up here for one-tap logging.'}
              </Text>
            ) : (
              (recents.data ?? []).map((food) => <FoodRow key={food.key} food={food} onPress={() => setSelected(food)} />)
            )}
          </>
        ) : (
          <>
            {mineFoods.length > 0 ? (
              <>
                <SectionLabel>{ar ? 'أطعمتك' : 'Your foods'}</SectionLabel>
                {mineFoods.map((food) => (
                  <FoodRow key={food.key} food={food} onPress={() => setSelected(food)} />
                ))}
              </>
            ) : null}
            <SectionLabel>{ar ? 'المكتبة العالمية' : 'Global library'}</SectionLabel>
            {global.isPending ? (
              <View style={{ paddingVertical: spacing[4], alignItems: 'center' }}>
                <ActivityIndicator color={theme.accent} />
              </View>
            ) : global.isError ? (
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label }}>
                {ar ? 'تعذّر الوصول للمكتبة العالمية الآن. تحقق من الاتصال وحاول مجدداً.' : "Couldn't reach the global library. Check your connection and try again."}
              </Text>
            ) : globalFoods.length === 0 && mineFoods.length === 0 ? (
              <EmptyState compact title={ar ? 'لا نتائج' : 'No results'} body={ar ? 'جرّب اسماً أقصر أو بالإنجليزية.' : 'Try a shorter name, or search in Arabic.'} />
            ) : (
              globalFoods.map((food) => <FoodRow key={food.key} food={food} onPress={() => setSelected(food)} />)
            )}
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.micro, marginTop: spacing[4], lineHeight: 16 }}>
              {ar ? 'بيانات المكتبة العالمية من Open Food Facts (رخصة ODbL)، يحررها مساهمون؛ راجع الملصق عند الشك.' : 'Global library data from Open Food Facts (ODbL), contributed by volunteers — check the label when in doubt.'}
            </Text>
          </>
        )}
      </ScreenBody>

      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)}>
        <PortionSheet key={selected?.key ?? 'none'} food={selected} day={day} mealSlot={mealSlot} onClose={() => setSelected(null)} />
      </BottomSheet>
    </Screen>
  );
}
