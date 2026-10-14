import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Screen } from '../src/ui/Screen';
import { AppHeader, EmptyState } from '../src/ui/kit';

export default function ActivityScreen() {
  const { locale } = useLocale();
  return (
    <Screen>
      <AppHeader title={text(locale, 'activity')} subtitle={text(locale, 'unavailable')} />
      <EmptyState title={text(locale, 'activity')} body={text(locale, 'healthMissing')} />
    </Screen>
  );
}
