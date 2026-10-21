import { Text as NativeText, type TextProps } from 'react-native';
import { useLocale } from '../i18n/LocaleProvider';
import { fontFamily } from '../theme/tokens';
/** Locale alignment is independent of the script in a name, number or Latin brand.
 * Containers own layout direction; this component never mirrors rows or icons.
 * Explicit center/numeric styles remain authoritative. Unicode determines mixed-script runs.
 */
export function Text({ style, ...props }: TextProps) {
  const { locale } = useLocale();
  return <NativeText {...props} style={[{ fontFamily: fontFamily.regular, textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: 'auto' }, style]} />;
}
