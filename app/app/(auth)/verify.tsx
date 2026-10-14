import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useSession } from '../../src/auth/SessionProvider';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { CodeField } from '../../src/ui/CodeField';
import { Body, Button, Muted, Screen, ScreenBody } from '../../src/ui/Screen';

export default function VerifyScreen() {
  const { locale } = useLocale();
  const session = useSession();
  const params = useLocalSearchParams<{ email?: string; fresh?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(params.fresh === '1' ? 60 : 0);
  const [provider, setProvider] = useState<'resend' | 'unconfigured' | 'unknown'>('unknown');

  useEffect(() => {
    if (!__DEV__ || email.length === 0) {
      return;
    }
    void apiRequest<{ provider?: string }>('/v1/dev/mailbox?email=' + encodeURIComponent(email), { auth: false })
      .then((mailbox) => setProvider(mailbox.provider === 'resend' ? 'resend' : 'unconfigured'))
      .catch(() => setProvider('unknown'));
  }, [email]);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }
    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function submit(next = code) {
    if (busy || next.length !== 6) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const tokens = await apiRequest<{ accessToken?: string; refreshToken?: string }>('/v1/auth/verify', {
        method: 'POST',
        auth: false,
        body: { email, code: next },
      });
      if (tokens.accessToken !== undefined && tokens.refreshToken !== undefined) {
        await session.save({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
        router.replace('/');
        return;
      }
      router.replace('/(auth)/login');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, text(locale, 'error')) : text(locale, 'offline'));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (seconds > 0 || busy) {
      return;
    }
    setError('');
    try {
      await apiRequest('/v1/auth/verify/resend', { method: 'POST', auth: false, body: { email } });
      setSeconds(60);
      setCode('');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, text(locale, 'error')) : text(locale, 'offline'));
    }
  }

  return (
    <Screen title={text(locale, 'verify')}>
      <ScreenBody>
        <Muted>{text(locale, 'verifyHint')}</Muted>
        {email.length > 0 ? <Body>{email}</Body> : null}
        {__DEV__ && provider === 'unconfigured' ? <Muted>{text(locale, 'verifyDev')}</Muted> : null}
        <CodeField
          label={text(locale, 'verify')}
          value={code}
          onChange={(next) => {
            setCode(next);
            if (next.length === 6) {
              void submit(next);
            }
          }}
        />
        {error.length > 0 ? <Body>{error}</Body> : null}
        <Button label={busy ? text(locale, 'loading') : text(locale, 'continue')} disabled={busy || code.length !== 6} onPress={() => void submit()} />
        <Button
          label={seconds > 0 ? `${text(locale, 'resend')} ${seconds}` : text(locale, 'resend')}
          variant="secondary"
          disabled={seconds > 0}
          onPress={() => void resend()}
        />
        <Button label={text(locale, 'changeEmail')} variant="secondary" onPress={() => router.replace({ pathname: '/(auth)/register', params: { email } })} />
      </ScreenBody>
    </Screen>
  );
}
