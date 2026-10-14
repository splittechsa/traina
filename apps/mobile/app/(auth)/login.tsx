import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useSession } from '../../src/auth/SessionProvider';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { Field } from '../../src/ui/Screen';
import { EditorialFrame, EditorialHint, EditorialLink, editorialPhotos } from '../../src/ui/editorial';

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
    <EditorialFrame
      source={editorialPhotos.strength}
      kicker={text(locale, 'brand')}
      title={text(locale, 'motto')}
      action={busy ? text(locale, 'loading') : text(locale, 'login')}
      onAction={() => void submit()}
      disabled={busy}
    >
      {params.notice === 'reset' ? <EditorialHint>{text(locale, 'resetDone')}</EditorialHint> : null}
      <Field
        inverse
        label={text(locale, 'email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <Field
        inverse
        label={text(locale, 'password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
      />
      {error.length > 0 ? <EditorialHint tone="danger">{error}</EditorialHint> : null}
      {needsVerify ? (
        <EditorialLink align="start" onPress={() => router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } })}>
          {text(locale, 'verify')}
        </EditorialLink>
      ) : null}
      <EditorialLink align="start" onPress={() => router.push('/(auth)/recover')}>
        {text(locale, 'recover')}
      </EditorialLink>
      <EditorialLink align="start" onPress={() => router.push('/(auth)/register')}>
        {text(locale, 'register')}
      </EditorialLink>
      {__DEV__ ? (
        <EditorialLink align="start" onPress={() => router.push('/(auth)/diagnostics')}>
          {text(locale, 'diagnostics')}
        </EditorialLink>
      ) : null}
    </EditorialFrame>
  );
}
