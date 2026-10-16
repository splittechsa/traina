import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setApiLocale } from '../api/client';
import type { Locale } from '../format';

const LOCALE_KEY = 'sahhti.locale';

type LocaleValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  direction: 'rtl' | 'ltr';
  // True right after setLocale() actually flips the native layout direction (ar<->en).
  // I18nManager.forceRTL() only takes effect on the *next* native layout pass — React
  // Native reads the RTL flag once at native init (see index.ts) and does not re-mirror
  // already-mounted native views, so there is no way to make the layout flip live without
  // a full app relaunch. Screens should surface this flag as a "restart to apply" notice
  // rather than silently leaving the UI half-mirrored.
  restartRequired: boolean;
};

const LocaleContext = createContext<LocaleValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === 'ar' || value === 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');
  const [restartRequired, setRestartRequired] = useState(false);
  useEffect(() => {
    void SecureStore.getItemAsync(LOCALE_KEY).then((stored) => {
      if (isLocale(stored)) {
        setLocaleState(stored);
      }
    });
  }, []);
  useEffect(() => {
    setApiLocale(locale);
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    void SecureStore.setItemAsync(LOCALE_KEY, next);
    const wantsRtl = next === 'ar';
    if (wantsRtl !== I18nManager.isRTL) {
      I18nManager.forceRTL(wantsRtl);
      setRestartRequired(true);
    }
  }

  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      setLocale,
      direction: locale === 'ar' ? 'rtl' : 'ltr',
      restartRequired,
    }),
    [locale, restartRequired],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (value === null) {
    throw new Error('LocaleProvider is missing');
  }
  return value;
}
