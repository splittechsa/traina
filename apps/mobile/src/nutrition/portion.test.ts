import { describe, expect, it } from 'vitest';
import { macroEnergyShares, portionPresets, previewPortion } from './portion';

const laban = { per100g: { energyKcal: 61, proteinMg: 3200, carbohydrateMg: 4600, fatMg: 3300 } };

describe('previewPortion', () => {
  it('scales per-100 g values exactly like the API (integer truncation)', () => {
    expect(previewPortion(laban, 200)).toEqual({ energyKcal: 122, proteinMg: 6400, carbohydrateMg: 9200, fatMg: 6600 });
    expect(previewPortion(laban, 150)?.energyKcal).toBe(91); // 91.5 truncates, same as server
  });

  it('refuses amounts the API would reject', () => {
    expect(previewPortion(laban, 0)).toBeNull();
    expect(previewPortion(laban, 2001)).toBeNull();
    expect(previewPortion(laban, 1.5)).toBeNull();
    expect(previewPortion(laban, 1)).not.toBeNull();
    expect(previewPortion(laban, 2000)).not.toBeNull();
  });
});

describe('portionPresets', () => {
  it('leads with the product serving and does not duplicate it', () => {
    const presets = portionPresets({ servingGrams: 200 }, 'en');
    expect(presets[0]?.value).toBe(200);
    expect(presets.filter((p) => p.value === 200)).toHaveLength(1);
    expect(presets).toHaveLength(6);
  });

  it('works without a serving size', () => {
    expect(portionPresets({}, 'ar').map((p) => p.value)).toEqual([50, 100, 150, 200, 250, 300]);
  });
});

describe('macroEnergyShares', () => {
  it('weights fat at 9 kcal/g and sums to 1', () => {
    const shares = macroEnergyShares({ proteinMg: 10_000, carbohydrateMg: 10_000, fatMg: 10_000 });
    expect(shares.fat).toBeCloseTo(9 / 17);
    expect(shares.protein + shares.carbs + shares.fat).toBeCloseTo(1);
  });

  it('returns zeros for an empty portion', () => {
    expect(macroEnergyShares({ proteinMg: 0, carbohydrateMg: 0, fatMg: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});
