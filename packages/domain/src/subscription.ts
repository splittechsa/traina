import { DomainError, assertIsoDateTime } from './errors.js';

export type SubscriptionStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'billing_retry'
  | 'canceled'
  | 'expired'
  | 'refunded'
  | 'revoked';

export type SubscriptionEventType =
  | 'trial_started'
  | 'purchase_verified'
  | 'renewal_verified'
  | 'grace_started'
  | 'billing_retry_started'
  | 'cancel_scheduled'
  | 'canceled'
  | 'expired'
  | 'refunded'
  | 'revoked'
  | 'restored';

export type StoreChannel = 'app_store' | 'play_store' | 'web' | 'promotional';

export type SubscriptionSnapshot = {
  status: SubscriptionStatus;
  productId: string | null;
  store: StoreChannel | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastEventAt: string | null;
  processedEventIds: readonly string[];
};

export type SubscriptionNotification = {
  eventId: string;
  type: SubscriptionEventType;
  occurredAt: string;
  verified: boolean;
  productId?: string;
  store?: StoreChannel;
  currentPeriodEnd?: string;
};

export type SubscriptionDisposition = 'applied' | 'duplicate' | 'ignored_out_of_order';

export type SubscriptionTransition = {
  snapshot: SubscriptionSnapshot;
  disposition: SubscriptionDisposition;
};

const CORRECTIONS = new Set<SubscriptionEventType>(['refunded', 'revoked']);

const TRANSITIONS: Record<SubscriptionStatus, Partial<Record<SubscriptionEventType, SubscriptionStatus>>> = {
  free: {
    trial_started: 'trialing',
    purchase_verified: 'active',
  },
  trialing: {
    purchase_verified: 'active',
    canceled: 'canceled',
    expired: 'expired',
    refunded: 'refunded',
    revoked: 'revoked',
  },
  active: {
    renewal_verified: 'active',
    grace_started: 'grace_period',
    billing_retry_started: 'billing_retry',
    canceled: 'canceled',
    expired: 'expired',
    refunded: 'refunded',
    revoked: 'revoked',
  },
  grace_period: {
    renewal_verified: 'active',
    billing_retry_started: 'billing_retry',
    canceled: 'canceled',
    expired: 'expired',
    refunded: 'refunded',
    revoked: 'revoked',
  },
  billing_retry: {
    renewal_verified: 'active',
    grace_started: 'grace_period',
    expired: 'expired',
    refunded: 'refunded',
    revoked: 'revoked',
  },
  canceled: {
    purchase_verified: 'active',
    restored: 'active',
    expired: 'expired',
  },
  expired: {
    purchase_verified: 'active',
    restored: 'active',
  },
  refunded: {
    purchase_verified: 'active',
  },
  revoked: {
    restored: 'active',
    purchase_verified: 'active',
  },
};

export function initialSubscription(): SubscriptionSnapshot {
  return {
    status: 'free',
    productId: null,
    store: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    lastEventAt: null,
    processedEventIds: [],
  };
}

export function applySubscriptionEvent(
  snapshot: SubscriptionSnapshot,
  event: SubscriptionNotification,
): SubscriptionTransition {
  if (!event.verified) {
    throw new DomainError('UNVERIFIED_STORE_EVENT', 'Subscription events must be verified on the server');
  }
  if (event.eventId.trim().length === 0) {
    throw new DomainError('INVALID_EVENT', 'Event id is required');
  }
  assertIsoDateTime(event.occurredAt, 'INVALID_EVENT_TIME');
  if (snapshot.processedEventIds.includes(event.eventId)) {
    return { snapshot, disposition: 'duplicate' };
  }
  if (
    snapshot.lastEventAt !== null &&
    Date.parse(event.occurredAt) < Date.parse(snapshot.lastEventAt) &&
    !CORRECTIONS.has(event.type)
  ) {
    return { snapshot, disposition: 'ignored_out_of_order' };
  }

  if (event.type === 'cancel_scheduled') {
    if (snapshot.status !== 'active' && snapshot.status !== 'trialing' && snapshot.status !== 'grace_period') {
      throw new DomainError('INVALID_TRANSITION', `Cannot schedule cancellation from ${snapshot.status}`);
    }
    return {
      disposition: 'applied',
      snapshot: {
        ...snapshot,
        cancelAtPeriodEnd: true,
        lastEventAt: later(snapshot.lastEventAt, event.occurredAt),
        processedEventIds: [...snapshot.processedEventIds, event.eventId],
      },
    };
  }

  const nextStatus = TRANSITIONS[snapshot.status][event.type];
  if (nextStatus === undefined) {
    throw new DomainError('INVALID_TRANSITION', `Cannot apply ${event.type} from ${snapshot.status}`);
  }
  if ((event.type === 'purchase_verified' || event.type === 'trial_started') && (event.productId === undefined || event.store === undefined)) {
    throw new DomainError('INVALID_EVENT', 'A verified purchase or trial requires a product and store');
  }

  return {
    disposition: 'applied',
    snapshot: {
      status: nextStatus,
      productId: event.productId ?? snapshot.productId,
      store: event.store ?? snapshot.store,
      currentPeriodEnd: event.currentPeriodEnd ?? snapshot.currentPeriodEnd,
      cancelAtPeriodEnd: nextStatus === 'active' && event.type === 'renewal_verified' ? snapshot.cancelAtPeriodEnd : nextStatus === 'active' ? false : snapshot.cancelAtPeriodEnd,
      lastEventAt: later(snapshot.lastEventAt, event.occurredAt),
      processedEventIds: [...snapshot.processedEventIds, event.eventId],
    },
  };
}

function later(current: string | null, incoming: string): string {
  if (current === null) {
    return incoming;
  }
  return Date.parse(incoming) > Date.parse(current) ? incoming : current;
}

export function entitlementAllowsAccess(snapshot: SubscriptionSnapshot, at: string): boolean {
  assertIsoDateTime(at, 'INVALID_AS_OF');
  const atMs = Date.parse(at);
  const withinPeriod =
    snapshot.currentPeriodEnd !== null && atMs <= Date.parse(snapshot.currentPeriodEnd);
  switch (snapshot.status) {
    case 'trialing':
    case 'active':
    case 'grace_period':
      return true;
    case 'billing_retry':
    case 'canceled':
      return withinPeriod;
    case 'free':
    case 'expired':
    case 'refunded':
    case 'revoked':
      return false;
    default:
      return false;
  }
}
