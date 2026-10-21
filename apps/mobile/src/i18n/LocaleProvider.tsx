import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  const manuallyChanged = useRef(false);
  useEffect(() => {
    let mounted = true;
    void SecureStore.getItemAsync(LOCALE_KEY).then(stored => {
      if (!mounted || manuallyChanged.current) return;
      const next = isLocale(stored) ? stored : 'ar';
      setLocaleState(next);
      I18nManager.forceRTL(next === 'ar');
      setRestartRequired((next === 'ar') !== I18nManager.isRTL);
    }).catch(() => { /* Keep the default language if secure storage is unavailable. */ });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    setApiLocale(locale);
  }, [locale]);

  function setLocale(next: Locale) {
    manuallyChanged.current = true;
    setLocaleState(next);
    void SecureStore.setItemAsync(LOCALE_KEY, next);
    const wantsRtl = next === 'ar';
    I18nManager.forceRTL(wantsRtl);
    setRestartRequired(wantsRtl !== I18nManager.isRTL);
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
