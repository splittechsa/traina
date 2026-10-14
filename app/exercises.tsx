import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiClientError, apiRequest } from '../src/api/client';
import { useLocale } from '../src/i18n/LocaleProvider';
import { text } from '../src/i18n/copy';
import { Field, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, BottomSheet, EmptyState, ErrorState, ExerciseCard, LoadingSkeleton } from '../src/ui/kit';
import { label, labelList } from '../src/i18n/labels';

type Exercise = {
  id: string;
  name_ar: string;
  name_en: string;
  primary_muscles: string[] | string;
  secondary_muscles: string[] | string;
  equipment: string[] | string;
  difficulty: string;
  instructions_ar: string[] | string;
  instructions_en: string[] | string;
  demonstrationMedia: null;
};

function asList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    return value.replace(/[{}]/g, '').split(',').map((item) => item.trim()).filter((item) => item.length > 0);
  }
  return [];
}

export default function ExercisesScreen() {
  const { locale } = useLocale();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const exercises = useQuery({
    queryKey: ['exercises'],
    queryFn: () => apiRequest<{ exercises: Exercise[]; demonstrationMedia: null }>('/v1/exercises'),
  });
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = exercises.data?.exercises ?? [];
    if (needle.length === 0) {
      return rows;
    }
    return rows.filter((item) => item.name_ar.includes(query.trim()) || item.name_en.toLowerCase().includes(needle));
  }, [exercises.data?.exercises, query]);

  if (exercises.isPending) {
    return (
      <Screen>
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (exercises.isError || exercises.data === undefined) {
    const offline = exercises.error instanceof ApiClientError && exercises.error.code === 'OFFLINE';
    return (
      <Screen title={text(locale, 'exercises')}>
        <ErrorState body={text(locale, offline ? 'offline' : 'error')} onRetry={() => void exercises.refetch()} />
      </Screen>
    );
  }
  return (
    <Screen>
      <ScreenBody>
        <AppHeader title={text(locale, 'exercises')} subtitle={text(locale, 'noPhoto')} />
        <Field label={text(locale, 'searchExercises')} value={query} onChangeText={setQuery} />
        {visible.length === 0 ? <EmptyState title={text(locale, 'exercises')} body={text(locale, 'empty')} /> : null}
        {visible.map((item) => (
          <ExerciseCard
            key={item.id}
            title={locale === 'ar' ? item.name_ar : item.name_en}
            meta={labelList(locale, 'muscle', asList(item.primary_muscles))}
            onPress={() => setSelected(item)}
          />
        ))}
      </ScreenBody>
      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)}>
        {selected === null ? null : (
          <>
            <AppHeader title={locale === 'ar' ? selected.name_ar : selected.name_en} subtitle={text(locale, 'unreviewed')} />
            <EmptyState title={text(locale, 'muscles')} body={labelList(locale, 'muscle', asList(selected.primary_muscles))} />
            <EmptyState title={text(locale, 'equipment')} body={labelList(locale, 'equipment', asList(selected.equipment))} />
            <EmptyState
              title={text(locale, 'level')}
              body={label(locale, 'experience', selected.difficulty)}
            />
            <EmptyState
              title={text(locale, 'exercises')}
              body={asList(locale === 'ar' ? selected.instructions_ar : selected.instructions_en).join('\n')}
            />
          </>
        )}
      </BottomSheet>
    </Screen>
  );
}
