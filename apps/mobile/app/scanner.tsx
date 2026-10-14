import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Button, Screen } from '../src/ui/Screen';
import { AppHeader, EmptyState } from '../src/ui/kit';

export default function ScannerScreen() {
  const { locale } = useLocale();
  const [permission, requestPermission] = useCameraPermissions();
  return (
    <Screen>
      <AppHeader title={text(locale, 'scanner')} subtitle={text(locale, 'unavailable')} />
      <EmptyState title={text(locale, 'scanner')} body={text(locale, 'scannerMissing')} />
      {permission?.granted === true ? <CameraView style={{ height: 240, borderRadius: 16 }} /> : <Button label={text(locale, 'continue')} variant="secondary" onPress={() => void requestPermission()} />}
    </Screen>
  );
}
