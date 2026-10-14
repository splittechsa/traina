import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useSession } from '../../src/auth/SessionProvider';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { Body, Button, Field, Muted, Screen, ScreenBody } from '../../src/ui/Screen';

function describe(caught: unknown, locale: 'ar' | 'en'): string {
  if (caught instanceof ApiClientError) {
    return messageFor(caught.code, locale, text(locale, 'error'));
  }
  return text(locale, 'offline');
}

export default function LoginScreen() {
  const { locale } = useLocale();
  const session = useSession();
  const params = useLocalSearchParams<{ notice?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    setNeedsVerify(false);
    try {
      const tokens = await apiRequest<{ accessToken: string; refreshToken: string }>('/v1/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), password },
      });
      await session.save(tokens);
      router.replace('/');
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerify(true);
      }
      setError(describe(caught, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={text(locale, 'brand')}>
      <ScreenBody>
        <Muted>{text(locale, 'motto')}</Muted>
        {params.notice === 'reset' ? <Body>{text(locale, 'resetDone')}</Body> : null}
        <Field
          label={text(locale, 'email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
        <Field
          label={text(locale, 'password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
        />
        {error.length > 0 ? <Body>{error}</Body> : null}
        <Button label={busy ? text(locale, 'loading') : text(locale, 'login')} disabled={busy} onPress={() => void submit()} />
        {needsVerify ? (
          <Button label={text(locale, 'verify')} variant="secondary" onPress={() => router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } })} />
        ) : null}
        <Button label={text(locale, 'recover')} variant="secondary" onPress={() => router.push('/(auth)/recover')} />
        <Button label={text(locale, 'register')} variant="secondary" onPress={() => router.push('/(auth)/register')} />
        {__DEV__ ? <Button label={text(locale, 'diagnostics')} variant="secondary" onPress={() => router.push('/(auth)/diagnostics')} /> : null}
      </ScreenBody>
    </Screen>
  );
}
