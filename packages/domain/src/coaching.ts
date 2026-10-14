import { DomainError, assertIsoDateTime, assertSafeNonNegativeInteger } from './errors.js';
import type { Role } from './access.js';

export type RuleStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'retired';

export type Comparison = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in';

export type FactValue = string | number | boolean;

export type Condition =
  | { type: 'fact'; fact: string; op: Comparison; value: FactValue | readonly string[] }
  | { type: 'all'; conditions: readonly Condition[] }
  | { type: 'any'; conditions: readonly Condition[] };

export type RuleAction =
  | { type: 'set_flag'; flag: string }
  | { type: 'propose_adjustment'; adjustment: string; magnitude: number }
  | { type: 'require_review'; reason: string }
  | { type: 'block'; reason: string };

export type CoachingRuleVersion = {
  ruleId: string;
  version: number;
  status: RuleStatus;
  priority: number;
  authorUserId: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  conditions: Condition;
  actions: readonly RuleAction[];
  safetyBlocks: readonly string[];
};

export type RuleHit = {
  ruleId: string;
  version: number;
  priority: number;
  status: RuleStatus;
  simulated: boolean;
  actions: readonly RuleAction[];
  suppressed: boolean;
  suppressionReason: string | null;
};

export type EvaluationResult = {
  mode: 'production' | 'simulation';
  asOf: string;
  hits: readonly RuleHit[];
  blocked: boolean;
  blockReasons: readonly string[];
  persistable: boolean;
};

export type RuleApproval = {
  ruleId: string;
  version: number;
  decision: 'approved' | 'rejected';
  reviewerUserId: string;
  decidedAt: string;
};

function compareFact(actual: FactValue | undefined, op: Comparison, expected: FactValue | readonly string[]): boolean {
  if (actual === undefined) {
    return false;
  }
  if (op === 'in') {
    return typeof actual === 'string' && Array.isArray(expected) && expected.includes(actual);
  }
  if (Array.isArray(expected)) {
    return false;
  }
  if (typeof actual !== typeof expected) {
    return false;
  }
  const left = actual as string | number | boolean;
  const right = expected;
  switch (op) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'lt':
      return typeof left === 'number' && typeof right === 'number' && left < right;
    case 'lte':
      return typeof left === 'number' && typeof right === 'number' && left <= right;
    case 'gt':
      return typeof left === 'number' && typeof right === 'number' && left > right;
    case 'gte':
      return typeof left === 'number' && typeof right === 'number' && left >= right;
    default:
      return false;
  }
}

function matches(condition: Condition, facts: Readonly<Record<string, FactValue>>): boolean {
  if (condition.type === 'all') {
    return condition.conditions.every((child) => matches(child, facts));
  }
  if (condition.type === 'any') {
    return condition.conditions.some((child) => matches(child, facts));
  }
  return compareFact(facts[condition.fact], condition.op, condition.value);
}

function isEffective(rule: CoachingRuleVersion, asOfMs: number): boolean {
  const from = Date.parse(rule.effectiveFrom);
  if (Number.isNaN(from) || asOfMs < from) {
    return false;
  }
  if (rule.effectiveUntil === null) {
    return true;
  }
  const until = Date.parse(rule.effectiveUntil);
  if (Number.isNaN(until)) {
    throw new DomainError('INVALID_RULE_WINDOW', 'effectiveUntil is not a timestamp');
  }
  return asOfMs < until;
}

export function evaluateCoachingRules(input: {
  rules: readonly CoachingRuleVersion[];
  facts: Readonly<Record<string, FactValue>>;
  asOf: string;
  mode: 'production' | 'simulation';
}): EvaluationResult {
  assertIsoDateTime(input.asOf, 'INVALID_AS_OF');
  const asOfMs = Date.parse(input.asOf);
  const seen = new Set<string>();
  for (const rule of input.rules) {
    const key = `${rule.ruleId}:${rule.version}`;
    if (seen.has(key)) {
      throw new DomainError('AMBIGUOUS_RULESET', 'Duplicate rule version in evaluation input');
    }
    seen.add(key);
    assertSafeNonNegativeInteger(rule.priority, 'INVALID_PRIORITY');
    assertSafeNonNegativeInteger(rule.version, 'INVALID_RULE_VERSION');
  }

  const eligible = input.rules.filter((rule) => {
    if (rule.status === 'rejected' || rule.status === 'retired') {
      return false;
    }
    if (input.mode === 'production' && rule.status !== 'approved') {
      return false;
    }
    if (input.mode === 'simulation' && rule.status === 'approved') {
      return isEffective(rule, asOfMs);
    }
    if (input.mode === 'simulation') {
      return rule.status === 'draft' || rule.status === 'in_review' || rule.status === 'approved';
    }
    return isEffective(rule, asOfMs);
  }).filter((rule) => (input.mode === 'production' ? isEffective(rule, asOfMs) : true));

  const newest = new Map<string, CoachingRuleVersion>();
  for (const rule of eligible) {
    const current = newest.get(rule.ruleId);
    if (current === undefined || rule.version > current.version) {
      newest.set(rule.ruleId, rule);
    }
  }

  const ordered = [...newest.values()].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
  });

  const hits: RuleHit[] = [];
  const blockReasons: string[] = [];
  let blocked = false;

  for (const rule of ordered) {
    if (!matches(rule.conditions, input.facts)) {
      continue;
    }
    const simulated = rule.status !== 'approved';
    const safetyFact = rule.safetyBlocks.find((fact) => input.facts[fact] === true);
    if (safetyFact !== undefined) {
      const reason = `safety:${safetyFact}`;
      blockReasons.push(reason);
      hits.push({
        ruleId: rule.ruleId,
        version: rule.version,
        priority: rule.priority,
        status: rule.status,
        simulated,
        actions: [{ type: 'block', reason }],
        suppressed: true,
        suppressionReason: reason,
      });
      blocked = true;
      break;
    }
    const blockingAction = rule.actions.find((action) => action.type === 'block');
    hits.push({
      ruleId: rule.ruleId,
      version: rule.version,
      priority: rule.priority,
      status: rule.status,
      simulated,
      actions: rule.actions,
      suppressed: false,
      suppressionReason: null,
    });
    if (blockingAction !== undefined && blockingAction.type === 'block') {
      blockReasons.push(blockingAction.reason);
      blocked = true;
      break;
    }
  }

  const persistable = input.mode === 'production' && hits.every((hit) => hit.status === 'approved' && !hit.simulated);

  return {
    mode: input.mode,
    asOf: input.asOf,
    hits,
    blocked,
    blockReasons,
    persistable,
  };
}

export function assertPersistablePlan(result: EvaluationResult): void {
  if (!result.persistable) {
    throw new DomainError('SIMULATION_NOT_PERSISTABLE', 'Only production evaluations of approved rules can be stored as a plan');
  }
  if (result.blocked) {
    throw new DomainError('BLOCKED_PLAN', 'A safety block prevents persisting this plan');
  }
}

export function decideRuleApproval(input: {
  rule: Pick<CoachingRuleVersion, 'ruleId' | 'version' | 'status' | 'authorUserId'>;
  decision: 'approved' | 'rejected';
  reviewerUserId: string;
  reviewerRoles: readonly Role[];
  decidedAt: string;
}): { status: RuleStatus; approval: RuleApproval } {
  assertIsoDateTime(input.decidedAt, 'INVALID_DECISION_TIME');
  const reviewer = input.reviewerRoles.includes('coach_reviewer') || input.reviewerRoles.includes('admin');
  if (!reviewer) {
    throw new DomainError('FORBIDDEN', 'Rule approval requires a coach reviewer');
  }
  if (input.reviewerUserId === input.rule.authorUserId) {
    throw new DomainError('SELF_APPROVAL', 'The author cannot approve their own rule');
  }
  if (input.rule.status !== 'in_review') {
    throw new DomainError('INVALID_RULE_STATE', 'Only rules in review can be approved or rejected');
  }
  return {
    status: input.decision,
    approval: {
      ruleId: input.rule.ruleId,
      version: input.rule.version,
      decision: input.decision,
      reviewerUserId: input.reviewerUserId,
      decidedAt: input.decidedAt,
    },
  };
}
