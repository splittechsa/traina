import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { assembleMemberState, type ValidatedObservation } from './member-state.js';
import {
  aiMustNotApplyRecommendation,
  generateRecommendationsFromMemberState,
  transitionRecommendation,
  validateRecommendation,
} from './recommendation.js';

function obs(partial: Partial<ValidatedObservation> & Pick<ValidatedObservation, 'kind' | 'observedOn'>): ValidatedObservation {
  return {
    value: null,
    provenance: 'self_reported',
    confidenceBps: 8_000,
    ...partial,
  };
}

let seq = 0;
const ids = () => `rec-${++seq}`;

function stateFrom(observations: ValidatedObservation[], extras: Partial<Parameters<typeof assembleMemberState>[0]> = {}) {
  return assembleMemberState({
    goals: ['fat_loss'],
    currentProgramId: 'prog-1',
    nutritionPhase: 'cutting',
    windowDays: 14,
    asOfDay: '2026-06-14',
    timeZone: 'UTC',
    observations,
    ...extras,
  });
}

describe('deterministic recommendation matrix (P1-REC-01)', () => {
  it('missed workout log ≠ confirmed skip; asks clarifying guidance', () => {
    const state = stateFrom([obs({ kind: 'meal_day', observedOn: '2026-06-10' })]);
    const recs = generateRecommendationsFromMemberState({
      memberId: 'u1',
      state,
      nowIso: '2026-06-14T12:00:00.000Z',
      idFactory: ids,
    });
    const trainingGap = recs.find((r) => r.payload.kind === 'clarify_training_gap');
    expect(trainingGap).toBeDefined();
    expect(trainingGap?.payload.assumeSkipped).toBe(false);
    expect(state.adherence.confirmedNonAdherence).toBe(false);
  });

  it('fatigue / poor recovery suggests easier training without punishment cardio', () => {
    const state = stateFrom([obs({ kind: 'meal_day', observedOn: '2026-06-01' })]);
    const recs = generateRecommendationsFromMemberState({
      memberId: 'u1',
      state,
      nowIso: '2026-06-14T12:00:00.000Z',
      idFactory: ids,
    });
    const recovery = recs.find((r) => r.payload.kind === 'recovery_preference');
    expect(recovery).toBeDefined();
    expect(recovery?.payload.addCardioPunishment).toBe(false);
  });

  it('several weeks of rising weight on cut proposes nutrition review only', () => {
    const observations: ValidatedObservation[] = [];
    for (let i = 1; i <= 14; i += 1) {
      const day = `2026-06-${String(i).padStart(2, '0')}`;
      observations.push(obs({ kind: 'meal_day', observedOn: day }));
      observations.push(obs({ kind: 'water_day', observedOn: day }));
      observations.push(obs({ kind: 'session_completed', observedOn: day }));
    }
    observations.push(obs({ kind: 'weight', observedOn: '2026-06-01', value: 80_000 }));
    observations.push(obs({ kind: 'weight', observedOn: '2026-06-14', value: 82_000 }));
    const state = stateFrom(observations);
    const recs = generateRecommendationsFromMemberState({
      memberId: 'u1',
      state,
      nowIso: '2026-06-14T12:00:00.000Z',
      idFactory: ids,
    });
    const nutrition = recs.find((r) => r.category === 'nutrition');
    expect(nutrition).toBeDefined();
    const gated = validateRecommendation(nutrition!, '2026-06-14T12:01:00.000Z');
    expect(gated.status).toBe('REVIEW_REQUIRED');
    const approved = transitionRecommendation(gated, 'APPROVED', '2026-06-14T12:02:00.000Z', { actorId: 'coach' });
    expect(() => transitionRecommendation(approved, 'APPLIED', '2026-06-14T12:03:00.000Z')).toThrow(DomainError);
  });

  it('incomplete food data encourages logging without punitive calorie cut', () => {
    const state = stateFrom([]);
    const recs = generateRecommendationsFromMemberState({
      memberId: 'u1',
      state,
      nowIso: '2026-06-14T12:00:00.000Z',
      idFactory: ids,
    });
    const meal = recs.find((r) => r.payload.kind === 'encourage_meal_logging');
    expect(meal?.payload.punitiveCardio).toBe(false);
    expect(meal?.payload.calorieCut).toBe(false);
  });

  it('single-day weight fluctuation does not recommend material nutrition change', () => {
    const state = stateFrom([
      obs({ kind: 'weight', observedOn: '2026-06-14', value: 81_000 }),
      obs({ kind: 'meal_day', observedOn: '2026-06-14' }),
      obs({ kind: 'water_day', observedOn: '2026-06-14' }),
    ]);
    const recs = generateRecommendationsFromMemberState({
      memberId: 'u1',
      state,
      nowIso: '2026-06-14T12:00:00.000Z',
      idFactory: ids,
    });
    expect(recs.some((r) => r.payload.kind === 'hold_nutrition')).toBe(true);
    expect(recs.filter((r) => r.category === 'nutrition' && r.payload.kind === 'propose_energy_delta')).toHaveLength(0);
  });

  it('unexpected meal absence does not invent punitive compensation', () => {
    const state = stateFrom([obs({ kind: 'water_day', observedOn: '2026-06-14' })]);
    const recs = generateRecommendationsFromMemberState({
      memberId: 'u1',
      state,
      nowIso: '2026-06-14T12:00:00.000Z',
      idFactory: ids,
    });
    for (const rec of recs) {
      expect(rec.payload.punitiveCardio ?? false).toBe(false);
      expect(rec.payload.calorieCut ?? false).toBe(false);
    }
  });

  it('same inputs + policy version reproduce the same candidate kinds', () => {
    const observations = [
      obs({ kind: 'meal_day', observedOn: '2026-06-10' }),
      obs({ kind: 'weight', observedOn: '2026-06-14', value: 80_000 }),
    ];
    const a = generateRecommendationsFromMemberState({
      memberId: 'u1',
      state: stateFrom(observations),
      nowIso: '2026-06-14T12:00:00.000Z',
      idFactory: () => 'fixed-a',
    });
    const b = generateRecommendationsFromMemberState({
      memberId: 'u1',
      state: stateFrom(observations),
      nowIso: '2026-06-14T12:00:00.000Z',
      idFactory: () => 'fixed-b',
    });
    expect(a.map((r) => r.payload.kind)).toEqual(b.map((r) => r.payload.kind));
    expect(a.map((r) => r.policyVersion)).toEqual(b.map((r) => r.policyVersion));
  });

  it('unsafe unpaid energy policy yields human_required block; AI cannot apply', () => {
    const state = stateFrom([obs({ kind: 'meal_day', observedOn: '2026-06-10' })]);
    const recs = generateRecommendationsFromMemberState({
      memberId: 'u1',
      state,
      nowIso: '2026-06-14T12:00:00.000Z',
      idFactory: ids,
    });
    const block = recs.find((r) => r.payload.kind === 'block_paid_nutrition_adaptations');
    expect(block?.category).toBe('human_required');
    expect(() => aiMustNotApplyRecommendation(block!)).toThrow(DomainError);
    try {
      aiMustNotApplyRecommendation(block!);
    } catch (error) {
      expect((error as DomainError).code).toBe('AI_CANNOT_APPLY');
    }
  });
});
