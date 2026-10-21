import { Text } from '../src/ui/Text';
import { useFormRecovery } from '../src/storage/useFormRecovery';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../src/api/client';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { fontFamily, spacing, typeScale } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, SurfaceCard } from '../src/ui/kit';

type SupplementItem = {
  name: string;
  taken: boolean;
  logId: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SupplementsScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const on = useMemo(() => todayIso(), []);
  const [name, setName] = useState('');
  const recovery = useFormRecovery('supplement-name', { name }, draft => setName(draft.name), name !== '');
  const list = useQuery({
    queryKey: ['supplements', on],
    queryFn: () => apiRequest<{ items: SupplementItem[] }>(`/v1/supplements?on=${on}`),
  });
  const add = useMutation({
    mutationFn: (raw: string) =>
      apiRequest('/v1/supplements', { method: 'POST', body: { name: raw, loggedOn: on } }),
    onSuccess: async () => {
      await recovery.clear();
      setName('');
      await client.invalidateQueries({ queryKey: ['supplements', on] });
    },
  });
  const toggle = useMutation({
    mutationFn: async (item: SupplementItem) => {
      if (item.taken && item.logId) {
        return apiRequest(`/v1/supplements/log/${item.logId}?on=${on}`, { method: 'DELETE' });
      }
      return apiRequest('/v1/supplements/log', { method: 'POST', body: { name: item.name, loggedOn: on } });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['supplements', on] });
    },
  });

  const items = list.data?.items ?? [];

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={text(locale, 'supplements')}
          subtitle={locale === 'ar' ? 'قائمة شخصية — ليست وصفة طبية' : 'Personal list — not a medical prescription'}
          showBack
        />
        {list.isPending ? <LoadingSkeleton /> : null}
        {list.isError ? (
          <ErrorState body={text(locale, 'error')} onRetry={() => { void list.refetch(); }} />
        ) : null}
        {!list.isPending && !list.isError && items.length === 0 ? (
          <EmptyState
            title={text(locale, 'supplements')}
            body={locale === 'ar'
              ? 'أضف أسماء مكملاتك لتتبع ما أخذته اليوم. لا نقدّم كتالوجاً معتمداً.'
              : 'Add your supplement names to track what you took today. There is no approved catalog.'}
          />
        ) : null}

        <View style={{ gap: spacing[2], marginBottom: spacing[4] }}>
          {items.map((item) => (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              onPress={() => toggle.mutate(item)}
              disabled={toggle.isPending}
            >
              <SurfaceCard tone={item.taken ? 'raised' : 'muted'}>
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>
                  {item.name}
                </Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, marginTop: 6, fontSize: typeScale.label }}>
                  {item.taken
                    ? (locale === 'ar' ? 'مأخوذ اليوم — اضغط للإلغاء' : 'Logged today — tap to undo')
                    : (locale === 'ar' ? 'لم يُسجَّل اليوم — اضغط للتأكيد' : 'Not logged today — tap to confirm')}
                </Text>
              </SurfaceCard>
            </Pressable>
          ))}
        </View>

        <SurfaceCard>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, marginBottom: spacing[2] }}>
            {locale === 'ar' ? 'أضف مكملاً' : 'Add a supplement'}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={locale === 'ar' ? 'مثال: فيتامين د' : 'e.g. Vitamin D'}
            placeholderTextColor={theme.textMuted}
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: theme.text,
              fontFamily: fontFamily.regular,
              marginBottom: spacing[3],
            }}
          />
          <Button
            label={text(locale, 'save')}
            onPress={() => {
              const trimmed = name.trim();
              if (trimmed.length > 0) add.mutate(trimmed);
            }}
            disabled={add.isPending || name.trim().length === 0}
          />
        </SurfaceCard>
      </ScreenBody>
    </Screen>
  );
}
