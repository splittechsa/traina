import { describe, expect, it } from 'vitest';
import { editedProgramDays, strengthDraftValues } from './programDraft';
const day = { name_ar: 'مخصص', name_en: 'Custom', exerciseIds: ['one'] };
describe('program parameter drafts', () => {
  it('round-trips edited parameters and permits no-rest intervals', () => {
    const [saved] = editedProgramDays([day], { '0:one': { sets: '5', reps: '12', restSeconds: '0' } });
    expect(saved.strengthOverrides?.one).toEqual({ sets: 5, reps: 12, restSeconds: 0 });
    expect(strengthDraftValues(saved, 'one')).toEqual({ sets: '5', reps: '12', restSeconds: '0' });
  });
  it('rejects empty, fractional, and out-of-range input without silently saving an old value', () => {
    for (const sets of ['', '2.5', '21', '-1']) expect(() => editedProgramDays([day], { '0:one': { sets, reps: '12', restSeconds: '90' } })).toThrow('INVALID_STRENGTH_OVERRIDE');
  });
  it('does not carry removed-exercise overrides into replacement exercises', () => {
    const [saved] = editedProgramDays([{ ...day, exerciseIds: ['two'], strengthOverrides: { one: { sets: 5, reps: 12, restSeconds: 90 } } }], { '0:one': { sets: '5', reps: '12', restSeconds: '90' } });
    expect(saved.strengthOverrides).toBeUndefined();
  });
});
