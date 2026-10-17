import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../src/api/client';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { fontFamily, spacing, typeScale } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState, LoadingSkeleton, SurfaceCard } from '../src/ui/kit';

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  authorKind: string;
  readAt: string | null;
  createdAt: string;
  isHumanCoach: boolean;
};

export default function NotificationsScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ['member-notifications'],
    queryFn: () => apiRequest<{ notifications: NotificationRow[] }>('/v1/member/notifications'),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/member/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['member-notifications'] });
    },
  });

  return (
    <Screen>
      <ScreenBody>
        <AppHeader title={text(locale, 'notifications')} subtitle={text(locale, 'humanCoachLabel')} />
        {list.isPending ? <LoadingSkeleton /> : null}
        {list.isError ? <EmptyState title={text(locale, 'error')} body={text(locale, 'error')} /> : null}
        {!list.isPending && (list.data?.notifications.length ?? 0) === 0 ? (
          <EmptyState title={text(locale, 'notifications')} body={text(locale, 'notificationsMissing')} />
        ) : null}
        <View style={{ gap: spacing[3] }}>
          {(list.data?.notifications ?? []).map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => {
                if (row.readAt === null) markRead.mutate(row.id);
                if (row.href) router.push(row.href as '/weekly-checkin');
              }}
            >
              <SurfaceCard tone={row.readAt === null ? 'raised' : 'muted'}>
                <Text style={{ color: theme.accent, fontFamily: fontFamily.bold, marginBottom: 4 }}>
                  {row.isHumanCoach ? text(locale, 'humanCoachLabel') : row.title}
                </Text>
                <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>
                  {row.title}
                </Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 8, lineHeight: 22 }}>
                  {row.body}
                </Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 8, fontSize: 12 }}>
                  {row.createdAt.slice(0, 16).replace('T', ' ')}
                  {row.readAt === null ? ' · unread' : ''}
                </Text>
              </SurfaceCard>
            </Pressable>
          ))}
        </View>
      </ScreenBody>
    </Screen>
  );
}
