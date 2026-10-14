export type Locale = 'ar' | 'en';

const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

export function localizeDigits(value: string, locale: Locale): string {
  if (locale === 'en') {
    return value;
  }
  return value.replace(/\d/g, (digit) => arabicDigits[Number(digit)] ?? digit);
}

export function formatKgFromGrams(grams: number): string {
  const sign = grams < 0 ? '-' : '';
  const absolute = Math.abs(grams);
  const whole = Math.floor(absolute / 1000);
  const fraction = String(absolute % 1000).padStart(3, '0').replace(/0+$/, '');
  return fraction.length === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-arab' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatKg(grams: number, locale: Locale): string {
  return formatCount(Number(formatKgFromGrams(grams)), locale);
}

export function formatGramsFromMg(milligrams: number, locale: Locale): string {
  return formatCount(milligrams / 1000, locale);
}

export function riyadhToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function formatRiyadhDate(iso: string, locale: Locale): string {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-arab' : 'en-GB', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatRiyadhWeekday(isoDate: string, locale: Locale): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-arab' : 'en-GB', {
    timeZone: 'Asia/Riyadh',
    weekday: 'short',
  }).format(date);
}

export function formatSarFromHalalas(halalas: number): string {
  const sign = halalas < 0 ? '-' : '';
  const absolute = Math.abs(halalas);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction} SAR`;
}
