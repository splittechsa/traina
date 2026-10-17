import { describe, expect, it } from 'vitest';
import { executeCoachTool, type MemberSnapshot, type ToolQuota } from './coach-tools.js';
import {
  ENERGY_POLICY,
  assertEnergyPolicyApprovedForPaidCoaching,
  athleteEnergyPlan,
  proposeWeeklyNutritionStep,
} from './meal-plan.js';

const quota: ToolQuota = { limit: 10, used: 0, windowStartMs: 0, windowMs: 60_000 };
const actor = { userId: 'user-1', roles: ['member'] as const, gymOrganizationIds: [] as const };
const trusted: MemberSnapshot = {
  userId: 'user-1',
  profile: null,
  goals: ['fat_loss'],
  programName: 'PPL',
  todayWorkout: null,
  upcomingWorkoutNames: [],
  recentCompletedSessionIds: [],
  nutrition: null,
  activitySteps: null,
  supplementNames: [],
};

/**
 * P0-SAFE-01 — bypass matrix.
 * Proposals and displays may compute placeholders; paid *apply* must throw until SME review.
 */
describe('P0-SAFE-01 energy policy gate — no silent paid apply', () => {
  it('keeps ENERGY_POLICY unapproved', () => {
    expect(ENERGY_POLICY.approvedForPaidCoaching).toBe(false);
    expect(() => assertEnergyPolicyApprovedForPaidCoaching()).toThrow(/ENERGY_POLICY_UNAPPROVED|not approved/);
  });

  it('marks computed athleteEnergyPlan as not approved for paid coaching', () => {
    const plan = athleteEnergyPlan({ maintenanceKcal: 2_800, phase: 'cutting', pace: 'sprint' });
    expect(plan.deficitOrSurplusKcal).toBe(-1_100);
    expect(plan.policyApprovedForPaidCoaching).toBe(false);
  });

  it('weekly proposals never auto-apply and carry unapproved policy flag', () => {
    const step = proposeWeeklyNutritionStep({
      phase: 'cutting',
      pace: 'steady',
      mealAdherenceBps: 8_000,
      waterAdherenceBps: 8_000,
      samples: [
        { recordedOn: '2026-06-01', weightGrams: 90_000 },
        { recordedOn: '2026-06-08', weightGrams: 89_900 },
      ],
    });
    expect(step.status).toBe('propose');
    expect(step.energyDeltaKcal).not.toBe(0);
    expect(step.mayAutoApply).toBe(false);
    expect(step.policyApprovedForPaidCoaching).toBe(false);
    expect(() => assertEnergyPolicyApprovedForPaidCoaching()).toThrow(Error);
  });

  it('AI coach tools cannot apply nutrition or program adjustments', () => {
    const nutrition = executeCoachTool({
      actor,
      tool: 'proposeNutritionAdjustment',
      modelArguments: { deltaKcal: -500 },
      trusted,
      quota,
      atMs: 1_000,
    });
    expect(nutrition.persisted).toBe(false);
    expect(nutrition.body.status).toBe('not_applied');

    const program = executeCoachTool({
      actor,
      tool: 'proposeProgramAdjustment',
      modelArguments: { note: 'cut harder' },
      trusted,
      quota,
      atMs: 2_000,
    });
    expect(program.persisted).toBe(false);
    expect(program.body.status).toBe('not_applied');
  });
});
