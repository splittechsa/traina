// SAHHTI / 2026 — a performance-first Saudi visual language.
// Accessible contrast and a unified color system across all existing routes.
export const brand = {
  charcoal: '#080E13',
  green: '#0C8D80',
  lime: '#C7F36B',
  paper: '#F6F8F6',
  violet: '#93A9C8',
} as const;

export type Palette = {
  scheme: 'light' | 'dark'; background: string; surface: string; surfaceMuted: string;
  text: string; textMuted: string; border: string; accent: string; emphasis: string;
  emphasisText: string; lime: string; limeInk: string; violet: string;
  hero: string; heroText: string; heroAccent: string; danger: string;
  warning: string; success: string; focus: string; ringTrack: string;
};

export const light: Palette = {
  scheme: 'light', background: '#F6F8F6', surface: '#FFFFFF', surfaceMuted: '#EBF0ED',
  text: '#101D23', textMuted: '#607178', border: '#E1E8E5', accent: '#0B7369',
  emphasis: '#101D23', emphasisText: '#FFFFFF', lime: '#0B7369', limeInk: '#FFFFFF',
  violet: '#4F6E94', hero: '#10252A', heroText: '#FFFFFF', heroAccent: '#C7F36B',
  danger: '#C53443', warning: '#9B5E0B', success: '#0B7369', focus: '#0B7369', ringTrack: '#DFE7E2',
};
export const dark: Palette = {
  scheme: 'dark', background: '#080E13', surface: '#121C23', surfaceMuted: '#1C2932',
  text: '#F6F8F8', textMuted: '#A4B4BD', border: '#27343D', accent: '#C7F36B',
  emphasis: '#C7F36B', emphasisText: '#0A1717', lime: '#C7F36B', limeInk: '#0A1717',
  violet: '#A5BDF5', hero: '#102C30', heroText: '#F6F8F8', heroAccent: '#C7F36B',
  danger: '#FF8590', warning: '#FFD084', success: '#8AE0B5', focus: '#C7F36B', ringTrack: '#263740',
};

export const spacing = [0, 4, 8, 12, 16, 24, 32, 48] as const;
export const radius = { sm: 12, md: 16, lg: 24, pill: 999 } as const;

export const typeScale = {
  display: 36,
  title: 26,
  headline: 21,
  card: 18,
  body: 16,
  label: 13,
  numeric: 36,
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
