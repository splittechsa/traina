// TRAINA / 2026 — warm Saudi editorial craft with a performance core.
// Green drives action; gold is reserved for earned moments and brand detail.
export const brand = {
  charcoal: '#161411',
  green: '#315C49',
  gold: '#D6A54A',
  paper: '#F3EEE6',
  sand: '#C9B7A2',
} as const;

export type Palette = {
  scheme: 'light' | 'dark'; background: string; surface: string; surfaceMuted: string; surfaceRaised: string;
  text: string; textMuted: string; border: string; accent: string; emphasis: string;
  emphasisText: string; lime: string; limeInk: string; violet: string;
  hero: string; heroText: string; heroAccent: string; danger: string;
  warning: string; success: string; focus: string; ringTrack: string;
  ember: string; emberInk: string;
  gold: string; goldInk: string; overlay: string; overlayStrong: string; shadow: string;
};

export const light: Palette = {
  scheme: 'light', background: '#F5F6F1', surface: '#FFFFFF', surfaceMuted: '#EAF0E5', surfaceRaised: '#FFFFFF',
  text: '#1C2B24', textMuted: '#667464', border: '#DCE4D7', accent: '#315C49',
  emphasis: '#315C49', emphasisText: '#FFFFFF', lime: '#D6A54A', limeInk: '#21180A',
  violet: '#796C89', hero: '#17382D', heroText: '#FFF9EF', heroAccent: '#E2B65E',
  danger: '#9B3A3A', warning: '#8A5A12', success: '#3E6B56', focus: '#B78329', ringTrack: '#DED5C7',
  ember: '#B85D35', emberInk: '#FFFFFF', gold: '#D6A54A', goldInk: '#21180A',
  overlay: 'rgba(22,20,17,0.44)', overlayStrong: 'rgba(15,18,15,0.88)', shadow: 'rgba(43,34,22,0.14)',
};
export const dark: Palette = {
  scheme: 'dark', background: '#111510', surface: '#1A211D', surfaceMuted: '#252D27', surfaceRaised: '#202923',
  text: '#F5EFE5', textMuted: '#B1A89B', border: '#353D36', accent: '#8EB79D',
  emphasis: '#3E6B56', emphasisText: '#FFFFFF', lime: '#E2B65E', limeInk: '#21180A',
  violet: '#B9A9C7', hero: '#102A21', heroText: '#FFF9EF', heroAccent: '#E2B65E',
  danger: '#FF9898', warning: '#F0C273', success: '#8EB79D', focus: '#E2B65E', ringTrack: '#303931',
  ember: '#DF835D', emberInk: '#241006', gold: '#E2B65E', goldInk: '#21180A',
  overlay: 'rgba(8,12,9,0.52)', overlayStrong: 'rgba(8,12,9,0.9)', shadow: 'rgba(0,0,0,0.34)',
};

export const spacing = [0, 4, 8, 12, 16, 24, 32, 48] as const;
export const radius = { sm: 12, md: 16, card: 22, lg: 24, hero: 28, sheet: 28, pill: 999 } as const;

// A single deliberate scale. Every screen header, section label and number pulls from
// this instead of hand-picked font sizes, so hierarchy reads the same everywhere.
export const typeScale = {
  hero: 34,
  display: 34,
  title: 28,
  headline: 22,
  card: 18,
  body: 16,
  label: 13,
  micro: 11,
  numeric: 36,
  numericHero: 48,
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
