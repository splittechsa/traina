import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useLocale } from '../i18n/LocaleProvider';
import { text } from '../i18n/copy';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { SurfaceCard } from './kit';

export type YazanAction = {
  label: string;
  onPress: () => void;
};

type Props = {
  title?: string;
  body: string;
  actions?: YazanAction[];
  compact?: boolean;
};

/** Contextual Yazan coaching surface — not a chat dump. */
export function YazanCard({ title, body, actions = [], compact = false }: Props) {
  const { locale } = useLocale();
  const theme = useTheme();
  const heading = title ?? text(locale, 'yazanToday');
  return (
    <SurfaceCard tone="raised" style={{ marginBottom: compact ? 10 : 14 }}>
      <Text
        style={{
          color: theme.accent,
          fontFamily: fontFamily.bold,
          fontSize: compact ? 12 : 13,
          marginBottom: 4,
        }}
      >
        {heading}
      </Text>
      <Text
        style={{
          color: theme.text,
          fontFamily: fontFamily.regular,
          fontSize: compact ? typeScale.label : typeScale.body,
          lineHeight: compact ? 20 : 22,
        }}
      >
        {body}
      </Text>
      {actions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing[3] }}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={action.onPress}
              style={{
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surfaceMuted,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 12 }}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </SurfaceCard>
  );
}

export function openYazanWithPrompt(prompt: string) {
  router.push({ pathname: '/(tabs)/coach', params: { seed: prompt } });
}
