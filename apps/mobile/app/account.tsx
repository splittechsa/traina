import { useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../src/api/client';
import { useSession } from '../src/auth/SessionProvider';
import { labelList } from '../src/i18n/labels';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { fontFamily, spacing, typeScale } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Screen, ScreenBody } from '../src/ui/Screen';
import { ProfileAvatar, SettingsGroup, SettingsRow } from '../src/ui/kit';

type Me = { profile: { display_name?: string | null } | null; goals?: string[] };

export default function AccountScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const session = useSession();
  const [exporting, setExporting] = useState(false);
  const me = useQuery({
    queryKey: ['me', session.tokens?.accessToken],
    enabled: session.tokens !== null,
    queryFn: () => apiRequest<Me>('/v1/me'),
  });
  const name = me.data?.profile?.display_name?.trim() || text(locale, 'brand');
  const goalLabel = labelList(locale, 'goal', me.data?.goals ?? []);

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

  async function exportData() {
    setExporting(true);
    try {
      const payload = await apiRequest<Record<string, unknown>>('/v1/account/export');
      await Share.share({
        message: JSON.stringify(payload, null, 2),
        title: text(locale, 'exportAccount'),
      });
    } catch (err) {
      Alert.alert(text(locale, 'error'), err instanceof Error ? err.message : text(locale, 'error'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen title={text(locale, 'account')}>
      <ScreenBody>
        <View style={{ alignItems: 'center', marginTop: spacing[2], marginBottom: spacing[5] }}>
          <ProfileAvatar name={name} />
          <Text
            numberOfLines={1}
            style={{ marginTop: spacing[3], color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.title, writingDirection: 'auto' }}
          >
            {name}
          </Text>
          {goalLabel.length > 0 ? (
            <Text
              numberOfLines={1}
              style={{ marginTop: 2, color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, writingDirection: 'auto' }}
            >
              {goalLabel}
            </Text>
          ) : null}
        </View>
        <SettingsGroup>
          <SettingsRow
            icon={{ ios: 'hand.raised.fill', android: 'privacy_tip', web: 'privacy_tip' }}
            title={text(locale, 'privacyConsent')}
            onPress={() => router.push('/privacy')}
          />
          <SettingsRow
            icon={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
            title={text(locale, 'settings')}
            onPress={() => router.push('/settings')}
            last
          />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow
            icon={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'share' }}
            title={exporting ? text(locale, 'loading') : text(locale, 'exportAccount')}
            showChevron={false}
            onPress={() => {
              if (!exporting) void exportData();
            }}
            last
          />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow
            icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
            title={text(locale, 'signOut')}
            showChevron={false}
            onPress={() => void logout()}
          />
          <SettingsRow
            icon={{ ios: 'trash.fill', android: 'delete', web: 'delete' }}
            tint={theme.danger}
            title={text(locale, 'deleteAccount')}
            destructive
            showChevron={false}
            onPress={() => void remove()}
            last
          />
        </SettingsGroup>
      </ScreenBody>
    </Screen>
  );
}
