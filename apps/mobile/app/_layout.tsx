import { Stack, router, type Href } from 'expo-router';
import { Profiler, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { attachPerformanceLab, lab, perfMark, invokeControl, requireSynthetic } from '../src/performance/lab';
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
import { SessionProvider, useSession } from '../src/auth/SessionProvider';
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
  const { tokens } = useSession();
  const { reduce } = useMotion();
  return (
    <Profiler id="navigation" onRender={(_id,phase,duration)=>perfMark('react.commit',phase,duration)}><Stack key={tokens?.userId ?? 'signed-out'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: reduce ? 'none' : 'fade',
      }}
    /></Profiler>
  );
}

export default function RootLayout() {
  const captureView=useRef<View>(null);
  useEffect(()=>{
    attachPerformanceLab();const current=lab();if(!current)return;
    current.capture=async()=>{requireSynthetic();const {captureRef}=await import('react-native-view-shot');return captureRef(captureView,{format:'png',result:'base64',quality:1});};
    current.refresh=async()=>{requireSynthetic();await queryClient.invalidateQueries();};
    current.navigate=path=>{requireSynthetic();router.replace(path as Href);};
    current.press=id=>invokeControl(id,'onPress');current.input=(id,value)=>invokeControl(id,'onChangeText',value);
  },[]);
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
    <GestureHandlerRootView style={{ flex: 1 }}><View ref={captureView} collapsable={false} style={{flex:1}}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LocaleProvider>
            <SessionProvider>
              <Navigation />
            </SessionProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </View></GestureHandlerRootView>
  );
}
