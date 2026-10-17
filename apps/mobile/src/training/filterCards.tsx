import type { ComponentProps } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatCount } from '../format';
import { useLocale } from '../i18n/LocaleProvider';
import { label } from '../i18n/labels';
import { useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { tapImpact } from '../ui/haptics';
import { brandLabel, type EquipmentBrand, type EquipmentManufacturer, type TrainingEnvironment } from './library';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
export type TrainingFamily = 'all' | 'strength' | 'crossfit' | 'calisthenics';

const familyContent: Record<Exclude<TrainingFamily, 'all'>, {
  icon: SymbolName;
  ar: { title: string; subtitle: string };
  en: { title: string; subtitle: string };
  color: 'accent' | 'ember' | 'violet';
}> = {
  strength: {
    icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
    ar: { title: 'حديد وقوة', subtitle: 'أوزان • أجهزة • تضخيم' },
    en: { title: 'Strength', subtitle: 'Weights • machines • muscle' },
    color: 'accent',
  },
  crossfit: {
    icon: { ios: 'timer.circle.fill', android: 'timer', web: 'timer' },
    ar: { title: 'كروس فت', subtitle: 'WOD • جولات • وقت' },
    en: { title: 'CrossFit', subtitle: 'WOD • rounds • time' },
    color: 'ember',
  },
  calisthenics: {
    icon: { ios: 'figure.strengthtraining.traditional', android: 'accessibility_new', web: 'accessibility_new' },
    ar: { title: 'كاليسثنكس', subtitle: 'تكرارات • ثبات • مهارة' },
    en: { title: 'Calisthenics', subtitle: 'Reps • holds • skills' },
    color: 'violet',
  },
};

export function familyForDiscipline(discipline: string): TrainingFamily {
  if (discipline === 'bodybuilding' || discipline === 'powerlifting' || discipline === 'strength') return 'strength';
  if (discipline === 'crossfit' || discipline === 'functional_training') return 'crossfit';
  if (discipline === 'calisthenics') return 'calisthenics';
  return 'all';
}

export function TrainingFamilyCards({
  value,
  onChange,
  counts,
}: {
  value: TrainingFamily;
  onChange: (family: TrainingFamily) => void;
  counts?: Partial<Record<TrainingFamily, number>>;
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  const { reduce, duration } = useMotion();
  const families = Object.keys(familyContent) as Exclude<TrainingFamily, 'all'>[];
  return (
    <View style={{ marginBottom: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] }}>
        <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card }}>{locale === 'ar' ? 'اختر نظامك' : 'Choose your system'}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: value === 'all' }} onPress={() => onChange('all')} style={{ paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.pill, backgroundColor: value === 'all' ? theme.text : theme.surfaceMuted }}>
          <Text style={{ color: value === 'all' ? theme.background : theme.textMuted, fontFamily: fontFamily.semibold, fontSize: typeScale.micro }}>{locale === 'ar' ? 'عرض الكل' : 'All'}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2], paddingEnd: spacing[4] }}>
        {families.map((family, index) => {
          const content = familyContent[family];
          const selected = value === family;
          const tint = theme[content.color];
          return (
            <Animated.View key={family} entering={reduce ? undefined : FadeInDown.delay(index * 70).duration(duration(280))}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  tapImpact(reduce);
                  onChange(family);
                }}
                style={({ pressed }) => ({
                  width: 166,
                  minHeight: 128,
                  borderRadius: radius.lg,
                  padding: spacing[3],
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? tint : theme.border,
                  backgroundColor: selected ? theme.surfaceMuted : theme.surface,
                  opacity: pressed ? 0.84 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? tint : theme.surfaceMuted }}>
                    <SymbolView name={content.icon} size={22} tintColor={selected ? theme.emphasisText : tint} />
                  </View>
                  {counts?.[family] !== undefined ? <Text style={{ color: theme.textMuted, fontFamily: fontFamily.bold, fontSize: typeScale.label }}>{formatCount(counts[family] ?? 0, locale)}</Text> : null}
                </View>
                <Text style={{ color: theme.text, fontFamily: fontFamily.bold, fontSize: typeScale.card, marginTop: spacing[3], textAlign: locale === 'ar' ? 'right' : 'left' }}>{content[locale].title}</Text>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.micro, marginTop: 2, textAlign: locale === 'ar' ? 'right' : 'left' }}>{content[locale].subtitle}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const environments: { id: TrainingEnvironment; icon: SymbolName }[] = [
  { id: 'all', icon: { ios: 'square.grid.2x2.fill', android: 'apps', web: 'apps' } },
  { id: 'home', icon: { ios: 'house.fill', android: 'home', web: 'home' } },
  { id: 'gym', icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' } },
  { id: 'outdoor', icon: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' } },
];

export function EnvironmentCards({ value, onChange }: { value: TrainingEnvironment; onChange: (environment: TrainingEnvironment) => void }) {
  const theme = useTheme();
  const { locale } = useLocale();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
      {environments.map((item) => {
        const selected = value === item.id;
        const title = item.id === 'all' ? (locale === 'ar' ? 'كل الأماكن' : 'All places') : label(locale, 'environment', item.id);
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(item.id)}
            style={({ pressed }) => ({ width: '48.5%', minHeight: 58, borderRadius: radius.md, borderWidth: 1, borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.surfaceMuted : theme.surface, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2], opacity: pressed ? 0.82 : 1 })}
          >
            <SymbolView name={item.icon} size={18} tintColor={selected ? theme.accent : theme.textMuted} />
            <Text numberOfLines={1} style={{ flex: 1, color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.label, textAlign: locale === 'ar' ? 'right' : 'left' }}>{title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const muscleGroups: { id: Exclude<import('./library').MuscleGroup, 'all'>; ar: string; en: string }[] = [
  { id: 'chest', ar: 'صدر', en: 'Chest' },
  { id: 'back', ar: 'ظهر', en: 'Back' },
  { id: 'legs', ar: 'أرجل', en: 'Legs' },
  { id: 'shoulders', ar: 'أكتاف', en: 'Shoulders' },
  { id: 'arms', ar: 'ذراعان', en: 'Arms' },
  { id: 'core', ar: 'جذع', en: 'Core' },
  { id: 'full_body', ar: 'كامل الجسم', en: 'Full body' },
];

const equipmentKinds: { id: Exclude<import('./library').EquipmentKind, 'all'>; ar: string; en: string }[] = [
  { id: 'barbell', ar: 'بار', en: 'Barbell' },
  { id: 'dumbbell', ar: 'دمبل', en: 'Dumbbell' },
  { id: 'machine', ar: 'جهاز', en: 'Machine' },
  { id: 'cable', ar: 'كابل', en: 'Cable' },
  { id: 'bodyweight', ar: 'وزن الجسم', en: 'Bodyweight' },
  { id: 'kettlebell', ar: 'كيتل', en: 'Kettlebell' },
];

function ChipRow<T extends string>({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: T | 'all';
  onChange: (value: T | 'all') => void;
  options: { id: T; ar: string; en: string }[];
  allLabel: string;
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2], paddingEnd: spacing[4], marginBottom: spacing[3] }}>
      {[{ id: 'all' as const, label: allLabel }, ...options.map((item) => ({ id: item.id, label: item[locale] }))].map((item) => {
        const selected = value === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(item.id)}
            style={{
              paddingHorizontal: spacing[3],
              paddingVertical: 8,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: selected ? theme.accent : theme.border,
              backgroundColor: selected ? theme.accent : theme.surface,
            }}
          >
            <Text style={{ color: selected ? theme.emphasisText : theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.micro }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function MuscleGroupChips({
  value,
  onChange,
}: {
  value: import('./library').MuscleGroup;
  onChange: (value: import('./library').MuscleGroup) => void;
}) {
  const { locale } = useLocale();
  return <ChipRow value={value} onChange={onChange} options={muscleGroups} allLabel={locale === 'ar' ? 'كل العضلات' : 'All muscles'} />;
}

export function EquipmentKindChips({
  value,
  onChange,
}: {
  value: import('./library').EquipmentKind;
  onChange: (value: import('./library').EquipmentKind) => void;
}) {
  const { locale } = useLocale();
  return <ChipRow value={value} onChange={onChange} options={equipmentKinds} allLabel={locale === 'ar' ? 'كل الأدوات' : 'All equipment'} />;
}

const difficulties: { id: Exclude<import('./library').DifficultyFilter, 'all'>; ar: string; en: string }[] = [
  { id: 'beginner', ar: 'مبتدئ', en: 'Beginner' },
  { id: 'intermediate', ar: 'متوسط', en: 'Intermediate' },
  { id: 'advanced', ar: 'متقدم', en: 'Advanced' },
];

export function DifficultyChips({
  value,
  onChange,
}: {
  value: import('./library').DifficultyFilter;
  onChange: (value: import('./library').DifficultyFilter) => void;
}) {
  const { locale } = useLocale();
  return <ChipRow value={value} onChange={onChange} options={difficulties} allLabel={locale === 'ar' ? 'كل المستويات' : 'All levels'} />;
}

export function EquipmentBrandCards({
  value,
  onChange,
  manufacturers,
}: {
  value: EquipmentBrand | 'all';
  onChange: (brand: EquipmentBrand | 'all') => void;
  manufacturers: readonly EquipmentManufacturer[];
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  const brands: (EquipmentBrand | 'all')[] = ['all', ...manufacturers.map((item) => item.id)];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
      {brands.map((brand) => {
        const selected = value === brand;
        const title = brand === 'all' ? (locale === 'ar' ? 'جميع الشركات' : 'All brands') : brandLabel(brand, locale, manufacturers);
        const initials = brand === 'all' ? 'ALL' : brand.split('_').map((part) => part[0]?.toUpperCase()).join('').slice(0, 2);
        return (
          <Pressable
            key={brand}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(brand)}
            style={({ pressed }) => ({ width: '48.5%', minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.surfaceMuted : theme.surface, padding: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[2], opacity: pressed ? 0.82 : 1 })}
          >
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: selected ? theme.accent : theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: selected ? theme.emphasisText : theme.textMuted, fontFamily: fontFamily.bold, fontSize: 10 }}>{initials}</Text>
            </View>
            <Text numberOfLines={2} style={{ flex: 1, color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.micro, lineHeight: 15, textAlign: locale === 'ar' ? 'right' : 'left' }}>{title}</Text>
            {selected ? <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={16} tintColor={theme.accent} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
