import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  aiMustNotApplyRecommendation,
  applyPermittedRecommendation,
  createRecommendationDraft,
  expireRecommendation,
  memberConfirmRecommendation,
  prioritizeRecommendations,
  suppressDuplicateRecommendations,
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

  it('expires open recommendations past expiresAt', () => {
    const draft = baseDraft('daily_guidance');
    const expired = expireRecommendation(draft, '2026-06-09T12:00:00.000Z');
    expect(expired.status).toBe('EXPIRED');
  });

  it('suppresses duplicate open payload kinds and prioritizes human_required first', () => {
    const a = createRecommendationDraft({
      id: 'a',
      memberId: 'u1',
      category: 'daily_guidance',
      summary: 'Log meals',
      rationale: 'Missing meal days',
      confidence: 'medium',
      createdAt: '2026-06-01T12:00:00.000Z',
      expiresAt: '2026-06-08T12:00:00.000Z',
      payload: { kind: 'encourage_meal_logging' },
      requiresMemberConfirmation: false,
    });
    const dup = createRecommendationDraft({
      id: 'b',
      memberId: 'u1',
      category: 'daily_guidance',
      summary: 'Log meals again',
      rationale: 'Still missing',
      confidence: 'medium',
      createdAt: '2026-06-01T12:00:00.000Z',
      expiresAt: '2026-06-08T12:00:00.000Z',
      payload: { kind: 'encourage_meal_logging' },
      requiresMemberConfirmation: false,
    });
    const human = createRecommendationDraft({
      id: 'c',
      memberId: 'u1',
      category: 'human_required',
      summary: 'Policy block',
      rationale: 'ENERGY_POLICY',
      confidence: 'high',
      createdAt: '2026-06-01T12:00:00.000Z',
      expiresAt: '2026-06-08T12:00:00.000Z',
      payload: { kind: 'block_paid_nutrition_adaptations' },
    });
    expect(suppressDuplicateRecommendations([a], [dup, human])).toHaveLength(1);
    expect(prioritizeRecommendations([a, human])[0]?.category).toBe('human_required');
  });

  it('member-confirms training recovery but refuses status-only apply without program service', () => {
    const draft = createRecommendationDraft({
      id: 't1',
      memberId: 'user-1',
      category: 'training',
      summary: 'Easier session',
      rationale: 'Recovery first',
      confidence: 'low',
      createdAt: '2026-06-01T12:00:00.000Z',
      expiresAt: '2026-06-08T12:00:00.000Z',
      payload: { kind: 'recovery_preference', addCardioPunishment: false },
      requiresHumanReview: false,
      requiresMemberConfirmation: true,
    });
    const validated = validateRecommendation(draft, '2026-06-01T12:01:00.000Z');
    expect(validated.status).toBe('MEMBER_CONFIRMATION_REQUIRED');
    const approved = memberConfirmRecommendation(validated, '2026-06-01T12:02:00.000Z', 'user-1');
    expect(() => applyPermittedRecommendation(approved, '2026-06-01T12:03:00.000Z', 'user-1')).toThrow(DomainError);
  });
});
