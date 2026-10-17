import { DomainError } from './errors.js';
import { ENERGY_POLICY, assertEnergyPolicyApprovedForPaidCoaching } from './meal-plan.js';
import type { MemberState } from './member-state.js';

/**
 * P1-REC-01 — Adaptive recommendation engine (deterministic).
 * AI may request drafts via tools but cannot apply. Nutrition stays propose-only until ENERGY_POLICY approval.
 */

export const RECOMMENDATION_POLICY_VERSION = 'rec_policy_v1_unapproved_nutrition';

export const RECOMMENDATION_STATUSES = [
  'DRAFT',
  'VALIDATED',
  'REVIEW_REQUIRED',
  'MEMBER_CONFIRMATION_REQUIRED',
  'APPROVED',
  'APPLIED',
  'MONITORED',
  'SUPERSEDED',
  'REVERTED',
  'REJECTED',
  'EXPIRED',
  'CANCELED',
] as const;

export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export type RecommendationCategory = 'daily_guidance' | 'training' | 'nutrition' | 'human_required';

/** Deterministic safety class — AI cannot escalate a blocked item to auto-apply. */
export type RecommendationSafetyClass =
  | 'safe_guidance'
  | 'member_confirm'
  | 'human_review'
  | 'blocked_policy';

export type RecommendationEvidence = {
  fact: string;
  value: string | number | boolean | null;
  source: 'member_state' | 'policy' | 'safety';
};

export type CoachingRecommendation = {
  id: string;
  memberId: string;
  category: RecommendationCategory;
  status: RecommendationStatus;
  summary: string;
  rationale: string;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  missingData: readonly string[];
  evidence: readonly RecommendationEvidence[];
  policyVersion: string;
  expiresAt: string;
  /** Opaque deterministic payload — never applied by this module alone. */
  payload: Readonly<Record<string, unknown>>;
  requiresHumanReview: boolean;
  requiresMemberConfirmation: boolean;
  safetyClass: RecommendationSafetyClass;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 2;
  audit: readonly { at: string; action: string; actorId: string | null; note: string }[];
};

export type RecommendationApplyResult = {
  applied: true;
  kind: string;
  /** What the deterministic engine recorded — never invents member outcomes. */
  effect: Readonly<Record<string, unknown>>;
  monitoredFrom: string;
};

const OPEN_STATUSES: readonly RecommendationStatus[] = [
  'DRAFT',
  'VALIDATED',
  'REVIEW_REQUIRED',
  'MEMBER_CONFIRMATION_REQUIRED',
  'APPROVED',
  'APPLIED',
  'MONITORED',
];

const TRANSITIONS: Record<RecommendationStatus, readonly RecommendationStatus[]> = {
  DRAFT: ['VALIDATED', 'REJECTED', 'SUPERSEDED', 'CANCELED', 'EXPIRED'],
  VALIDATED: ['REVIEW_REQUIRED', 'MEMBER_CONFIRMATION_REQUIRED', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'CANCELED', 'EXPIRED'],
  REVIEW_REQUIRED: ['APPROVED', 'REJECTED', 'SUPERSEDED', 'MEMBER_CONFIRMATION_REQUIRED', 'CANCELED', 'EXPIRED'],
  MEMBER_CONFIRMATION_REQUIRED: ['APPROVED', 'REJECTED', 'SUPERSEDED', 'CANCELED', 'EXPIRED'],
  APPROVED: ['APPLIED', 'SUPERSEDED', 'REJECTED', 'CANCELED', 'EXPIRED'],
  APPLIED: ['MONITORED', 'REVERTED', 'SUPERSEDED'],
  MONITORED: ['SUPERSEDED', 'REVERTED'],
  SUPERSEDED: [],
  REVERTED: ['SUPERSEDED'],
  REJECTED: [],
  EXPIRED: [],
  CANCELED: [],
};

const APPLYABLE_TRAINING_KINDS = new Set([
  'recovery_preference',
  'volume_deload',
  'session_intensity_ease',
  'progressive_overload_hint',
]);

export function assertRecommendationStatus(value: string): RecommendationStatus {
  if ((RECOMMENDATION_STATUSES as readonly string[]).includes(value)) {
    return value as RecommendationStatus;
  }
  throw new DomainError('UNKNOWN_RECOMMENDATION_STATUS', 'Unknown recommendation status');
}

function pushAudit(
  rec: CoachingRecommendation,
  at: string,
  action: string,
  actorId: string | null,
  note: string,
): CoachingRecommendation {
  return {
    ...rec,
    updatedAt: at,
    audit: [...rec.audit, { at, action, actorId, note }],
  };
}

export function classifyRecommendationSafety(input: {
  category: RecommendationCategory;
  requiresHumanReview: boolean;
  requiresMemberConfirmation: boolean;
  payload?: Readonly<Record<string, unknown>>;
}): RecommendationSafetyClass {
  if (input.category === 'human_required') {
    return 'blocked_policy';
  }
  if (input.category === 'nutrition') {
    return ENERGY_POLICY.approvedForPaidCoaching ? 'human_review' : 'blocked_policy';
  }
  if (input.requiresHumanReview) return 'human_review';
  if (input.requiresMemberConfirmation) return 'member_confirm';
  const kind = typeof input.payload?.kind === 'string' ? input.payload.kind : '';
  if (input.category === 'training' && !APPLYABLE_TRAINING_KINDS.has(kind) && kind.length > 0) {
    return 'human_review';
  }
  return 'safe_guidance';
}

export function createRecommendationDraft(input: {
  id: string;
  memberId: string;
  category: RecommendationCategory;
  summary: string;
  rationale: string;
  confidence: CoachingRecommendation['confidence'];
  missingData?: readonly string[];
  evidence?: readonly RecommendationEvidence[];
  payload?: Readonly<Record<string, unknown>>;
  createdAt: string;
  expiresAt: string;
  requiresHumanReview?: boolean;
  requiresMemberConfirmation?: boolean;
  safetyClass?: RecommendationSafetyClass;
  actorId?: string | null;
}): CoachingRecommendation {
  if (input.id.trim().length < 1 || input.memberId.trim().length < 1) {
    throw new DomainError('INVALID_RECOMMENDATION', 'id and memberId are required');
  }
  if (input.summary.trim().length < 1 || input.summary.length > 500) {
    throw new DomainError('INVALID_RECOMMENDATION', 'summary must be 1–500 characters');
  }
  if (input.rationale.trim().length < 1 || input.rationale.length > 2000) {
    throw new DomainError('INVALID_RECOMMENDATION', 'rationale must be 1–2000 characters');
  }
  const requiresHumanReview =
    input.requiresHumanReview ?? (input.category === 'human_required' || input.category === 'nutrition');
  const requiresMemberConfirmation = input.requiresMemberConfirmation ?? input.category !== 'daily_guidance';
  const payload = input.payload ?? {};
  const safetyClass =
    input.safetyClass ??
    classifyRecommendationSafety({
      category: input.category,
      requiresHumanReview,
      requiresMemberConfirmation,
      payload,
    });
  const draft: CoachingRecommendation = {
    id: input.id,
    memberId: input.memberId,
    category: input.category,
    status: 'DRAFT',
    summary: input.summary.trim(),
    rationale: input.rationale.trim(),
    confidence: input.confidence,
    missingData: input.missingData ?? [],
    evidence: input.evidence ?? [],
    policyVersion: RECOMMENDATION_POLICY_VERSION,
    expiresAt: input.expiresAt,
    payload,
    requiresHumanReview,
    requiresMemberConfirmation,
    safetyClass,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    schemaVersion: 2,
    audit: [],
  };
  return pushAudit(draft, input.createdAt, 'created', input.actorId ?? null, 'draft_created');
}

export function transitionRecommendation(
  current: CoachingRecommendation,
  next: RecommendationStatus,
  at: string,
  options: { actorId?: string | null; note?: string } = {},
): CoachingRecommendation {
  const allowed = TRANSITIONS[current.status];
  if (!allowed.includes(next)) {
    throw new DomainError(
      'INVALID_RECOMMENDATION_TRANSITION',
      `Cannot transition recommendation from ${current.status} to ${next}`,
    );
  }
  if (next === 'APPLIED') {
    assertRecommendationMayApply(current);
  }
  return pushAudit(
    { ...current, status: next },
    at,
    `transition_${next.toLowerCase()}`,
    options.actorId ?? null,
    options.note ?? `status=${next}`,
  );
}

/** Hard gate before APPLIED — nutrition cannot bypass ENERGY_POLICY; AI cannot call this successfully for nutrition. */
export function assertRecommendationMayApply(rec: CoachingRecommendation): void {
  if (rec.status !== 'APPROVED') {
    throw new DomainError('NOT_APPROVED', 'Only APPROVED recommendations may be applied');
  }
  if (rec.category === 'nutrition') {
    assertEnergyPolicyApprovedForPaidCoaching();
  }
  if (rec.category === 'human_required' || rec.safetyClass === 'blocked_policy') {
    throw new DomainError('POLICY_BLOCKED', 'Recommendation cannot be applied under current policy');
  }
  if (rec.category === 'training') {
    const kind = typeof rec.payload.kind === 'string' ? rec.payload.kind : '';
    if (!APPLYABLE_TRAINING_KINDS.has(kind)) {
      throw new DomainError('TRAINING_APPLY_NOT_PERMITTED', 'This training adaptation requires a permitted payload kind');
    }
  }
}

export function memberConfirmRecommendation(
  rec: CoachingRecommendation,
  at: string,
  memberId: string,
): CoachingRecommendation {
  if (rec.memberId !== memberId) {
    throw new DomainError('FORBIDDEN', 'Recommendation does not belong to this member');
  }
  if (rec.status !== 'MEMBER_CONFIRMATION_REQUIRED' && rec.status !== 'APPROVED') {
    throw new DomainError(
      'INVALID_RECOMMENDATION_TRANSITION',
      'Member confirmation is only valid from MEMBER_CONFIRMATION_REQUIRED or already APPROVED',
    );
  }
  if (rec.status === 'APPROVED') return rec;
  return transitionRecommendation(rec, 'APPROVED', at, { actorId: memberId, note: 'member_confirmed' });
}

export function cancelRecommendation(
  rec: CoachingRecommendation,
  at: string,
  actorId: string | null,
  note: string,
): CoachingRecommendation {
  return transitionRecommendation(rec, 'CANCELED', at, { actorId, note });
}

export function expireRecommendation(
  rec: CoachingRecommendation,
  at: string,
): CoachingRecommendation {
  if (!OPEN_STATUSES.includes(rec.status) || rec.status === 'APPLIED' || rec.status === 'MONITORED') {
    return rec;
  }
  if (Date.parse(rec.expiresAt) > Date.parse(at)) {
    return rec;
  }
  return transitionRecommendation(rec, 'EXPIRED', at, { actorId: 'system:recommendation_engine', note: 'past_expires_at' });
}

export function expireOpenRecommendations(
  rows: readonly CoachingRecommendation[],
  at: string,
): CoachingRecommendation[] {
  return rows.map((row) => expireRecommendation(row, at));
}

export function payloadKind(rec: CoachingRecommendation): string {
  return typeof rec.payload.kind === 'string' ? rec.payload.kind : '';
}

/** Suppress duplicate open recommendations with the same category + payload.kind. */
export function suppressDuplicateRecommendations(
  existing: readonly CoachingRecommendation[],
  incoming: readonly CoachingRecommendation[],
): CoachingRecommendation[] {
  const openKeys = new Set(
    existing
      .filter((row) => OPEN_STATUSES.includes(row.status))
      .map((row) => `${row.category}:${payloadKind(row)}`),
  );
  const out: CoachingRecommendation[] = [];
  for (const rec of incoming) {
    const key = `${rec.category}:${payloadKind(rec)}`;
    if (openKeys.has(key)) continue;
    openKeys.add(key);
    out.push(rec);
  }
  return out;
}

const PRIORITY_RANK: Record<RecommendationCategory, number> = {
  human_required: 0,
  nutrition: 1,
  training: 2,
  daily_guidance: 3,
};

const CONFIDENCE_RANK: Record<CoachingRecommendation['confidence'], number> = {
  high: 0,
  medium: 1,
  low: 2,
  insufficient: 3,
};

export function prioritizeRecommendations(
  rows: readonly CoachingRecommendation[],
): CoachingRecommendation[] {
  return [...rows].sort((a, b) => {
    const byCat = PRIORITY_RANK[a.category] - PRIORITY_RANK[b.category];
    if (byCat !== 0) return byCat;
    const byConf = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
    if (byConf !== 0) return byConf;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

/**
 * Apply an APPROVED recommendation through the deterministic gate.
 * Records an apply effect in audit/payload — does not invent outcome metrics.
 */
export function applyPermittedRecommendation(
  rec: CoachingRecommendation,
  at: string,
  actorId: string,
): { recommendation: CoachingRecommendation; result: RecommendationApplyResult } {
  assertRecommendationMayApply(rec);
  const kind = payloadKind(rec) || rec.category;
  const effect: Record<string, unknown> = {
    kind,
    category: rec.category,
    policyVersion: rec.policyVersion,
    punitiveForbidden: true,
  };
  if (rec.category === 'training') {
    throw new DomainError(
      'USE_PROGRAM_APPLY',
      'Training recommendations must be applied through the program adaptation service after a real version bump',
    );
  }
  if (rec.category === 'daily_guidance') {
    effect.guidanceOnly = true;
  }
  const withPayload: CoachingRecommendation = {
    ...rec,
    payload: { ...rec.payload, lastApplyEffect: effect, lastAppliedAt: at },
  };
  const applied = transitionRecommendation(withPayload, 'APPLIED', at, {
    actorId,
    note: `applied_kind=${kind}`,
  });
  return {
    recommendation: applied,
    result: { applied: true, kind, effect, monitoredFrom: at },
  };
}

export function beginMonitoringRecommendation(
  rec: CoachingRecommendation,
  at: string,
  actorId: string | null,
  note = 'monitoring_started',
): CoachingRecommendation {
  if (rec.status !== 'APPLIED') {
    throw new DomainError('INVALID_RECOMMENDATION_TRANSITION', 'Only APPLIED recommendations enter MONITORED');
  }
  return transitionRecommendation(rec, 'MONITORED', at, { actorId, note });
}

export function revertAppliedRecommendation(
  rec: CoachingRecommendation,
  at: string,
  actorId: string | null,
  note: string,
): CoachingRecommendation {
  if (rec.status !== 'APPLIED' && rec.status !== 'MONITORED') {
    throw new DomainError('INVALID_RECOMMENDATION_TRANSITION', 'Only APPLIED or MONITORED can revert');
  }
  return transitionRecommendation(rec, 'REVERTED', at, { actorId, note });
}

export function validateRecommendation(
  rec: CoachingRecommendation,
  at: string,
  actorId: string | null = null,
): CoachingRecommendation {
  if (rec.status !== 'DRAFT') {
    throw new DomainError('INVALID_RECOMMENDATION_TRANSITION', 'Only DRAFT recommendations can be validated');
  }
  if (rec.confidence === 'insufficient') {
    return transitionRecommendation(rec, 'REJECTED', at, {
      actorId,
      note: 'insufficient_confidence',
    });
  }
  let next = transitionRecommendation(rec, 'VALIDATED', at, { actorId, note: 'validated' });
  if (next.category === 'nutrition' && !ENERGY_POLICY.approvedForPaidCoaching) {
    next = { ...next, requiresHumanReview: true };
    return transitionRecommendation(next, 'REVIEW_REQUIRED', at, {
      actorId,
      note: 'nutrition_propose_only_pending_energy_policy',
    });
  }
  if (next.requiresHumanReview) {
    return transitionRecommendation(next, 'REVIEW_REQUIRED', at, { actorId, note: 'human_review_required' });
  }
  if (next.requiresMemberConfirmation) {
    return transitionRecommendation(next, 'MEMBER_CONFIRMATION_REQUIRED', at, {
      actorId,
      note: 'member_confirmation_required',
    });
  }
  return next;
}

export function rejectRecommendation(
  rec: CoachingRecommendation,
  at: string,
  actorId: string | null,
  note: string,
): CoachingRecommendation {
  return transitionRecommendation(rec, 'REJECTED', at, { actorId, note });
}

export function supersedeRecommendation(
  rec: CoachingRecommendation,
  at: string,
  actorId: string | null,
  note: string,
): CoachingRecommendation {
  return transitionRecommendation(rec, 'SUPERSEDED', at, { actorId, note });
}

function missingIndicators(state: MemberState): string[] {
  const missing: string[] = [];
  if (state.adherence.mealDaysLogged < Math.ceil(state.adherence.windowDays / 2)) missing.push('meal_logs');
  if (state.adherence.waterDaysLogged < Math.ceil(state.adherence.windowDays / 2)) missing.push('water_logs');
  if (state.weightTrendGramsPerWeek === null) missing.push('weight_trend');
  if (!state.sleepLoggingAvailable) missing.push('daily_sleep_hours');
  return missing;
}

/**
 * Deterministic candidates from MemberState. Never invents adherence; never applies.
 * Material nutrition changes are always propose/review only while ENERGY_POLICY is unapproved.
 */
export function generateRecommendationsFromMemberState(input: {
  memberId: string;
  state: MemberState;
  nowIso: string;
  idFactory: () => string;
}): CoachingRecommendation[] {
  const { state, memberId, nowIso } = input;
  const expiresAt = new Date(Date.parse(nowIso) + 7 * 86_400_000).toISOString();
  const missing = missingIndicators(state);
  const out: CoachingRecommendation[] = [];

  // Unexpected meal / incomplete food — encourage logging, never punish with cardio/deficit.
  if (state.adherence.mealDaysLogged === 0) {
    out.push(
      createRecommendationDraft({
        id: input.idFactory(),
        memberId,
        category: 'daily_guidance',
        summary: 'Log meals when you can — missing food data is unknown, not a failed day.',
        rationale: 'No meal_day observations in the window. Silence must not trigger punitive compensation.',
        confidence: 'medium',
        missingData: missing,
        evidence: [
          { fact: 'mealDaysLogged', value: 0, source: 'member_state' },
          { fact: 'confirmedNonAdherence', value: false, source: 'member_state' },
        ],
        payload: { kind: 'encourage_meal_logging', punitiveCardio: false, calorieCut: false },
        createdAt: nowIso,
        expiresAt,
        requiresHumanReview: false,
        requiresMemberConfirmation: false,
        actorId: 'system:recommendation_engine',
      }),
    );
  }

  // Missed workout log vs confirmed miss: we only see completed sessions; absence ≠ skip.
  if (state.adherence.sessionsCompleted === 0) {
    out.push(
      createRecommendationDraft({
        id: input.idFactory(),
        memberId,
        category: 'daily_guidance',
        summary: 'No completed sessions logged this window — ask what happened without assuming a skip.',
        rationale: 'Zero session_completed events. Missing workout log is not confirmed non-adherence.',
        confidence: state.confidence === 'insufficient' ? 'insufficient' : 'low',
        missingData: [...missing, 'session_completion'],
        evidence: [
          { fact: 'sessionsCompleted', value: 0, source: 'member_state' },
          { fact: 'confirmedNonAdherence', value: false, source: 'member_state' },
        ],
        payload: { kind: 'clarify_training_gap', assumeSkipped: false },
        createdAt: nowIso,
        expiresAt,
        requiresHumanReview: false,
        requiresMemberConfirmation: false,
        actorId: 'system:recommendation_engine',
      }),
    );
  }

  // Single-day weight noise — do not propose nutrition change from one sample.
  const weightDays = state.daily.filter((d) => d.weightGrams !== null).length;
  if (weightDays === 1) {
    out.push(
      createRecommendationDraft({
        id: input.idFactory(),
        memberId,
        category: 'daily_guidance',
        summary: 'Hold nutrition steady — one weight sample is not a trend.',
        rationale: 'Single weight observation cannot justify macro changes.',
        confidence: 'high',
        missingData: missing,
        evidence: [{ fact: 'weightSampleDays', value: 1, source: 'member_state' }],
        payload: { kind: 'hold_nutrition', reason: 'single_weight_sample' },
        createdAt: nowIso,
        expiresAt,
        requiresHumanReview: false,
        requiresMemberConfirmation: false,
        actorId: 'system:recommendation_engine',
      }),
    );
  }

  // Multi-week inadequate progress (weight rising on cut) — nutrition candidate stays review-only.
  if (
    state.nutritionPhase === 'cutting' &&
    state.weightTrendGramsPerWeek !== null &&
    state.weightTrendGramsPerWeek > 200 &&
    state.confidence !== 'insufficient'
  ) {
    out.push(
      createRecommendationDraft({
        id: input.idFactory(),
        memberId,
        category: 'nutrition',
        summary: 'Propose a modest energy review after sustained weight rise on a cut.',
        rationale: 'Weight trend rising while phase=cutting with non-insufficient confidence. Propose only; ENERGY_POLICY gate blocks apply.',
        confidence: state.confidence,
        missingData: missing,
        evidence: [
          { fact: 'weightTrendGramsPerWeek', value: state.weightTrendGramsPerWeek, source: 'member_state' },
          { fact: 'nutritionPhase', value: 'cutting', source: 'member_state' },
          { fact: 'energyPolicyApproved', value: ENERGY_POLICY.approvedForPaidCoaching, source: 'policy' },
        ],
        payload: {
          kind: 'propose_energy_delta',
          energyDeltaKcal: -150,
          mayAutoApply: false,
        },
        createdAt: nowIso,
        expiresAt,
        requiresHumanReview: true,
        requiresMemberConfirmation: true,
        actorId: 'system:recommendation_engine',
      }),
    );
  }

  // Fatigue proxy: low activity + low sessions + low completeness → recovery guidance (not punishment).
  if (
    state.adherence.activityDaysLogged <= 1 &&
    state.adherence.sessionsCompleted <= 1 &&
    state.dataCompletenessBps < 4_000
  ) {
    out.push(
      createRecommendationDraft({
        id: input.idFactory(),
        memberId,
        category: 'training',
        summary: 'Suggest an easier session or rest — recovery first, no punishment volume.',
        rationale: 'Low activity and session completion with incomplete logs suggests fatigue or life load, not a deficit to chase.',
        confidence: 'low',
        missingData: missing,
        evidence: [
          { fact: 'activityDaysLogged', value: state.adherence.activityDaysLogged, source: 'member_state' },
          { fact: 'sessionsCompleted', value: state.adherence.sessionsCompleted, source: 'member_state' },
        ],
        payload: { kind: 'recovery_preference', addCardioPunishment: false, intensityDelta: -1 },
        createdAt: nowIso,
        expiresAt,
        requiresHumanReview: false,
        requiresMemberConfirmation: true,
        actorId: 'system:recommendation_engine',
      }),
    );
  }

  // Bounded progressive overload hint when sessions are logged and confidence is usable.
  if (state.adherence.sessionsCompleted >= 3 && state.confidence !== 'insufficient') {
    out.push(
      createRecommendationDraft({
        id: input.idFactory(),
        memberId,
        category: 'training',
        summary: 'Consider a small load increase on primary lifts if technique felt solid.',
        rationale: 'Multiple completed sessions with usable confidence support a bounded progressive-overload hint — not a free-form program rewrite.',
        confidence: state.confidence === 'high' ? 'medium' : 'low',
        missingData: missing,
        evidence: [
          { fact: 'sessionsCompleted', value: state.adherence.sessionsCompleted, source: 'member_state' },
          { fact: 'confidence', value: state.confidence, source: 'member_state' },
        ],
        payload: {
          kind: 'progressive_overload_hint',
          loadIncrementPctMax: 5,
          volumeIncreaseForbiddenWithoutReview: true,
        },
        createdAt: nowIso,
        expiresAt,
        requiresHumanReview: false,
        requiresMemberConfirmation: true,
        actorId: 'system:recommendation_engine',
      }),
    );
  }

  // Volume deload when completeness is high but weight trend unavailable / fatigue signals.
  if (
    state.dataCompletenessBps >= 5_000 &&
    state.adherence.sessionsCompleted >= 4 &&
    state.weightTrendGramsPerWeek === null
  ) {
    out.push(
      createRecommendationDraft({
        id: input.idFactory(),
        memberId,
        category: 'training',
        summary: 'Optional light deload week while weight trend data is still incomplete.',
        rationale: 'High session count without a weight trend favors recovery volume reduction over guessing nutrition.',
        confidence: 'low',
        missingData: missing,
        evidence: [
          { fact: 'sessionsCompleted', value: state.adherence.sessionsCompleted, source: 'member_state' },
          { fact: 'weightTrendGramsPerWeek', value: null, source: 'member_state' },
        ],
        payload: { kind: 'volume_deload', volumeScaleBps: 7_000, addCardioPunishment: false },
        createdAt: nowIso,
        expiresAt,
        requiresHumanReview: false,
        requiresMemberConfirmation: true,
        actorId: 'system:recommendation_engine',
      }),
    );
  }

  // Paid nutrition adaptations blocked while ENERGY_POLICY is unapproved — stop safely.
  if (!ENERGY_POLICY.approvedForPaidCoaching || state.policyNotes.includes('energy_policy_unapproved_for_paid_coaching')) {
    out.push(
      createRecommendationDraft({
        id: input.idFactory(),
        memberId,
        category: 'human_required',
        summary: 'Paid nutrition adaptations are blocked until scientific policy approval.',
        rationale: 'ENERGY_POLICY is unapproved. Workflow must stop safely rather than apply cuts.',
        confidence: 'high',
        missingData: missing,
        evidence: [{ fact: 'ENERGY_POLICY.approvedForPaidCoaching', value: false, source: 'safety' }],
        payload: { kind: 'block_paid_nutrition_adaptations' },
        createdAt: nowIso,
        expiresAt,
        requiresHumanReview: true,
        requiresMemberConfirmation: false,
        actorId: 'system:recommendation_engine',
      }),
    );
  }

  return out;
}

/** AI tool surface: drafting is allowed; applying always throws. */
export function aiMustNotApplyRecommendation(rec: CoachingRecommendation): never {
  void rec;
  throw new DomainError('AI_CANNOT_APPLY', 'The AI model cannot apply recommendations directly');
}
