import type { DiarySummary } from './nutrition.js';
import type { WorkoutSession } from './training.js';

export type HomeSection<T> = { status: 'ready'; data: T } | { status: 'unavailable'; reason: string };

export type HomeDashboard = {
  greeting: string;
  date: string;
  goal: HomeSection<string>;
  phase: HomeSection<string>;
  adherence: HomeSection<{ completed: number; planned: number; ratioBps: number | null }>;
  todayWorkout: HomeSection<{
    id: string;
    name: string;
    discipline: string;
    exerciseCount: number;
    status: WorkoutSession['status'];
  }>;
  nutrition: HomeSection<DiarySummary>;
  gym: HomeSection<{ name: string }>;
  coachingInsight: HomeSection<{ source: 'approved_rules'; flags: readonly string[] }>;
};

export function hourInTimeZone(isoUtc: string, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date(isoUtc));
  return Number(hour);
}

export function greetingFor(locale: 'ar' | 'en', hour: number, displayName: string | null): string {
  const period = hour < 12 ? 'morning' : 'evening';
  const base =
    locale === 'ar'
      ? period === 'morning'
        ? 'صباح الخير'
        : 'مساء الخير'
      : period === 'morning'
        ? 'Good morning'
        : hour < 17
          ? 'Good afternoon'
          : 'Good evening';
  if (displayName === null || displayName.trim().length === 0) {
    return base;
  }
  const separator = locale === 'ar' ? '، ' : ', ';
  return `${base}${separator}${displayName.trim()}`;
}

export function adherenceRatioBps(completed: number, planned: number): number | null {
  if (!Number.isSafeInteger(completed) || !Number.isSafeInteger(planned) || completed < 0 || planned < 0) {
    return null;
  }
  if (planned === 0) {
    return null;
  }
  return Number((BigInt(completed) * 10_000n) / BigInt(planned));
}

export function assembleHomeDashboard(input: {
  asOf: string;
  locale: 'ar' | 'en';
  displayName: string | null;
  goal: string | null;
  phase: string | null;
  adherence: { completed: number; planned: number } | null;
  today: WorkoutSession | null;
  nutrition: DiarySummary | null;
  gymName: string | null;
  approvedRuleFlags: readonly string[] | null;
}): HomeDashboard {
  const hour = hourInTimeZone(input.asOf, 'Asia/Riyadh');
  return {
    greeting: greetingFor(input.locale, hour, input.displayName),
    date: input.asOf,
    goal: input.goal === null ? { status: 'unavailable', reason: 'no_active_goal' } : { status: 'ready', data: input.goal },
    phase: input.phase === null ? { status: 'unavailable', reason: 'no_training_phase' } : { status: 'ready', data: input.phase },
    adherence:
      input.adherence === null
        ? { status: 'unavailable', reason: 'no_adherence_record' }
        : {
            status: 'ready',
            data: {
              completed: input.adherence.completed,
              planned: input.adherence.planned,
              ratioBps: adherenceRatioBps(input.adherence.completed, input.adherence.planned),
            },
          },
    todayWorkout:
      input.today === null
        ? { status: 'unavailable', reason: 'no_scheduled_workout' }
        : {
            status: 'ready',
            data: {
              id: input.today.id,
              name: input.today.name,
              discipline: input.today.discipline,
              exerciseCount: input.today.plannedExercises.length,
              status: input.today.status,
            },
          },
    nutrition:
      input.nutrition === null
        ? { status: 'unavailable', reason: 'no_diary' }
        : { status: 'ready', data: input.nutrition },
    gym: input.gymName === null ? { status: 'unavailable', reason: 'no_partner_gym' } : { status: 'ready', data: { name: input.gymName } },
    coachingInsight:
      input.approvedRuleFlags === null
        ? { status: 'unavailable', reason: 'model_provider_not_configured' }
        : { status: 'ready', data: { source: 'approved_rules', flags: input.approvedRuleFlags } },
  };
}
