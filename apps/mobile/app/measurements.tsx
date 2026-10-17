import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseScaledInteger } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../src/api/client';
import { formatCount, riyadhToday } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily } from '../src/theme/tokens';
import { Button, Field, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton } from '../src/ui/kit';

type Measurement = {
  id: string;
  recordedOn: string;
  waistMm: number | null;
  chestMm: number | null;
  hipMm: number | null;
  armMm: number | null;
  thighMm: number | null;
  neckMm: number | null;
};

const fields = ['waist', 'chest', 'hip', 'arm', 'thigh', 'neck'] as const;

export default function MeasurementsScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const [values, setValues] = useState<Record<(typeof fields)[number], string>>({
    waist: '',
    chest: '',
    hip: '',
    arm: '',
    thigh: '',
    neck: '',
  });
  const [notice, setNotice] = useState('');
  const list = useQuery({
    queryKey: ['measurements'],
    queryFn: () => apiRequest<{ measurements: Measurement[] }>('/v1/measurements'),
  });
  const isAr = locale === 'ar';
  const captions = {
    waist: isAr ? 'الخصر' : 'Waist',
    chest: isAr ? 'الصدر' : 'Chest',
    hip: isAr ? 'الورك' : 'Hip',
    arm: isAr ? 'الذراع' : 'Arm',
    thigh: isAr ? 'الفخذ' : 'Thigh',
    neck: isAr ? 'الرقبة' : 'Neck',
  };

  async function save() {
    setNotice('');
    const body: Record<string, number | string | null> = { recordedOn: riyadhToday() };
    for (const key of fields) {
      const raw = values[key].trim();
      if (raw.length === 0) continue;
      body[`${key}Mm`] = parseScaledInteger(raw, 10);
    }
    try {
      await apiRequest('/v1/measurements', { method: 'POST', body });
      await client.invalidateQueries({ queryKey: ['measurements'] });
      setNotice(text(locale, 'saved'));
    } catch (caught) {
      setNotice(caught instanceof ApiClientError ? caught.message : text(locale, 'error'));
    }
  }

  if (list.isPending) {
    return <Screen><LoadingSkeleton /></Screen>;
  }
  if (list.isError) {
    return (
      <Screen title={text(locale, 'bodyTape')}>
        <ErrorState body={text(locale, 'error')} onRetry={() => void list.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={text(locale, 'bodyTape')}
          subtitle={text(locale, 'centimeters')}
          trailing={(
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{text(locale, 'back')}</Text>
            </Pressable>
          )}
        />
        {fields.map((key) => (
          <Field key={key} label={captions[key]} value={values[key]} onChangeText={(next) => setValues((current) => ({ ...current, [key]: next }))} keyboardType="decimal-pad" />
        ))}
        <Button label={text(locale, 'save')} onPress={() => void save()} />
        {notice ? <Text style={{ color: theme.warning, fontFamily: fontFamily.medium, marginTop: 10 }}>{notice}</Text> : null}
        {(list.data?.measurements ?? []).slice(0, 8).map((row) => (
          <Text key={row.id} style={{ color: theme.textMuted, fontFamily: fontFamily.medium, marginTop: 10 }}>
            {row.waistMm === null ? row.recordedOn : `${String(row.recordedOn).slice(0, 10)} · ${formatCount(row.waistMm / 10, locale)} ${text(locale, 'centimeters')}`}
          </Text>
        ))}
      </ScreenBody>
    </Screen>
  );
}
