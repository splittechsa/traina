import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Screen } from '../src/ui/Screen';
import { AppHeader, EmptyState } from '../src/ui/kit';

export default function NotificationsScreen() {
  const { locale } = useLocale();
  return (
    <Screen>
      <AppHeader title={text(locale, 'notifications')} subtitle={text(locale, 'unavailable')} />
      <EmptyState title={text(locale, 'notifications')} body={text(locale, 'notificationsMissing')} />
    </Screen>
  );
}
