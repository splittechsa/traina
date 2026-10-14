import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { dark, light, type Palette } from './tokens';

export type AppearancePreference = 'system' | 'light' | 'dark';

const APPEARANCE_KEY = 'sahhti.appearance';

type ThemeValue = Palette & {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function isPreference(value: string | null): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>('dark');

  useEffect(() => {
    void SecureStore.getItemAsync(APPEARANCE_KEY).then((stored) => {
      if (isPreference(stored)) {
        setPreferenceState(stored);
      }
    });
  }, []);

  function setPreference(next: AppearancePreference) {
    setPreferenceState(next);
    void SecureStore.setItemAsync(APPEARANCE_KEY, next);
  }

  const value = useMemo<ThemeValue>(() => {
    const palette = preference === 'system' ? (system === 'dark' ? dark : light) : preference === 'dark' ? dark : light;
    return { ...palette, preference, setPreference };
  }, [preference, system]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('ThemeProvider is missing');
  }
  return value;
}
