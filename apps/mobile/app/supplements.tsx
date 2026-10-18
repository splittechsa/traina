import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Screen } from '../src/ui/Screen';
import { AppHeader, EmptyState } from '../src/ui/kit';

export default function SupplementsScreen() {
  const { locale } = useLocale();
  return (
    <Screen>
      <AppHeader title={text(locale, 'supplements')} subtitle={text(locale, 'unavailable')} showBack />
      <EmptyState title={text(locale, 'supplements')} body={text(locale, 'supplementsMissing')} />
    </Screen>
  );
}
