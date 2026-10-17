import { DomainError } from './errors.js';
import type { Actor } from './access.js';
import { authorize } from './access.js';

/**
 * P2-HUM foundation — coach identity, assignment, weekly review queue (backend first).
 * No decorative dashboard here.
 */

export const WEEKLY_REVIEW_STATUSES = [
  'WEEKLY_REVIEW_DUE',
  'MEMBER_SUBMITTED',
  'AUTO_SUMMARY_READY',
  'QUEUED_FOR_HUMAN',
  'ASSIGNED',
  'IN_REVIEW',
  'FEEDBACK_SENT',
  'ACKNOWLEDGED',
  'FOLLOW_UP',
  'OVERDUE',
  'REASSIGNED',
  'REOPENED',
  'ESCALATED',
] as const;

export type WeeklyReviewStatus = (typeof WEEKLY_REVIEW_STATUSES)[number];

export type CoachAssignment = {
  coachUserId: string;
  memberUserId: string;
  active: boolean;
  assignedAt: string;
};

export type WeeklyReviewItem = {
  id: string;
  memberUserId: string;
  coachUserId: string | null;
  weekOf: string;
  status: WeeklyReviewStatus;
  updatedAt: string;
};

const REVIEW_TRANSITIONS: Partial<Record<WeeklyReviewStatus, readonly WeeklyReviewStatus[]>> = {
  WEEKLY_REVIEW_DUE: ['MEMBER_SUBMITTED', 'AUTO_SUMMARY_READY', 'OVERDUE'],
  MEMBER_SUBMITTED: ['AUTO_SUMMARY_READY', 'QUEUED_FOR_HUMAN'],
  AUTO_SUMMARY_READY: ['QUEUED_FOR_HUMAN'],
  QUEUED_FOR_HUMAN: ['ASSIGNED', 'OVERDUE'],
  ASSIGNED: ['IN_REVIEW', 'REASSIGNED', 'OVERDUE'],
  IN_REVIEW: ['FEEDBACK_SENT', 'REOPENED', 'ESCALATED', 'REASSIGNED'],
  FEEDBACK_SENT: ['ACKNOWLEDGED', 'FOLLOW_UP', 'REOPENED'],
  ACKNOWLEDGED: ['FOLLOW_UP', 'REOPENED'],
  FOLLOW_UP: ['IN_REVIEW', 'ACKNOWLEDGED'],
  OVERDUE: ['ASSIGNED', 'REASSIGNED', 'ESCALATED'],
  REASSIGNED: ['ASSIGNED', 'IN_REVIEW'],
  REOPENED: ['IN_REVIEW', 'QUEUED_FOR_HUMAN'],
  ESCALATED: ['REASSIGNED', 'IN_REVIEW'],
};

export function assertWeeklyReviewStatus(value: string): WeeklyReviewStatus {
  if ((WEEKLY_REVIEW_STATUSES as readonly string[]).includes(value)) return value as WeeklyReviewStatus;
  throw new DomainError('UNKNOWN_REVIEW_STATUS', 'Unknown weekly review status');
}

export function isCoachAssignedToMember(assignment: CoachAssignment | null, coachUserId: string, memberUserId: string): boolean {
  return (
    assignment !== null &&
    assignment.active &&
    assignment.coachUserId === coachUserId &&
    assignment.memberUserId === memberUserId
  );
}

/** MemberState for another user requires active assignment (or self). */
export function assertCanReadMemberStateFor(
  actor: Actor,
  subjectUserId: string,
  assignment: CoachAssignment | null,
): void {
  if (actor.userId === subjectUserId) {
    const self = authorize(actor, 'member_state.read', { kind: 'user', userId: subjectUserId });
    if (!self.allowed) {
      throw new DomainError(self.code ?? 'FORBIDDEN', 'Not allowed to read member state');
    }
    return;
  }
  if (!actor.roles.includes('coach_reviewer') && !actor.roles.includes('admin')) {
    throw new DomainError('FORBIDDEN', 'Not allowed to read another member state');
  }
  if (actor.roles.includes('admin')) {
    return;
  }
  if (!isCoachAssignedToMember(assignment, actor.userId, subjectUserId)) {
    throw new DomainError('ASSIGNMENT_REQUIRED', 'Coach is not assigned to this member');
  }
}

export function transitionWeeklyReview(
  item: WeeklyReviewItem,
  next: WeeklyReviewStatus,
  at: string,
  coachUserId?: string | null,
): WeeklyReviewItem {
  const allowed = REVIEW_TRANSITIONS[item.status] ?? [];
  if (!allowed.includes(next)) {
    throw new DomainError(
      'INVALID_REVIEW_TRANSITION',
      `Cannot transition weekly review from ${item.status} to ${next}`,
    );
  }
  return {
    ...item,
    status: next,
    updatedAt: at,
    coachUserId: coachUserId === undefined ? item.coachUserId : coachUserId,
  };
}

export type CoachFeedbackRecord = {
  id: string;
  reviewId: string;
  coachUserId: string;
  memberUserId: string;
  body: string;
  createdAt: string;
};

export function createCoachFeedback(input: {
  id: string;
  reviewId: string;
  coachUserId: string;
  memberUserId: string;
  body: string;
  createdAt: string;
}): CoachFeedbackRecord {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 8000) {
    throw new DomainError('INVALID_FEEDBACK', 'Feedback body must be 1–8000 characters');
  }
  return { ...input, body };
}

export type CoachAccessAudit = {
  at: string;
  coachUserId: string;
  memberUserId: string;
  action: 'member_state.read' | 'recommendation.approve' | 'recommendation.reject' | 'feedback.send' | 'review.claim';
};
