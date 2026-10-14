import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Screen } from '../src/ui/Screen';
import { AppHeader, EmptyState } from '../src/ui/kit';

export default function HelpScreen() {
  const { locale } = useLocale();
  return (
    <Screen>
      <AppHeader title={text(locale, 'help')} subtitle={text(locale, 'motto')} />
      <EmptyState title={text(locale, 'help')} body={text(locale, 'supportMissing')} />
    </Screen>
  );
}
