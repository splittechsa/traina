import { Redirect, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { gateDestination, profileIsComplete } from '../src/auth/gate';
import { useSession } from '../src/auth/SessionProvider';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Body, Button, Screen, ScreenBody, StatusLine } from '../src/ui/Screen';

type Me = { onboardingCompleted?: boolean; profile: Record<string, unknown> | null };

export default function Gate() {
  const { ready, tokens, clear } = useSession();
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['me', tokens?.accessToken],
    enabled: ready && tokens !== null,
    retry: false,
    queryFn: () => apiRequest<Me>('/v1/me'),
  });
  const destination = gateDestination({
    ready,
    hasSession: tokens !== null,
    onboardingCompleted: profileIsComplete(me.data),
    fetching: tokens !== null && (me.isPending || me.isFetching),
    failed: me.isError,
  });
  if (destination === 'loading') {
    return (
      <Screen title={text(locale, 'brand')}>
        <StatusLine state="loading" />
      </Screen>
    );
  }
  if (destination === 'login') {
    return <Redirect href="/(auth)/login" />;
  }
  if (destination === 'error') {
    const code = me.error instanceof ApiClientError ? me.error.code : 'HTTP';
    const detail = me.error instanceof ApiClientError ? me.error.message : text(locale, 'error');
    return (
      <Screen title={text(locale, 'brand')}>
        <ScreenBody>
          <Body>{messageFor(code, locale, detail)}</Body>
          <Button label={text(locale, 'tryAgain')} onPress={() => void queryClient.resetQueries({ queryKey: ['me'] })} />
          {__DEV__ ? <Button label={text(locale, 'diagnostics')} variant="secondary" onPress={() => router.push('/(auth)/diagnostics')} /> : null}
          <Button
            label={text(locale, 'signOut')}
            onPress={() => {
              void clear();
            }}
          />
        </ScreenBody>
      </Screen>
    );
  }
  if (destination === 'onboarding') {
    return <Redirect href="/(onboarding)" />;
  }
  return <Redirect href="/(tabs)/home" />;
}
