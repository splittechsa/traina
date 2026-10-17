import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { assembleMemberState, assertValidatedObservation, type ValidatedObservation } from './member-state.js';

const obs = (partial: Partial<ValidatedObservation> & Pick<ValidatedObservation, 'kind' | 'observedOn'>): ValidatedObservation =>
  assertValidatedObservation({
    value: null,
    provenance: 'self_reported',
    confidenceBps: 8_000,
    ...partial,
  });

describe('MemberState engine (P1-STATE-01)', () => {
  it('rejects invalid observation days', () => {
    expect(() => assertValidatedObservation(obs({ kind: 'meal_day', observedOn: '06-01-2026' }))).toThrow(DomainError);
  });

  it('does not treat missing meal logs as confirmed non-adherence', () => {
    const state = assembleMemberState({
      goals: ['fat_loss'],
      currentProgramId: 'prog-1',
      nutritionPhase: 'cutting',
      windowDays: 14,
      observations: [
        obs({ kind: 'meal_day', observedOn: '2026-06-01' }),
        obs({ kind: 'water_day', observedOn: '2026-06-01' }),
        obs({ kind: 'weight', observedOn: '2026-06-01', value: 90_000 }),
        obs({ kind: 'weight', observedOn: '2026-06-08', value: 89_500 }),
      ],
    });
    expect(state.adherence.mealDaysLogged).toBe(1);
    expect(state.adherence.confirmedNonAdherence).toBe(false);
    expect(state.confidence).toBe('insufficient');
    expect(state.pendingRecommendations).toEqual([]);
    expect(state.policyNotes).toContain('energy_policy_unapproved_for_paid_coaching');
  });

  it('raises confidence when logging is denser', () => {
    const days = Array.from({ length: 12 }, (_, i) => `2026-06-${String(i + 1).padStart(2, '0')}`);
    const observations = days.flatMap((on) => [
      obs({ kind: 'meal_day', observedOn: on }),
      obs({ kind: 'water_day', observedOn: on }),
    ]);
    observations.push(obs({ kind: 'weight', observedOn: '2026-06-01', value: 90_000 }));
    observations.push(obs({ kind: 'weight', observedOn: '2026-06-12', value: 89_200 }));
    const state = assembleMemberState({
      goals: ['fat_loss'],
      currentProgramId: null,
      nutritionPhase: 'cutting',
      windowDays: 14,
      observations,
    });
    expect(state.dataCompletenessBps).toBeGreaterThanOrEqual(7_500);
    expect(state.confidence).toBe('high');
    expect(state.weightTrendGramsPerWeek).not.toBeNull();
  });
});
