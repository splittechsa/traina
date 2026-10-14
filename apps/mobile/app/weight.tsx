import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { formatKg, formatRiyadhDate, riyadhToday } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { fontFamily } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Body, Button, Field, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, ErrorState, ListRow, LoadingSkeleton, Sparkline } from '../src/ui/kit';
import { stableRecordKey } from '../src/lists/keys';

type Progress = { weights: { id: string; weight_grams: number; recorded_on: string }[] };

export default function WeightScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
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

  const weights = progress.data?.weights ?? [];
  const latest = weights.length === 0 ? null : weights[weights.length - 1];
  const previous = weights.length < 2 ? null : weights[weights.length - 2];
  const delta = latest !== null && previous !== null ? Number(latest.weight_grams) - Number(previous.weight_grams) : null;

  return (
    <Screen>
      <ScreenBody>
        <AppHeader title={text(locale, 'weightTracking')} subtitle={text(locale, 'units')} />
        {latest !== null ? (
          <View style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: 44, lineHeight: 52 }}>
                {formatKg(Number(latest.weight_grams), locale)}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: 15 }}>{text(locale, 'kilograms')}</Text>
            </View>
            {delta !== null ? (
              <Text style={{ color: delta <= 0 ? theme.success : theme.textMuted, fontFamily: fontFamily.semibold, fontSize: 13, marginTop: 4 }}>
                {`${delta > 0 ? '+' : ''}${formatKg(delta, locale)} ${locale === 'ar' ? 'منذ آخر تسجيل' : 'since last entry'}`}
              </Text>
            ) : null}
            {weights.length >= 2 ? (
              <View style={{ marginTop: 14 }}>
                <Sparkline values={weights.map((row) => Number(row.weight_grams))} />
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={{ gap: 10, marginBottom: 20 }}>
          <Field label={`${text(locale, 'weight')} (${text(locale, 'kilograms')})`} value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[-0.5, -0.1, 0.1, 0.5].map((delta2) => (
              <View key={delta2} style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  label={delta2 > 0 ? `+${delta2}` : String(delta2)}
                  onPress={() => {
                    const now = Number(weightKg) || (latest === null ? 0 : Number(latest.weight_grams) / 1000);
                    const next = Math.max(0, now + delta2);
                    setWeightKg(Number.isInteger(next) ? String(next) : next.toFixed(1));
                  }}
                />
              </View>
            ))}
          </View>
          <Button label={text(locale, 'save')} onPress={() => void save()} />
          {notice.length > 0 ? <Body>{notice}</Body> : null}
        </View>
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
      </ScreenBody>
    </Screen>
  );
}
