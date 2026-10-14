import { useState } from 'react';
import { router } from 'expo-router';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { Body, Button, Field, Muted, Screen, ScreenBody } from '../../src/ui/Screen';

export default function RecoverScreen() {
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest('/v1/auth/recover', { method: 'POST', auth: false, body: { email: email.trim() } });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, text(locale, 'error')) : text(locale, 'offline'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={text(locale, 'recover')}>
      <ScreenBody>
        <Muted>{text(locale, 'recoverSent')}</Muted>
        <Field label={text(locale, 'email')} value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
        {sent ? <Body>{text(locale, 'recoverSent')}</Body> : null}
        {error.length > 0 ? <Body>{error}</Body> : null}
        <Button label={busy ? text(locale, 'loading') : text(locale, 'continue')} disabled={busy} onPress={() => void submit()} />
        {sent ? (
          <Button label={text(locale, 'reset')} onPress={() => router.push({ pathname: '/(auth)/reset', params: { email: email.trim() } })} />
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
