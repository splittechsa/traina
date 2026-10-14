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
  todayWorkout: null,
  upcomingWorkoutNames: [],
  recentCompletedSessionIds: [],
  nutrition: null,
  activitySteps: null,
  supplementNames: [],
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
