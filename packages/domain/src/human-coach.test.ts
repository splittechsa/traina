import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  assertCanManageCoachAssignments,
  assertCanReadMemberStateFor,
  assertCoachEligibleForAssignment,
  assertMemberEligibleForAssignment,
  assertNotSelfRolePromotion,
  buildAuthorizedCoachPacket,
  createCoachFeedback,
  isCoachAssignedToMember,
  transitionWeeklyReview,
} from './human-coach.js';
import type { MemberState } from './member-state.js';

const emptyState = (overrides: Partial<MemberState> = {}): MemberState => ({
  schemaVersion: 2,
  asOfDay: '2026-06-14',
  timeZone: 'Asia/Riyadh',
  goals: ['strength'],
  currentProgramId: 'prog-1',
  nutritionPhase: 'maintain',
  adherence: {
    windowDays: 7,
    mealDaysLogged: 3,
    waterDaysLogged: 2,
    sessionsCompleted: 2,
    supplementDaysLogged: 0,
    activityDaysLogged: 1,
    confirmedNonAdherence: false,
  },
  weightTrendGramsPerWeek: null,
  dataCompletenessBps: 4000,
  confidence: 'low',
  openCoachingQuestions: ['How should I handle travel week?'],
  safetyFlags: [],
  pendingRecommendations: [],
  lastHumanReviewAt: null,
  policyNotes: ['energy_policy_unapproved'],
  daily: [],
  weekly: {
    weekOf: '2026-06-09',
    mealDaysLogged: 3,
    waterDaysLogged: 2,
    sessionsCompleted: 2,
    weightTrendGrams: null,
  },
  sleepLoggingAvailable: false,
  eventCounts: { accepted: 0, duplicatesDropped: 0, supersededDropped: 0 },
  ...overrides,
});

describe('human coach operations (P2-HUM)', () => {
  it('requires admin or supervisor to manage assignments', () => {
    const member = { userId: 'm1', roles: ['member'] as const, gymOrganizationIds: [] as const };
    const coach = { userId: 'c1', roles: ['coach_reviewer'] as const, gymOrganizationIds: [] as const };
    expect(() => assertCanManageCoachAssignments(member)).toThrow(DomainError);
    expect(() => assertCanManageCoachAssignments(coach)).toThrow(DomainError);
    assertCanManageCoachAssignments({
      userId: 'a1',
      roles: ['admin'],
      gymOrganizationIds: [],
    });
    assertCanManageCoachAssignments({
      userId: 's1',
      roles: ['coach_supervisor'],
      gymOrganizationIds: [],
    });
  });

  it('blocks self-promotion and inactive coaches', () => {
    const coach = { userId: 'c1', roles: ['coach_reviewer'] as const, gymOrganizationIds: [] as const };
    expect(() => assertNotSelfRolePromotion(coach, 'c1')).toThrow(DomainError);
    expect(() => assertCoachEligibleForAssignment(['member'], 'active')).toThrow(DomainError);
    expect(() => assertCoachEligibleForAssignment(['coach_reviewer'], 'inactive')).toThrow(DomainError);
    assertCoachEligibleForAssignment(['coach_reviewer'], 'active');
    assertMemberEligibleForAssignment(['member'], 'active');
  });

  it('denies coach MemberState without assignment or consent (fail-closed)', () => {
    const coach = { userId: 'coach-1', roles: ['coach_reviewer'] as const, gymOrganizationIds: [] as const };
    const assignment = {
      coachUserId: 'coach-1',
      memberUserId: 'member-1',
      active: true,
      assignedAt: '2026-06-01T00:00:00.000Z',
    };
    try {
      assertCanReadMemberStateFor(coach, 'member-1', null);
      throw new Error('expected deny');
    } catch (error) {
      expect((error as DomainError).code).toBe('FORBIDDEN');
      expect((error as DomainError).message).toBe('Access denied');
    }
    // Omitting consent option must deny (fail-closed).
    expect(() => assertCanReadMemberStateFor(coach, 'member-1', assignment)).toThrow(DomainError);
    expect(() =>
      assertCanReadMemberStateFor(coach, 'member-1', assignment, { coachShareConsentGranted: false }),
    ).toThrow(DomainError);
    assertCanReadMemberStateFor(coach, 'member-1', assignment, { coachShareConsentGranted: true });
    expect(
      isCoachAssignedToMember(
        { coachUserId: 'coach-1', memberUserId: 'member-2', active: true, assignedAt: '2026-06-01T00:00:00.000Z' },
        'coach-1',
        'member-1',
      ),
    ).toBe(false);
  });

  it('transitions weekly review queue through the operational path', () => {
    const item = {
      id: 'rev-1',
      memberUserId: 'm1',
      coachUserId: null,
      weekOf: '2026-06-09',
      status: 'QUEUED_FOR_HUMAN' as const,
      updatedAt: '2026-06-14T00:00:00.000Z',
    };
    const assigned = transitionWeeklyReview(item, 'ASSIGNED', '2026-06-14T01:00:00.000Z', 'coach-1');
    expect(assigned.coachUserId).toBe('coach-1');
    const reviewing = transitionWeeklyReview(assigned, 'IN_REVIEW', '2026-06-14T02:00:00.000Z');
    expect(reviewing.status).toBe('IN_REVIEW');
    const sent = transitionWeeklyReview(reviewing, 'FEEDBACK_SENT', '2026-06-14T03:00:00.000Z');
    const done = transitionWeeklyReview(sent, 'COMPLETED', '2026-06-14T04:00:00.000Z');
    expect(done.status).toBe('COMPLETED');
    expect(() => transitionWeeklyReview(reviewing, 'QUEUED_FOR_HUMAN', '2026-06-14T03:00:00.000Z')).toThrow(
      DomainError,
    );
  });

  it('builds packets without inventing missing sleep or weight', () => {
    const packet = buildAuthorizedCoachPacket({
      weekOf: '2026-06-09',
      memberUserId: 'm1',
      state: emptyState(),
      recommendations: [],
      surveySleep: null,
    });
    expect(packet.weightTrendGramsPerWeek).toBeNull();
    expect(packet.surveySleep).toBeNull();
    expect(packet.sleepLoggingAvailable).toBe(false);
    expect(packet.uncertaintyNotes).toContain('daily_sleep_hours_unavailable');
    expect(packet.uncertaintyNotes).toContain('weekly_survey_sleep_unavailable');
    expect(packet.yazanProposals.every((row) => row.humanApproved === false)).toBe(true);
  });

  it('validates feedback body length', () => {
    expect(() =>
      createCoachFeedback({
        id: 'f1',
        reviewId: 'r1',
        coachUserId: 'c1',
        memberUserId: 'm1',
        body: '   ',
        createdAt: '2026-06-14T00:00:00.000Z',
      }),
    ).toThrow(DomainError);
  });
});
