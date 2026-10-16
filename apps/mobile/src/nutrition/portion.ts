import { scalePer100g, type PortionAmount } from '@sahhti/domain';
import type { LibraryFood } from './foodLibrary';

export const MIN_PORTION_GRAMS = 1;
export const MAX_PORTION_GRAMS = 2000;

/**
 * Preview of what will be logged for `grams` of a food. Uses the same domain function the
 * API uses (scalePer100g, integer truncation), so the number on screen is the number saved.
 * Returns null outside the API's accepted 1–2000 g range.
 */
export function previewPortion(food: Pick<LibraryFood, 'per100g'>, grams: number): PortionAmount | null {
  if (!Number.isInteger(grams) || grams < MIN_PORTION_GRAMS || grams > MAX_PORTION_GRAMS) return null;
  try {
    return scalePer100g(food.per100g, grams);
  } catch {
    return null;
  }
}

export type PortionPreset = { label: string; value: number };

/** Quick-pick chips: the product's own serving size when the source has one, then common weights. */
export function portionPresets(food: Pick<LibraryFood, 'servingGrams'>, locale: 'ar' | 'en'): PortionPreset[] {
  const presets: PortionPreset[] = [];
  if (food.servingGrams !== undefined) {
    presets.push({ label: locale === 'ar' ? `حصة · ${food.servingGrams} غ` : `1 serving · ${food.servingGrams} g`, value: food.servingGrams });
  }
  for (const grams of [50, 100, 150, 200, 250, 300]) {
    if (grams !== food.servingGrams) presets.push({ label: locale === 'ar' ? `${grams} غ` : `${grams} g`, value: grams });
  }
  return presets;
}

/** Share of energy from each macro (Atwater 4/4/9), for the preview bar. Sums to 1 or all zero. */
export function macroEnergyShares(amount: Pick<PortionAmount, 'proteinMg' | 'carbohydrateMg' | 'fatMg'>): { protein: number; carbs: number; fat: number } {
  const protein = amount.proteinMg * 4;
  const carbs = amount.carbohydrateMg * 4;
  const fat = amount.fatMg * 9;
  const total = protein + carbs + fat;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: protein / total, carbs: carbs / total, fat: fat / total };
}
