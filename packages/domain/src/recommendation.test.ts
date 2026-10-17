import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  createRecommendationDraft,
  transitionRecommendation,
  validateRecommendation,
} from './recommendation.js';

describe('recommendation lifecycle (P1-REC-01)', () => {
  it('creates DRAFT and routes nutrition to REVIEW_REQUIRED while energy policy is unapproved', () => {
    const draft = createRecommendationDraft({
      id: 'rec-1',
      memberId: 'user-1',
      category: 'nutrition',
      summary: 'Propose -150 kcal weekly step',
      createdAt: '2026-06-01T12:00:00.000Z',
      payload: { energyDeltaKcal: -150 },
    });
    expect(draft.status).toBe('DRAFT');
    const validated = validateRecommendation(draft, '2026-06-01T12:01:00.000Z');
    expect(validated.status).toBe('REVIEW_REQUIRED');
  });

  it('refuses applying nutrition recommendations while ENERGY_POLICY is unapproved', () => {
    const draft = createRecommendationDraft({
      id: 'rec-2',
      memberId: 'user-1',
      category: 'nutrition',
      summary: 'Cut harder',
      createdAt: '2026-06-01T12:00:00.000Z',
      requiresHumanReview: true,
    });
    const review = validateRecommendation(draft, '2026-06-01T12:01:00.000Z');
    const approved = transitionRecommendation(review, 'APPROVED', '2026-06-01T12:02:00.000Z');
    expect(() => transitionRecommendation(approved, 'APPLIED', '2026-06-01T12:03:00.000Z')).toThrow(DomainError);
  });

  it('allows daily guidance to reach APPROVED without nutrition policy', () => {
    const draft = createRecommendationDraft({
      id: 'rec-3',
      memberId: 'user-1',
      category: 'daily_guidance',
      summary: 'Drink water before noon',
      createdAt: '2026-06-01T12:00:00.000Z',
      requiresHumanReview: false,
      requiresMemberConfirmation: false,
    });
    const validated = validateRecommendation(draft, '2026-06-01T12:01:00.000Z');
    expect(validated.status).toBe('VALIDATED');
    const approved = transitionRecommendation(validated, 'APPROVED', '2026-06-01T12:02:00.000Z');
    const applied = transitionRecommendation(approved, 'APPLIED', '2026-06-01T12:03:00.000Z');
    expect(applied.status).toBe('APPLIED');
  });
});
