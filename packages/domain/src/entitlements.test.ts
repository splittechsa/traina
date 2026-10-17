import { describe, expect, it } from 'vitest';
import { hasCapability, projectEntitlements } from './entitlements.js';
import type { SubscriptionSnapshot } from './subscription.js';

const freeSnap = (): SubscriptionSnapshot => ({
  status: 'free',
  productId: null,
  store: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  lastEventAt: null,
  processedEventIds: [],
});

const coachSnap = (): SubscriptionSnapshot => ({
  status: 'active',
  productId: 'traina_coach_monthly',
  store: 'web',
  currentPeriodEnd: '2026-11-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  lastEventAt: '2026-10-01T00:00:00.000Z',
  processedEventIds: ['evt-1'],
});

describe('entitlement projection (P3-ENT-01)', () => {
  it('keeps free members off human-coach assignment capability', () => {
    const projection = projectEntitlements({ subscription: freeSnap() });
    expect(projection.planCode).toBe('free');
    expect(hasCapability(projection, 'human_coach.assignment')).toBe(false);
    expect(hasCapability(projection, 'tracking.free')).toBe(true);
    expect(projection.nutritionAdaptationsBlocked).toBe(true);
  });

  it('grants coach capabilities only while subscription is paid-active', () => {
    const projection = projectEntitlements({
      subscription: coachSnap(),
      planCode: 'traina_coach',
    });
    expect(hasCapability(projection, 'human_coach.weekly_review')).toBe(true);
    expect(hasCapability(projection, 'human_coach.assignment')).toBe(true);
    expect(projection.capabilities.includes('nutrition.paid_adaptations')).toBe(false);
  });

  it('revokes coach capabilities when subscription expires', () => {
    const projection = projectEntitlements({
      subscription: { ...coachSnap(), status: 'expired' },
      planCode: 'traina_coach',
    });
    expect(projection.planCode).toBe('free');
    expect(hasCapability(projection, 'human_coach.assignment')).toBe(false);
  });
});
