import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LocaleProvider } from '../src/i18n/LocaleProvider';
import { SessionProvider } from '../src/auth/SessionProvider';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { useMotion } from '../src/theme/motion';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
    mutations: { retry: 0 },
  },
});

function Navigation() {
  const theme = useTheme();
  const { reduce } = useMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: reduce ? 'none' : 'fade',
      }}
    />
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  if (!loaded && error == null) {
    return null;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LocaleProvider>
            <SessionProvider>
              <Navigation />
            </SessionProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
