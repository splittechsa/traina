import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  phase: 'hold' as 'hold' | 'ready' | 'offline' | 'error' | 'empty',
}));

vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } },
  Keyboard: { addListener: () => ({ remove: () => undefined }) },
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
  Platform: { OS: 'ios' },
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => false,
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  FadeIn: { duration: () => undefined },
  FadeInDown: { duration: () => undefined },
  useSharedValue: (value: unknown) => ({ value }),
  useAnimatedStyle: (factory: () => object) => factory(),
  useAnimatedProps: (factory: () => object) => factory(),
  withTiming: (value: unknown) => value,
}));

vi.mock('expo-image', () => ({ Image: 'Image' }));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Circle: 'Circle',
  Path: 'Path',
  Svg: 'Svg',
  Rect: 'Rect',
  Stop: 'Stop',
}));

vi.mock('expo-haptics', () => ({
  selectionAsync: async () => undefined,
  impactAsync: async () => undefined,
  notificationAsync: async () => undefined,
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

vi.mock('./editorial', () => ({
  PhotoWash: 'PhotoWash',
  editorialPhotos: { strength: 1, run: 1, meal: 1, recovery: 1, coach: 1 },
}));

vi.mock('expo-router', () => ({
  router: { push: () => undefined, replace: () => undefined },
  useSegments: () => ['(tabs)'],
  useFocusEffect: () => undefined,
}));

vi.mock('expo-symbols', () => ({ SymbolView: () => null }));
vi.mock('expo-sensors', () => ({
  Pedometer: {
    isAvailableAsync: async () => false,
    getPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
    requestPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
    watchStepCount: () => ({ remove: () => undefined }),
  },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: 'SafeAreaView',
}));

vi.mock('../theme/ThemeProvider', () => ({
  useTheme: () => ({ violet: '#BBA6F6', surfaceMuted: '#EEF1E8', text: '#111614', accent: '#176B52', scheme: 'light' }),
}));

vi.mock('../i18n/LocaleProvider', () => ({
  useLocale: () => ({ locale: 'ar', direction: 'rtl', setLocale: () => undefined }),
}));

vi.mock('../auth/SessionProvider', () => ({
  useSession: () => ({
    ready: true,
    tokens: { accessToken: 'session-token', refreshToken: 'refresh-token' },
    save: async () => undefined,
    clear: async () => undefined,
  }),
}));

vi.mock('../api/client', () => {
  class ApiClientError extends Error {
    readonly code: string;
    constructor(_status: number, code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    ApiClientError,
    apiRequest: (path: string) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (path !== '/v1/home') {
            resolve(path === '/v1/me'
              ? state.phase === 'empty'
                ? { onboardingCompleted: false, profile: null }
                : { onboardingCompleted: true, profile: { display_name: 'أحمد', height_mm: 1700 }, goals: ['general_health'] }
              : { weights: [], completedWorkouts: 0 });
            return;
          }
          if (state.phase === 'hold') return;
          if (state.phase === 'offline') {
            reject(new ApiClientError(0, 'OFFLINE', 'offline'));
            return;
          }
          if (state.phase === 'error') {
            reject(new ApiClientError(500, 'INTERNAL', 'failed'));
            return;
          }
          if (state.phase === 'empty') {
            resolve({ onboarded: false, dashboard: null });
            return;
          }
          resolve({
            onboarded: true,
            dashboard: {
              greeting: 'صباح الخير',
              date: '2026-10-12T08:00:00.000Z',
              goal: { status: 'unavailable', reason: 'no_active_goal' },
              phase: { status: 'unavailable', reason: 'no_training_phase' },
              adherence: { status: 'unavailable', reason: 'no_plan' },
              todayWorkout: { status: 'unavailable', reason: 'no_session' },
              nutrition: { status: 'unavailable', reason: 'no_diary' },
              gym: { status: 'unavailable', reason: 'no_gym' },
              coachingInsight: { status: 'unavailable', reason: 'no_rules' },
            },
            authoritativeCalorieTarget: null,
          });
        }, 20);
      }),
  };
});

vi.mock('./Screen', () => ({
  Screen: 'Screen',
  Button: 'Button',
  ScreenBody: 'ScreenBody',
}));

vi.mock('./kit', () => ({
  ActivityRing: 'ActivityRing',
  AppHeader: 'AppHeader',
  EmptyState: 'EmptyState',
  ErrorState: 'ErrorState',
  LoadingSkeleton: 'LoadingSkeleton',
  MetricCard: 'MetricCard',
  ProfileAvatar: 'ProfileAvatar',
  SectionLabel: 'SectionLabel',
  SectionTitle: 'SectionTitle',
  Sparkline: 'Sparkline',
  SurfaceCard: 'SurfaceCard',
  WorkoutCard: 'WorkoutCard',
}));

import HomeScreen from '../../app/(tabs)/home';

function renderedText(renderer: TestRenderer.ReactTestRenderer): string {
  const visit = (node: unknown): string => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(visit).join(' ');
    if (typeof node === 'object') {
      const record = node as { type?: unknown; children?: unknown; props?: Record<string, unknown> };
      return [typeof record.type === 'string' ? record.type : '', visit(record.children), visit(record.props?.title), visit(record.props?.label), visit(record.props?.body)].join(' ');
    }
    return '';
  };
  return visit(renderer.toJSON());
}

describe('HomeScreen hook order', () => {
  beforeEach(() => {
    state.phase = 'hold';
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders loading, then the signed-in dashboard, then offline, error, and incomplete profile', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={client}>
          <HomeScreen />
        </QueryClientProvider>,
      );
    });
    expect(renderedText(renderer)).toContain('LoadingSkeleton');

    state.phase = 'ready';
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(renderedText(renderer)).toContain('صباح الخير');
    expect(renderedText(renderer)).toContain('اسأل المدرب');
    expect(renderedText(renderer)).toContain('الخطوة التالية');
    expect(renderedText(renderer)).toContain('أنشئ خطتك الرياضية');

    state.phase = 'offline';
    await act(async () => {
      const refresh = client.invalidateQueries({ queryKey: ['home'] });
      await new Promise((resolve) => setTimeout(resolve, 40));
      await refresh;
    });
    expect(renderedText(renderer)).toContain('لا يوجد اتصال');

    state.phase = 'error';
    await act(async () => {
      const refresh = client.invalidateQueries({ queryKey: ['home'] });
      await new Promise((resolve) => setTimeout(resolve, 40));
      await refresh;
    });
    expect(renderedText(renderer)).toContain('تعذر إكمال الطلب');

    state.phase = 'empty';
    await act(async () => {
      const refresh = Promise.all([
        client.invalidateQueries({ queryKey: ['home'] }),
        client.invalidateQueries({ queryKey: ['me'] }),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 40));
      await refresh;
    });
    expect(renderedText(renderer)).toContain('لا توجد بيانات محفوظة بعد');
    expect(renderedText(renderer)).toContain('إعداد الملف');
  });
});
