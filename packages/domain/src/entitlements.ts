import type { SubscriptionSnapshot, SubscriptionStatus } from './subscription.js';

/**
 * P3-ENT-01 — Server-authoritative capability projection.
 * Clients must never unlock paid coaching from local flags.
 */

export const TRAIN_A_CAPABILITIES = [
  'tracking.free',
  'yazan.daily',
  'recommendations.propose',
  'human_coach.weekly_review',
  'human_coach.assignment',
  'nutrition.paid_adaptations',
] as const;

export type TrainaCapability = (typeof TRAIN_A_CAPABILITIES)[number];

export type EntitlementProjection = {
  planCode: 'free' | 'traina_ai' | 'traina_coach';
  status: SubscriptionStatus;
  capabilities: readonly TrainaCapability[];
  /** Usage ceilings — enforced server-side later. */
  limits: {
    yazanTurnsPerDay: number;
    humanReviewsPerMonth: number;
  };
  nutritionAdaptationsBlocked: true;
  note: string;
};

const FREE_CAPABILITIES: readonly TrainaCapability[] = [
  'tracking.free',
  'yazan.daily',
  'recommendations.propose',
];

const AI_CAPABILITIES: readonly TrainaCapability[] = [...FREE_CAPABILITIES];

const COACH_CAPABILITIES: readonly TrainaCapability[] = [
  ...AI_CAPABILITIES,
  'human_coach.weekly_review',
  'human_coach.assignment',
];

function paidActive(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing' || status === 'grace_period';
}

/**
 * Deterministic entitlements from subscription snapshot + optional plan code.
 * Nutrition paid adaptations stay blocked until ENERGY_POLICY SME approval (capability omitted).
 */
export function projectEntitlements(input: {
  subscription: SubscriptionSnapshot;
  planCode?: 'free' | 'traina_ai' | 'traina_coach';
}): EntitlementProjection {
  const planCode =
    input.planCode ??
    (input.subscription.productId?.includes('coach')
      ? 'traina_coach'
      : input.subscription.productId?.includes('ai')
        ? 'traina_ai'
        : 'free');
  const active = paidActive(input.subscription.status);
  let capabilities: readonly TrainaCapability[] = FREE_CAPABILITIES;
  if (active && planCode === 'traina_ai') capabilities = AI_CAPABILITIES;
  if (active && planCode === 'traina_coach') capabilities = COACH_CAPABILITIES;
  if (!active) capabilities = FREE_CAPABILITIES;

  return {
    planCode: active ? planCode : 'free',
    status: input.subscription.status,
    capabilities,
    limits: {
      yazanTurnsPerDay: planCode === 'free' || !active ? 20 : 200,
      humanReviewsPerMonth: planCode === 'traina_coach' && active ? 8 : 0,
    },
    nutritionAdaptationsBlocked: true,
    note: 'nutrition.paid_adaptations omitted until ENERGY_POLICY approved. Never grant from client flags.',
  };
}

export function hasCapability(
  projection: EntitlementProjection,
  capability: TrainaCapability,
): boolean {
  return projection.capabilities.includes(capability);
}
