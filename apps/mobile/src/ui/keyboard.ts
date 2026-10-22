import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions, type KeyboardMetrics } from 'react-native';

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
  return Platform.OS === 'ios' ? frame.height : Math.max(0, windowHeight - frame.screenY);
}
