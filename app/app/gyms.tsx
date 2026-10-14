import { useState } from 'react';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Body, Button, Field, Screen } from '../src/ui/Screen';
import { AppHeader } from '../src/ui/kit';

export default function GymsScreen() {
  const { locale } = useLocale();
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');

  async function submit() {
    try {
      const result = await apiRequest<{ result: string }>('/v1/referrals', { method: 'POST', body: { code } });
      setNotice(result.result === 'created' ? text(locale, 'referralCreated') : result.result === 'existing' ? text(locale, 'referralExisting') : text(locale, 'saved'));
    } catch (caught) {
      setNotice(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    }
  }

  return (
    <Screen>
      <AppHeader title={text(locale, 'gyms')} subtitle={text(locale, 'referral')} />
      <Field label={text(locale, 'referral')} value={code} onChangeText={setCode} />
      {notice.length > 0 ? <Body>{notice}</Body> : null}
      <Button label={text(locale, 'save')} onPress={() => void submit()} />
    </Screen>
  );
}
