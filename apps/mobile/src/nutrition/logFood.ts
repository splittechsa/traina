// Logs a library food through the EXISTING API contracts only:
//   global (Open Food Facts) food → POST /v1/nutrition/foods  (customFoodSchema, per 100 g)
//                                 → POST /v1/nutrition/portions (foodPortionSchema)
//   member's own food             → POST /v1/nutrition/portions
// The barcode→food id link is remembered on device so the same product isn't re-created
// every time it's logged. No backend change.
import { ApiClientError, apiRequest } from '../api/client';
import { LOCAL_KEYS, readJson, removeKey, writeJson } from '../storage/local';
import type { LibraryFood } from './foodLibrary';

const RECENT_LIMIT = 8;

async function createMemberFood(food: LibraryFood): Promise<string> {
  const created = await apiRequest<{ id: string }>('/v1/nutrition/foods', {
    method: 'POST',
    body: {
      nameAr: food.nameAr,
      nameEn: food.nameEn,
      energyKcal: food.per100g.energyKcal,
      proteinMg: food.per100g.proteinMg,
      carbohydrateMg: food.per100g.carbohydrateMg,
      fatMg: food.per100g.fatMg,
    },
  });
  return created.id;
}

async function resolveFoodId(food: LibraryFood): Promise<{ id: string; linkKey: string | null }> {
  if (food.localId !== undefined) return { id: food.localId, linkKey: null };
  if (food.code === undefined) throw new Error('FOOD_HAS_NO_ID');
  const linkKey = LOCAL_KEYS.offLink(food.code);
  const linked = await readJson<string | null>(linkKey, null);
  if (linked !== null) return { id: linked, linkKey };
  const id = await createMemberFood(food);
  await writeJson(linkKey, id);
  return { id, linkKey };
}

async function postPortion(foodItemId: string, grams: number, day: string) {
  await apiRequest('/v1/nutrition/portions', { method: 'POST', body: { foodItemId, quantityGrams: grams, loggedOn: day } });
}

export async function logLibraryFood(food: LibraryFood, grams: number, day: string): Promise<void> {
  const { id, linkKey } = await resolveFoodId(food);
  try {
    await postPortion(id, grams, day);
  } catch (error) {
    // A remembered link can go stale (account reset, food deleted) — recreate once.
    if (linkKey !== null && error instanceof ApiClientError && error.code === 'FOOD_NOT_FOUND') {
      await removeKey(linkKey);
      const fresh = await createMemberFood(food);
      await writeJson(linkKey, fresh);
      await postPortion(fresh, grams, day);
    } else {
      throw error;
    }
  }
  await rememberRecent({ ...food, localId: food.localId ?? id });
}

export async function readRecentFoods(): Promise<LibraryFood[]> {
  const list = await readJson<LibraryFood[]>(LOCAL_KEYS.recentFoods, []);
  return Array.isArray(list) ? list : [];
}

async function rememberRecent(food: LibraryFood): Promise<void> {
  const current = await readRecentFoods();
  const next = [food, ...current.filter((item) => item.key !== food.key)].slice(0, RECENT_LIMIT);
  await writeJson(LOCAL_KEYS.recentFoods, next);
}
