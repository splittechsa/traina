/** Normalize iPhone Arabic/Persian numeric keyboards without silently dropping invalid characters. */
export function normalizeWorkoutNumber(value: string): string {
  return value.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٫,]/g, '.').replace(/[\u200e\u200f]/g, '').trim();
}
