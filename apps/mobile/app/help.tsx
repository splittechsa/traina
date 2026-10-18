import { Text, View } from 'react-native';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text, type CopyKey } from '../src/i18n/copy';
import { fontFamily, spacing, typeScale } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeProvider';
import { Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, SurfaceCard } from '../src/ui/kit';

export default function HelpScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const faqs: Array<{ q: CopyKey; a: CopyKey }> = [
    { q: 'helpFaqAccount', a: 'helpFaqAccountBody' },
    { q: 'helpFaqCoach', a: 'helpFaqCoachBody' },
    { q: 'helpFaqBilling', a: 'helpFaqBillingBody' },
  ];

  return (
    <Screen>
      <ScreenBody>
        <AppHeader title={text(locale, 'help')} subtitle={text(locale, 'motto')} showBack />
        <SurfaceCard tone="raised">
          <Text style={{ color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 24 }}>
            {text(locale, 'helpIntro')}
          </Text>
        </SurfaceCard>

        <Text
          style={{
            color: theme.textMuted,
            fontFamily: fontFamily.semibold,
            fontSize: typeScale.label,
            marginTop: spacing[4],
            marginBottom: spacing[2],
          }}
        >
          {text(locale, 'helpFaqTitle')}
        </Text>
        <View style={{ gap: spacing[3] }}>
          {faqs.map((item) => (
            <SurfaceCard key={item.q}>
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.card }}>
                {text(locale, item.q)}
              </Text>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 8, lineHeight: 22 }}>
                {text(locale, item.a)}
              </Text>
            </SurfaceCard>
          ))}
        </View>

        <View style={{ gap: spacing[3], marginTop: spacing[4] }}>
          <SurfaceCard tone="muted">
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{text(locale, 'helpContactTitle')}</Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 8, lineHeight: 22 }}>
              {text(locale, 'helpContactBody')}
            </Text>
          </SurfaceCard>
          <SurfaceCard tone="muted">
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold }}>{text(locale, 'helpPrivacyTitle')}</Text>
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, marginTop: 8, lineHeight: 22 }}>
              {text(locale, 'helpPrivacyBody')}
            </Text>
          </SurfaceCard>
        </View>
      </ScreenBody>
    </Screen>
  );
}
