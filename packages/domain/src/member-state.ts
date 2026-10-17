import { DomainError } from './errors.js';
import { ENERGY_POLICY } from './meal-plan.js';

/**
 * P1-STATE-01 — Member State Engine (foundation).
 * Deterministic projection from validated observations. Does not invent calories,
 * diagnose medical conditions, or apply plan changes.
 */

export type DataProvenance = 'measured' | 'self_reported' | 'estimated' | 'unknown';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

export type ValidatedObservation = {
  kind:
    | 'weight'
    | 'meal_day'
    | 'water_day'
    | 'session_completed'
    | 'session_missed_unknown'
    | 'sleep_hours'
    | 'steps'
    | 'supplement_taken'
    | 'supplement_missed_unknown';
  /** Calendar day YYYY-MM-DD in the member's coaching timezone (caller-normalized). */
  observedOn: string;
  value: number | null;
  provenance: DataProvenance;
  /** 0–10000 basis points; null when confidence is not estimated. */
  confidenceBps: number | null;
};

export type AdherenceSummary = {
  windowDays: number;
  mealDaysLogged: number;
  waterDaysLogged: number;
  sessionsCompleted: number;
  /** Missing logs ≠ confirmed non-adherence. */
  confirmedNonAdherence: false;
};

export type MemberState = {
  schemaVersion: 1;
  goals: readonly string[];
  currentProgramId: string | null;
  nutritionPhase: string | null;
  adherence: AdherenceSummary;
  weightTrendGramsPerWeek: number | null;
  dataCompletenessBps: number;
  confidence: ConfidenceLevel;
  openCoachingQuestions: readonly string[];
  safetyFlags: readonly string[];
  pendingRecommendations: readonly never[];
  lastHumanReviewAt: string | null;
  /** Always empty until recommendation engine lands. */
  policyNotes: readonly string[];
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function assertValidatedObservation(row: ValidatedObservation): ValidatedObservation {
  if (!ISO_DAY.test(row.observedOn)) {
    throw new DomainError('INVALID_OBSERVATION_DAY', 'Observation day must be YYYY-MM-DD');
  }
  if (
    row.confidenceBps !== null &&
    (!Number.isSafeInteger(row.confidenceBps) || row.confidenceBps < 0 || row.confidenceBps > 10_000)
  ) {
    throw new DomainError('INVALID_CONFIDENCE', 'Confidence must be basis points 0–10000');
  }
  if (row.value !== null && !Number.isFinite(row.value)) {
    throw new DomainError('INVALID_OBSERVATION_VALUE', 'Observation value must be finite or null');
  }
  return row;
}

function uniqueDays(obs: readonly ValidatedObservation[], kind: ValidatedObservation['kind']): number {
  return new Set(obs.filter((row) => row.kind === kind).map((row) => row.observedOn)).size;
}

function weightTrendGramsPerWeek(obs: readonly ValidatedObservation[]): number | null {
  const weights = obs
    .filter((row) => row.kind === 'weight' && row.value !== null && Number.isSafeInteger(row.value) && (row.value as number) >= 30_000)
    .map((row) => ({ on: row.observedOn, grams: row.value as number }))
    .sort((a, b) => a.on.localeCompare(b.on));
  if (weights.length < 2) return null;
  const first = weights[0]!;
  const last = weights[weights.length - 1]!;
  const days = Math.max(
    1,
    Math.round((Date.parse(`${last.on}T12:00:00.000Z`) - Date.parse(`${first.on}T12:00:00.000Z`)) / 86_400_000),
  );
  return Math.round(((last.grams - first.grams) * 7) / days);
}

function completenessBps(adherence: AdherenceSummary): number {
  const meal = Math.min(10_000, Math.round((adherence.mealDaysLogged / adherence.windowDays) * 10_000));
  const water = Math.min(10_000, Math.round((adherence.waterDaysLogged / adherence.windowDays) * 10_000));
  return Math.round((meal + water) / 2);
}

function confidenceFromCompleteness(bps: number, weightSamples: number): ConfidenceLevel {
  if (bps < 2_500 || weightSamples < 2) return 'insufficient';
  if (bps < 5_000) return 'low';
  if (bps < 7_500) return 'medium';
  return 'high';
}

export type AssembleMemberStateInput = {
  goals: readonly string[];
  currentProgramId: string | null;
  nutritionPhase: string | null;
  windowDays: number;
  observations: readonly ValidatedObservation[];
  openCoachingQuestions?: readonly string[];
  safetyFlags?: readonly string[];
  lastHumanReviewAt?: string | null;
};

/** Build MemberState from validated observations only — never invents missing adherence. */
export function assembleMemberState(input: AssembleMemberStateInput): MemberState {
  if (!Number.isSafeInteger(input.windowDays) || input.windowDays < 1 || input.windowDays > 90) {
    throw new DomainError('INVALID_WINDOW', 'Member state window must be 1–90 days');
  }
  const observations = input.observations.map(assertValidatedObservation);
  const adherence: AdherenceSummary = {
    windowDays: input.windowDays,
    mealDaysLogged: uniqueDays(observations, 'meal_day'),
    waterDaysLogged: uniqueDays(observations, 'water_day'),
    sessionsCompleted: uniqueDays(observations, 'session_completed'),
    confirmedNonAdherence: false,
  };
  const dataCompletenessBps = completenessBps(adherence);
  const weightSamples = observations.filter((row) => row.kind === 'weight').length;
  const notes: string[] = [];
  if (!ENERGY_POLICY.approvedForPaidCoaching) {
    notes.push('energy_policy_unapproved_for_paid_coaching');
  }
  return {
    schemaVersion: 1,
    goals: input.goals,
    currentProgramId: input.currentProgramId,
    nutritionPhase: input.nutritionPhase,
    adherence,
    weightTrendGramsPerWeek: weightTrendGramsPerWeek(observations),
    dataCompletenessBps,
    confidence: confidenceFromCompleteness(dataCompletenessBps, weightSamples),
    openCoachingQuestions: input.openCoachingQuestions ?? [],
    safetyFlags: input.safetyFlags ?? [],
    pendingRecommendations: [],
    lastHumanReviewAt: input.lastHumanReviewAt ?? null,
    policyNotes: notes,
  };
}
