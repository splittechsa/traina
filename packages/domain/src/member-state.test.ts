import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  assembleMemberState,
  assertValidatedObservation,
  calendarDayInTimeZone,
  normalizeMemberEvents,
  type RawMemberEvent,
  type ValidatedObservation,
} from './member-state.js';

const obs = (partial: Partial<ValidatedObservation> & Pick<ValidatedObservation, 'kind' | 'observedOn'>): ValidatedObservation =>
  assertValidatedObservation({
    value: null,
    provenance: 'self_reported',
    confidenceBps: 8_000,
    ...partial,
  });

function event(partial: Partial<RawMemberEvent> & Pick<RawMemberEvent, 'eventId' | 'eventType' | 'occurredAt'>): RawMemberEvent {
  return {
    memberId: 'user-1',
    recordedAt: partial.occurredAt,
    source: 'test',
    schemaVersion: 1,
    confidenceBps: 8_000,
    provenance: 'self_reported',
    payload: {},
    ...partial,
  };
}

describe('MemberState engine (P1-STATE-01)', () => {
  it('rejects invalid observation days', () => {
    expect(() => assertValidatedObservation(obs({ kind: 'meal_day', observedOn: '06-01-2026' }))).toThrow(DomainError);
  });

  it('maps instants to Asia/Riyadh calendar days across UTC midnight', () => {
    // 2026-06-01 21:00 UTC = 2026-06-02 00:00 in Riyadh (UTC+3)
    expect(calendarDayInTimeZone('2026-06-01T21:00:00.000Z', 'Asia/Riyadh')).toBe('2026-06-02');
    expect(calendarDayInTimeZone('2026-06-01T20:59:00.000Z', 'Asia/Riyadh')).toBe('2026-06-01');
  });

  it('dedupes duplicate event ids and applies corrections (supersedes)', () => {
    const normalized = normalizeMemberEvents([
      event({
        eventId: 'e1',
        eventType: 'weight',
        occurredAt: '2026-06-01T08:00:00.000Z',
        recordedAt: '2026-06-01T08:00:00.000Z',
        payload: { observedOn: '2026-06-01', value: 90_000 },
      }),
      event({
        eventId: 'e1',
        eventType: 'weight',
        occurredAt: '2026-06-01T08:00:00.000Z',
        recordedAt: '2026-06-01T09:00:00.000Z',
        payload: { observedOn: '2026-06-01', value: 90_500 },
      }),
      event({
        eventId: 'e2',
        eventType: 'weight',
        occurredAt: '2026-06-02T08:00:00.000Z',
        recordedAt: '2026-06-02T10:00:00.000Z',
        supersedesEventId: 'e1',
        payload: { observedOn: '2026-06-02', value: 89_800 },
      }),
    ]);
    expect(normalized.duplicatesDropped).toBe(1);
    expect(normalized.supersededDropped).toBe(1);
    expect(normalized.events).toHaveLength(1);
    expect(normalized.events[0]?.eventId).toBe('e2');
  });

  it('orders out-of-order delayed sync by occurredAt', () => {
    const normalized = normalizeMemberEvents([
      event({ eventId: 'late', eventType: 'meal_day', occurredAt: '2026-06-01T12:00:00.000Z', recordedAt: '2026-06-03T12:00:00.000Z' }),
      event({ eventId: 'early', eventType: 'meal_day', occurredAt: '2026-06-02T12:00:00.000Z', recordedAt: '2026-06-02T12:00:00.000Z' }),
    ]);
    expect(normalized.events.map((row) => row.eventId)).toEqual(['late', 'early']);
  });

  it('does not treat missing meal logs as confirmed non-adherence', () => {
    const state = assembleMemberState({
      goals: ['fat_loss'],
      currentProgramId: 'prog-1',
      nutritionPhase: 'cutting',
      windowDays: 14,
      asOfDay: '2026-06-14',
      timeZone: 'Asia/Riyadh',
      observations: [
        obs({ kind: 'meal_day', observedOn: '2026-06-01' }),
        obs({ kind: 'water_day', observedOn: '2026-06-01' }),
        obs({ kind: 'weight', observedOn: '2026-06-01', value: 90_000 }),
        obs({ kind: 'weight', observedOn: '2026-06-08', value: 89_500 }),
      ],
    });
    expect(state.adherence.mealDaysLogged).toBe(1);
    expect(state.adherence.confirmedNonAdherence).toBe(false);
    expect(state.confidence).toBe('insufficient');
    expect(state.pendingRecommendations).toEqual([]);
    expect(state.policyNotes).toContain('nutrition_adaptations_propose_only');
    expect(state.sleepLoggingAvailable).toBe(false);
    expect(state.daily).toHaveLength(14);
    expect(state.weekly.weekOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('projects large histories within a bounded window without inventing adherence', () => {
    const asOfDay = '2026-09-30';
    const observations: ValidatedObservation[] = [];
    for (let i = 0; i < 400; i += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      observations.push(obs({ kind: 'meal_day', observedOn: day }));
      observations.push(obs({ kind: 'water_day', observedOn: day }));
      if (i % 3 === 0) observations.push(obs({ kind: 'session_completed', observedOn: day }));
      if (i % 7 === 0) observations.push(obs({ kind: 'weight', observedOn: day, value: 90_000 - i * 10 }));
    }
    const started = Date.now();
    const state = assembleMemberState({
      goals: ['fat_loss'],
      currentProgramId: 'prog-1',
      nutritionPhase: 'cutting',
      windowDays: 90,
      asOfDay,
      timeZone: 'UTC',
      observations,
    });
    expect(Date.now() - started).toBeLessThan(250);
    expect(state.daily).toHaveLength(90);
    expect(state.adherence.confirmedNonAdherence).toBe(false);
    expect(state.adherence.mealDaysLogged).toBeLessThanOrEqual(90);
  });

  it('raises confidence when logging is denser', () => {
    const days = Array.from({ length: 12 }, (_, i) => `2026-06-${String(i + 1).padStart(2, '0')}`);
    const observations = days.flatMap((on) => [
      obs({ kind: 'meal_day', observedOn: on }),
      obs({ kind: 'water_day', observedOn: on }),
      obs({ kind: 'session_completed', observedOn: on }),
    ]);
    observations.push(obs({ kind: 'weight', observedOn: '2026-06-01', value: 90_000 }));
    observations.push(obs({ kind: 'weight', observedOn: '2026-06-12', value: 89_200 }));
    const state = assembleMemberState({
      goals: ['fat_loss'],
      currentProgramId: null,
      nutritionPhase: 'cutting',
      windowDays: 14,
      asOfDay: '2026-06-14',
      timeZone: 'UTC',
      observations,
    });
    expect(state.dataCompletenessBps).toBeGreaterThanOrEqual(7_500);
    expect(state.confidence).toBe('high');
    expect(state.weightTrendGramsPerWeek).not.toBeNull();
  });
});
