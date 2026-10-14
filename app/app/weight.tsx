import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { formatKg, formatRiyadhDate, riyadhToday } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Body, Button, Field, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, ErrorState, ListRow, LoadingSkeleton } from '../src/ui/kit';
import { stableRecordKey } from '../src/lists/keys';

type Progress = { weights: { id: string; weight_grams: number; recorded_on: string }[] };

export default function WeightScreen() {
  const { locale } = useLocale();
  const client = useQueryClient();
  const [weightKg, setWeightKg] = useState('');
  const [notice, setNotice] = useState('');
  const progress = useQuery({ queryKey: ['progress'], queryFn: () => apiRequest<Progress>('/v1/progress') });

  async function save() {
    try {
      await apiRequest('/v1/weight', {
        method: 'POST',
        body: { weightKg, recordedOn: riyadhToday() },
      });
      await client.invalidateQueries({ queryKey: ['progress'] });
      setNotice(text(locale, 'saved'));
      setWeightKg('');
    } catch (caught) {
      setNotice(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    }
  }

  return (
    <Screen>
      <ScreenBody footer={<Button label={text(locale, 'save')} onPress={() => void save()} />}>
        <AppHeader title={text(locale, 'weightTracking')} subtitle={text(locale, 'units')} />
        {progress.isPending ? <LoadingSkeleton /> : null}
        {progress.isError ? (
          <ErrorState
            body={text(locale, progress.error instanceof ApiClientError && progress.error.code === 'OFFLINE' ? 'offline' : 'error')}
            onRetry={() => void progress.refetch()}
          />
        ) : null}
        {progress.data !== undefined && progress.data.weights.length === 0 ? <EmptyState title={text(locale, 'weightTracking')} body={text(locale, 'noWeight')} /> : null}
        {progress.data?.weights.map((row) => (
          <ListRow
            key={stableRecordKey(row.id)}
            title={formatKg(Number(row.weight_grams), locale)}
            meta={formatRiyadhDate(String(row.recorded_on), locale)}
          />
        ))}
        <Field label={`${text(locale, 'weight')} (${text(locale, 'kilograms')})`} value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" />
        {notice.length > 0 ? <Body>{notice}</Body> : null}
      </ScreenBody>
    </Screen>
  );
}
