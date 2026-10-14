// The shape returned by GET /v1/progress (services/api/src/member/store.ts#progressFor,
// consumed by apps/mobile/app/progress.tsx, weight.tsx and training.tsx).
//
// Fields are intentionally left in the same snake_case shape the underlying SQL rows already
// use, rather than being camelCased here. The mobile client already reads this exact wire
// format (weight_grams, recorded_on, exercise_id, load_grams, achieved_at) and there is no way
// to exercise an end-to-end rename safely in this environment (no device shell, no simulator).
// This type pins and documents the existing contract instead of silently changing it; a future
// pass that wants to camelCase the wire format should update the mobile reads in the same
// change and verify on a device before shipping it.

export type ProgressWeightRow = {
  id: string;
  weight_grams: number;
  recorded_on: string;
  source: string;
};

export type ProgressPersonalRecordRow = {
  id: string;
  exercise_id: string;
  load_grams: number;
  reps: number;
  achieved_at: string;
};

// Best set per exercise per completed session, bounded to the last 120 days. Deliberately not
// sourced from personal_records, which only ever keeps a single current-best row per exercise
// (it is deleted and re-inserted in place on every new PR — see mutateSession's 'complete'
// branch) — this is the only place a real, multi-point exercise progression can come from.
export type ProgressExerciseSetRow = {
  exercise_id: string;
  date: string;
  load_grams: number;
  reps: number;
};

export type ProgressSnapshot = {
  weights: readonly ProgressWeightRow[];
  personalRecords: readonly ProgressPersonalRecordRow[];
  completedWorkouts: number;
  // ISO timestamps of completed workout sessions in the last 120 days. Bucketed into weeks
  // client-side (Riyadh-anchored day math, matching the rest of the app) to drive the
  // 8-week training-frequency chart.
  completedSessionDates: readonly string[];
  exerciseSets: readonly ProgressExerciseSetRow[];
};
