import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { SymbolView } from 'expo-symbols';
import type { CopyKey } from '../i18n/copy';

type Icon = ComponentProps<typeof SymbolView>['name'];

export type HomeShortcutId =
  | 'coach'
  | 'food'
  | 'training'
  | 'weight'
  | 'water'
  | 'supplements'
  | 'activity'
  | 'exercises'
  | 'report'
  | 'community'
  | 'plan';

export const HOME_SHORTCUTS: { id: HomeShortcutId; label: CopyKey; icon: Icon; href: () => void }[] = [
  { id: 'coach', label: 'askCoach', icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }, href: () => router.push('/(tabs)/coach') },
  { id: 'food', label: 'foodManual', icon: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }, href: () => router.push('/food-log') },
  { id: 'training', label: 'schedule', icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }, href: () => router.push('/(tabs)/training') },
  { id: 'weight', label: 'logWeight', icon: { ios: 'scalemass.fill', android: 'monitor_weight', web: 'monitor_weight' }, href: () => router.push('/weight') },
  { id: 'water', label: 'logWater', icon: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }, href: () => router.push('/water') },
  { id: 'supplements', label: 'supplements', icon: { ios: 'pills.fill', android: 'medication', web: 'medication' }, href: () => router.push('/supplements') },
  { id: 'activity', label: 'logActivityQuick', icon: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' }, href: () => router.push('/quick-activity') },
  { id: 'exercises', label: 'exercises', icon: { ios: 'square.grid.2x2.fill', android: 'grid_view', web: 'grid_view' }, href: () => router.push('/exercises') },
  { id: 'plan', label: 'mealPlan', icon: { ios: 'list.bullet.rectangle', android: 'view_week', web: 'view_week' }, href: () => router.push('/meal-plan') },
  { id: 'report', label: 'weekReport', icon: { ios: 'doc.text.fill', android: 'description', web: 'description' }, href: () => router.push('/week-report') },
  { id: 'community', label: 'community', icon: { ios: 'person.3.fill', android: 'groups', web: 'groups' }, href: () => router.push('/(tabs)/community') },
];

export const DEFAULT_HOME_SHORTCUTS: HomeShortcutId[] = ['coach', 'food', 'training', 'weight'];

export function sanitizeHomeShortcuts(value: unknown): HomeShortcutId[] {
  const allowed = new Set(HOME_SHORTCUTS.map((item) => item.id));
  const ids = Array.isArray(value) ? value.filter((item): item is HomeShortcutId => typeof item === 'string' && allowed.has(item as HomeShortcutId)) : [];
  const unique = [...new Set(ids)];
  if (unique.length === 0) return DEFAULT_HOME_SHORTCUTS;
  return unique.slice(0, 6);
}
