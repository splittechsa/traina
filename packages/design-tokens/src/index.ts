import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DesignTokens = {
  color: {
    brand: Record<string, string>;
    semantic: {
      background: string;
      surface: string;
      text: string;
      textMuted: string;
      border: string;
      accent: string;
      danger: string;
      warning: string;
      success: string;
      focus: string;
    };
  };
  typography: {
    arabicFamily: string;
    latinFamily: string;
    scale: Record<string, number>;
  };
  spacing: number[];
  radius: Record<string, number>;
  direction: { ar: 'rtl'; en: 'ltr' };
  motion: { fastMs: number; standardMs: number };
};

function loadTokens(): DesignTokens {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../tokens.json');
  return JSON.parse(readFileSync(path, 'utf8')) as DesignTokens;
}

export const designTokens = loadTokens();

export function layoutDirection(locale: 'ar' | 'en'): 'rtl' | 'ltr' {
  return designTokens.direction[locale];
}
