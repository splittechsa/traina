export type OnboardingDraft = {
  step: number;
  storyIndex: number;
  displayName: string;
  ageYears: string;
  heightCm: string;
  weightKg: string;
  sex: 'male' | 'female';
  experience: string;
  goal: string;
  discipline: string;
  sports: string[];
  sessionsPerWeek: string;
  environment: string;
  activity: string;
  when: string;
  diet: string;
  nutritionPace: 'sprint' | 'steady' | 'gentle';
  horizonWeeks: number | null;
};

const empty: OnboardingDraft = {
  step: 0,
  storyIndex: 0,
  displayName: '',
  ageYears: '',
  heightCm: '',
  weightKg: '',
  sex: 'male',
  experience: 'beginner',
  goal: 'general_health',
  discipline: 'general_fitness',
  sports: ['general_fitness'],
  sessionsPerWeek: '3',
  environment: 'gym',
  activity: 'moderate',
  when: 'evening',
  diet: 'no_preference',
  nutritionPace: 'steady',
  horizonWeeks: null,
};

function stringList(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : fallback;
}

function textOf(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function bounded(value: unknown, fallback: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : fallback;
}

export function parseOnboardingDraft(raw: string | null): OnboardingDraft | null {
  if (raw === null || raw.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return {
      ...empty,
      step: bounded(parsed.step, 0, 7),
      storyIndex: bounded(parsed.storyIndex, 0, 5),
      displayName: textOf(parsed.displayName, ''),
      ageYears: textOf(parsed.ageYears, ''),
      heightCm: textOf(parsed.heightCm, ''),
      weightKg: textOf(parsed.weightKg, ''),
      sex: parsed.sex === 'female' ? 'female' : 'male',
      experience: textOf(parsed.experience, empty.experience),
      goal: textOf(parsed.goal, empty.goal),
      discipline: textOf(parsed.discipline, empty.discipline),
      sports: stringList(parsed.sports, empty.sports),
      sessionsPerWeek: textOf(parsed.sessionsPerWeek, empty.sessionsPerWeek),
      environment: textOf(parsed.environment, empty.environment),
      activity: textOf(parsed.activity, empty.activity),
      when: textOf(parsed.when, empty.when),
      diet: textOf(parsed.diet, empty.diet),
      nutritionPace:
        parsed.nutritionPace === 'sprint' || parsed.nutritionPace === 'gentle' || parsed.nutritionPace === 'steady'
          ? parsed.nutritionPace
          : empty.nutritionPace,
      horizonWeeks:
        typeof parsed.horizonWeeks === 'number' && Number.isInteger(parsed.horizonWeeks) && parsed.horizonWeeks >= 1 && parsed.horizonWeeks <= 52
          ? parsed.horizonWeeks
          : null,
    };
  } catch {
    return null;
  }
}
