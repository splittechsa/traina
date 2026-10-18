import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../src/api/client';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text, type CopyKey } from '../src/i18n/copy';
import { fontFamily, spacing, typeScale } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton, SurfaceCard } from '../src/ui/kit';

type EntitlementsResponse = {
  planCode: 'free' | 'traina_ai' | 'traina_coach';
  status: string;
  capabilities: readonly string[];
  limits: { yazanTurnsPerDay: number; humanReviewsPerMonth: number };
  nutritionAdaptationsBlocked: true;
  note: string;
  purchasesEnabled: false;
  source: 'subscriptions' | 'default_free';
};

function planLabel(locale: 'ar' | 'en', plan: EntitlementsResponse['planCode']): string {
  const key: CopyKey =
    plan === 'traina_coach' ? 'membershipPlanCoach'
      : plan === 'traina_ai' ? 'membershipPlanAi'
        : 'membershipPlanFree';
  return text(locale, key);
}

export default function MembershipScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const entitlements = useQuery({
    queryKey: ['member-entitlements'],
    queryFn: () => apiRequest<EntitlementsResponse>('/v1/member/entitlements'),
  });

  return (
    <Screen>
      <ScreenBody>
        <AppHeader
          title={text(locale, 'membership')}
          subtitle={text(locale, 'membershipPurchaseOff')}
          showBack
        />
        {entitlements.isPending ? <LoadingSkeleton /> : null}
        {entitlements.isError ? (
          <ErrorState body={text(locale, 'membershipMissing')} onRetry={() => { void entitlements.refetch(); }} />
        ) : null}
        {entitlements.data !== undefined ? (
          <View style={{ gap: spacing[3] }}>
            <SurfaceCard tone="raised">
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>
                {text(locale, 'membershipStatus')}
              </Text>
              <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.headline, marginTop: 6 }}>
                {planLabel(locale, entitlements.data.planCode)}
              </Text>
              <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, marginTop: 8 }}>
                {entitlements.data.status}
              </Text>
            </SurfaceCard>

            <SurfaceCard>
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.card }}>
                {text(locale, 'membershipCapabilities')}
              </Text>
              <View style={{ marginTop: spacing[2], gap: 8 }}>
                {entitlements.data.capabilities.map((capability) => (
                  <Text key={capability} style={{ color: theme.textMuted, fontFamily: fontFamily.regular, lineHeight: 22 }}>
                    · {capability}
                  </Text>
                ))}
              </View>
            </SurfaceCard>

            <SurfaceCard tone="muted">
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.card }}>
                {text(locale, 'membershipLimits')}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 8, lineHeight: 22 }}>
                {text(locale, 'membershipYazanTurns')}: {entitlements.data.limits.yazanTurnsPerDay}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 4, lineHeight: 22 }}>
                {text(locale, 'membershipHumanReviews')}: {entitlements.data.limits.humanReviewsPerMonth}
              </Text>
              <Text style={{ color: theme.warning, fontFamily: fontFamily.medium, marginTop: spacing[3], lineHeight: 22 }}>
                {text(locale, 'membershipNutritionBlocked')}
              </Text>
            </SurfaceCard>
          </View>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
