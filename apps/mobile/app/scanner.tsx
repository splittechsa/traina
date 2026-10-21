import { Text } from '../src/ui/Text';
// Barcode scanner → food lookup. Reads EAN/UPC codes with the native camera scanner
// (expo-camera, works in Expo Go) and hands the code to the food-log screen, which looks
// the product up in Open Food Facts and opens the portion sheet directly.
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useLocale } from '../src/i18n/LocaleProvider';
import { useTheme } from '../src/theme/ThemeProvider';
import { useMotion } from '../src/theme/motion';
import { fontFamily, radius, spacing, typeScale } from '../src/theme/tokens';
import { Button, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, EmptyState } from '../src/ui/kit';
import { tapSuccess } from '../src/ui/haptics';

export default function ScannerScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const { reduce } = useMotion();
  const ar = locale === 'ar';
  const params = useLocalSearchParams<{ day?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const handled = useRef(false);

  function onScanned(result: BarcodeScanningResult) {
    const code = result.data.replace(/\D/g, '');
    if (handled.current || code.length < 8) return;
    handled.current = true;
    tapSuccess(reduce);
    router.replace({ pathname: '/food-log', params: { code, ...(typeof params.day === 'string' ? { day: params.day } : {}) } });
  }

  const header = (
    <AppHeader
      title={ar ? 'امسح الباركود' : 'Scan barcode'}
      subtitle={ar ? 'وجّه الكاميرا إلى باركود المنتج' : "Point the camera at the product's barcode"}
      trailing={
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.accent, fontFamily: fontFamily.semibold, fontSize: typeScale.body }}>{ar ? 'إغلاق' : 'Close'}</Text>
        </Pressable>
      }
    />
  );

  if (permission === null) {
    return (
      <Screen>
        <ScreenBody>{header}</ScreenBody>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <ScreenBody>
          {header}
          <EmptyState
            title={ar ? 'نحتاج إذن الكاميرا' : 'Camera access needed'}
            body={ar ? 'نستخدم الكاميرا لقراءة الباركود فقط، ولا نحفظ أي صور.' : 'The camera is only used to read barcodes. No photos are saved.'}
          />
          {permission.canAskAgain ? (
            <Button label={ar ? 'السماح بالكاميرا' : 'Allow camera'} onPress={() => void requestPermission()} />
          ) : (
            <Button label={ar ? 'فتح الإعدادات' : 'Open Settings'} onPress={() => void Linking.openSettings()} />
          )}
        </ScreenBody>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing[4] }}>{header}</View>
      <View style={{ flex: 1, marginHorizontal: spacing[4], marginBottom: spacing[4], borderRadius: radius.lg + 4, overflow: 'hidden', backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={onScanned}
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: '78%', aspectRatio: 1.6, borderRadius: radius.lg, borderWidth: 3, borderColor: theme.heroAccent }} />
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.semibold, fontSize: typeScale.body, marginTop: spacing[4] }}>
            {ar ? 'ضع الباركود داخل الإطار' : 'Fit the barcode inside the frame'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ar ? 'الكشاف' : 'Flashlight'}
          onPress={() => setTorch((on) => !on)}
          style={{
            position: 'absolute',
            bottom: spacing[5],
            alignSelf: 'center',
            paddingVertical: spacing[3],
            paddingHorizontal: spacing[5],
            borderRadius: radius.pill,
            backgroundColor: torch ? theme.heroAccent : 'rgba(0,0,0,0.55)',
          }}
        >
          <Text style={{ color: torch ? '#0C1715' : '#FFFFFF', fontFamily: fontFamily.semibold, fontSize: typeScale.label }}>
            {ar ? (torch ? 'إطفاء الكشاف' : 'تشغيل الكشاف') : torch ? 'Torch off' : 'Torch on'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
