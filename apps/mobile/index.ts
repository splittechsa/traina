// Custom entry point (replaces the default `expo-router/entry`) so we can force the native
// layout direction before any view is mounted. I18nManager.forceRTL() only affects the next
// native layout pass — React Native reads this flag once during native initialization, so it
// has to run here, before expo-router's entry even executes, not from inside a component.
//
// Sahhti defaults to Arabic (see LocaleProvider's initial state), and almost the entire app
// previously ran as a native-LTR layout with Arabic text dropped into LTR boxes (flex
// direction, icon sides, nav drawer side, swipe direction were all never mirrored — only
// text glyph shaping was handled, via `writingDirection: 'auto'`). Forcing RTL here fixes the
// *layout*, which is the piece that was missing.
import { I18nManager } from 'react-native';

I18nManager.allowRTL(true);
if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
}

// eslint-disable-next-line import/no-unassigned-import
import 'expo-router/entry';
