import { useState } from 'react';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ApiClientError, apiBaseUrl, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { setApiBaseOverride } from '../../src/api/tokens';
import { API_URL_KEY } from '../../src/auth/SessionProvider';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { Body, Button, Field, Muted, Screen, ScreenBody } from '../../src/ui/Screen';

export default function DiagnosticsScreen() {
  const { locale } = useLocale();
  const [apiUrl, setApiUrl] = useState(apiBaseUrl());
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [code, setCode] = useState('');

  if (!__DEV__) {
    return <Redirect href="/(auth)/login" />;
  }

  async function saveUrl() {
    const next = apiUrl.trim().replace(/\/$/, '');
    setApiBaseOverride(next);
    await SecureStore.setItemAsync(API_URL_KEY, next);
    setApiUrl(next);
    return next;
  }

  async function check() {
    setStatus('');
    setCode('');
    await saveUrl();
    try {
      const health = await apiRequest<{ live: boolean; auth?: string }>('/v1/health', { auth: false });
      setStatus(health.live ? `auth: ${health.auth ?? 'missing'}` : text(locale, 'error'));
    } catch (caught) {
      setStatus(caught instanceof ApiClientError ? messageFor(caught.code, locale, text(locale, 'error')) : text(locale, 'offline'));
    }
  }

  async function mailbox() {
    setCode('');
    await saveUrl();
    try {
      const latest = await apiRequest<{ provider?: string; code?: string | null; purpose?: string | null }>(
        '/v1/dev/mailbox?email=' + encodeURIComponent(email.trim()) + '&include=code',
        { auth: false },
      );
      if (latest.provider !== 'resend') {
        setStatus(text(locale, 'verifyDev'));
      }
      setCode(latest.code ?? '');
    } catch (caught) {
      setStatus(caught instanceof ApiClientError ? messageFor(caught.code, locale, text(locale, 'error')) : text(locale, 'offline'));
    }
  }

  return (
    <Screen title={text(locale, 'diagnostics')}>
      <ScreenBody>
        <Muted>{text(locale, 'verifyDev')}</Muted>
        <Field label="API" value={apiUrl} onChangeText={setApiUrl} autoComplete="off" />
        <Button label={text(locale, 'checkConnection')} variant="secondary" onPress={() => void check()} />
        {status.length > 0 ? <Body>{status}</Body> : null}
        <Field label={text(locale, 'email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="off" />
        <Button label={text(locale, 'verify')} variant="secondary" onPress={() => void mailbox()} />
        {code.length > 0 ? <Body>{code}</Body> : null}
      </ScreenBody>
    </Screen>
  );
}
