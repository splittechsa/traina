import { DomainError } from './errors.js';
import type { Actor, Role } from './access.js';
import { authorize } from './access.js';
import type { MemberState } from './member-state.js';
import type { CoachingRecommendation } from './recommendation.js';

/**
 * P2-HUM — human coaching operations (authorization + weekly review).
 * Assignments are admin/supervisor-only. Coaches cannot self-promote.
 */

export const COACH_SHARE_POLICY_VERSION = 'coach_share_v1';

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
  'COMPLETED',
  'FAILED',
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
  WEEKLY_REVIEW_DUE: ['MEMBER_SUBMITTED', 'AUTO_SUMMARY_READY', 'OVERDUE', 'FAILED'],
  MEMBER_SUBMITTED: ['AUTO_SUMMARY_READY', 'QUEUED_FOR_HUMAN', 'FAILED'],
  AUTO_SUMMARY_READY: ['QUEUED_FOR_HUMAN', 'FAILED'],
  QUEUED_FOR_HUMAN: ['ASSIGNED', 'OVERDUE', 'FAILED'],
  ASSIGNED: ['IN_REVIEW', 'REASSIGNED', 'OVERDUE', 'FAILED'],
  IN_REVIEW: ['FEEDBACK_SENT', 'REOPENED', 'ESCALATED', 'REASSIGNED', 'FAILED'],
  FEEDBACK_SENT: ['ACKNOWLEDGED', 'FOLLOW_UP', 'REOPENED', 'COMPLETED'],
  ACKNOWLEDGED: ['FOLLOW_UP', 'REOPENED', 'COMPLETED'],
  FOLLOW_UP: ['IN_REVIEW', 'ACKNOWLEDGED', 'COMPLETED'],
  OVERDUE: ['ASSIGNED', 'REASSIGNED', 'ESCALATED', 'FAILED'],
  REASSIGNED: ['ASSIGNED', 'IN_REVIEW'],
  REOPENED: ['IN_REVIEW', 'QUEUED_FOR_HUMAN'],
  ESCALATED: ['REASSIGNED', 'IN_REVIEW'],
  COMPLETED: ['REOPENED'],
  FAILED: ['QUEUED_FOR_HUMAN', 'REOPENED'],
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

export function canManageCoachAssignments(actor: Actor): boolean {
  return actor.roles.includes('admin') || actor.roles.includes('coach_supervisor');
}

/** Only admin/supervisor may create or revoke assignments. Never self-serve. */
export function assertCanManageCoachAssignments(actor: Actor): void {
  if (!canManageCoachAssignments(actor)) {
    throw new DomainError('FORBIDDEN', 'Only an admin or coach supervisor may manage coach assignments');
  }
}

export function assertCoachEligibleForAssignment(coachRoles: readonly Role[], coachStatus: 'active' | 'inactive'): void {
  if (coachStatus !== 'active') {
    throw new DomainError('COACH_INACTIVE', 'Coach account is not active');
  }
  if (!coachRoles.includes('coach_reviewer') && !coachRoles.includes('admin')) {
    throw new DomainError('COACH_ROLE_REQUIRED', 'Target user must already hold coach_reviewer role');
  }
}

export function assertMemberEligibleForAssignment(memberRoles: readonly Role[], memberStatus: 'active' | 'inactive'): void {
  if (memberStatus !== 'active') {
    throw new DomainError('MEMBER_INACTIVE', 'Member account is not active');
  }
  if (!memberRoles.includes('member') && !memberRoles.includes('admin')) {
    throw new DomainError('MEMBER_ROLE_REQUIRED', 'Target user must be a member account');
  }
}

/** Refuse using assignment API to grant roles — role_assignments is separate and admin-only. */
export function assertNotSelfRolePromotion(actor: Actor, coachUserId: string): void {
  if (actor.userId === coachUserId && !canManageCoachAssignments(actor)) {
    throw new DomainError('FORBIDDEN', 'Cannot assign yourself as coach');
  }
}

/**
 * MemberState / coaching packet for another user requires:
 * active assignment + coach-share consent (or self / admin).
 * Never returns whether the subject exists when denied.
 */
export function assertCanReadMemberStateFor(
  actor: Actor,
  subjectUserId: string,
  assignment: CoachAssignment | null,
  options: { coachShareConsentGranted?: boolean } = {},
): void {
  if (actor.userId === subjectUserId) {
    const self = authorize(actor, 'member_state.read', { kind: 'user', userId: subjectUserId });
    if (!self.allowed) {
      throw new DomainError(self.code ?? 'FORBIDDEN', 'Not allowed to read member state');
    }
    return;
  }
  // Admin health-data access is intentional for support break-glass; still requires audit at call site.
  if (actor.roles.includes('admin')) {
    return;
  }
  if (!actor.roles.includes('coach_reviewer') && !actor.roles.includes('coach_supervisor')) {
    throw new DomainError('FORBIDDEN', 'Access denied');
  }
  if (!isCoachAssignedToMember(assignment, actor.userId, subjectUserId)) {
    throw new DomainError('FORBIDDEN', 'Access denied');
  }
  // Fail-closed: consent must be explicitly granted (undefined/false both deny).
  if (options.coachShareConsentGranted !== true) {
    throw new DomainError('FORBIDDEN', 'Access denied');
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
  /** Always human — never AI-impersonated. */
  authorKind: 'human_coach';
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
  return { ...input, body, authorKind: 'human_coach' };
}

export type CoachAccessAudit = {
  at: string;
  coachUserId: string;
  memberUserId: string;
  action:
    | 'member_state.read'
    | 'recommendation.approve'
    | 'recommendation.reject'
    | 'feedback.send'
    | 'review.claim'
    | 'assignment.write'
    | 'packet.read';
};

/** Authorized weekly packet — facts and uncertainty only; never invents missing values. */
export type AuthorizedCoachPacket = {
  schemaVersion: 1;
  weekOf: string;
  memberUserId: string;
  goals: readonly string[];
  approvedPlan: {
    programId: string | null;
    nutritionPhase: string | null;
  };
  adherence: MemberState['adherence'];
  weightTrendGramsPerWeek: number | null;
  weekly: MemberState['weekly'];
  dataCompletenessBps: number;
  confidence: MemberState['confidence'];
  sleepLoggingAvailable: false;
  surveySleep: number | null;
  memberQuestions: readonly string[];
  safetyFlags: readonly string[];
  policyNotes: readonly string[];
  yazanProposals: readonly {
    id: string;
    category: string;
    status: string;
    summary: string;
    rationale: string;
    humanApproved: false;
  }[];
  uncertaintyNotes: readonly string[];
};

export function buildAuthorizedCoachPacket(input: {
  weekOf: string;
  memberUserId: string;
  state: MemberState;
  recommendations: readonly CoachingRecommendation[];
  surveySleep: number | null;
  memberQuestions?: readonly string[];
}): AuthorizedCoachPacket {
  const uncertainty: string[] = [...input.state.policyNotes];
  if (input.state.adherence.confirmedNonAdherence === false) {
    uncertainty.push('missing_logs_are_unknown_not_non_adherence');
  }
  if (!input.state.sleepLoggingAvailable) {
    uncertainty.push('daily_sleep_hours_unavailable');
  }
  if (input.surveySleep === null) {
    uncertainty.push('weekly_survey_sleep_unavailable');
  }
  return {
    schemaVersion: 1,
    weekOf: input.weekOf,
    memberUserId: input.memberUserId,
    goals: input.state.goals,
    approvedPlan: {
      programId: input.state.currentProgramId,
      nutritionPhase: input.state.nutritionPhase,
    },
    adherence: input.state.adherence,
    weightTrendGramsPerWeek: input.state.weightTrendGramsPerWeek,
    weekly: input.state.weekly,
    dataCompletenessBps: input.state.dataCompletenessBps,
    confidence: input.state.confidence,
    sleepLoggingAvailable: false,
    surveySleep: input.surveySleep,
    memberQuestions: input.memberQuestions ?? input.state.openCoachingQuestions,
    safetyFlags: input.state.safetyFlags,
    policyNotes: input.state.policyNotes,
    yazanProposals: input.recommendations.map((rec) => ({
      id: rec.id,
      category: rec.category,
      status: rec.status,
      summary: rec.summary,
      rationale: rec.rationale,
      humanApproved: false as const,
    })),
    uncertaintyNotes: uncertainty,
  };
}
