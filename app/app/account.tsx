import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../src/api/client';
import { useSession } from '../src/auth/SessionProvider';
import { labelList } from '../src/i18n/labels';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Button, Screen } from '../src/ui/Screen';
import { AppHeader, EmptyState, NavRow, ProfileAvatar } from '../src/ui/kit';

type Me = { profile: { display_name?: string | null } | null; goals?: string[] };

export default function AccountScreen() {
  const { locale } = useLocale();
  const session = useSession();
  const me = useQuery({
    queryKey: ['me', session.tokens?.accessToken],
    enabled: session.tokens !== null,
    queryFn: () => apiRequest<Me>('/v1/me'),
  });
  const name = me.data?.profile?.display_name?.trim() || text(locale, 'brand');

  async function logout() {
    await apiRequest('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    await session.clear();
    router.replace('/(auth)/login');
  }

  async function remove() {
    await apiRequest('/v1/account', { method: 'DELETE' });
    await session.clear();
    router.replace('/(auth)/login');
  }

  return (
    <Screen>
      <AppHeader title={text(locale, 'account')} trailing={<ProfileAvatar name={name} />} />
      <EmptyState title={text(locale, 'goal')} body={labelList(locale, 'goal', me.data?.goals ?? [])} />
      <NavRow label={text(locale, 'settings')} onPress={() => router.push('/settings')} />
      <Button label={text(locale, 'signOut')} variant="secondary" onPress={() => void logout()} />
      <Button label={text(locale, 'deleteAccount')} variant="danger" onPress={() => void remove()} />
    </Screen>
  );
}
