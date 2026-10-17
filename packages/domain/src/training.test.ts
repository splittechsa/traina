import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  abandonWorkout,
  applyOfflineSet,
  completeWorkout,
  logSet,
  pauseWorkout,
  personalRecordsFromSessions,
  resumeWorkout,
  scheduleWorkout,
  startWorkout,
} from './training.js';

const planned = [
  {
    exerciseId: 'squat',
    prescription: { kind: 'strength' as const, sets: 3, reps: 5, restSeconds: 180, loadGrams: 100_000, rpeTenths: 80 },
  },
];

function session() {
  return startWorkout(
    scheduleWorkout({
      id: 'session-1',
      userId: 'user-1',
      name: 'Lower strength',
      discipline: 'powerlifting',
      exercises: planned,
      scheduledFor: '2026-06-01T15:00:00.000Z',
    }),
    '2026-06-01T15:05:00.000Z',
  );
}

const set = {
  id: 'set-1',
  exerciseId: 'squat',
  setIndex: 1,
  reps: 5,
  loadGrams: 100_000,
  rpeTenths: 80,
  completedAt: '2026-06-01T15:10:00.000Z',
};

describe('workout sessions', () => {
  it('starts an already running session without changing it', () => {
    const current = session();
    expect(startWorkout(current, '2026-06-01T15:06:00.000Z')).toEqual(current);
  });

  it('resumes a paused session when start is sent again', () => {
    const paused = pauseWorkout(session(), '2026-06-01T15:08:00.000Z');
    const resumed = startWorkout(paused, '2026-06-01T15:09:00.000Z');
    expect(resumed.status).toBe('in_progress');
    expect(resumed.pauses[0]?.resumedAt).toBe('2026-06-01T15:09:00.000Z');
  });

  it('completes a timed session without logged sets', () => {
    const finished = completeWorkout(session(), '2026-06-01T15:20:00.000Z');
    expect(finished.summary.setCount).toBe(0);
    expect(finished.summary.exerciseCount).toBe(0);
    expect(finished.summary.durationSeconds).toBe(15 * 60);
  });

  it('records only logged sets and subtracts paused time', () => {
    let current = logSet(session(), set);
    current = pauseWorkout(current, '2026-06-01T15:12:00.000Z');
    current = resumeWorkout(current, '2026-06-01T15:14:00.000Z');
    const finished = completeWorkout(current, '2026-06-01T15:20:00.000Z');
    expect(finished.summary.setCount).toBe(1);
    expect(finished.summary.totalReps).toBe(5);
    expect(finished.summary.durationSeconds).toBe(13 * 60);
  });

  it('derives personal records only from completed sessions', () => {
    const active = logSet(session(), set);
    expect(personalRecordsFromSessions([active])).toEqual([]);
    const finished = completeWorkout(active, '2026-06-01T15:30:00.000Z').session;
    const heavier = completeWorkout(
      logSet(session(), { ...set, id: 'set-2', loadGrams: 110_000, completedAt: '2026-06-08T15:10:00.000Z' }),
      '2026-06-08T15:30:00.000Z',
    ).session;
    heavier.id = 'session-2';
    const records = personalRecordsFromSessions([finished, heavier]);
    expect(records).toEqual([
      expect.objectContaining({ exerciseId: 'squat', loadGrams: 110_000, sessionId: 'session-2' }),
    ]);
  });

  it('does not apply offline logs onto a completed server session', () => {
    const finished = completeWorkout(logSet(session(), set), '2026-06-01T15:30:00.000Z').session;
    const resolution = applyOfflineSet(finished, { ...set, id: 'set-offline', loadGrams: 140_000 });
    expect(resolution.disposition).toBe('conflict');
    expect(finished.sets).toHaveLength(1);
  });

  it('replays an identical offline set and rejects a conflicting payload', () => {
    const active = logSet(session(), set);
    expect(applyOfflineSet(active, set).disposition).toBe('replay');
    expect(applyOfflineSet(active, { ...set, reps: 6 }).disposition).toBe('conflict');
  });

  it('rejects a CrossFit prescription on a powerlifting session', () => {
    expect(() =>
      scheduleWorkout({
        id: 'session-2',
        userId: 'user-1',
        name: 'Bad mix',
        discipline: 'powerlifting',
        exercises: [{ exerciseId: 'burpee', prescription: { kind: 'crossfit', format: 'amrap', timeCapSeconds: 600, rounds: null } }],
        scheduledFor: '2026-06-01T15:00:00.000Z',
      }),
    ).toThrow(DomainError);
  });

  it('abandons an empty session without marking it complete', () => {
    const abandoned = abandonWorkout(session(), '2026-06-01T15:06:00.000Z');
    expect(abandoned.status).toBe('abandoned');
    expect(personalRecordsFromSessions([abandoned])).toEqual([]);
  });
});
