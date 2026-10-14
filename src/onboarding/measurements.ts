export type MeasurementIssue = 'name' | 'age' | 'height' | 'weight';

const DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';

/** Western digits and a single dot, matching the server decimal parser. */
export function westernDecimal(input: string): string {
  return input
    .trim()
    .replace(/[٠-٩۰-۹]/g, (digit) => String(DIGITS.indexOf(digit) % 10))
    .replace(/[,،٫]/g, '.');
}

/** A decimal string the API can store at this scale, or null when it cannot. */
export function scaledDecimal(input: string, places: number): string | null {
  const western = westernDecimal(input);
  if (!/^\d+(\.\d+)?$/.test(western)) {
    return null;
  }
  const [whole, fraction = ''] = western.split('.');
  if (fraction.length > places) {
    return null;
  }
  const trimmed = fraction.replace(/0+$/, '');
  const canonical = trimmed.length === 0 ? String(Number(whole)) : `${Number(whole)}.${trimmed}`;
  return Number.isSafeInteger(Number(whole)) ? canonical : null;
}

export function measurementIssue(input: { name: string; age: string; height: string; weight: string }): MeasurementIssue | null {
  if (input.name.trim().length < 1) {
    return 'name';
  }
  const ageText = westernDecimal(input.age);
  if (!/^\d+$/.test(ageText)) {
    return 'age';
  }
  const age = Number(ageText);
  if (age < 13 || age > 100) {
    return 'age';
  }
  const height = scaledDecimal(input.height, 1);
  const heightValue = height === null ? Number.NaN : Number(height);
  if (height === null || heightValue < 100 || heightValue > 250) {
    return 'height';
  }
  const weight = scaledDecimal(input.weight, 3);
  const weightValue = weight === null ? Number.NaN : Number(weight);
  if (weight === null || weightValue < 30 || weightValue > 300) {
    return 'weight';
  }
  return null;
}

export function measurementPayload(input: { age: string; height: string; weight: string }): { ageYears: number; heightCm: string; weightKg: string } | null {
  if (measurementIssue({ name: 'member', ...input }) !== null) {
    return null;
  }
  const heightCm = scaledDecimal(input.height, 1);
  const weightKg = scaledDecimal(input.weight, 3);
  if (heightCm === null || weightKg === null) {
    return null;
  }
  return { ageYears: Number(westernDecimal(input.age)), heightCm, weightKg };
}

export function onboardingFailure(message: string): 'age' | 'height' | 'weight' | 'other' {
  if (message.includes('ageYears')) return 'age';
  if (message.includes('heightCm')) return 'height';
  if (message.includes('weightKg')) return 'weight';
  return 'other';
}
