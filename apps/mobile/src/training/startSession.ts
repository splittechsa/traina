import { apiRequest } from '../api/client';
import { plannedExercises, type PlannedRequest } from './plan';
import { disciplineForExercise, type LibraryExercise } from './library';

export async function startWorkoutNow(input: {
  name: string;
  discipline: string;
  exercises: PlannedRequest[];
}): Promise<string> {
  const created = await apiRequest<{ session: { id: string } }>('/v1/training/sessions', {
    method: 'POST',
    body: {
      name: input.name,
      discipline: input.discipline,
      scheduledFor: new Date().toISOString(),
      exercises: input.exercises,
      startNow: true,
    },
  });
  return created.session.id;
}

export function quickPlanFor(exercises: readonly LibraryExercise[]): { discipline: string; plan: PlannedRequest[] } {
  const lead = exercises[0];
  const discipline = lead === undefined ? 'general_fitness' : disciplineForExercise(lead);
  return {
    discipline,
    plan: plannedExercises({
      discipline,
      exerciseIds: exercises.map((item) => item.id),
      sets: 3,
      reps: 8,
      format: 'amrap',
      minutes: 12,
      rounds: 5,
      progression: 'full',
      holdSeconds: null,
    }),
  };
}
