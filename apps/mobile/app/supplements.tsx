import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { messageFor } from '../src/api/errors';
import { riyadhToday } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, radius, spacing, typeScale } from '../src/theme/tokens';
import { Button, Field, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton } from '../src/ui/kit';
import { stableRecordKey } from '../src/lists/keys';

type Item = { name: string; taken: boolean; logId: string | null };
type Day = { loggedOn: string; catalog: boolean; items: Item[] };

export default function SupplementsScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const today = riyadhToday();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: ['supplements', today],
    queryFn: () => apiRequest<Day>(`/v1/supplements?on=${today}`),
  });
  const ar = locale === 'ar';

  async function add() {
    setError('');
    setBusy(true);
    try {
      await apiRequest('/v1/supplements', { method: 'POST', body: { name: name.trim(), loggedOn: today } });
      setName('');
      await client.invalidateQueries({ queryKey: ['supplements', today] });
      await client.invalidateQueries({ queryKey: ['home'] });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: Item) {
    setError('');
    setBusy(true);
    try {
      if (item.taken && item.logId !== null) {
        await apiRequest(`/v1/supplements/log/${item.logId}?on=${today}`, { method: 'DELETE' });
      } else {
        await apiRequest('/v1/supplements/log', { method: 'POST', body: { name: item.name, loggedOn: today } });
      }
      await client.invalidateQueries({ queryKey: ['supplements', today] });
      await client.invalidateQueries({ queryKey: ['home'] });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'error'));
    } finally {
      setBusy(false);
    }
  }

  if (list.isPending) {
    return (
      <Screen>
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (list.isError || list.data === undefined) {
    const offline = list.error instanceof ApiClientError && list.error.code === 'OFFLINE';
    return (
      <Screen title={text(locale, 'supplements')}>
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void list.refetch()} />
      </Screen>
    );
  }

  const items = list.data.items;

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={text(locale, 'supplements')}
          subtitle={text(locale, 'supplementsHint')}
          trailing={(
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{text(locale, 'back')}</Text>
            </Pressable>
          )}
        />
        <Field label={text(locale, 'addSupplement')} value={name} onChangeText={setName} />
        <Button label={busy ? text(locale, 'saving') : text(locale, 'save')} onPress={() => void add()} disabled={busy || name.trim().length < 2} />
        {error.length > 0 ? <Text style={{ color: theme.danger, fontFamily: fontFamily.medium, marginTop: spacing[2] }}>{error}</Text> : null}
        <View style={{ height: spacing[4] }} />
        {items.length === 0 ? (
          <EmptyState title={text(locale, 'supplements')} body={text(locale, 'supplementsHint')} />
        ) : (
          items.map((item) => (
            <Pressable
              key={stableRecordKey(item.name)}
              accessibilityRole="button"
              accessibilityState={{ selected: item.taken }}
              disabled={busy}
              onPress={() => void toggle(item)}
              style={{
                minHeight: 64,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: item.taken ? theme.accent : theme.border,
                backgroundColor: item.taken ? theme.surfaceMuted : theme.surface,
                paddingHorizontal: spacing[4],
                marginBottom: spacing[2],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing[3],
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body, writingDirection: 'auto' }}>{item.name}</Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.micro, marginTop: 4 }}>
                  {item.taken ? text(locale, 'tookToday') : ar ? 'اضغط إذا أخذته اليوم' : 'Tap if you took it today'}
                </Text>
              </View>
              <Text style={{ color: item.taken ? theme.accent : theme.textMuted, fontFamily: fontFamily.bold, fontSize: 22 }}>{item.taken ? '✓' : '+'}</Text>
            </Pressable>
          ))
        )}
      </ScreenBody>
    </Screen>
  );
}
