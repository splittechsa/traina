import { Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../src/api/client';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { fontFamily, spacing, typeScale } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, LoadingSkeleton, SurfaceCard } from '../src/ui/kit';

type Consent = { status: string; disclosure?: string };

export default function PrivacyScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const client = useQueryClient();
  const consent = useQuery({
    queryKey: ['coach-share-consent'],
    queryFn: () => apiRequest<Consent>('/v1/member/coach-share-consent'),
  });
  const grant = useMutation({
    mutationFn: () => apiRequest('/v1/member/coach-share-consent', { method: 'POST' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['coach-share-consent'] });
    },
  });
  const revoke = useMutation({
    mutationFn: () => apiRequest('/v1/member/coach-share-consent', { method: 'DELETE' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['coach-share-consent'] });
    },
  });

  const granted = consent.data?.status === 'granted';

  return (
    <Screen>
      <ScreenBody>
        <AppHeader title={text(locale, 'privacyConsent')} showBack />
        {consent.isPending ? <LoadingSkeleton /> : null}
        <SurfaceCard>
          <Text style={{ color: theme.text, fontFamily: fontFamily.regular, lineHeight: 22, fontSize: typeScale.body }}>
            {consent.data?.disclosure ?? text(locale, 'privacyConsentBody')}
          </Text>
        </SurfaceCard>
        <SurfaceCard tone={granted ? 'raised' : 'muted'}>
          <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.card }}>
            {granted ? text(locale, 'privacyConsentGranted') : text(locale, 'privacyConsentWithdrawn')}
          </Text>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 8, lineHeight: 20 }}>
            {text(locale, 'helpPrivacyBody')}
          </Text>
        </SurfaceCard>
        <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
          {granted ? (
            <Button
              label={text(locale, 'privacyConsentRevoke')}
              variant="secondary"
              onPress={() => revoke.mutate()}
              disabled={revoke.isPending}
            />
          ) : (
            <Button
              label={text(locale, 'privacyConsentGrant')}
              onPress={() => grant.mutate()}
              disabled={grant.isPending}
            />
          )}
        </View>
      </ScreenBody>
    </Screen>
  );
}
