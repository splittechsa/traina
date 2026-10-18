import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { formatCount, riyadhToday } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { fontFamily, radius, spacing, typeScale } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Body, Button, Field, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, LoadingSkeleton, SurfaceCard } from '../src/ui/kit';

type FoodHit = {
  id: string;
  name_ar: string;
  name_en: string;
  energy_kcal: number;
  protein_mg: number;
  carbohydrate_mg: number;
  fat_mg: number;
  per_quantity?: string;
};

type IngredientDraft = {
  foodItemId: string;
  nameAr: string;
  nameEn: string;
  quantityGrams: string;
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
};

type CustomMeal = {
  id: string;
  foodItemId: string;
  nameAr: string;
  nameEn: string;
  servings: number;
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
  ingredients: {
    foodItemId: string;
    quantityGrams: number;
    nameAr: string;
    nameEn: string;
  }[];
};

function scalePreview(per100: FoodHit, grams: number) {
  if (!Number.isFinite(grams) || grams < 1) {
    return { energyKcal: 0, proteinMg: 0, carbohydrateMg: 0, fatMg: 0 };
  }
  return {
    energyKcal: Math.floor((per100.energy_kcal * grams) / 100),
    proteinMg: Math.floor((per100.protein_mg * grams) / 100),
    carbohydrateMg: Math.floor((per100.carbohydrate_mg * grams) / 100),
    fatMg: Math.floor((per100.fat_mg * grams) / 100),
  };
}

export default function MealBuilderScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const params = useLocalSearchParams<{ mealId?: string; day?: string; mealSlot?: string }>();
  const ar = locale === 'ar';
  const day = typeof params.day === 'string' && params.day.length >= 8 ? params.day : riyadhToday();
  const mealSlot =
    params.mealSlot === 'breakfast' || params.mealSlot === 'lunch' || params.mealSlot === 'dinner' || params.mealSlot === 'snack'
      ? params.mealSlot
      : undefined;

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [servings, setServings] = useState('1');
  const [query, setQuery] = useState('');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(typeof params.mealId === 'string' ? params.mealId : null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const meals = useQuery({
    queryKey: ['custom-meals'],
    queryFn: () => apiRequest<{ meals: CustomMeal[] }>('/v1/nutrition/custom-meals'),
  });
  const favorites = useQuery({
    queryKey: ['food-favorites'],
    queryFn: () => apiRequest<{ foods: FoodHit[] }>('/v1/nutrition/favorites'),
  });
  const search = useQuery({
    queryKey: ['food-search', query],
    enabled: query.trim().length >= 2,
    queryFn: () => apiRequest<{ foods: FoodHit[] }>(`/v1/nutrition/foods?q=${encodeURIComponent(query.trim())}`),
  });

  const totals = useMemo(() => {
    return ingredients.reduce(
      (sum, row) => {
        const grams = Number(row.quantityGrams);
        const scaled = scalePreview(
          {
            id: row.foodItemId,
            name_ar: row.nameAr,
            name_en: row.nameEn,
            energy_kcal: row.energyKcal,
            protein_mg: row.proteinMg,
            carbohydrate_mg: row.carbohydrateMg,
            fat_mg: row.fatMg,
          },
          Number.isFinite(grams) ? grams : 0,
        );
        return {
          energyKcal: sum.energyKcal + scaled.energyKcal,
          proteinMg: sum.proteinMg + scaled.proteinMg,
          carbohydrateMg: sum.carbohydrateMg + scaled.carbohydrateMg,
          fatMg: sum.fatMg + scaled.fatMg,
        };
      },
      { energyKcal: 0, proteinMg: 0, carbohydrateMg: 0, fatMg: 0 },
    );
  }, [ingredients]);

  const servingCount = Math.max(1, Math.min(20, Number.parseInt(servings, 10) || 1));
  const perServing = {
    energyKcal: Math.floor(totals.energyKcal / servingCount),
    proteinMg: Math.floor(totals.proteinMg / servingCount),
    carbohydrateMg: Math.floor(totals.carbohydrateMg / servingCount),
    fatMg: Math.floor(totals.fatMg / servingCount),
  };

  function loadMeal(meal: CustomMeal) {
    setEditingId(meal.id);
    setNameAr(meal.nameAr);
    setNameEn(meal.nameEn);
    setServings(String(meal.servings));
    setIngredients(
      meal.ingredients.map((ing) => ({
        foodItemId: ing.foodItemId,
        nameAr: ing.nameAr,
        nameEn: ing.nameEn,
        quantityGrams: String(ing.quantityGrams),
        energyKcal: 0,
        proteinMg: 0,
        carbohydrateMg: 0,
        fatMg: 0,
      })),
    );
    setNotice('');
    setError('');
  }

  function addFood(food: FoodHit) {
    if (food.per_quantity !== undefined && food.per_quantity !== '100 g') {
      setError(ar ? 'المكوّنات يجب أن تكون لكل ١٠٠ غ' : 'Ingredients must be foods stored per 100 g');
      return;
    }
    if (ingredients.some((row) => row.foodItemId === food.id)) return;
    setIngredients((current) => [
      ...current,
      {
        foodItemId: food.id,
        nameAr: food.name_ar,
        nameEn: food.name_en,
        quantityGrams: '100',
        energyKcal: food.energy_kcal,
        proteinMg: food.protein_mg,
        carbohydrateMg: food.carbohydrate_mg,
        fatMg: food.fat_mg,
      },
    ]);
    setQuery('');
    setError('');
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        nameAr: nameAr.trim() || nameEn.trim(),
        nameEn: nameEn.trim() || nameAr.trim(),
        servings: servingCount,
        ingredients: ingredients.map((row) => ({
          foodItemId: row.foodItemId,
          quantityGrams: Number.parseInt(row.quantityGrams, 10),
        })),
      };
      if (payload.nameAr.length === 0 || payload.ingredients.some((row) => !Number.isFinite(row.quantityGrams) || row.quantityGrams < 1)) {
        throw new ApiClientError(422, 'INVALID_MEAL', ar ? 'تحقق من الاسم والكميات' : 'Check the name and quantities');
      }
      if (editingId !== null) {
        return apiRequest<CustomMeal>(`/v1/nutrition/custom-meals/${editingId}`, { method: 'PUT', body: payload });
      }
      return apiRequest<CustomMeal>('/v1/nutrition/custom-meals', { method: 'POST', body: payload });
    },
    onSuccess: async (meal) => {
      setEditingId(meal.id);
      setNotice(text(locale, 'saveCustomMeal'));
      await client.invalidateQueries({ queryKey: ['custom-meals'] });
      await client.invalidateQueries({ queryKey: ['food-favorites'] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    },
  });

  const logMeal = useMutation({
    mutationFn: async (meal: CustomMeal) => {
      await apiRequest('/v1/nutrition/portions', {
        method: 'POST',
        body: {
          foodItemId: meal.foodItemId,
          quantityGrams: 1,
          loggedOn: day,
          ...(mealSlot ? { mealSlot } : {}),
        },
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['diary', day] });
      await client.invalidateQueries({ queryKey: ['home'] });
      router.back();
    },
    onError: (caught) => {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    },
  });

  const isPerHundred = (food: FoodHit) => food.per_quantity === undefined || food.per_quantity === '100 g';
  const hits = (search.data?.foods ?? []).filter(isPerHundred);
  const favoriteHits = (favorites.data?.foods ?? []).filter(isPerHundred);

  if (meals.isPending) {
    return (
      <Screen>
        <AppHeader title={text(locale, 'customMealBuilder')} showBack />
        <LoadingSkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenBody
        footer={
          <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2], gap: 8 }}>
            {error.length > 0 ? <Text style={{ color: theme.danger, fontFamily: fontFamily.medium }}>{error}</Text> : null}
            {notice.length > 0 ? <Text style={{ color: theme.success, fontFamily: fontFamily.medium }}>{notice}</Text> : null}
            <Button
              label={save.isPending ? text(locale, 'loading') : editingId ? text(locale, 'editCustomMeal') : text(locale, 'saveCustomMeal')}
              onPress={() => save.mutate()}
              disabled={save.isPending || ingredients.length === 0}
            />
          </View>
        }
      >
        <AppHeader title={text(locale, 'customMealBuilder')} subtitle={text(locale, 'customMealHint')} showBack />

        <SurfaceCard style={{ marginBottom: spacing[3] }}>
          <Field label={ar ? 'الاسم بالعربية' : 'Arabic name'} value={nameAr} onChangeText={setNameAr} autoCapitalize="words" />
          <Field label={ar ? 'الاسم بالإنجليزية' : 'English name'} value={nameEn} onChangeText={setNameEn} autoCapitalize="words" />
          <Field label={text(locale, 'servings')} value={servings} onChangeText={setServings} keyboardType="number-pad" />
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 4 }}>
            {formatCount(perServing.energyKcal, locale)} {text(locale, 'kcal')} / {text(locale, 'servings').toLowerCase()}
            {' · '}P {formatCount(perServing.proteinMg / 1000, locale)}g
            {' · '}C {formatCount(perServing.carbohydrateMg / 1000, locale)}g
            {' · '}F {formatCount(perServing.fatMg / 1000, locale)}g
          </Text>
        </SurfaceCard>

        <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>
          {text(locale, 'mealIngredients')}
        </Text>
        {ingredients.length === 0 ? (
          <EmptyState title={text(locale, 'addIngredient')} body={text(locale, 'customMealHint')} compact />
        ) : (
          ingredients.map((row, index) => (
            <SurfaceCard key={row.foodItemId} style={{ marginBottom: spacing[2] }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, textAlign: ar ? 'right' : 'left' }}>
                {ar ? row.nameAr : row.nameEn}
              </Text>
              <Field
                label={text(locale, 'portion')}
                value={row.quantityGrams}
                onChangeText={(value) => {
                  setIngredients((current) => current.map((item, i) => (i === index ? { ...item, quantityGrams: value } : item)));
                }}
                keyboardType="number-pad"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setIngredients((current) => current.filter((item) => item.foodItemId !== row.foodItemId))}
                style={{ minHeight: 40, justifyContent: 'center' }}
              >
                <Text style={{ color: theme.danger, fontFamily: fontFamily.semibold }}>{text(locale, 'removeIngredient')}</Text>
              </Pressable>
            </SurfaceCard>
          ))
        )}

        <Field label={text(locale, 'foodSearch')} value={query} onChangeText={setQuery} />
        {hits.map((food) => (
          <Pressable
            key={food.id}
            accessibilityRole="button"
            onPress={() => addFood(food)}
            style={{
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, textAlign: ar ? 'right' : 'left' }}>
              {ar ? food.name_ar : food.name_en}
            </Text>
            <Text style={{ color: theme.textMuted, textAlign: ar ? 'right' : 'left' }}>
              {formatCount(food.energy_kcal, locale)} {text(locale, 'kcal')} / 100 g
            </Text>
          </Pressable>
        ))}
        {query.trim().length < 2 && favoriteHits.length > 0 ? (
          <>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.semibold, marginTop: spacing[3], marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>
              {text(locale, 'addIngredient')}
            </Text>
            {favoriteHits.slice(0, 8).map((food) => (
              <Pressable key={food.id} accessibilityRole="button" onPress={() => addFood(food)} style={{ paddingVertical: 10 }}>
                <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, textAlign: ar ? 'right' : 'left' }}>
                  {ar ? food.name_ar : food.name_en}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, marginTop: spacing[5], marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>
          {text(locale, 'myCustomMeals')}
        </Text>
        {(meals.data?.meals ?? []).length === 0 ? (
          <EmptyState title={text(locale, 'myCustomMeals')} body={text(locale, 'emptyCustomMeals')} compact />
        ) : (
          (meals.data?.meals ?? []).map((meal) => (
            <SurfaceCard key={meal.id} style={{ marginBottom: spacing[2] }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, textAlign: ar ? 'right' : 'left' }}>
                {ar ? meal.nameAr : meal.nameEn}
              </Text>
              <Text style={{ color: theme.textMuted, marginVertical: 6, textAlign: ar ? 'right' : 'left' }}>
                {formatCount(meal.energyKcal, locale)} {text(locale, 'kcal')} · {meal.ingredients.length} {text(locale, 'mealIngredients')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => loadMeal(meal)}
                  style={{ flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{text(locale, 'editCustomMeal')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => logMeal.mutate(meal)}
                  style={{ flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: theme.emphasisText, fontFamily: fontFamily.semibold }}>{text(locale, 'logCustomMeal')}</Text>
                </Pressable>
              </View>
            </SurfaceCard>
          ))
        )}
        <Body>{text(locale, 'customMealHint')}</Body>
        <View style={{ height: spacing[4] }} />
      </ScreenBody>
    </Screen>
  );
}
