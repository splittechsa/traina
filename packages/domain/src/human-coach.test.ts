import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  assertCanReadMemberStateFor,
  createCoachFeedback,
  isCoachAssignedToMember,
  transitionWeeklyReview,
} from './human-coach.js';

describe('human coach foundation (P2-HUM)', () => {
  it('requires active assignment for coach MemberState reads', () => {
    const coach = { userId: 'coach-1', roles: ['coach_reviewer'] as const, gymOrganizationIds: [] as const };
    expect(() => assertCanReadMemberStateFor(coach, 'member-1', null)).toThrow(DomainError);
    try {
      assertCanReadMemberStateFor(coach, 'member-1', null);
    } catch (error) {
      expect((error as DomainError).code).toBe('ASSIGNMENT_REQUIRED');
    }
    assertCanReadMemberStateFor(coach, 'member-1', {
      coachUserId: 'coach-1',
      memberUserId: 'member-1',
      active: true,
      assignedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(
      isCoachAssignedToMember(
        { coachUserId: 'coach-1', memberUserId: 'member-2', active: true, assignedAt: '2026-06-01T00:00:00.000Z' },
        'coach-1',
        'member-1',
      ),
    ).toBe(false);
  });

  it('transitions weekly review queue with ownership', () => {
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
    expect(() => transitionWeeklyReview(reviewing, 'QUEUED_FOR_HUMAN', '2026-06-14T03:00:00.000Z')).toThrow(DomainError);
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
