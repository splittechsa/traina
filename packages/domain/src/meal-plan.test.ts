import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  CUT_DEFICIT_BY_PACE,
  ENERGY_POLICY,
  assembleDayMealPlan,
  assertEnergyPolicyApprovedForPaidCoaching,
  athleteEnergyPlan,
  customizeMealSlot,
  loggingDiscipline,
  paceFromHorizonWeeks,
  phaseFromAthleteGoals,
  pickReadyMeal,
  proposeWeeklyNutritionStep,
  readyMealsForSlot,
} from './meal-plan.js';

describe('adaptive AI meal plan (Traina Training)', () => {
  it('marks fixed cut deficits as unapproved for paid coaching (P0-SAFE-01 / S-07)', () => {
    expect(ENERGY_POLICY.approvedForPaidCoaching).toBe(false);
    expect(ENERGY_POLICY.status).toBe('unapproved_pending_professional_review');
    expect(athleteEnergyPlan({ maintenanceKcal: 2_800, phase: 'cutting', pace: 'sprint' }).policyApprovedForPaidCoaching).toBe(false);
    expect(() => assertEnergyPolicyApprovedForPaidCoaching()).toThrow(DomainError);
  });

  it('maps athlete goals to a phase — cut, gain, or fitness', () => {
    expect(phaseFromAthleteGoals(['fat_loss'])).toBe('cutting');
    expect(phaseFromAthleteGoals(['muscle_gain', 'strength'])).toBe('gain');
    expect(phaseFromAthleteGoals(['general_health'])).toBe('fitness');
    expect(phaseFromAthleteGoals(['endurance'])).toBe('fitness');
  });

  it('uses a harder deficit for a short sprint cut than a natural cut', () => {
    expect(CUT_DEFICIT_BY_PACE.sprint).toBeGreaterThan(CUT_DEFICIT_BY_PACE.steady);
    expect(CUT_DEFICIT_BY_PACE.steady).toBeGreaterThan(CUT_DEFICIT_BY_PACE.gentle);
    expect(paceFromHorizonWeeks(3)).toBe('sprint');
    expect(paceFromHorizonWeeks(8)).toBe('steady');
    expect(paceFromHorizonWeeks(16)).toBe('gentle');

    const sprint = athleteEnergyPlan({ maintenanceKcal: 2_800, phase: 'cutting', horizonWeeks: 3 });
    expect(sprint.pace).toBe('sprint');
    expect(sprint.deficitOrSurplusKcal).toBe(-1_100);
    expect(sprint.targetKcal).toBe(1_700);

    const natural = athleteEnergyPlan({ maintenanceKcal: 2_800, phase: 'cutting', pace: 'steady' });
    expect(natural.deficitOrSurplusKcal).toBe(-650);
    expect(natural.targetKcal).toBe(2_150);

    const bulk = athleteEnergyPlan({ maintenanceKcal: 2_800, phase: 'gain', pace: 'steady' });
    expect(bulk.deficitOrSurplusKcal).toBe(300);
    expect(bulk.targetKcal).toBe(3_100);

    const fitness = athleteEnergyPlan({ maintenanceKcal: 2_800, phase: 'fitness' });
    expect(fitness.targetKcal).toBeLessThan(2_800);
    expect(fitness.targetKcal).toBeGreaterThan(2_400);
  });

  it('flags weak water logging over 14 days and proposes easing the schedule', () => {
    const discipline = loggingDiscipline({ mealDaysLogged: 12, waterDaysLogged: 3 });
    expect(discipline.windowDays).toBe(14);
    expect(discipline.status).toBe('water_low');
    expect(discipline.waterAdherenceBps).toBeLessThan(5_000);

    const step = proposeWeeklyNutritionStep({
      phase: 'cutting',
      pace: 'sprint',
      mealAdherenceBps: 8_000,
      waterAdherenceBps: discipline.waterAdherenceBps,
      samples: [
        { recordedOn: '2026-06-01', weightGrams: 90_000 },
        { recordedOn: '2026-06-08', weightGrams: 89_500 },
      ],
    });
    expect(step.reason).toBe('water_adherence_low');
    expect(step.alert).toBe(true);
    expect(step.status).toBe('propose');
    expect(step.energyDeltaKcal).toBeGreaterThan(0);
    expect(step.mayAutoApply).toBe(false);
    expect(step.policyApprovedForPaidCoaching).toBe(false);
  });

  it('proposes a deeper weekly cut when weight stalls with decent meal+water adherence', () => {
    const step = proposeWeeklyNutritionStep({
      phase: 'cutting',
      pace: 'steady',
      mealAdherenceBps: 8_000,
      waterAdherenceBps: 8_000,
      samples: [
        { recordedOn: '2026-06-01', weightGrams: 90_000 },
        { recordedOn: '2026-06-08', weightGrams: 89_900 },
      ],
    });
    expect(step.status).toBe('propose');
    expect(step.energyDeltaKcal).toBeLessThan(0);
    expect(step.reason).toBe('weight_stalled_on_cut');
    expect(step.alert).toBe(true);
  });

  it('holds and alerts when the member is not logging meals', () => {
    const step = proposeWeeklyNutritionStep({
      phase: 'cutting',
      mealAdherenceBps: 2_000,
      waterAdherenceBps: 9_000,
      samples: [
        { recordedOn: '2026-06-01', weightGrams: 90_000 },
        { recordedOn: '2026-06-08', weightGrams: 90_000 },
      ],
    });
    expect(step.reason).toBe('adherence_low');
    expect(step.alert).toBe(true);
  });

  it('lets the athlete pick ready meals or customize a slot with declared macros', () => {
    expect(readyMealsForSlot('lunch').length).toBeGreaterThan(0);
    const lunch = pickReadyMeal('lunch', 'lunch_chicken_rice');
    expect(lunch.energyKcal).toBe(520);
    const custom = customizeMealSlot('dinner', {
      label: 'وجبتـي',
      energyKcal: 400,
      proteinMg: 35_000,
      carbohydrateMg: 20_000,
      fatMg: 12_000,
    });
    expect(custom.templateId).toBeNull();
    const day = assembleDayMealPlan(2_000, [lunch, custom]);
    expect(day.plannedKcal).toBe(920);
    expect(() => pickReadyMeal('breakfast', 'lunch_chicken_rice')).toThrow(DomainError);
  });
});
