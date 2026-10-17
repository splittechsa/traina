import { Redirect } from 'expo-router';

/** Legacy /plan duplicated training + nutrition — send members to meal plan. */
export default function PlanRedirect() {
  return <Redirect href="/meal-plan" />;
}
