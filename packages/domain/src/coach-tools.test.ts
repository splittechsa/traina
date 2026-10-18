import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { executeCoachTool, type MemberSnapshot, type ToolQuota } from './coach-tools.js';
import { startWorkout, scheduleWorkout } from './training.js';

const quota: ToolQuota = { limit: 2, used: 0, windowStartMs: 0, windowMs: 60_000 };

const snapshot = (overrides: Partial<MemberSnapshot> = {}): MemberSnapshot => ({
  userId: 'user-1',
  profile: null,
  goals: ['strength'],
  programName: null,
  activeProgram: null,
  todayWorkout: null,
  upcomingWorkoutNames: [],
  recentCompletedSessionIds: [],
  nutrition: null,
  activitySteps: null,
  supplementNames: [],
  memberState: null,
  humanFeedback: [],
  recommendations: [],
  ...overrides,
});

const actor = { userId: 'user-1', roles: ['member'] as const, gymOrganizationIds: [] as const };

describe('coach tool authorization', () => {
  it('returns trusted profile data and ignores a model-selected user', () => {
    expect(() =>
      executeCoachTool({
        actor,
        tool: 'getUserProfile',
        modelArguments: { userId: 'user-2', sql: 'select * from users' },
        trusted: snapshot(),
        quota,
        atMs: 1_000,
      }),
    ).toThrow(DomainError);
  });

  it('does not expose another member snapshot to the signed-in user', () => {
    expect(() =>
      executeCoachTool({
        actor,
        tool: 'getActiveGoals',
        modelArguments: {},
        trusted: snapshot({ userId: 'user-2', goals: ['secret'] }),
        quota,
        atMs: 1_000,
      }),
    ).toThrow(DomainError);
  });

  it('refuses unknown tools, including medical diagnosis', () => {
    expect(() =>
      executeCoachTool({
        actor,
        tool: 'diagnoseInjury',
        modelArguments: {},
        trusted: snapshot(),
        quota,
        atMs: 1_000,
      }),
    ).toThrow(DomainError);
  });

  it('does not persist proposed adjustments or memory', () => {
    const result = executeCoachTool({
      actor,
      tool: 'proposeNutritionAdjustment',
      modelArguments: { calories: 900 },
      trusted: snapshot(),
      quota,
      atMs: 1_000,
    });
    expect(result.persisted).toBe(false);
    expect(result.body.status).toBe('not_applied');
  });

  it('returns authorized MemberState projection via getMemberState', () => {
    const result = executeCoachTool({
      actor,
      tool: 'getMemberState',
      modelArguments: {},
      trusted: snapshot({
        memberState: {
          schemaVersion: 2,
          asOfDay: '2026-06-14',
          timeZone: 'Asia/Riyadh',
          goals: ['strength'],
          currentProgramId: null,
          nutritionPhase: null,
          adherence: {
            windowDays: 14,
            mealDaysLogged: 2,
            waterDaysLogged: 2,
            sessionsCompleted: 1,
            supplementDaysLogged: 0,
            activityDaysLogged: 0,
            confirmedNonAdherence: false,
          },
          weightTrendGramsPerWeek: null,
          dataCompletenessBps: 1_000,
          confidence: 'insufficient',
          openCoachingQuestions: [],
          safetyFlags: [],
          pendingRecommendations: [],
          lastHumanReviewAt: null,
          policyNotes: ['nutrition_adaptations_propose_only'],
          daily: [],
          weekly: { weekOf: '2026-06-09', mealDaysLogged: 2, waterDaysLogged: 2, sessionsCompleted: 1, weightTrendGrams: null },
          sleepLoggingAvailable: false,
          eventCounts: { accepted: 4, duplicatesDropped: 0, supersededDropped: 0 },
        },
      }),
      quota,
      atMs: 1_000,
    });
    expect(result.persisted).toBe(false);
    expect(result.body.note).toBe('authorized_projection_only');
    expect((result.body.state as { confidence: string }).confidence).toBe('insufficient');
  });

  it('returns only persisted human feedback and never invents comments', () => {
    const empty = executeCoachTool({
      actor,
      tool: 'getHumanCoachFeedback',
      modelArguments: {},
      trusted: snapshot(),
      quota,
      atMs: 1_000,
    });
    expect(empty.body.inventsComments).toBe(false);
    expect(empty.body.feedback).toEqual([]);
    const withFeedback = executeCoachTool({
      actor,
      tool: 'getHumanCoachFeedback',
      modelArguments: {},
      trusted: snapshot({
        humanFeedback: [
          {
            id: 'f1',
            body: 'Keep protein steady.',
            createdAt: '2026-06-14T00:00:00.000Z',
            authorKind: 'human_coach',
          },
        ],
      }),
      quota: { ...quota, used: 1 },
      atMs: 1_000,
    });
    expect(withFeedback.body.authorKind).toBe('human_coach');
    expect((withFeedback.body.feedback as { body: string }[])[0]?.body).toBe('Keep protein steady.');
  });

  it('requests missing data without inventing values', () => {
    const result = executeCoachTool({
      actor,
      tool: 'requestMissingData',
      modelArguments: {},
      trusted: snapshot(),
      quota,
      atMs: 1_000,
    });
    expect(result.body.inventsData).toBe(false);
    expect(result.body.missing).toEqual(['member_state']);
  });

  it('draftRecommendationProposal never auto-applies nutrition', () => {
    const result = executeCoachTool({
      actor,
      tool: 'draftRecommendationProposal',
      modelArguments: { category: 'nutrition', summary: 'cut 200' },
      trusted: snapshot(),
      quota,
      atMs: 1_000,
    });
    expect(result.body.mayAutoApply).toBe(false);
    expect(result.body.blockedByEnergyPolicy).toBe(true);
  });

  it('marks pending recommendations as guidance-only, not applied', () => {
    const result = executeCoachTool({
      actor,
      tool: 'getRecommendationStatus',
      modelArguments: {},
      trusted: snapshot({
        recommendations: [
          {
            id: 'r1',
            category: 'nutrition',
            status: 'REVIEW_REQUIRED',
            summary: 'Propose protein floor',
            requiresHumanReview: true,
          },
        ],
      }),
      quota,
      atMs: 1_000,
    });
    expect(result.body.pendingIsNotApplied).toBe(true);
    expect(result.body.nutritionApplyBlockedUntilEnergyPolicy).toBe(true);
    const rows = result.body.recommendations as { status: string; applied: boolean; treatAsGuidanceOnly: boolean }[];
    expect(rows[0]?.applied).toBe(false);
    expect(rows[0]?.treatAsGuidanceOnly).toBe(true);
  });

  it('enforces the tool quota', () => {
    const first = executeCoachTool({
      actor,
      tool: 'getActiveGoals',
      modelArguments: {},
      trusted: snapshot(),
      quota,
      atMs: 1_000,
    });
    const second = executeCoachTool({
      actor,
      tool: 'getActiveGoals',
      modelArguments: {},
      trusted: snapshot(),
      quota: first.quota,
      atMs: 1_100,
    });
    expect(() =>
      executeCoachTool({
        actor,
        tool: 'getActiveGoals',
        modelArguments: {},
        trusted: snapshot(),
        quota: second.quota,
        atMs: 1_200,
      }),
    ).toThrow(DomainError);
  });

  it('can reduce a server-loaded in-progress session without marking it saved', () => {
    const workout = startWorkout(
      scheduleWorkout({
        id: 'session-1',
        userId: 'user-1',
        name: 'Lower',
        discipline: 'powerlifting',
        exercises: [
          {
            exerciseId: 'squat',
            prescription: { kind: 'strength', sets: 3, reps: 5, restSeconds: 120, loadGrams: null, rpeTenths: null },
          },
        ],
        scheduledFor: '2026-06-01T15:00:00.000Z',
      }),
      '2026-06-01T15:05:00.000Z',
    );
    const result = executeCoachTool({
      actor,
      tool: 'logWorkoutSet',
      modelArguments: {
        set: {
          id: 'set-1',
          exerciseId: 'squat',
          setIndex: 1,
          reps: 5,
          loadGrams: 80_000,
          rpeTenths: null,
          completedAt: '2026-06-01T15:10:00.000Z',
        },
      },
      trusted: snapshot({ todayWorkout: workout }),
      quota,
      atMs: 1_000,
    });
    expect(result.persisted).toBe(false);
    expect(result.body.status).toBe('accepted_for_domain_reducer');
  });
});
