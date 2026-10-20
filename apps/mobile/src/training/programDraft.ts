import type { ProgramDayDocument, StrengthSettings } from '@sahhti/domain';

export type StrengthInput = { sets: string; reps: string; restSeconds: string };
export type StrengthInputs = Record<string, StrengthInput>;
export function strengthInputKey(day: number, exerciseId: string): string { return day + ':' + exerciseId; }
export function strengthDraftValues(day: ProgramDayDocument, exerciseId: string): StrengthInput {
  const value = day.strengthOverrides?.[exerciseId] ?? { sets: 3, reps: 8, restSeconds: 90 };
  return { sets: String(value.sets), reps: String(value.reps), restSeconds: String(value.restSeconds) };
}
export function editedProgramDays(days: readonly ProgramDayDocument[], inputs: StrengthInputs): ProgramDayDocument[] {
  return days.map((day, index) => {
    const overrides: Record<string, StrengthSettings> = {};
    for (const exerciseId of day.exerciseIds) {
      const draft = inputs[strengthInputKey(index, exerciseId)];
      const saved = day.strengthOverrides?.[exerciseId];
      if (draft === undefined) { if (saved) overrides[exerciseId] = saved; continue; }
      if (Object.values(draft).some(value => !/^\d+$/.test(value.trim()))) throw new Error('INVALID_STRENGTH_OVERRIDE');
      const sets = Number(draft.sets), reps = Number(draft.reps), restSeconds = Number(draft.restSeconds);
      if (sets < 1 || sets > 20 || reps < 1 || reps > 100 || restSeconds < 0 || restSeconds > 1800) throw new Error('INVALID_STRENGTH_OVERRIDE');
      overrides[exerciseId] = { sets, reps, restSeconds };
    }
    return { ...day, exerciseIds: [...day.exerciseIds], ...(Object.keys(overrides).length ? { strengthOverrides: overrides } : { strengthOverrides: undefined }) };
  });
}
