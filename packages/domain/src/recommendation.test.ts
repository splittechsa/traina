import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  aiMustNotApplyRecommendation,
  createRecommendationDraft,
  transitionRecommendation,
  validateRecommendation,
} from './recommendation.js';

const baseDraft = (category: 'nutrition' | 'daily_guidance' = 'nutrition') =>
  createRecommendationDraft({
    id: 'rec-1',
    memberId: 'user-1',
    category,
    summary: category === 'nutrition' ? 'Propose -150 kcal weekly step' : 'Drink water before noon',
    rationale: 'Deterministic test rationale',
    confidence: 'medium',
    createdAt: '2026-06-01T12:00:00.000Z',
    expiresAt: '2026-06-08T12:00:00.000Z',
    requiresHumanReview: category === 'nutrition',
    requiresMemberConfirmation: category === 'nutrition',
    payload: category === 'nutrition' ? { energyDeltaKcal: -150 } : {},
  });

describe('recommendation lifecycle (P1-REC-01)', () => {
  it('creates DRAFT and routes nutrition to REVIEW_REQUIRED while energy policy is unapproved', () => {
    const draft = baseDraft('nutrition');
    expect(draft.status).toBe('DRAFT');
    expect(draft.schemaVersion).toBe(2);
    const validated = validateRecommendation(draft, '2026-06-01T12:01:00.000Z');
    expect(validated.status).toBe('REVIEW_REQUIRED');
  });

  it('refuses applying nutrition recommendations while ENERGY_POLICY is unapproved', () => {
    const review = validateRecommendation(baseDraft('nutrition'), '2026-06-01T12:01:00.000Z');
    const approved = transitionRecommendation(review, 'APPROVED', '2026-06-01T12:02:00.000Z', {
      actorId: 'coach-1',
      note: 'human_approved',
    });
    expect(() => transitionRecommendation(approved, 'APPLIED', '2026-06-01T12:03:00.000Z')).toThrow(DomainError);
  });

  it('allows daily guidance to reach APPROVED/APPLIED without nutrition policy', () => {
    const draft = baseDraft('daily_guidance');
    const validated = validateRecommendation(draft, '2026-06-01T12:01:00.000Z');
    expect(validated.status).toBe('VALIDATED');
    const approved = transitionRecommendation(validated, 'APPROVED', '2026-06-01T12:02:00.000Z');
    const applied = transitionRecommendation(approved, 'APPLIED', '2026-06-01T12:03:00.000Z');
    expect(applied.status).toBe('APPLIED');
  });

  it('blocks AI from applying recommendations', () => {
    const draft = baseDraft('daily_guidance');
    expect(() => aiMustNotApplyRecommendation(draft)).toThrow(DomainError);
    try {
      aiMustNotApplyRecommendation(draft);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('AI_CANNOT_APPLY');
    }
  });
});
