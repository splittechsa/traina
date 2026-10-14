export type PlannedRequest =
  | {
      exerciseId: string;
      prescription: {
        kind: 'strength';
        sets: number;
        reps: number;
        restSeconds: number;
        loadGrams: null;
        rpeTenths: null;
      };
    }
  | {
      exerciseId: string;
      prescription: {
        kind: 'crossfit';
        format: 'amrap' | 'emom' | 'for_time';
        timeCapSeconds: number;
        rounds: number;
      };
    }
  | {
      exerciseId: string;
      prescription: {
        kind: 'calisthenics';
        progression: string;
        targetReps: number;
        holdSeconds: number | null;
      };
    };

export function plannedExercises(input: {
  discipline: string;
  exerciseIds: readonly string[];
  sets: number;
  reps: number;
  format: 'amrap' | 'emom' | 'for_time';
  minutes: number;
  rounds: number;
  progression: string;
  holdSeconds: number | null;
}): PlannedRequest[] {
  return input.exerciseIds.map((exerciseId) => {
    if (input.discipline === 'crossfit') {
      return {
        exerciseId,
        prescription: {
          kind: 'crossfit',
          format: input.format,
          timeCapSeconds: input.minutes * 60,
          rounds: input.rounds,
        },
      };
    }
    if (input.discipline === 'calisthenics') {
      return {
        exerciseId,
        prescription: {
          kind: 'calisthenics',
          progression: input.progression,
          targetReps: input.reps,
          holdSeconds: input.holdSeconds,
        },
      };
    }
    return {
      exerciseId,
      prescription: {
        kind: 'strength',
        sets: input.sets,
        reps: input.reps,
        restSeconds: 90,
        loadGrams: null,
        rpeTenths: null,
      },
    };
  });
}
