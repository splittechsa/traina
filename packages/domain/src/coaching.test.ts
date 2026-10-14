import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { decideRuleApproval, evaluateCoachingRules, assertPersistablePlan, type CoachingRuleVersion } from './coaching.js';

function rule(overrides: Partial<CoachingRuleVersion> & Pick<CoachingRuleVersion, 'ruleId' | 'status'>): CoachingRuleVersion {
  return {
    version: 1,
    priority: 10,
    authorUserId: 'author-1',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: null,
    conditions: { type: 'fact', fact: 'sessions_completed', op: 'gte', value: 3 },
    actions: [{ type: 'set_flag', flag: 'adherence_met' }],
    safetyBlocks: [],
    ...overrides,
  };
}

const facts = { sessions_completed: 4, injury_reported: false };

describe('coaching rule engine', () => {
  it('runs only the newest approved effective version in production', () => {
    const result = evaluateCoachingRules({
      mode: 'production',
      asOf: '2026-06-01T00:00:00.000Z',
      facts,
      rules: [
        rule({ ruleId: 'adherence', status: 'approved', version: 1, actions: [{ type: 'set_flag', flag: 'old' }] }),
        rule({ ruleId: 'adherence', status: 'approved', version: 2, actions: [{ type: 'set_flag', flag: 'new' }] }),
        rule({ ruleId: 'draft-rule', status: 'draft' }),
      ],
    });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.version).toBe(2);
    expect(result.hits[0]?.actions).toEqual([{ type: 'set_flag', flag: 'new' }]);
    expect(result.persistable).toBe(true);
    expect(() => assertPersistablePlan(result)).not.toThrow();
  });

  it('does not persist simulated draft rules', () => {
    const result = evaluateCoachingRules({
      mode: 'simulation',
      asOf: '2026-06-01T00:00:00.000Z',
      facts,
      rules: [rule({ ruleId: 'draft-rule', status: 'draft' })],
    });
    expect(result.hits[0]?.simulated).toBe(true);
    expect(result.persistable).toBe(false);
    expect(() => assertPersistablePlan(result)).toThrow(DomainError);
  });

  it('stops on safety blocks before lower-priority rules', () => {
    const result = evaluateCoachingRules({
      mode: 'production',
      asOf: '2026-06-01T00:00:00.000Z',
      facts: { sessions_completed: 4, injury_reported: true },
      rules: [
        rule({
          ruleId: 'safety',
          status: 'approved',
          priority: 100,
          conditions: { type: 'fact', fact: 'injury_reported', op: 'eq', value: true },
          safetyBlocks: ['injury_reported'],
          actions: [{ type: 'propose_adjustment', adjustment: 'increase_load', magnitude: 1 }],
        }),
        rule({ ruleId: 'adherence', status: 'approved', priority: 1 }),
      ],
    });
    expect(result.blocked).toBe(true);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.suppressed).toBe(true);
    expect(() => assertPersistablePlan(result)).toThrow(DomainError);
  });

  it('ignores rules outside the effective window and missing facts', () => {
    const future = evaluateCoachingRules({
      mode: 'production',
      asOf: '2025-01-01T00:00:00.000Z',
      facts,
      rules: [rule({ ruleId: 'adherence', status: 'approved' })],
    });
    expect(future.hits).toHaveLength(0);

    const missing = evaluateCoachingRules({
      mode: 'production',
      asOf: '2026-06-01T00:00:00.000Z',
      facts: {},
      rules: [rule({ ruleId: 'adherence', status: 'approved' })],
    });
    expect(missing.hits).toHaveLength(0);
  });

  it('rejects self-approval and approves in-review rules by a different reviewer', () => {
    const pending = rule({ ruleId: 'adherence', status: 'in_review' });
    expect(() =>
      decideRuleApproval({
        rule: pending,
        decision: 'approved',
        reviewerUserId: 'author-1',
        reviewerRoles: ['coach_reviewer'],
        decidedAt: '2026-06-01T00:00:00.000Z',
      }),
    ).toThrow(DomainError);

    const approved = decideRuleApproval({
      rule: pending,
      decision: 'approved',
      reviewerUserId: 'reviewer-2',
      reviewerRoles: ['coach_reviewer'],
      decidedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(approved.status).toBe('approved');
    expect(approved.approval.reviewerUserId).toBe('reviewer-2');
  });
});
