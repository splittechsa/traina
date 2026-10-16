import { useMemo, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ApiClientError, apiRequest } from '../src/api/client';
import { formatCount } from '../src/format';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { label, labelList } from '../src/i18n/labels';
import { useMotion } from '../src/theme/motion';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, radius, spacing, typeScale } from '../src/theme/tokens';
import { Button, Screen } from '../src/ui/Screen';
import { AppHeader, BottomSheet, EmptyState, ErrorState, LoadingSkeleton, SectionLabel } from '../src/ui/kit';
import { EnvironmentCards, EquipmentBrandCards, TrainingFamilyCards, type TrainingFamily } from '../src/training/filterCards';
import { MovementDemo3D } from '../src/training/MovementDemo3D';
import {
  asLibraryList,
  brandLabel,
  filterExerciseLibrary,
  type EquipmentBrand,
  type EquipmentManufacturer,
  type LibraryExercise,
  type TrainingEnvironment,
} from '../src/training/library';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type LibraryRow =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'exercise'; key: string; exercise: LibraryExercise };

const movementSymbols: Record<string, SymbolName> = {
  squat: { ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' },
  hinge: { ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' },
  horizontal_push: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  vertical_push: { ios: 'arrow.up.circle.fill', android: 'arrow_upward', web: 'arrow_upward' },
  horizontal_pull: { ios: 'arrow.left.and.right.circle.fill', android: 'swap_horiz', web: 'swap_horiz' },
  vertical_pull: { ios: 'arrow.down.circle.fill', android: 'arrow_downward', web: 'arrow_downward' },
  conditioning: { ios: 'bolt.heart.fill', android: 'monitor_heart', web: 'monitor_heart' },
  jump: { ios: 'figure.jumprope', android: 'directions_run', web: 'directions_run' },
  brace: { ios: 'figure.core.training', android: 'accessibility_new', web: 'accessibility_new' },
};

function movementLabel(value: string, locale: 'ar' | 'en'): string {
  const labels: Record<string, { ar: string; en: string }> = {
    squat: { ar: 'القرفصاء والرجلين', en: 'Squat and legs' },
    hinge: { ar: 'السلسلة الخلفية', en: 'Hinge and posterior chain' },
    horizontal_push: { ar: 'الدفع الأفقي', en: 'Horizontal push' },
    vertical_push: { ar: 'الدفع العمودي', en: 'Vertical push' },
    horizontal_pull: { ar: 'السحب الأفقي', en: 'Horizontal pull' },
    vertical_pull: { ar: 'السحب العمودي', en: 'Vertical pull' },
    lunge: { ar: 'الاندفاع والتوازن', en: 'Lunge and balance' },
    brace: { ar: 'الجذع والثبات', en: 'Core and bracing' },
    conditioning: { ar: 'اللياقة الوظيفية', en: 'Conditioning' },
    jump: { ar: 'القفز والقوة الانفجارية', en: 'Jump and power' },
    squat_to_press: { ar: 'حركات مركبة', en: 'Compound movement' },
    knee_flexion: { ar: 'خلفية الفخذ', en: 'Knee flexion' },
  };
  return labels[value]?.[locale] ?? value.replaceAll('_', ' ');
}

function iconFor(exercise: LibraryExercise): SymbolName {
  return movementSymbols[exercise.movement_pattern] ?? { ios: 'figure.strengthtraining.functional', android: 'fitness_center', web: 'fitness_center' };
}

function ExerciseRow({ exercise, index, onPress }: { exercise: LibraryExercise; index: number; onPress: () => void }) {
  const theme = useTheme();
  const { locale } = useLocale();
  const { reduce, duration } = useMotion();
  const ar = locale === 'ar';
  const equipment = asLibraryList(exercise.equipment);
  const muscles = asLibraryList(exercise.primary_muscles);
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.delay(Math.min(index, 8) * 35).duration(duration(240))}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          paddingVertical: spacing[3],
          paddingHorizontal: spacing[2],
          borderRadius: radius.md,
          backgroundColor: pressed ? theme.surfaceMuted : 'transparent',
        })}
      >
        <View style={{ width: 50, height: 50, borderRadius: radius.md, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name={iconFor(exercise)} size={23} tintColor={theme.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: theme.text, fontFamily: fontFamily.semibold, fontSize: typeScale.body, textAlign: ar ? 'right' : 'left', writingDirection: ar ? 'rtl' : 'ltr' }}>
            {ar ? exercise.name_ar : exercise.name_en}
          </Text>
          {ar ? <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.micro, textAlign: 'right' }}>{exercise.name_en}</Text> : null}
          <Text numberOfLines={1} style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: typeScale.label, textAlign: ar ? 'right' : 'left' }}>
            {[labelList(locale, 'muscle', muscles), labelList(locale, 'equipment', equipment)].filter(Boolean).join('  •  ')}
          </Text>
        </View>
        <View style={{ alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing[2], paddingVertical: 6 }}>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.semibold, fontSize: typeScale.micro }}>{label(locale, 'experience', exercise.difficulty)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function DetailTag({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: theme.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
      <Text style={{ color: theme.text, fontFamily: fontFamily.medium, fontSize: typeScale.label }}>{children}</Text>
    </View>
  );
}

export default function ExercisesScreen() {
  const { locale } = useLocale();
  const theme = useTheme();
  const ar = locale === 'ar';
  const [query, setQuery] = useState('');
  const [discipline, setDiscipline] = useState<TrainingFamily>('all');
  const [environment, setEnvironment] = useState<TrainingEnvironment>('all');
  const [brand, setBrand] = useState<EquipmentBrand | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const exercises = useQuery({
    queryKey: ['exercises'],
    queryFn: () => apiRequest<{ exercises: LibraryExercise[] }>('/v1/exercises'),
  });
  const manufacturers = useQuery({
    queryKey: ['equipment-manufacturers'],
    queryFn: () => apiRequest<{ manufacturers: EquipmentManufacturer[] }>('/v1/equipment/manufacturers'),
  });
  const visible = useMemo(
    () => filterExerciseLibrary(exercises.data?.exercises ?? [], { query, discipline, environment, brand }),
    [brand, discipline, environment, exercises.data?.exercises, query],
  );
  const familyCounts = useMemo(() => {
    const library = exercises.data?.exercises ?? [];
    const count = (family: TrainingFamily) => filterExerciseLibrary(library, { query: '', discipline: family, environment: 'all', brand: 'all' }).length;
    return { all: library.length, strength: count('strength'), crossfit: count('crossfit'), calisthenics: count('calisthenics') };
  }, [exercises.data?.exercises]);
  const rows = useMemo<LibraryRow[]>(() => {
    const grouped = new Map<string, LibraryExercise[]>();
    for (const exercise of visible) {
      const group = exercise.movement_pattern || 'other';
      grouped.set(group, [...(grouped.get(group) ?? []), exercise]);
    }
    return [...grouped.entries()].flatMap(([movement, items]) => [
      { kind: 'section' as const, key: `section-${movement}`, title: movementLabel(movement, locale) },
      ...items.map((exercise) => ({ kind: 'exercise' as const, key: exercise.id, exercise })),
    ]);
  }, [locale, visible]);
  const activeFilters = [discipline !== 'all', environment !== 'all', brand !== 'all'].filter(Boolean).length;

  if (exercises.isPending) {
    return <Screen><LoadingSkeleton /></Screen>;
  }
  if (exercises.isError || exercises.data === undefined) {
    const offline = exercises.error instanceof ApiClientError && exercises.error.code === 'OFFLINE';
    return <Screen title={text(locale, 'exercises')}><ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void exercises.refetch()} /></Screen>;
  }

  return (
    <Screen>
      <FlashList
        data={rows}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.kind}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing[7] }}
        ListHeaderComponent={(
          <View>
            <AppHeader
              title={ar ? 'مكتبة الحركة' : 'Movement library'}
              subtitle={ar ? 'ابحث باسم التمرين، العضلة، أو الجهاز' : 'Search by exercise, muscle or equipment'}
              trailing={<Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}><Text style={{ color: theme.accent, fontFamily: fontFamily.semibold }}>{ar ? 'إغلاق' : 'Close'}</Text></Pressable>}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <View style={{ flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderRadius: radius.pill, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingHorizontal: spacing[4] }}>
                <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={17} tintColor={theme.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={ar ? 'مثال: صدر، سحب، سكوات' : 'e.g. chest, pull, squat'}
                  placeholderTextColor={theme.textMuted}
                  autoCorrect={false}
                  returnKeyType="search"
                  style={{ flex: 1, color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, textAlign: ar ? 'right' : 'left', writingDirection: ar ? 'rtl' : 'ltr' }}
                />
                {query.length > 0 ? <Pressable onPress={() => setQuery('')} hitSlop={8}><SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={17} tintColor={theme.textMuted} /></Pressable> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ar ? 'تصفية التمارين' : 'Filter exercises'}
                onPress={() => setFiltersOpen(true)}
                style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: activeFilters > 0 ? theme.accent : theme.surface, borderWidth: 1, borderColor: activeFilters > 0 ? theme.accent : theme.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <SymbolView name={{ ios: 'line.3.horizontal.decrease', android: 'tune', web: 'tune' }} size={20} tintColor={activeFilters > 0 ? theme.emphasisText : theme.text} />
                {activeFilters > 0 ? <View style={{ position: 'absolute', top: -3, end: -2, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: theme.ember, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.emberInk, fontFamily: fontFamily.bold, fontSize: 10 }}>{activeFilters}</Text></View> : null}
              </Pressable>
            </View>
            <View style={{ height: spacing[4] }} />
            <TrainingFamilyCards value={discipline} onChange={setDiscipline} counts={familyCounts} />
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium, fontSize: typeScale.label, marginBottom: spacing[2], textAlign: ar ? 'right' : 'left' }}>
              {ar ? `${formatCount(visible.length, locale)} تمرين مطابق` : `${formatCount(visible.length, locale)} matching exercises`}
            </Text>
          </View>
        )}
        ListEmptyComponent={<EmptyState compact title={ar ? 'لا توجد نتائج' : 'No results'} body={ar ? 'جرّب كلمة أقصر أو غيّر التصفية.' : 'Try a shorter search or change the filters.'} />}
        renderItem={({ item, index }) => item.kind === 'section'
          ? <SectionLabel>{item.title}</SectionLabel>
          : <ExerciseRow exercise={item.exercise} index={index} onPress={() => setSelected(item.exercise)} />}
      />

      {filtersOpen ? <BottomSheet visible onClose={() => setFiltersOpen(false)}>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 580 }}>
          <AppHeader title={ar ? 'تصفية المكتبة' : 'Filter library'} subtitle={ar ? 'أظهر ما يناسب رياضتك ومكانك فقط' : 'Show what fits your sport and place'} />
          <SectionLabel>{ar ? 'الرياضة' : 'Discipline'}</SectionLabel>
          <TrainingFamilyCards value={discipline} onChange={setDiscipline} counts={familyCounts} />
          <SectionLabel>{ar ? 'مكان التدريب' : 'Training place'}</SectionLabel>
          <EnvironmentCards
            value={environment}
            onChange={(next) => {
              setEnvironment(next);
              if (next !== 'gym') setBrand('all');
            }}
          />
          {environment === 'gym' ? (
            <>
              <SectionLabel>{ar ? 'شركة الأجهزة' : 'Equipment brand'}</SectionLabel>
              <EquipmentBrandCards value={brand} onChange={setBrand} manufacturers={manufacturers.data?.manufacturers ?? []} />
            </>
          ) : null}
          <Button label={ar ? 'مسح التصفية' : 'Clear filters'} variant="secondary" onPress={() => { setDiscipline('all'); setEnvironment('all'); setBrand('all'); }} />
          <Button label={ar ? 'عرض النتائج' : 'Show results'} onPress={() => setFiltersOpen(false)} />
        </ScrollView>
      </BottomSheet> : null}

      {selected !== null ? <BottomSheet visible onClose={() => setSelected(null)}>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 620 }} contentContainerStyle={{ paddingBottom: spacing[4] }}>
            <View style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] }}>
              <SymbolView name={iconFor(selected)} size={30} tintColor={theme.accent} />
            </View>
            <AppHeader title={ar ? selected.name_ar : selected.name_en} subtitle={ar ? selected.name_en : movementLabel(selected.movement_pattern, locale)} />
            <MovementDemo3D profile={selected.demonstrationMedia?.profile ?? selected.movement_pattern} equipment={asLibraryList(selected.equipment)} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] }}>
              <DetailTag>{label(locale, 'experience', selected.difficulty)}</DetailTag>
              <DetailTag>{movementLabel(selected.movement_pattern, locale)}</DetailTag>
              {asLibraryList(selected.primary_muscles).map((muscle) => <DetailTag key={muscle}>{label(locale, 'muscle', muscle)}</DetailTag>)}
            </View>
            <SectionLabel>{text(locale, 'equipment')}</SectionLabel>
            <Text style={{ color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 25, textAlign: ar ? 'right' : 'left' }}>
              {labelList(locale, 'equipment', asLibraryList(selected.equipment))}
            </Text>
            {asLibraryList(selected.equipment_brands).length > 0 ? (
              <>
                <SectionLabel>{ar ? 'الشركات المتوافقة عادةً' : 'Common compatible brands'}</SectionLabel>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                  {asLibraryList(selected.equipment_brands).map((item) => (
                    <DetailTag key={item}>{brandLabel(item, locale, manufacturers.data?.manufacturers)}</DetailTag>
                  ))}
                </View>
              </>
            ) : null}
            <SectionLabel>{ar ? 'طريقة الحركة' : 'Movement guidance'}</SectionLabel>
            {asLibraryList(ar ? selected.instructions_ar : selected.instructions_en).map((instruction, index) => (
              <View key={`${instruction}-${index}`} style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: theme.emphasisText, fontFamily: fontFamily.bold }}>{formatCount(index + 1, locale)}</Text>
                </View>
                <Text style={{ flex: 1, color: theme.text, fontFamily: fontFamily.regular, fontSize: typeScale.body, lineHeight: 25, textAlign: ar ? 'right' : 'left', writingDirection: ar ? 'rtl' : 'ltr' }}>{instruction}</Text>
              </View>
            ))}
            <Text style={{ color: theme.warning, fontFamily: fontFamily.medium, fontSize: typeScale.micro, lineHeight: 17, marginTop: spacing[2], textAlign: ar ? 'right' : 'left' }}>{text(locale, 'unreviewed')}</Text>
        </ScrollView>
      </BottomSheet> : null}
    </Screen>
  );
}
