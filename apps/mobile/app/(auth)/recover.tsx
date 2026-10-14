import { useState } from 'react';
import { router } from 'expo-router';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { Field } from '../../src/ui/Screen';
import { EditorialFrame, EditorialHint, editorialPhotos } from '../../src/ui/editorial';

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
    <EditorialFrame
      source={editorialPhotos.recovery}
      kicker={text(locale, 'brand')}
      title={text(locale, 'recover')}
      action={busy ? text(locale, 'loading') : text(locale, 'continue')}
      onAction={() => void submit()}
      disabled={busy}
      secondary={sent ? text(locale, 'reset') : undefined}
      onSecondary={sent ? () => router.push({ pathname: '/(auth)/reset', params: { email: email.trim() } }) : undefined}
    >
      <EditorialHint>{text(locale, 'recoverSent')}</EditorialHint>
      <Field
        inverse
        label={text(locale, 'email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      {sent ? <EditorialHint>{text(locale, 'recoverSent')}</EditorialHint> : null}
      {error.length > 0 ? <EditorialHint tone="danger">{error}</EditorialHint> : null}
    </EditorialFrame>
  );
}
