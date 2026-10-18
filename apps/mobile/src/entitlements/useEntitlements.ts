import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { useSession } from '../auth/SessionProvider';

export type MemberEntitlements = {
  planCode: 'free' | 'traina_ai' | 'traina_coach';
  status: string;
  capabilities: readonly string[];
  limits: { yazanTurnsPerDay: number; humanReviewsPerMonth: number };
  nutritionAdaptationsBlocked: true;
  purchasesEnabled: false;
  source: 'subscriptions' | 'default_free';
};

export function useEntitlements() {
  const { tokens } = useSession();
  const query = useQuery({
    queryKey: ['member-entitlements'],
    enabled: tokens !== null,
    queryFn: () => apiRequest<MemberEntitlements>('/v1/member/entitlements'),
    staleTime: 60_000,
  });

  const capabilities = query.data?.capabilities ?? [];
  const has = (capability: string) => capabilities.includes(capability);
  const planCode = query.data?.planCode ?? 'free';

  return {
    ...query,
    planCode,
    hasHumanCoach: has('human_coach.weekly_review') || has('human_coach.assignment'),
    hasYazanDaily: has('yazan.daily'),
    hasRecommendations: has('recommendations.propose'),
    yazanTurnsPerDay: query.data?.limits.yazanTurnsPerDay ?? 0,
    humanReviewsPerMonth: query.data?.limits.humanReviewsPerMonth ?? 0,
    purchasesEnabled: query.data?.purchasesEnabled ?? false,
    nutritionAdaptationsBlocked: query.data?.nutritionAdaptationsBlocked ?? true,
  };
}
