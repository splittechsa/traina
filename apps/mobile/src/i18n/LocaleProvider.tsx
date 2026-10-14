import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setApiLocale } from '../api/client';
import type { Locale } from '../format';

const LOCALE_KEY = 'sahhti.locale';

type LocaleValue = { locale: Locale; setLocale: (locale: Locale) => void; direction: 'rtl' | 'ltr' };

const LocaleContext = createContext<LocaleValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === 'ar' || value === 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');
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
  }

  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      setLocale,
      direction: locale === 'ar' ? 'rtl' : 'ltr',
    }),
    [locale],
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
