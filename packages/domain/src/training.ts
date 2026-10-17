import { DomainError, assertIsoDateTime, assertSafeNonNegativeInteger } from './errors.js';

export const DISCIPLINES = [
  'bodybuilding',
  'powerlifting',
  'crossfit',
  'calisthenics',
  'functional_training',
  'general_fitness',
  'hybrid',
] as const;

export type Discipline = (typeof DISCIPLINES)[number];
export type SessionStatus = 'scheduled' | 'in_progress' | 'paused' | 'completed' | 'abandoned';

export type StrengthPrescription = {
  kind: 'strength';
  sets: number;
  reps: number;
  restSeconds: number;
  loadGrams: number | null;
  rpeTenths: number | null;
};

export type CrossFitPrescription = {
  kind: 'crossfit';
  format: 'amrap' | 'emom' | 'for_time';
  timeCapSeconds: number | null;
  rounds: number | null;
};

export type CalisthenicsPrescription = {
  kind: 'calisthenics';
  progression: string;
  targetReps: number | null;
  holdSeconds: number | null;
};

export type Prescription = StrengthPrescription | CrossFitPrescription | CalisthenicsPrescription;

export type PlannedExercise = {
  exerciseId: string;
  prescription: Prescription;
};

export type WorkoutSet = {
  id: string;
  exerciseId: string;
  setIndex: number;
  reps: number;
  loadGrams: number;
  rpeTenths: number | null;
  completedAt: string;
};

export type PauseInterval = {
  pausedAt: string;
  resumedAt: string | null;
};

export type WorkoutSession = {
  id: string;
  userId: string;
  name: string;
  discipline: Discipline;
  status: SessionStatus;
  plannedExercises: readonly PlannedExercise[];
  sets: readonly WorkoutSet[];
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  pauses: readonly PauseInterval[];
};

export type WorkoutSummary = {
  sessionId: string;
  status: 'completed';
  setCount: number;
  exerciseCount: number;
  totalReps: number;
  durationSeconds: number;
};

export type PersonalRecord = {
  exerciseId: string;
  loadGrams: number;
  reps: number;
  achievedAt: string;
  sessionId: string;
  setId: string;
};

function assertPrescription(discipline: Discipline, prescription: Prescription): void {
  if (prescription.kind === 'strength') {
    assertSafeNonNegativeInteger(prescription.sets, 'INVALID_PRESCRIPTION');
    assertSafeNonNegativeInteger(prescription.reps, 'INVALID_PRESCRIPTION');
    assertSafeNonNegativeInteger(prescription.restSeconds, 'INVALID_PRESCRIPTION');
    if (prescription.sets < 1) {
      throw new DomainError('INVALID_PRESCRIPTION', 'Strength work requires at least one set');
    }
    if (discipline === 'crossfit') {
      throw new DomainError('PRESCRIPTION_DISCIPLINE_MISMATCH', 'CrossFit sessions use a CrossFit prescription');
    }
    return;
  }
  if (prescription.kind === 'crossfit') {
    if (discipline !== 'crossfit' && discipline !== 'hybrid') {
      throw new DomainError('PRESCRIPTION_DISCIPLINE_MISMATCH', 'This discipline does not use a CrossFit prescription');
    }
    return;
  }
  if (discipline !== 'calisthenics' && discipline !== 'hybrid') {
    throw new DomainError('PRESCRIPTION_DISCIPLINE_MISMATCH', 'This discipline does not use a calisthenics prescription');
  }
  if (prescription.progression.trim().length === 0) {
    throw new DomainError('INVALID_PRESCRIPTION', 'Calisthenics progression is required');
  }
}

function assertSet(set: WorkoutSet): void {
  if (set.id.trim().length === 0 || set.exerciseId.trim().length === 0) {
    throw new DomainError('INVALID_SET', 'Set id and exercise id are required');
  }
  assertSafeNonNegativeInteger(set.setIndex, 'INVALID_SET');
  assertSafeNonNegativeInteger(set.reps, 'INVALID_SET');
  assertSafeNonNegativeInteger(set.loadGrams, 'INVALID_SET');
  if (set.setIndex < 1) {
    throw new DomainError('INVALID_SET', 'Set index starts at 1');
  }
  if (set.rpeTenths !== null) {
    assertSafeNonNegativeInteger(set.rpeTenths, 'INVALID_SET');
    if (set.rpeTenths > 100) {
      throw new DomainError('INVALID_SET', 'RPE tenths cannot exceed 100');
    }
  }
  assertIsoDateTime(set.completedAt, 'INVALID_SET');
}

export function scheduleWorkout(input: {
  id: string;
  userId: string;
  name: string;
  discipline: Discipline;
  exercises: readonly PlannedExercise[];
  scheduledFor: string;
}): WorkoutSession {
  if (input.id.trim().length === 0 || input.userId.trim().length === 0 || input.name.trim().length === 0) {
    throw new DomainError('INVALID_SESSION', 'Session id, user, and name are required');
  }
  if (!(DISCIPLINES as readonly string[]).includes(input.discipline)) {
    throw new DomainError('INVALID_DISCIPLINE', 'Unsupported discipline');
  }
  if (input.exercises.length === 0) {
    throw new DomainError('INVALID_SESSION', 'A scheduled workout needs explicit exercises');
  }
  assertIsoDateTime(input.scheduledFor, 'INVALID_SCHEDULE');
  for (const exercise of input.exercises) {
    if (exercise.exerciseId.trim().length === 0) {
      throw new DomainError('INVALID_SESSION', 'Exercise id is required');
    }
    assertPrescription(input.discipline, exercise.prescription);
  }
  return {
    id: input.id,
    userId: input.userId,
    name: input.name.trim(),
    discipline: input.discipline,
    status: 'scheduled',
    plannedExercises: input.exercises,
    sets: [],
    scheduledFor: input.scheduledFor,
    startedAt: null,
    completedAt: null,
    pauses: [],
  };
}

export function startWorkout(session: WorkoutSession, at: string): WorkoutSession {
  assertIsoDateTime(at, 'INVALID_SESSION_TIME');
  if (session.status === 'in_progress' && session.startedAt !== null) {
    return session;
  }
  if (session.status === 'paused') {
    return resumeWorkout(session, at);
  }
  if (session.status !== 'scheduled') {
    throw new DomainError('INVALID_SESSION_STATE', 'Only a scheduled workout can start');
  }
  return { ...session, status: 'in_progress', startedAt: at };
}

export function pauseWorkout(session: WorkoutSession, at: string): WorkoutSession {
  assertIsoDateTime(at, 'INVALID_SESSION_TIME');
  if (session.status !== 'in_progress' || session.startedAt === null) {
    throw new DomainError('INVALID_SESSION_STATE', 'Only an in-progress workout can pause');
  }
  return {
    ...session,
    status: 'paused',
    pauses: [...session.pauses, { pausedAt: at, resumedAt: null }],
  };
}

export function resumeWorkout(session: WorkoutSession, at: string): WorkoutSession {
  assertIsoDateTime(at, 'INVALID_SESSION_TIME');
  if (session.status !== 'paused') {
    throw new DomainError('INVALID_SESSION_STATE', 'Only a paused workout can resume');
  }
  const open = session.pauses.findIndex((pause) => pause.resumedAt === null);
  if (open < 0) {
    throw new DomainError('INVALID_SESSION_STATE', 'Paused session has no open pause');
  }
  const pauses = session.pauses.map((pause, index) => (index === open ? { ...pause, resumedAt: at } : pause));
  return { ...session, status: 'in_progress', pauses };
}

export function logSet(session: WorkoutSession, set: WorkoutSet): WorkoutSession {
  if (session.status !== 'in_progress') {
    throw new DomainError('INVALID_SESSION_STATE', 'Sets can be logged only while the workout is in progress');
  }
  assertSet(set);
  if (session.sets.some((existing) => existing.id === set.id)) {
    throw new DomainError('DUPLICATE_SET', 'Set id already exists on this session');
  }
  return { ...session, sets: [...session.sets, set] };
}

function pausedSeconds(session: Pick<WorkoutSession, 'pauses'>, endedAt: string): number {
  let paused = 0;
  for (const pause of session.pauses) {
    const resumed = pause.resumedAt ?? endedAt;
    const delta = Math.floor((Date.parse(resumed) - Date.parse(pause.pausedAt)) / 1000);
    if (delta < 0) {
      throw new DomainError('INVALID_SESSION_TIME', 'Pause interval is negative');
    }
    paused += delta;
  }
  return paused;
}

export function workoutElapsedSeconds(
  session: Pick<WorkoutSession, 'startedAt' | 'completedAt' | 'pauses'>,
  at: string,
): number {
  if (session.startedAt === null) {
    return 0;
  }
  const endedAt = session.completedAt ?? at;
  const elapsed = Math.floor((Date.parse(endedAt) - Date.parse(session.startedAt)) / 1000) - pausedSeconds(session, endedAt);
  return elapsed < 0 ? 0 : elapsed;
}

export function completeWorkout(session: WorkoutSession, at: string): { session: WorkoutSession; summary: WorkoutSummary } {
  assertIsoDateTime(at, 'INVALID_SESSION_TIME');
  if (session.status !== 'in_progress' && session.status !== 'paused') {
    throw new DomainError('INVALID_SESSION_STATE', 'Only an active workout can be completed');
  }
  if (session.startedAt === null) {
    throw new DomainError('INVALID_SESSION_STATE', 'Workout has no start time');
  }
  const elapsed = Math.floor((Date.parse(at) - Date.parse(session.startedAt)) / 1000) - pausedSeconds(session, at);
  if (elapsed < 0) {
    throw new DomainError('INVALID_SESSION_TIME', 'Completion is before the workout started');
  }
  const completed: WorkoutSession = { ...session, status: 'completed', completedAt: at };
  return { session: completed, summary: summarizeCompleted(completed) };
}

export function abandonWorkout(session: WorkoutSession, at: string): WorkoutSession {
  assertIsoDateTime(at, 'INVALID_SESSION_TIME');
  if (session.status === 'completed' || session.status === 'abandoned') {
    throw new DomainError('INVALID_SESSION_STATE', 'Terminal workouts cannot be abandoned');
  }
  return { ...session, status: 'abandoned', completedAt: at };
}

function summarizeCompleted(session: WorkoutSession): WorkoutSummary {
  if (session.status !== 'completed' || session.startedAt === null || session.completedAt === null) {
    throw new DomainError('INVALID_SESSION_STATE', 'Summary requires a completed workout');
  }
  const exercises = new Set(session.sets.map((set) => set.exerciseId));
  return {
    sessionId: session.id,
    status: 'completed',
    setCount: session.sets.length,
    exerciseCount: exercises.size,
    totalReps: session.sets.reduce((sum, set) => sum + set.reps, 0),
    durationSeconds: workoutElapsedSeconds(session, session.completedAt),
  };
}

export function personalRecordsFromSessions(sessions: readonly WorkoutSession[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const session of sessions) {
    if (session.status !== 'completed') {
      continue;
    }
    for (const set of session.sets) {
      const current = best.get(set.exerciseId);
      const candidate: PersonalRecord = {
        exerciseId: set.exerciseId,
        loadGrams: set.loadGrams,
        reps: set.reps,
        achievedAt: set.completedAt,
        sessionId: session.id,
        setId: set.id,
      };
      if (current === undefined || isBetterRecord(candidate, current)) {
        best.set(set.exerciseId, candidate);
      }
    }
  }
  return [...best.values()];
}

function isBetterRecord(candidate: PersonalRecord, current: PersonalRecord): boolean {
  if (candidate.loadGrams !== current.loadGrams) {
    return candidate.loadGrams > current.loadGrams;
  }
  if (candidate.reps !== current.reps) {
    return candidate.reps > current.reps;
  }
  return Date.parse(candidate.achievedAt) < Date.parse(current.achievedAt);
}

export type OfflineResolution =
  | { disposition: 'applied'; session: WorkoutSession }
  | { disposition: 'replay'; session: WorkoutSession }
  | { disposition: 'conflict'; serverStatus: SessionStatus; command: 'log_set' };

export function applyOfflineSet(server: WorkoutSession, set: WorkoutSet): OfflineResolution {
  if (server.status === 'completed' || server.status === 'abandoned') {
    return { disposition: 'conflict', serverStatus: server.status, command: 'log_set' };
  }
  const existing = server.sets.find((item) => item.id === set.id);
  if (existing !== undefined) {
    const same =
      existing.reps === set.reps &&
      existing.loadGrams === set.loadGrams &&
      existing.exerciseId === set.exerciseId;
    if (same) {
      return { disposition: 'replay', session: server };
    }
    return { disposition: 'conflict', serverStatus: server.status, command: 'log_set' };
  }
  if (server.status !== 'in_progress') {
    return { disposition: 'conflict', serverStatus: server.status, command: 'log_set' };
  }
  return { disposition: 'applied', session: logSet(server, set) };
}
