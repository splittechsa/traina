import { DomainError, assertSafeNonNegativeInteger } from './errors.js';

export type FoodEntrySource = 'manual' | 'barcode' | 'image_estimate' | 'recipe';

export type FoodEntry = {
  id: string;
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
  source: FoodEntrySource;
};

export type NutritionTotals = {
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
  imageEstimateEnergyKcal: number;
};

export type NutritionTarget = {
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
  formulaId: string;
  formulaVersion: number;
  formulaStatus: 'approved';
};

export type MacroRemainder = {
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
  overTarget: boolean;
};

export type DiarySummary = {
  consumed: NutritionTotals;
  target: NutritionTarget | null;
  remaining: MacroRemainder | null;
  entryCount: number;
};

function assertMacro(value: number, code: string): void {
  assertSafeNonNegativeInteger(value, code);
}

export function assertFoodEntry(entry: FoodEntry): void {
  if (entry.id.trim().length === 0) {
    throw new DomainError('INVALID_FOOD_ENTRY', 'Food entry id is required');
  }
  assertMacro(entry.energyKcal, 'INVALID_ENERGY');
  assertMacro(entry.proteinMg, 'INVALID_PROTEIN');
  assertMacro(entry.carbohydrateMg, 'INVALID_CARBOHYDRATE');
  assertMacro(entry.fatMg, 'INVALID_FAT');
}

export function sumFoodEntries(entries: readonly FoodEntry[]): NutritionTotals {
  const totals: NutritionTotals = {
    energyKcal: 0,
    proteinMg: 0,
    carbohydrateMg: 0,
    fatMg: 0,
    imageEstimateEnergyKcal: 0,
  };
  const seen = new Set<string>();
  for (const entry of entries) {
    assertFoodEntry(entry);
    if (seen.has(entry.id)) {
      throw new DomainError('DUPLICATE_FOOD_ENTRY', 'Food entry ids must be unique');
    }
    seen.add(entry.id);
    totals.energyKcal += entry.energyKcal;
    totals.proteinMg += entry.proteinMg;
    totals.carbohydrateMg += entry.carbohydrateMg;
    totals.fatMg += entry.fatMg;
    if (entry.source === 'image_estimate') {
      totals.imageEstimateEnergyKcal += entry.energyKcal;
    }
  }
  return totals;
}

/** Atwater general factors: 4, 4, and 9 kcal per gram. Integer milligram inputs. */
export type PortionAmount = {
  energyKcal: number;
  proteinMg: number;
  carbohydrateMg: number;
  fatMg: number;
};

/** Scales values stored per 100 g. Truncates toward zero. Does not estimate missing nutrients. */
export function scalePer100g(amount: PortionAmount, quantityGrams: number): PortionAmount {
  if (!Number.isSafeInteger(quantityGrams) || quantityGrams < 1 || quantityGrams > 2_000) {
    throw new DomainError('INVALID_PORTION', 'Portion must be a whole number of grams from 1 to 2000');
  }
  const scale = (value: number, code: string): number => {
    assertMacro(value, code);
    return Number((BigInt(value) * BigInt(quantityGrams)) / 100n);
  };
  return {
    energyKcal: scale(amount.energyKcal, 'INVALID_ENERGY'),
    proteinMg: scale(amount.proteinMg, 'INVALID_PROTEIN'),
    carbohydrateMg: scale(amount.carbohydrateMg, 'INVALID_CARBOHYDRATE'),
    fatMg: scale(amount.fatMg, 'INVALID_FAT'),
  };
}

export function atwaterEnergyKcal(proteinMg: number, carbohydrateMg: number, fatMg: number): number {
  assertMacro(proteinMg, 'INVALID_PROTEIN');
  assertMacro(carbohydrateMg, 'INVALID_CARBOHYDRATE');
  assertMacro(fatMg, 'INVALID_FAT');
  const milliKcal =
    BigInt(proteinMg) * 4n + BigInt(carbohydrateMg) * 4n + BigInt(fatMg) * 9n;
  return Number(milliKcal / 1000n);
}

export function remainingMacros(target: NutritionTarget, consumed: NutritionTotals): MacroRemainder {
  const energyKcal = target.energyKcal - consumed.energyKcal;
  const proteinMg = target.proteinMg - consumed.proteinMg;
  const carbohydrateMg = target.carbohydrateMg - consumed.carbohydrateMg;
  const fatMg = target.fatMg - consumed.fatMg;
  return {
    energyKcal,
    proteinMg,
    carbohydrateMg,
    fatMg,
    overTarget: energyKcal < 0 || proteinMg < 0 || carbohydrateMg < 0 || fatMg < 0,
  };
}

export function summarizeDiary(
  target: NutritionTarget | null,
  entries: readonly FoodEntry[],
): DiarySummary {
  if (target !== null && target.formulaStatus !== 'approved') {
    throw new DomainError('UNAPPROVED_NUTRITION_FORMULA', 'Calorie targets require an approved formula');
  }
  const consumed = sumFoodEntries(entries);
  return {
    consumed,
    target,
    remaining: target === null ? null : remainingMacros(target, consumed),
    entryCount: entries.length,
  };
}

export type TargetFormula = {
  id: string;
  version: number;
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'retired';
};

/**
 * Authoritative targets are refused until a formula version is approved.
 * No default metabolic formula is shipped as coaching canon.
 */
export function authoritativeTargetFromFormula(formula: TargetFormula | null): NutritionTarget | null {
  if (formula === null || formula.status !== 'approved') {
    return null;
  }
  throw new DomainError(
    'APPROVED_FORMULA_HAS_NO_EXECUTOR',
    'An approved formula id exists but this build has no executor for it',
  );
}
