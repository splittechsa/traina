import * as Haptics from 'expo-haptics';

export function tapSelection(reduceMotion: boolean): void {
  if (reduceMotion) return;
  void Haptics.selectionAsync();
}

export function tapImpact(reduceMotion: boolean): void {
  if (reduceMotion) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function tapSuccess(reduceMotion: boolean): void {
  if (reduceMotion) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
