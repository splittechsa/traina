import { DomainError } from './errors.js';
import { ENERGY_POLICY, assertEnergyPolicyApprovedForPaidCoaching } from './meal-plan.js';

/**
 * P1-REC-01 foundation — recommendation lifecycle.
 * AI / heuristics may DRAFT only. Nutrition apply requires approved ENERGY_POLICY + approvals.
 */

export const RECOMMENDATION_STATUSES = [
  'DRAFT',
  'VALIDATED',
  'REVIEW_REQUIRED',
  'MEMBER_CONFIRMATION_REQUIRED',
  'APPROVED',
  'APPLIED',
  'MONITORED',
  'SUPERSEDED',
  'REVERTED',
  'REJECTED',
] as const;

export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export type RecommendationCategory = 'daily_guidance' | 'training' | 'nutrition' | 'human_required';

export type CoachingRecommendation = {
  id: string;
  memberId: string;
  category: RecommendationCategory;
  status: RecommendationStatus;
  summary: string;
  /** Opaque deterministic payload — never applied by this module alone. */
  payload: Readonly<Record<string, unknown>>;
  requiresHumanReview: boolean;
  requiresMemberConfirmation: boolean;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
};

const TRANSITIONS: Record<RecommendationStatus, readonly RecommendationStatus[]> = {
  DRAFT: ['VALIDATED', 'REJECTED', 'SUPERSEDED'],
  VALIDATED: ['REVIEW_REQUIRED', 'MEMBER_CONFIRMATION_REQUIRED', 'APPROVED', 'REJECTED', 'SUPERSEDED'],
  REVIEW_REQUIRED: ['APPROVED', 'REJECTED', 'SUPERSEDED', 'MEMBER_CONFIRMATION_REQUIRED'],
  MEMBER_CONFIRMATION_REQUIRED: ['APPROVED', 'REJECTED', 'SUPERSEDED'],
  APPROVED: ['APPLIED', 'SUPERSEDED', 'REJECTED'],
  APPLIED: ['MONITORED', 'REVERTED', 'SUPERSEDED'],
  MONITORED: ['SUPERSEDED', 'REVERTED'],
  SUPERSEDED: [],
  REVERTED: ['SUPERSEDED'],
  REJECTED: [],
};

export function assertRecommendationStatus(value: string): RecommendationStatus {
  if ((RECOMMENDATION_STATUSES as readonly string[]).includes(value)) {
    return value as RecommendationStatus;
  }
  throw new DomainError('UNKNOWN_RECOMMENDATION_STATUS', 'Unknown recommendation status');
}

export function createRecommendationDraft(input: {
  id: string;
  memberId: string;
  category: RecommendationCategory;
  summary: string;
  payload?: Readonly<Record<string, unknown>>;
  createdAt: string;
  requiresHumanReview?: boolean;
  requiresMemberConfirmation?: boolean;
}): CoachingRecommendation {
  if (input.id.trim().length < 1 || input.memberId.trim().length < 1) {
    throw new DomainError('INVALID_RECOMMENDATION', 'id and memberId are required');
  }
  if (input.summary.trim().length < 1 || input.summary.length > 500) {
    throw new DomainError('INVALID_RECOMMENDATION', 'summary must be 1–500 characters');
  }
  const requiresHumanReview =
    input.requiresHumanReview ?? (input.category === 'human_required' || input.category === 'nutrition');
  const requiresMemberConfirmation = input.requiresMemberConfirmation ?? input.category !== 'daily_guidance';
  return {
    id: input.id,
    memberId: input.memberId,
    category: input.category,
    status: 'DRAFT',
    summary: input.summary.trim(),
    payload: input.payload ?? {},
    requiresHumanReview,
    requiresMemberConfirmation,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    schemaVersion: 1,
  };
}

export function transitionRecommendation(
  current: CoachingRecommendation,
  next: RecommendationStatus,
  at: string,
): CoachingRecommendation {
  const allowed = TRANSITIONS[current.status];
  if (!allowed.includes(next)) {
    throw new DomainError(
      'INVALID_RECOMMENDATION_TRANSITION',
      `Cannot transition recommendation from ${current.status} to ${next}`,
    );
  }
  if (next === 'APPLIED') {
    assertRecommendationMayApply(current);
  }
  return { ...current, status: next, updatedAt: at };
}

/** Hard gate before APPLIED — nutrition cannot bypass ENERGY_POLICY. */
export function assertRecommendationMayApply(rec: CoachingRecommendation): void {
  if (rec.status !== 'APPROVED') {
    throw new DomainError('NOT_APPROVED', 'Only APPROVED recommendations may be applied');
  }
  if (rec.category === 'nutrition') {
    assertEnergyPolicyApprovedForPaidCoaching();
  }
}

export function validateRecommendation(rec: CoachingRecommendation, at: string): CoachingRecommendation {
  if (rec.status !== 'DRAFT') {
    throw new DomainError('INVALID_RECOMMENDATION_TRANSITION', 'Only DRAFT recommendations can be validated');
  }
  let next = transitionRecommendation(rec, 'VALIDATED', at);
  // Nutrition stays propose-only / human review until ENERGY_POLICY is approved.
  if (next.category === 'nutrition' && !ENERGY_POLICY.approvedForPaidCoaching) {
    next = { ...next, requiresHumanReview: true };
    return transitionRecommendation(next, 'REVIEW_REQUIRED', at);
  }
  if (next.requiresHumanReview) {
    return transitionRecommendation(next, 'REVIEW_REQUIRED', at);
  }
  if (next.requiresMemberConfirmation) {
    return transitionRecommendation(next, 'MEMBER_CONFIRMATION_REQUIRED', at);
  }
  return next;
}
