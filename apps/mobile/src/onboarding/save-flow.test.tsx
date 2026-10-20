import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flow = vi.hoisted(() => ({
  replace: vi.fn(),
  posts: 0,
  heightSent: '',
  mode: 'save' as 'save' | 'invalid' | 'offline' | 'delay',
}));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  Keyboard: { addListener: () => ({ remove: () => undefined }) },
  Platform: { OS: 'ios' },
  AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove: () => undefined }) },
}));

vi.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  return {
    router: { replace: (...args: unknown[]) => flow.replace(...args), push: () => undefined },
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
    useSegments: () => ['(onboarding)'],
  };
});

vi.mock('expo-secure-store', () => ({
  getItemAsync: async () =>
    JSON.stringify({
      step: 7,
      storyIndex: 5,
      displayName: 'أحمد',
      ageYears: '28',
      heightCm: '170,5',
      weightKg: '70',
      experience: 'beginner',
      goal: 'general_health',
      discipline: 'general_fitness',
      sessionsPerWeek: '3',
      environment: 'gym',
      activity: 'moderate',
      when: 'evening',
      diet: 'no_preference',
    }),
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

vi.mock('../offline/resource', () => ({ accountScope: () => 'https://synthetic|onboarding-account' }));

vi.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  FadeInDown: { duration: () => undefined },
  FadeOut: { duration: () => undefined },
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
    apiRequest: async (path: string, options?: { method?: string; body?: { heightCm?: string } }) => {
      if (options?.method === 'POST' && path === '/v1/onboarding') {
        flow.posts += 1;
        flow.heightSent = options.body?.heightCm ?? '';
        if (flow.mode === 'invalid') {
          throw new ApiClientError(422, 'ONBOARDING_INVALID', 'ageYears:OUT_OF_RANGE');
        }
        if (flow.mode === 'offline') {
          throw new ApiClientError(0, 'OFFLINE', 'Network unavailable');
        }
        if (flow.mode === 'delay') {
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        return { persisted: true, onboardingCompleted: true };
      }
      if (path === '/v1/profile') {
        return { persisted: true };
      }
      if (flow.posts === 0) {
        return { onboardingCompleted: false, profile: null };
      }
      return { onboardingCompleted: true, profile: { height_mm: 1705, age_years_reported: 28, display_name: 'أحمد' } };
    },
  };
});

vi.mock('../auth/SessionProvider', () => ({
  useSession: () => ({ tokens: { accessToken: 'access', refreshToken: 'refresh' }, ready: true }),
}));

vi.mock('../i18n/LocaleProvider', () => ({
  useLocale: () => ({ locale: 'ar', direction: 'rtl', setLocale: () => undefined }),
}));

vi.mock('../ui/editorial', () => {
  const React = require('react') as typeof import('react');
  return {
    editorialPhotos: { strength: 1, run: 1, recovery: 1, meal: 1, coach: 1 },
    EditorialHint: ({ children }: { children: import('react').ReactNode }) => React.createElement('Text', null, children),
    EditorialFrame: ({ action, onAction, children }: { action: string; onAction: () => void; children?: import('react').ReactNode }) =>
      React.createElement('View', null, children, React.createElement('Pressable', { accessibilityLabel: action, label: action, onPress: onAction }, action)),
  };
});

vi.mock('../ui/Screen', () => ({
  Screen: 'Screen',
  ScreenBody: 'ScreenBody',
  Body: 'Body',
  Muted: 'Muted',
  Button: 'Button',
  Field: 'Field',
  StatusLine: 'StatusLine',
}));

vi.mock('../ui/kit', () => ({
  LoadingSkeleton: 'LoadingSkeleton',
  SegmentedControl: 'SegmentedControl',
}));

import OnboardingScreen from '../../app/(onboarding)';

function textOf(renderer: TestRenderer.ReactTestRenderer): string {
  const visit = (node: unknown): string => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(visit).join(' ');
    if (typeof node === 'object') {
      const record = node as { children?: unknown; props?: Record<string, unknown> };
      return [visit(record.children), visit(record.props?.title), visit(record.props?.label), visit(record.props?.body), visit(record.props?.accessibilityLabel)].join(' ');
    }
    return '';
  };
  return visit(renderer.toJSON());
}

async function renderAtDiet(): Promise<TestRenderer.ReactTestRenderer> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={client}>
        <OnboardingScreen />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return renderer;
}

describe('onboarding save navigation', () => {
  beforeEach(() => {
    flow.replace.mockClear();
    flow.posts = 0;
    flow.heightSent = '';
    flow.mode = 'save';
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('opens home only after the saved profile is read back', async () => {
    const renderer = await renderAtDiet();
    expect(textOf(renderer)).not.toContain('ملفك محفوظ');
    await act(async () => {
      renderer.root.findByProps({ label: 'حفظ' }).props.onPress();
      renderer.root.findByProps({ label: 'حفظ' }).props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(flow.posts).toBe(1);
    expect(flow.heightSent).toBe('170.5');
    expect(flow.replace).toHaveBeenCalledWith('/(tabs)/home');
    expect(textOf(renderer)).toContain('ملفك محفوظ');
  });

  it('stays on measurements when age is rejected and does not announce success', async () => {
    flow.mode = 'invalid';
    const renderer = await renderAtDiet();
    await act(async () => {
      renderer.root.findByProps({ label: 'حفظ' }).props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(flow.replace).not.toHaveBeenCalled();
    expect(textOf(renderer)).toContain('العمر من 13 إلى 100');
    expect(textOf(renderer)).not.toContain('ملفك محفوظ');
  });

  it('keeps the step available after a network failure', async () => {
    flow.mode = 'offline';
    const renderer = await renderAtDiet();
    await act(async () => {
      renderer.root.findByProps({ label: 'حفظ' }).props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(flow.replace).not.toHaveBeenCalled();
    expect(textOf(renderer)).toContain('حفظ');
    expect(textOf(renderer)).toContain('تعذر الوصول إلى الخادم');
  });

  it('does not show success while the profile read is still pending', async () => {
    flow.mode = 'delay';
    const renderer = await renderAtDiet();
    await act(async () => {
      renderer.root.findByProps({ label: 'حفظ' }).props.onPress();
    });
    expect(textOf(renderer)).toContain('جار الحفظ');
    expect(textOf(renderer)).not.toContain('ملفك محفوظ');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(flow.replace).toHaveBeenCalledWith('/(tabs)/home');
  });
});
