import { Text } from '../src/ui/Text';
import { useFormRecovery } from '../src/storage/useFormRecovery';
import { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { formatKg, formatRiyadhDate, riyadhToday } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { fontFamily } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Body, Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, ErrorState, ListRow, LoadingSkeleton, Sparkline } from '../src/ui/kit';
import { NumberWheel } from '../src/ui/pickers/NumberWheel';
import { tapSuccess } from '../src/ui/haptics';
import { useMotion } from '../src/theme/motion';
import { stableRecordKey } from '../src/lists/keys';
import { GlowCard } from '../src/ui/visual';

type Progress = { weights: { id: string; weight_grams: number; recorded_on: string }[] };

const DEFAULT_WEIGHT_KG = 70;

export default function WeightScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const { reduce } = useMotion();
  const client = useQueryClient();
  const [weightKg, setWeightKg] = useState(DEFAULT_WEIGHT_KG);
  const [initialized, setInitialized] = useState(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const progress = useQuery({ queryKey: ['progress'], queryFn: () => apiRequest<Progress>('/v1/progress') });

  const weights = progress.data?.weights ?? [];
  const latest = weights.length === 0 ? null : weights[weights.length - 1];
  const previous = weights.length < 2 ? null : weights[weights.length - 2];
  const delta = latest !== null && previous !== null ? Number(latest.weight_grams) - Number(previous.weight_grams) : null;

  // Initialize the wheel to the most recent recorded weight, once, as soon as it loads —
  // not on every refetch, so it doesn't jump back under the user mid-edit.
  if (!initialized && latest != null) {
    setWeightKg(Number(latest.weight_grams) / 1000);
    setInitialized(true);
  }

  const recovery = useFormRecovery('weight', { weightKg }, draft => setWeightKg(draft.weightKg), weightKg !== (latest ? Number(latest.weight_grams) / 1000 : DEFAULT_WEIGHT_KG), progress.isFetched);

  async function save() {
    setSaving(true);
    try {
      await apiRequest('/v1/weight', {
        method: 'POST',
        body: { weightKg: weightKg.toFixed(1), recordedOn: riyadhToday() },
      });
      await client.invalidateQueries({ queryKey: ['progress'] });
      await recovery.clear();
      setNotice(text(locale, 'saved'));
      tapSuccess(reduce);
    } catch (caught) {
      setNotice(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenBody>
        <AppHeader title={text(locale, 'weightTracking')} subtitle={text(locale, 'units')} showBack />
        {latest !== null ? (
          <View style={{ marginBottom: 16 }}>
            <GlowCard>
              <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium, fontSize: 13 }}>{locale === 'ar' ? 'آخر وزن مسجّل' : 'Latest weigh-in'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: 48, lineHeight: 56, fontVariant: ['tabular-nums'] }}>
                  {formatKg(Number(latest.weight_grams), locale)}
                </Text>
                <Text style={{ color: 'rgba(243,246,244,0.62)', fontFamily: fontFamily.medium, fontSize: 15 }}>{text(locale, 'kilograms')}</Text>
              </View>
              {delta !== null ? (
                <Text style={{ color: delta <= 0 ? theme.heroAccent : theme.ember, fontFamily: fontFamily.semibold, fontSize: 13, marginTop: 4 }}>
                  {`${delta > 0 ? '▲ +' : '▼ '}${formatKg(delta, locale)} ${locale === 'ar' ? 'منذ آخر تسجيل' : 'since last entry'}`}
                </Text>
              ) : null}
              {weights.length >= 2 ? (
                <View style={{ marginTop: 14 }}>
                  <Sparkline values={weights.map((row) => Number(row.weight_grams))} />
                </View>
              ) : null}
            </GlowCard>
          </View>
        ) : null}
        <View style={{ gap: 12, marginBottom: 20, backgroundColor: theme.surface, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 12 }}>
          <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 15, textAlign: 'center' }}>{locale === 'ar' ? 'وزن اليوم' : "Today's weight"}</Text>
          <NumberWheel
            value={weightKg}
            onChange={setWeightKg}
            min={30}
            max={300}
            step={0.1}
            decimals={1}
            suffix={text(locale, 'kilograms')}
            locale={locale}
            accessibilityLabel={`${text(locale, 'weight')} (${text(locale, 'kilograms')})`}
            testID="weight-wheel"
          />
          <Button label={text(locale, 'save')} onPress={() => void save()} disabled={saving} />
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
