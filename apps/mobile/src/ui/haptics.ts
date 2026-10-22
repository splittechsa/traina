import * as Haptics from 'expo-haptics';

export function tapSelection(reduceMotion: boolean): void {
  if (reduceMotion) return;
  void Haptics.selectionAsync().catch(() => undefined);
}

export function tapImpact(reduceMotion: boolean): void {
  if (reduceMotion) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function tapSuccess(reduceMotion: boolean): void {
  if (reduceMotion) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
