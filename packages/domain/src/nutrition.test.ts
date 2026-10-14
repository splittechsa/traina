import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  atwaterEnergyKcal,
  authoritativeTargetFromFormula,
  scalePer100g,
  summarizeDiary,
  type FoodEntry,
  type NutritionTarget,
} from './nutrition.js';

const rice: FoodEntry = {
  id: 'e1',
  energyKcal: 250,
  proteinMg: 5_000,
  carbohydrateMg: 45_000,
  fatMg: 2_000,
  source: 'manual',
};

const scan: FoodEntry = {
  id: 'e2',
  energyKcal: 100,
  proteinMg: 1_000,
  carbohydrateMg: 2_000,
  fatMg: 8_000,
  source: 'image_estimate',
};

describe('nutrition arithmetic', () => {
  it('scales a per-100g amount without filling missing nutrients', () => {
    expect(scalePer100g({ energyKcal: 200, proteinMg: 10_000, carbohydrateMg: 0, fatMg: 1_500 }, 50)).toEqual({
      energyKcal: 100,
      proteinMg: 5_000,
      carbohydrateMg: 0,
      fatMg: 750,
    });
    expect(() => scalePer100g({ energyKcal: 1, proteinMg: 0, carbohydrateMg: 0, fatMg: 0 }, 0)).toThrow(DomainError);
  });

  it('sums entries and isolates image estimates', () => {
    const summary = summarizeDiary(null, [rice, scan]);
    expect(summary.consumed.energyKcal).toBe(350);
    expect(summary.consumed.proteinMg).toBe(6_000);
    expect(summary.consumed.imageEstimateEnergyKcal).toBe(100);
    expect(summary.remaining).toBeNull();
    expect(summary.target).toBeNull();
  });

  it('computes remaining macros from an approved target only', () => {
    const target: NutritionTarget = {
      energyKcal: 2_000,
      proteinMg: 150_000,
      carbohydrateMg: 200_000,
      fatMg: 60_000,
      formulaId: 'test-formula',
      formulaVersion: 1,
      formulaStatus: 'approved',
    };
    const summary = summarizeDiary(target, [rice]);
    expect(summary.remaining?.energyKcal).toBe(1_750);
    expect(summary.remaining?.proteinMg).toBe(145_000);
    expect(summary.remaining?.overTarget).toBe(false);
  });

  it('flags intake above target without clamping', () => {
    const target: NutritionTarget = {
      energyKcal: 100,
      proteinMg: 1_000,
      carbohydrateMg: 1_000,
      fatMg: 1_000,
      formulaId: 'test-formula',
      formulaVersion: 1,
      formulaStatus: 'approved',
    };
    const summary = summarizeDiary(target, [rice]);
    expect(summary.remaining?.energyKcal).toBe(-150);
    expect(summary.remaining?.overTarget).toBe(true);
  });

  it('rejects duplicate entries and unapproved formulas', () => {
    expect(() => summarizeDiary(null, [rice, rice])).toThrow(DomainError);
    expect(authoritativeTargetFromFormula({ id: 'mifflin', version: 1, status: 'draft' })).toBeNull();
    expect(() =>
      authoritativeTargetFromFormula({ id: 'future', version: 1, status: 'approved' }),
    ).toThrow(DomainError);
  });

  it('uses Atwater factors in integer milligrams', () => {
    expect(atwaterEnergyKcal(100_000, 0, 0)).toBe(400);
    expect(atwaterEnergyKcal(0, 0, 100_000)).toBe(900);
    expect(atwaterEnergyKcal(1, 1, 1)).toBe(0);
  });
});
