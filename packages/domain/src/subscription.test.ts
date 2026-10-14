import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  applySubscriptionEvent,
  entitlementAllowsAccess,
  initialSubscription,
} from './subscription.js';

describe('subscription state machine', () => {
  it('rejects unverified client callbacks', () => {
    expect(() =>
      applySubscriptionEvent(initialSubscription(), {
        eventId: 'evt-1',
        type: 'purchase_verified',
        occurredAt: '2026-06-01T00:00:00.000Z',
        verified: false,
        productId: 'premium_monthly',
        store: 'app_store',
      }),
    ).toThrow(DomainError);
  });

  it('activates a verified purchase and ignores a duplicate payload', () => {
    const first = applySubscriptionEvent(initialSubscription(), {
      eventId: 'evt-1',
      type: 'purchase_verified',
      occurredAt: '2026-06-01T00:00:00.000Z',
      verified: true,
      productId: 'premium_monthly',
      store: 'app_store',
      currentPeriodEnd: '2026-07-01T00:00:00.000Z',
    });
    expect(first.disposition).toBe('applied');
    expect(first.snapshot.status).toBe('active');
    const duplicate = applySubscriptionEvent(first.snapshot, {
      eventId: 'evt-1',
      type: 'refunded',
      occurredAt: '2026-06-02T00:00:00.000Z',
      verified: true,
    });
    expect(duplicate.disposition).toBe('duplicate');
    expect(duplicate.snapshot.status).toBe('active');
  });

  it('ignores stale non-corrective events and still applies refunds', () => {
    const active = applySubscriptionEvent(initialSubscription(), {
      eventId: 'evt-1',
      type: 'purchase_verified',
      occurredAt: '2026-06-02T00:00:00.000Z',
      verified: true,
      productId: 'premium_monthly',
      store: 'play_store',
      currentPeriodEnd: '2026-07-02T00:00:00.000Z',
    }).snapshot;
    const stale = applySubscriptionEvent(active, {
      eventId: 'evt-0',
      type: 'expired',
      occurredAt: '2026-06-01T00:00:00.000Z',
      verified: true,
    });
    expect(stale.disposition).toBe('ignored_out_of_order');
    expect(stale.snapshot.status).toBe('active');
    const refund = applySubscriptionEvent(active, {
      eventId: 'evt-refund',
      type: 'refunded',
      occurredAt: '2026-05-01T00:00:00.000Z',
      verified: true,
    });
    expect(refund.disposition).toBe('applied');
    expect(refund.snapshot.status).toBe('refunded');
    expect(entitlementAllowsAccess(refund.snapshot, '2026-06-03T00:00:00.000Z')).toBe(false);
  });

  it('keeps access through grace and until the end of a canceled period', () => {
    let snapshot = applySubscriptionEvent(initialSubscription(), {
      eventId: 'evt-1',
      type: 'purchase_verified',
      occurredAt: '2026-06-01T00:00:00.000Z',
      verified: true,
      productId: 'premium_annual',
      store: 'app_store',
      currentPeriodEnd: '2027-06-01T00:00:00.000Z',
    }).snapshot;
    snapshot = applySubscriptionEvent(snapshot, {
      eventId: 'evt-cancel',
      type: 'cancel_scheduled',
      occurredAt: '2026-07-01T00:00:00.000Z',
      verified: true,
    }).snapshot;
    expect(snapshot.status).toBe('active');
    expect(snapshot.cancelAtPeriodEnd).toBe(true);
    snapshot = applySubscriptionEvent(snapshot, {
      eventId: 'evt-canceled',
      type: 'canceled',
      occurredAt: '2026-07-02T00:00:00.000Z',
      verified: true,
    }).snapshot;
    expect(entitlementAllowsAccess(snapshot, '2026-08-01T00:00:00.000Z')).toBe(true);
    expect(entitlementAllowsAccess(snapshot, '2027-06-02T00:00:00.000Z')).toBe(false);
  });

  it('rejects impossible transitions', () => {
    expect(() =>
      applySubscriptionEvent(initialSubscription(), {
        eventId: 'evt-1',
        type: 'renewal_verified',
        occurredAt: '2026-06-01T00:00:00.000Z',
        verified: true,
      }),
    ).toThrow(DomainError);
  });
});
