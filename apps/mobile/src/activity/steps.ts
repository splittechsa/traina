// Pure step-tracking helpers. Step counts themselves come from the phone's motion
// coprocessor (CoreMotion CMPedometer on iPhone via expo-sensors) — nothing here estimates
// steps. Distance is an estimate from stride length and is labelled as such in the UI.

export const DEFAULT_STEP_GOAL = 8000;
export const STEP_GOAL_RANGE = { min: 2000, max: 30000, step: 500 } as const;

/** Local-midnight start of the day `offset` days before `now` (0 = today). */
export function startOfLocalDay(now: Date, offset = 0): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 0, 0, 0, 0);
  return day;
}

/** [start, end) ranges for the last `count` local days, oldest first; today's ends at `now`. */
export function lastDays(now: Date, count: number): { start: Date; end: Date }[] {
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    const start = startOfLocalDay(now, offset);
    const end = offset === 0 ? now : startOfLocalDay(now, offset - 1);
    return { start, end };
  });
}

/** Average stride as a fraction of height (common pedometer heuristic). Default 0.78 m. */
export function strideMeters(heightCm?: number | null): number {
  if (heightCm === undefined || heightCm === null || !Number.isFinite(heightCm) || heightCm < 120 || heightCm > 230) return 0.78;
  return (heightCm * 0.414) / 100;
}

export function estimateDistanceKm(steps: number, heightCm?: number | null): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return Math.round(((steps * strideMeters(heightCm)) / 1000) * 100) / 100;
}

export function goalProgress(steps: number, goal: number): number {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  return Math.max(0, Math.min(1, steps / goal));
}

/** Consecutive days (ending yesterday or today) that met the goal. */
export function goalStreak(daily: readonly number[], goal: number): number {
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    const value = daily[i] ?? 0;
    if (value >= goal) streak += 1;
    else if (i === daily.length - 1) continue; // today still in progress doesn't break the streak
    else break;
  }
  return streak;
}

export function averageSteps(daily: readonly number[]): number {
  const valid = daily.filter((value) => Number.isFinite(value) && value >= 0);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}
