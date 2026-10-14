import { describe, expect, it } from 'vitest';
import { parseOnboardingDraft } from './draft';
import { measurementIssue, measurementPayload, onboardingFailure } from './measurements';

describe('onboarding draft', () => {
  it('restores a saved step and ignores a broken payload', () => {
    const draft = parseOnboardingDraft(JSON.stringify({ step: 4, storyIndex: 5, displayName: 'أحمد', ageYears: '28' }));
    expect(draft?.step).toBe(4);
    expect(draft?.storyIndex).toBe(5);
    expect(draft?.displayName).toBe('أحمد');
    expect(parseOnboardingDraft('{')).toBeNull();
    expect(parseOnboardingDraft(JSON.stringify({ step: 99 }))?.step).toBe(0);
  });
});

describe('measurements', () => {
  it('names the first invalid field', () => {
    expect(measurementIssue({ name: '', age: '28', height: '170', weight: '70' })).toBe('name');
    expect(measurementIssue({ name: 'أحمد', age: '12', height: '170', weight: '70' })).toBe('age');
    expect(measurementIssue({ name: 'أحمد', age: '28', height: '90', weight: '70' })).toBe('height');
    expect(measurementIssue({ name: 'أحمد', age: '28', height: '170,5', weight: '20' })).toBe('weight');
    expect(measurementIssue({ name: 'أحمد', age: '28', height: '170.5', weight: '70' })).toBeNull();
    expect(measurementIssue({ name: 'أحمد', age: '28', height: '170.55', weight: '70' })).toBe('height');
    expect(measurementIssue({ name: 'أحمد', age: '٢٨', height: '١٧٠,٥', weight: '٧٠' })).toBeNull();
    expect(measurementPayload({ age: '٢٨', height: '١٧٠,٥', weight: '٧٠' })).toEqual({ ageYears: 28, heightCm: '170.5', weightKg: '70' });
    expect(onboardingFailure('heightCm:INVALID,weightKg:OUT_OF_RANGE')).toBe('height');
    expect(onboardingFailure('discipline:INVALID')).toBe('other');
  });
});
