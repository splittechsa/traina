import { I18nManager } from 'react-native';
// Respect the persisted native direction. LocaleProvider applies the saved app
// language; forcing Arabic here would undo an English choice on every restart.
I18nManager.allowRTL(true);
// eslint-disable-next-line import/no-unassigned-import
import 'expo-router/entry';
