import { DomainError } from './errors.js';

export const ACTIVITY_KINDS = [
  'walking',
  'running',
  'cycling',
  'football',
  'basketball',
  'tennis',
  'boxing',
  'swimming',
  'dance',
  'elliptical',
  'jump_rope',
  'hiit',
  'other',
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const DEFAULT_WATER_GOAL_ML = 2500;

export function isActivityKind(value: string): value is ActivityKind {
  return (ACTIVITY_KINDS as readonly string[]).includes(value);
}

export function isMealSlot(value: string | null | undefined): value is MealSlot {
  return value !== null && value !== undefined && (MEAL_SLOTS as readonly string[]).includes(value);
}

export function mealSlotEnergyKcal(
  entries: readonly { mealSlot?: string | null; energyKcal: number }[],
  slot: MealSlot,
): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.mealSlot === slot) total += entry.energyKcal;
  }
  return total;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDay(value: string): boolean {
  const match = ISO_DAY.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function previousCalendarDay(day: string): string {
  if (!isIsoDay(day)) {
    throw new DomainError('INVALID_DATE', 'Day must be YYYY-MM-DD');
  }
  const match = ISO_DAY.exec(day);
  const date = new Date(Date.UTC(Number(match?.[1]), Number(match?.[2]) - 1, Number(match?.[3])));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function assertDiaryCopy(from: string, to: string): void {
  if (!isIsoDay(from) || !isIsoDay(to)) {
    throw new DomainError('INVALID_DATE', 'Day must be YYYY-MM-DD');
  }
  if (from === to) {
    throw new DomainError('SAME_DAY_COPY', 'Cannot copy a day onto itself');
  }
}

export function waterMillilitersTotal(entries: readonly { milliliters: number }[]): number {
  let total = 0;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.milliliters) || entry.milliliters < 0) {
      throw new DomainError('INVALID_WATER', 'Water volume must be a non-negative integer');
    }
    total += entry.milliliters;
  }
  return total;
}

export function assertWaterServing(milliliters: number): void {
  if (!Number.isSafeInteger(milliliters) || milliliters < 50 || milliliters > 2000) {
    throw new DomainError('INVALID_WATER', 'A water serving must be between 50 ml and 2 L');
  }
}

export function assertActivityDuration(seconds: number): void {
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 8 * 3600) {
    throw new DomainError('INVALID_ACTIVITY', 'Activity duration must be between 1 minute and 8 hours');
  }
}

export function assertMeasurementMm(value: number | null): void {
  if (value === null) return;
  if (!Number.isSafeInteger(value) || value < 200 || value > 2500) {
    throw new DomainError('INVALID_MEASUREMENT', 'A circumference must be between 20 cm and 250 cm');
  }
}

export function assertSupplementName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean.length < 2 || clean.length > 40) {
    throw new DomainError('INVALID_SUPPLEMENT', 'A supplement name must be 2 to 40 characters');
  }
  return clean;
}

/** Logged facts a personal-training brief may read. Missing values stay missing. */
export type CoachingFactSheet = {
  waterMl: number;
  waterGoalMl: number;
  mealCount: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  todaySessionStatus: 'none' | 'scheduled' | 'in_progress' | 'completed';
  supplementsDue: readonly string[];
  supplementsLogged: readonly string[];
  /** Optional: days with any water log in the last window (AI discipline). */
  waterDaysLoggedLast14?: number | null;
  /** Optional: true when a weekly nutrition proposal wants member attention. */
  nutritionPlanAlert?: boolean;
};

export type CoachingDirective = {
  key:
    | 'water_low'
    | 'water_streak_missed'
    | 'meals_empty'
    | 'plan_needs_review'
    | 'sessions_behind'
    | 'session_live'
    | 'supplement_due'
    | 'day_held';
  status: 'act' | 'ok';
  href: 'water' | 'nutrition' | 'training' | 'supplements' | 'home' | 'macros';
  name: string | null;
};

/**
 * Turns today's logs into coaching moves. Does not invent electrolytes, burned
 * calories, or a supplement the member did not put on their own list.
 */
export function coachingDirectives(facts: CoachingFactSheet): CoachingDirective[] {
  const out: CoachingDirective[] = [];
  if (facts.waterGoalMl > 0 && facts.waterMl * 2 < facts.waterGoalMl) {
    out.push({ key: 'water_low', status: 'act', href: 'water', name: null });
  }
  if (
    facts.waterDaysLoggedLast14 !== undefined &&
    facts.waterDaysLoggedLast14 !== null &&
    Number.isSafeInteger(facts.waterDaysLoggedLast14) &&
    facts.waterDaysLoggedLast14 < 7
  ) {
    out.push({ key: 'water_streak_missed', status: 'act', href: 'water', name: null });
  }
  if (facts.nutritionPlanAlert === true) {
    out.push({ key: 'plan_needs_review', status: 'act', href: 'macros', name: null });
  }
  if (facts.mealCount === 0) {
    out.push({ key: 'meals_empty', status: 'act', href: 'nutrition', name: null });
  }
  if (facts.todaySessionStatus === 'in_progress') {
    out.push({ key: 'session_live', status: 'act', href: 'training', name: null });
  } else if (facts.sessionsPlanned > 0 && facts.sessionsCompleted < facts.sessionsPlanned && facts.todaySessionStatus !== 'completed') {
    out.push({ key: 'sessions_behind', status: 'act', href: 'training', name: null });
  }
  const taken = new Set(facts.supplementsLogged.map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0));
  for (const name of facts.supplementsDue) {
    const clean = name.trim();
    if (clean.length === 0) continue;
    if (!taken.has(clean.toLowerCase())) {
      out.push({ key: 'supplement_due', status: 'act', href: 'supplements', name: clean });
    }
  }
  if (out.length === 0) {
    out.push({ key: 'day_held', status: 'ok', href: 'home', name: null });
  }
  return out;
}
