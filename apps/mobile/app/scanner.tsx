// Barcode scanner → food EAN/UPC, or gym machine codes (TRN-* / traina:exercise:<uuid>).
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { apiRequest } from '../src/api/client';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
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
  const params = useLocalSearchParams<{ day?: string; intent?: string; session?: string }>();
  const gymScan = params.intent === 'exercise';
  const sessionId = typeof params.session === 'string' ? params.session : '';
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanError, setScanError] = useState('');
  const handled = useRef(false);

  function onScanned(result: BarcodeScanningResult) {
    if (handled.current) return;
    if (gymScan) {
      const code = result.data.trim();
      if (code.length < 4) return;
      handled.current = true;
      tapSuccess(reduce);
      void apiRequest<{ exercise: { id: string } }>(`/v1/exercises/scan?code=${encodeURIComponent(code)}`)
        .then((payload) => {
          if (sessionId.length > 0) {
            router.replace({ pathname: '/workout/[id]', params: { id: sessionId, select: payload.exercise.id } });
            return;
          }
          router.replace({ pathname: '/exercises', params: { select: payload.exercise.id } });
        })
        .catch(() => {
          handled.current = false;
          setScanError(text(locale, 'unknownGymCode'));
        });
      return;
    }
    const code = result.data.replace(/\D/g, '');
    if (code.length < 8) return;
    handled.current = true;
    tapSuccess(reduce);
    router.replace({ pathname: '/food-log', params: { code, ...(typeof params.day === 'string' ? { day: params.day } : {}) } });
  }

  const header = (
    <AppHeader
      title={gymScan ? text(locale, 'scanGym') : (ar ? 'امسح الباركود' : 'Scan barcode')}
      subtitle={gymScan
        ? (ar ? 'وجّه الكاميرا إلى ملصق الجهاز في النادي' : 'Point the camera at the gym machine label')
        : (ar ? 'وجّه الكاميرا إلى باركود المنتج' : "Point the camera at the product's barcode")}
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
          barcodeScannerSettings={{ barcodeTypes: gymScan ? ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'datamatrix'] : ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={onScanned}
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: '78%', aspectRatio: 1.6, borderRadius: radius.lg, borderWidth: 3, borderColor: theme.heroAccent }} />
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.semibold, fontSize: typeScale.body, marginTop: spacing[4] }}>
            {scanError.length > 0 ? scanError : (ar ? 'ضع الباركود داخل الإطار' : 'Fit the barcode inside the frame')}
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
