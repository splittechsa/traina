import { DomainError } from './errors.js';
import { ENERGY_POLICY } from './meal-plan.js';
import type { RecommendationStatus } from './recommendation.js';

/**
 * P1-STATE-01 — Member State Engine.
 * Deterministic projection from validated observations / normalized events.
 * Does not invent calories, diagnose conditions, or apply plan changes.
 */

export type DataProvenance = 'measured' | 'self_reported' | 'estimated' | 'unknown';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

export type ObservationKind =
  | 'weight'
  | 'meal_day'
  | 'water_day'
  | 'session_completed'
  | 'session_missed_unknown'
  | 'sleep_hours'
  | 'steps'
  | 'activity_minutes'
  | 'supplement_taken'
  | 'supplement_missed_unknown'
  | 'measurement';

export type ValidatedObservation = {
  kind: ObservationKind;
  /** Calendar day YYYY-MM-DD in the member's coaching timezone (caller-normalized). */
  observedOn: string;
  value: number | null;
  provenance: DataProvenance;
  /** 0–10000 basis points; null when confidence is not estimated. */
  confidenceBps: number | null;
  /** Stable id used for dedupe / corrections. */
  eventId?: string;
};

/** Append-oriented event before projection to observations. */
export type RawMemberEvent = {
  eventId: string;
  memberId: string;
  eventType: ObservationKind | string;
  occurredAt: string;
  recordedAt: string;
  source: string;
  schemaVersion: 1;
  confidenceBps: number | null;
  provenance: DataProvenance;
  payload: Readonly<Record<string, unknown>>;
  /** When set, prior event with this id is dropped (correction). */
  supersedesEventId?: string | null;
};

export type AdherenceSummary = {
  windowDays: number;
  mealDaysLogged: number;
  waterDaysLogged: number;
  sessionsCompleted: number;
  supplementDaysLogged: number;
  activityDaysLogged: number;
  /** Missing logs ≠ confirmed non-adherence. Always false unless an explicit miss event exists. */
  confirmedNonAdherence: boolean;
};

export type DailyStateSlice = {
  day: string;
  mealLogged: boolean;
  waterLogged: boolean;
  sessionCompleted: boolean;
  supplementTaken: boolean;
  activityLogged: boolean;
  weightGrams: number | null;
};

export type WeeklyStateSlice = {
  weekOf: string;
  mealDaysLogged: number;
  waterDaysLogged: number;
  sessionsCompleted: number;
  weightTrendGrams: number | null;
};

export type PendingRecommendationRef = {
  id: string;
  status: RecommendationStatus;
  category: string;
};

export type MemberState = {
  schemaVersion: 2;
  asOfDay: string;
  timeZone: string;
  goals: readonly string[];
  currentProgramId: string | null;
  nutritionPhase: string | null;
  adherence: AdherenceSummary;
  weightTrendGramsPerWeek: number | null;
  dataCompletenessBps: number;
  confidence: ConfidenceLevel;
  openCoachingQuestions: readonly string[];
  safetyFlags: readonly string[];
  pendingRecommendations: readonly PendingRecommendationRef[];
  lastHumanReviewAt: string | null;
  policyNotes: readonly string[];
  daily: readonly DailyStateSlice[];
  weekly: WeeklyStateSlice;
  /** Daily sleep hours logging is not in schema yet — weekly survey sleep is separate. */
  sleepLoggingAvailable: false;
  eventCounts: {
    accepted: number;
    duplicatesDropped: number;
    supersededDropped: number;
  };
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

/** Calendar YYYY-MM-DD for an instant in an IANA timezone (e.g. Asia/Riyadh). */
export function calendarDayInTimeZone(isoInstant: string, timeZone: string): string {
  const ms = Date.parse(isoInstant);
  if (Number.isNaN(ms)) {
    throw new DomainError('INVALID_INSTANT', 'occurredAt / recordedAt must be ISO-8601');
  }
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(ms));
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y === undefined || m === undefined || d === undefined) {
      throw new DomainError('INVALID_TIMEZONE', 'Could not format day in timezone');
    }
    return `${y}-${m}-${d}`;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('INVALID_TIMEZONE', 'Unknown or unsupported timezone');
  }
}

export type NormalizeEventsResult = {
  events: readonly RawMemberEvent[];
  duplicatesDropped: number;
  supersededDropped: number;
};

/**
 * Deduplicate by eventId (keep latest recordedAt), apply corrections, sort by occurredAt then recordedAt.
 * Out-of-order input is accepted; output is ordered.
 */
export function normalizeMemberEvents(input: readonly RawMemberEvent[]): NormalizeEventsResult {
  const byId = new Map<string, RawMemberEvent>();
  let duplicatesDropped = 0;
  for (const raw of input) {
    if (typeof raw.eventId !== 'string' || raw.eventId.length < 1) {
      throw new DomainError('INVALID_EVENT_ID', 'eventId is required');
    }
    if (Number.isNaN(Date.parse(raw.occurredAt)) || Number.isNaN(Date.parse(raw.recordedAt))) {
      throw new DomainError('INVALID_INSTANT', 'occurredAt / recordedAt must be ISO-8601');
    }
    const prev = byId.get(raw.eventId);
    if (prev === undefined) {
      byId.set(raw.eventId, raw);
      continue;
    }
    duplicatesDropped += 1;
    if (Date.parse(raw.recordedAt) >= Date.parse(prev.recordedAt)) {
      byId.set(raw.eventId, raw);
    }
  }

  const superseded = new Set<string>();
  for (const row of byId.values()) {
    if (row.supersedesEventId !== undefined && row.supersedesEventId !== null && row.supersedesEventId.length > 0) {
      superseded.add(row.supersedesEventId);
    }
  }
  let supersededDropped = 0;
  for (const id of superseded) {
    if (byId.delete(id)) supersededDropped += 1;
  }

  const events = [...byId.values()].sort((a, b) => {
    const oc = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
    if (oc !== 0) return oc;
    return Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
  });
  return { events, duplicatesDropped, supersededDropped };
}

export function observationsFromEvents(
  events: readonly RawMemberEvent[],
  timeZone: string,
): ValidatedObservation[] {
  const out: ValidatedObservation[] = [];
  for (const event of events) {
    const kind = event.eventType as ObservationKind;
    const dayFromPayload = typeof event.payload.observedOn === 'string' ? event.payload.observedOn : null;
    const observedOn = dayFromPayload !== null && ISO_DAY.test(dayFromPayload)
      ? dayFromPayload
      : calendarDayInTimeZone(event.occurredAt, timeZone);
    const value =
      typeof event.payload.value === 'number'
        ? event.payload.value
        : typeof event.payload.weightGrams === 'number'
          ? event.payload.weightGrams
          : typeof event.payload.milliliters === 'number'
            ? event.payload.milliliters
            : typeof event.payload.durationSeconds === 'number'
              ? event.payload.durationSeconds
              : null;
    out.push(
      assertValidatedObservation({
        kind,
        observedOn,
        value,
        provenance: event.provenance,
        confidenceBps: event.confidenceBps,
        eventId: event.eventId,
      }),
    );
  }
  return out;
}

function uniqueDays(obs: readonly ValidatedObservation[], kind: ObservationKind): number {
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
  const sessions = Math.min(10_000, Math.round((adherence.sessionsCompleted / Math.max(1, adherence.windowDays)) * 10_000));
  return Math.round((meal + water + sessions) / 3);
}

function confidenceFromCompleteness(bps: number, weightSamples: number): ConfidenceLevel {
  if (bps < 2_500 || weightSamples < 2) return 'insufficient';
  if (bps < 5_000) return 'low';
  if (bps < 7_500) return 'medium';
  return 'high';
}

function enumerateDays(endDay: string, windowDays: number): string[] {
  if (!ISO_DAY.test(endDay)) {
    throw new DomainError('INVALID_OBSERVATION_DAY', 'asOfDay must be YYYY-MM-DD');
  }
  const days: string[] = [];
  const cursor = new Date(`${endDay}T12:00:00.000Z`);
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setUTCDate(cursor.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function buildDailySlices(days: readonly string[], obs: readonly ValidatedObservation[]): DailyStateSlice[] {
  return days.map((day) => {
    const onDay = obs.filter((row) => row.observedOn === day);
    const weight = onDay.filter((row) => row.kind === 'weight' && row.value !== null).at(-1);
    return {
      day,
      mealLogged: onDay.some((row) => row.kind === 'meal_day'),
      waterLogged: onDay.some((row) => row.kind === 'water_day'),
      sessionCompleted: onDay.some((row) => row.kind === 'session_completed'),
      supplementTaken: onDay.some((row) => row.kind === 'supplement_taken'),
      activityLogged: onDay.some((row) => row.kind === 'activity_minutes' || row.kind === 'steps'),
      weightGrams: weight?.value ?? null,
    };
  });
}

function weekOfMonday(day: string): string {
  const d = new Date(`${day}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export type AssembleMemberStateInput = {
  goals: readonly string[];
  currentProgramId: string | null;
  nutritionPhase: string | null;
  windowDays: number;
  asOfDay: string;
  timeZone: string;
  observations?: readonly ValidatedObservation[];
  events?: readonly RawMemberEvent[];
  openCoachingQuestions?: readonly string[];
  safetyFlags?: readonly string[];
  lastHumanReviewAt?: string | null;
  pendingRecommendations?: readonly PendingRecommendationRef[];
};

/** Build MemberState from validated observations / normalized events — never invents missing adherence. */
export function assembleMemberState(input: AssembleMemberStateInput): MemberState {
  if (!Number.isSafeInteger(input.windowDays) || input.windowDays < 1 || input.windowDays > 90) {
    throw new DomainError('INVALID_WINDOW', 'Member state window must be 1–90 days');
  }
  if (!ISO_DAY.test(input.asOfDay)) {
    throw new DomainError('INVALID_OBSERVATION_DAY', 'asOfDay must be YYYY-MM-DD');
  }

  let duplicatesDropped = 0;
  let supersededDropped = 0;
  let observations: ValidatedObservation[];
  if (input.events !== undefined) {
    const normalized = normalizeMemberEvents(input.events);
    duplicatesDropped = normalized.duplicatesDropped;
    supersededDropped = normalized.supersededDropped;
    observations = observationsFromEvents(normalized.events, input.timeZone);
  } else {
    observations = (input.observations ?? []).map(assertValidatedObservation);
  }

  const windowStartDays = enumerateDays(input.asOfDay, input.windowDays);
  const windowSet = new Set(windowStartDays);
  const inWindow = observations.filter((row) => windowSet.has(row.observedOn));

  // Silence / missing logs never imply confirmed non-adherence (P1-STATE-01 / safety S-02).
  const adherence: AdherenceSummary = {
    windowDays: input.windowDays,
    mealDaysLogged: uniqueDays(inWindow, 'meal_day'),
    waterDaysLogged: uniqueDays(inWindow, 'water_day'),
    sessionsCompleted: uniqueDays(inWindow, 'session_completed'),
    supplementDaysLogged: uniqueDays(inWindow, 'supplement_taken'),
    activityDaysLogged: new Set(
      inWindow.filter((row) => row.kind === 'activity_minutes' || row.kind === 'steps').map((row) => row.observedOn),
    ).size,
    confirmedNonAdherence: false,
  };

  const dataCompletenessBps = completenessBps(adherence);
  const weightSamples = inWindow.filter((row) => row.kind === 'weight').length;
  const notes: string[] = [];
  if (!ENERGY_POLICY.approvedForPaidCoaching) {
    notes.push('energy_policy_unapproved_for_paid_coaching');
    notes.push('nutrition_adaptations_propose_only');
  }
  notes.push('missing_logs_are_unknown_not_non_adherence');

  const daily = buildDailySlices(windowStartDays, inWindow);
  const weekOf = weekOfMonday(input.asOfDay);
  const weekDays = daily.filter((row) => row.day >= weekOf && row.day <= input.asOfDay);
  const weekWeights = inWindow.filter((row) => row.kind === 'weight' && row.observedOn >= weekOf);
  const weekly: WeeklyStateSlice = {
    weekOf,
    mealDaysLogged: weekDays.filter((row) => row.mealLogged).length,
    waterDaysLogged: weekDays.filter((row) => row.waterLogged).length,
    sessionsCompleted: weekDays.filter((row) => row.sessionCompleted).length,
    weightTrendGrams: weightTrendGramsPerWeek(weekWeights),
  };

  return {
    schemaVersion: 2,
    asOfDay: input.asOfDay,
    timeZone: input.timeZone,
    goals: input.goals,
    currentProgramId: input.currentProgramId,
    nutritionPhase: input.nutritionPhase,
    adherence,
    weightTrendGramsPerWeek: weightTrendGramsPerWeek(inWindow),
    dataCompletenessBps,
    confidence: confidenceFromCompleteness(dataCompletenessBps, weightSamples),
    openCoachingQuestions: input.openCoachingQuestions ?? [],
    safetyFlags: input.safetyFlags ?? [],
    pendingRecommendations: input.pendingRecommendations ?? [],
    lastHumanReviewAt: input.lastHumanReviewAt ?? null,
    policyNotes: notes,
    daily,
    weekly,
    sleepLoggingAvailable: false,
    eventCounts: {
      accepted: inWindow.length,
      duplicatesDropped,
      supersededDropped,
    },
  };
}
