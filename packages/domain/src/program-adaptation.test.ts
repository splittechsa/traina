import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  buildProgramAdaptationPlan,
  overlayFromRecommendation,
  parseProgramVersionDocument,
} from './program-adaptation.js';
import { planTemplateDay } from './programs.js';
import {
  createRecommendationDraft,
  memberConfirmRecommendation,
  validateRecommendation,
} from './recommendation.js';

function approvedRecovery() {
  const draft = createRecommendationDraft({
    id: 'rec-adapt-1',
    memberId: 'user-1',
    category: 'training',
    summary: 'Easier session',
    rationale: 'Recovery first',
    confidence: 'low',
    createdAt: '2026-06-01T12:00:00.000Z',
    expiresAt: '2026-06-08T12:00:00.000Z',
    payload: { kind: 'recovery_preference', expectedProgramVersion: 1 },
    requiresHumanReview: false,
    requiresMemberConfirmation: true,
  });
  const validated = validateRecommendation(draft, '2026-06-01T12:01:00.000Z');
  return memberConfirmRecommendation(validated, '2026-06-01T12:02:00.000Z', 'user-1');
}

describe('program adaptation (real apply)', () => {
  it('builds a version bump with visible before/after volume change', () => {
    const rec = approvedRecovery();
    const current = parseProgramVersionDocument({
      templateId: 'gym_full_body',
      days: [],
    });
    const plan = buildProgramAdaptationPlan({
      recommendation: rec,
      currentDocument: current,
      currentVersion: 1,
      at: '2026-06-01T12:03:00.000Z',
    });
    expect(plan.diff.after.programVersion).toBe(2);
    expect(plan.diff.after.volumeScaleBps).toBe(7_000);
    expect(plan.diff.before.sampleDayExercises[0]?.sets).toBe(3);
    expect(plan.diff.after.sampleDayExercises[0]?.sets).toBe(2);
    expect(plan.nextDocument.sourceRecommendationId).toBe(rec.id);
  });

  it('rejects stale expectedProgramVersion', () => {
    const rec = approvedRecovery();
    expect(() =>
      buildProgramAdaptationPlan({
        recommendation: rec,
        currentDocument: parseProgramVersionDocument({ templateId: 'gym_full_body', days: [] }),
        currentVersion: 2,
        at: '2026-06-01T12:03:00.000Z',
      }),
    ).toThrow(DomainError);
  });

  it('rejects apply without expectedProgramVersion (non-preview)', () => {
    const stamped = approvedRecovery();
    const rec = {
      ...stamped,
      payload: { ...stamped.payload, expectedProgramVersion: undefined },
    };
    expect(() =>
      buildProgramAdaptationPlan({
        recommendation: rec,
        currentDocument: parseProgramVersionDocument({ templateId: 'gym_full_body', days: [] }),
        currentVersion: 1,
        at: '2026-06-01T12:03:00.000Z',
      }),
    ).toThrow(DomainError);
  });

  it('planTemplateDay reflects adaptation overlay on strength sessions', () => {
    const overlay = overlayFromRecommendation(approvedRecovery(), '2026-06-01T12:03:00.000Z');
    const plain = planTemplateDay('gym_full_body', 0, null);
    const adapted = planTemplateDay('gym_full_body', 0, overlay);
    const plainSets = plain.exercises[0]?.prescription.kind === 'strength' ? plain.exercises[0].prescription.sets : 0;
    const adaptedSets =
      adapted.exercises[0]?.prescription.kind === 'strength' ? adapted.exercises[0].prescription.sets : 0;
    expect(adaptedSets).toBeLessThan(plainSets);
  });
});
