import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { CodeField } from '../../src/ui/CodeField';
import { Body, Button, Field, Screen, ScreenBody } from '../../src/ui/Screen';

export default function ResetScreen() {
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    if (password.length < 10 || password.length > 128) {
      setError(text(locale, 'passwordRule'));
      return;
    }
    if (password !== confirm) {
      setError(text(locale, 'passwordMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest('/v1/auth/reset', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), code, password },
      });
      router.replace({ pathname: '/(auth)/login', params: { notice: 'reset' } });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, text(locale, 'error')) : text(locale, 'offline'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={text(locale, 'reset')}>
      <ScreenBody>
        <Field label={text(locale, 'email')} value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
        <CodeField label={text(locale, 'reset')} value={code} onChange={setCode} />
        <Field label={text(locale, 'password')} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
        <Field label={text(locale, 'confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
        {error.length > 0 ? <Body>{error}</Body> : null}
        <Button label={busy ? text(locale, 'loading') : text(locale, 'save')} disabled={busy || code.length !== 6} onPress={() => void submit()} />
      </ScreenBody>
    </Screen>
  );
}
