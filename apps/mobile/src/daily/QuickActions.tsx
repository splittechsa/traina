import type { ComponentProps } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useLocale } from '../i18n/LocaleProvider';
import { text } from '../i18n/copy';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, radius, spacing } from '../theme/tokens';
import { AppHeader, BottomSheet } from '../ui/kit';

type Action = {
  id: string;
  label: (locale: 'ar' | 'en') => string;
  icon: ComponentProps<typeof SymbolView>['name'];
  href: () => void;
};

const actions: Action[] = [
  { id: 'scanner', label: (locale) => text(locale, 'scanner'), icon: { ios: 'barcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }, href: () => router.push('/scanner') },
  { id: 'food', label: (locale) => text(locale, 'foodSearch'), icon: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }, href: () => router.push('/food-log') },
  { id: 'workout', label: (locale) => text(locale, 'workout'), icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }, href: () => router.push('/(tabs)/training') },
  { id: 'exercises', label: (locale) => text(locale, 'exercises'), icon: { ios: 'square.grid.2x2.fill', android: 'grid_view', web: 'grid_view' }, href: () => router.push('/exercises') },
  { id: 'plan', label: (locale) => text(locale, 'mealPlan'), icon: { ios: 'list.bullet.rectangle', android: 'view_week', web: 'view_week' }, href: () => router.push('/meal-plan') },
  { id: 'activity', label: (locale) => text(locale, 'logActivityQuick'), icon: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' }, href: () => router.push('/quick-activity') },
  { id: 'macros', label: (locale) => text(locale, 'manualEntry'), icon: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }, href: () => router.push('/(tabs)/nutrition') },
  { id: 'water', label: (locale) => text(locale, 'logWater'), icon: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }, href: () => router.push('/water') },
  { id: 'supplements', label: (locale) => text(locale, 'supplements'), icon: { ios: 'pills.fill', android: 'medication', web: 'medication' }, href: () => router.push('/supplements') },
  { id: 'weight', label: (locale) => text(locale, 'logWeight'), icon: { ios: 'scalemass.fill', android: 'monitor_weight', web: 'monitor_weight' }, href: () => router.push('/weight') },
  { id: 'tape', label: (locale) => text(locale, 'bodyTape'), icon: { ios: 'ruler.fill', android: 'straighten', web: 'straighten' }, href: () => router.push('/measurements') },
  { id: 'report', label: (locale) => text(locale, 'weekReport'), icon: { ios: 'doc.text.fill', android: 'description', web: 'description' }, href: () => router.push('/week-report') },
  { id: 'coach', label: (locale) => text(locale, 'coach'), icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }, href: () => router.push('/(tabs)/coach') },
  { id: 'community', label: (locale) => text(locale, 'community'), icon: { ios: 'person.3.fill', android: 'groups', web: 'groups' }, href: () => router.push('/(tabs)/community') },
];

export function QuickActionsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { locale } = useLocale();
  const theme = useTheme();
  const isAr = locale === 'ar';
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppHeader title={text(locale, 'quickActions')} subtitle={text(locale, 'noBurnedCalories')} />
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: spacing[6] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              action.href();
            }}
            style={{
              width: '48%',
              minHeight: 88,
              borderRadius: radius.lg,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              padding: spacing[3],
              justifyContent: 'space-between',
            }}
          >
            <SymbolView name={action.icon} size={22} tintColor={theme.accent} />
            <Text style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: 13, textAlign: isAr ? 'right' : 'left' }}>
              {action.label(locale)}
            </Text>
          </Pressable>
        ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
