import { useEffect, useState } from 'react';
import { Keyboard, Platform, StatusBar, useWindowDimensions, type KeyboardMetrics } from 'react-native';

/**
 * Height of the software keyboard from the bottom of the screen.
 * iOS does not resize the window, so composers must pad by this amount.
 * On Android, only lift by the part still overlapping the current window. Some
 * edge-to-edge hosts overlay the keyboard; others resize, which must not add it twice.
 */
export function useKeyboardInset(): number {
  const { height: windowHeight } = useWindowDimensions();
  const [frame, setFrame] = useState<KeyboardMetrics | undefined>(() => Keyboard.metrics());
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => setFrame(event.endCoordinates));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setFrame(undefined));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (!frame) return 0;
  if (Platform.OS === 'ios') return frame.height;
  // Android's window height can exclude the status bar while keyboard screenY
  // is in screen coordinates. Clamp to the actual keyboard height for hosts
  // whose window already includes the bars, and never pad a resized window twice.
  if (windowHeight <= frame.screenY) return 0;
  return Math.min(frame.height, Math.max(0, windowHeight + (StatusBar.currentHeight ?? 0) - frame.screenY));
}
