// SAHHTI / 2026 — a performance-first Saudi visual language.
// Accessible contrast and a unified color system across all existing routes.
export const brand = {
  charcoal: '#101418',
  green: '#14B8A6',
  lime: '#14B8A6',
  paper: '#F4F7F6',
  violet: '#7C9CB8',
} as const;

export type Palette = {
  scheme: 'light' | 'dark'; background: string; surface: string; surfaceMuted: string;
  text: string; textMuted: string; border: string; accent: string; emphasis: string;
  emphasisText: string; lime: string; limeInk: string; violet: string;
  hero: string; heroText: string; heroAccent: string; danger: string;
  warning: string; success: string; focus: string; ringTrack: string;
  /** Warm secondary accent — used sparingly for streaks, records and highlights so the
   *  app isn't read as a single-hue teal dashboard. Not a CTA color. */
  ember: string; emberInk: string;
};

export const light: Palette = {
  scheme: 'light', background: '#F6F4F1', surface: '#FFFFFF', surfaceMuted: '#ECF2F0',
  text: '#15201F', textMuted: '#5E6D6A', border: '#E4E0D9', accent: '#0F9B8E',
  emphasis: '#14B8A6', emphasisText: '#FFFFFF', lime: '#14B8A6', limeInk: '#FFFFFF',
  violet: '#4F6E94', hero: '#13201D', heroText: '#FFFFFF', heroAccent: '#4FE3C9',
  danger: '#C53443', warning: '#9B5E0B', success: '#0F9B8E', focus: '#14B8A6', ringTrack: '#DEE7E3',
  ember: '#C76A3A', emberInk: '#FFFFFF',
};
export const dark: Palette = {
  scheme: 'dark', background: '#0E1311', surface: '#171F1D', surfaceMuted: '#212B28',
  text: '#F3F6F4', textMuted: '#92A19D', border: '#283330', accent: '#2ED3C0',
  emphasis: '#14B8A6', emphasisText: '#FFFFFF', lime: '#14B8A6', limeInk: '#FFFFFF',
  violet: '#9BB4D0', hero: '#0C1715', heroText: '#F3F6F4', heroAccent: '#4FE3C9',
  danger: '#FF8590', warning: '#FFD084', success: '#5DDEC8', focus: '#14B8A6', ringTrack: '#243330',
  ember: '#E08456', emberInk: '#1A1008',
};

export const spacing = [0, 4, 8, 12, 16, 24, 32, 48] as const;
export const radius = { sm: 12, md: 16, lg: 24, pill: 999 } as const;

// A single deliberate scale. Every screen header, section label and number pulls from
// this instead of hand-picked font sizes, so hierarchy reads the same everywhere.
export const typeScale = {
  hero: 30,
  display: 30,
  title: 22,
  headline: 19,
  card: 17,
  body: 16,
  label: 13,
  micro: 11,
  numeric: 34,
} as const;

export const fontFamily = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

/** IBM Plex Sans Arabic is used for Arabic and Latin. Licensed under the SIL Open Font License. */
export const fontIntent = {
  arabic: 'IBM Plex Sans Arabic',
  latin: 'IBM Plex Sans Arabic',
} as const;
