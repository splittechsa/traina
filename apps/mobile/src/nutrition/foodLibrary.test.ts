import { describe, expect, it } from 'vitest';
import { cleanName, normalizeLocalFood, normalizeOffList, normalizeOffProduct } from './foodLibrary';

const laban = {
  code: '6281007020113',
  product_name: 'Fresh Laban Full Fat',
  product_name_ar: 'لبن طازج كامل الدسم',
  brands: 'Almarai, Al Marai',
  nutriments: { 'energy-kcal_100g': 61, proteins_100g: 3.2, carbohydrates_100g: 4.6, fat_100g: 3.3 },
  image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
  serving_quantity: '200',
  serving_quantity_unit: 'ml',
};

describe('normalizeOffProduct', () => {
  it('maps a complete product to per-100 g integer units', () => {
    const food = normalizeOffProduct(laban);
    expect(food).not.toBeNull();
    expect(food?.key).toBe('off:6281007020113');
    expect(food?.nameAr).toBe('لبن طازج كامل الدسم');
    expect(food?.nameEn).toBe('Fresh Laban Full Fat');
    expect(food?.brand).toBe('Almarai');
    expect(food?.per100g).toEqual({ energyKcal: 61, proteinMg: 3200, carbohydrateMg: 4600, fatMg: 3300 });
    expect(food?.servingGrams).toBe(200);
    expect(food?.complete).toBe(true);
  });

  it('converts kJ when kcal is missing', () => {
    const food = normalizeOffProduct({ code: '1234567', product_name: 'Oats', nutriments: { 'energy-kj_100g': 1556, proteins_100g: 13, carbohydrates_100g: 60, fat_100g: 7 } });
    expect(food?.per100g.energyKcal).toBe(372);
  });

  it('flags missing macros as incomplete instead of guessing', () => {
    const food = normalizeOffProduct({ code: '1234567', product_name: 'Mystery bar', nutriments: { 'energy-kcal_100g': 400 } });
    expect(food?.complete).toBe(false);
    expect(food?.per100g.proteinMg).toBe(0);
  });

  it('rejects products with no energy or physically impossible values', () => {
    expect(normalizeOffProduct({ code: '1234567', product_name: 'No energy', nutriments: { proteins_100g: 10 } })).toBeNull();
    expect(normalizeOffProduct({ code: '1234567', product_name: 'Too dense', nutriments: { 'energy-kcal_100g': 1200 } })).toBeNull();
    expect(normalizeOffProduct({ code: '1234567', product_name: 'Over 100 g', nutriments: { 'energy-kcal_100g': 500, proteins_100g: 60, fat_100g: 50 } })).toBeNull();
    expect(normalizeOffProduct({ code: '1234567', product_name: 'Negative', nutriments: { 'energy-kcal_100g': 50, fat_100g: -1 } })).toBeNull();
    expect(normalizeOffProduct({ code: 'abc', product_name: 'Bad code', nutriments: { 'energy-kcal_100g': 50 } })).toBeNull();
    expect(normalizeOffProduct({ code: '1234567', nutriments: { 'energy-kcal_100g': 50 } })).toBeNull();
  });

  it('ignores non-https images and implausible serving sizes', () => {
    const food = normalizeOffProduct({ ...laban, image_front_small_url: 'http://insecure/x.jpg', serving_quantity: 5000 });
    expect(food?.imageUrl).toBeUndefined();
    expect(food?.servingGrams).toBeUndefined();
  });

  it('falls back to the English name when there is no Arabic name', () => {
    const food = normalizeOffProduct({ code: '1234567', product_name: 'Basmati rice', nutriments: { 'energy-kcal_100g': 350 } });
    expect(food?.nameAr).toBe('Basmati rice');
  });
});

describe('normalizeOffList', () => {
  it('drops unusable products and duplicate barcodes', () => {
    const list = normalizeOffList([laban, laban, { code: '1', product_name: 'x', nutriments: {} }]);
    expect(list).toHaveLength(1);
  });
});

describe('normalizeLocalFood / cleanName', () => {
  it('maps API rows', () => {
    const food = normalizeLocalFood({ id: 'a1', name_ar: 'رز', name_en: 'Rice', energy_kcal: '130', protein_mg: 2700, carbohydrate_mg: 28000, fat_mg: 300 });
    expect(food.key).toBe('local:a1');
    expect(food.per100g.energyKcal).toBe(130);
    expect(food.complete).toBe(true);
  });

  it('collapses whitespace and caps at the API limit', () => {
    expect(cleanName('  a   b  ')).toBe('a b');
    expect(cleanName('x'.repeat(200))).toHaveLength(80);
  });
});
