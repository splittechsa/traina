import { Text } from '../src/ui/Text';
import { useFormRecovery } from '../src/storage/useFormRecovery';
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProgramDayDocument } from '@sahhti/domain';
import { apiRequest, ApiClientError } from '../src/api/client';
import { useLocale } from '../src/i18n/LocaleProvider';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, Field, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton, SurfaceCard, SectionLabel } from '../src/ui/kit';

type Program = { id: string; name: string; version: number; active: boolean; archivedAt: string | null };
type Version = { version: number; source: string; createdAt: string; document: { programName?: string; restoredFromVersion?: number; days: ProgramDayDocument[] } };
export default function ProgramManage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useLocale(); const ar = locale === 'ar'; const theme = useTheme(); const client = useQueryClient();
  const [name, setName] = useState(''); const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Version | null>(null); const [comparison, setComparison] = useState<Version | null>(null);
  const [confirm, setConfirm] = useState<'archive' | 'restore' | null>(null);
  const [before, setBefore] = useState<number | null>(null);
  const nameDraft = useFormRecovery('program-name:' + id, { name }, draft => setName(draft.name), name !== '');
  const program = useQuery({ queryKey: ['program-detail', id], queryFn: () => apiRequest<{ program: Program }>(`/v1/training/programs/${id}`) });
  const history = useQuery({ queryKey: ['program-history', id, before], queryFn: () => apiRequest<{ versions: Version[]; nextBefore: number | null }>(`/v1/training/programs/${id}/history${before === null ? '' : '?before=' + before}`) });
  const exercises = useQuery({ queryKey: ['exercises'], queryFn: () => apiRequest<{ exercises: { id: string; name_ar: string; name_en: string }[] }>('/v1/exercises') });
  const current = program.data?.program;
  const action = useMutation({
    mutationFn: (kind: string) => apiRequest(`/v1/training/programs/${id}/actions`, { method: 'POST', body: { action: kind, expectedVersion: current?.version,
      ...(['rename', 'duplicate'].includes(kind) ? { name: name.trim() } : {}), ...(kind === 'restore' ? { version: selected?.version } : {}) } }),
    onSuccess: async () => { await nameDraft.clear(); setName(''); setConfirm(null); setBefore(null); setMessage(ar ? 'تم حفظ التغيير' : 'Change saved');
      await Promise.all(['training-programs', 'program-detail', 'program-history', 'home'].map(key => client.invalidateQueries({ queryKey: [key] }))); },
    onError: error => setMessage(error instanceof ApiClientError && error.code === 'PROGRAM_VERSION_CONFLICT' ? (ar ? 'تغير البرنامج. حدّث الصفحة ثم راجع اختيارك.' : 'Program changed. Refresh and review your selection.') : (ar ? 'تعذر حفظ التغيير. حاول مجددًا.' : 'Could not save the change. Try again.')),
  });
  function versionView(version: Version) { return <SurfaceCard key={version.version} style={{ marginBottom: 10 }}>
    <Text style={{ color: theme.text }}>{ar ? 'إصدار' : 'Version'} {version.version} · {version.document.programName ?? current?.name}</Text>
    {version.document.restoredFromVersion ? <Text style={{ color: theme.textMuted }}>{ar ? 'استعادة من' : 'Restored from'} {version.document.restoredFromVersion}</Text> : null}
    {version.document.days.map((day, dayIndex) => <View key={dayIndex}>
      <Text style={{ color: theme.text }}>{ar ? day.name_ar : day.name_en}</Text>
      {day.exerciseIds.map((exerciseId, index) => { const exercise = exercises.data?.exercises.find(row => row.id === exerciseId); const settings = day.strengthOverrides?.[exerciseId]; return <Text key={index} style={{ color: theme.textMuted }}>{index + 1}. {exercise ? (ar ? exercise.name_ar : exercise.name_en) : (ar ? 'تمرين غير متاح' : 'Unavailable exercise')}{settings ? ` · ${settings.sets} × ${settings.reps} · ${settings.restSeconds} ${ar ? 'ث' : 's'}` : (ar ? ' · إعدادات القالب' : ' · Template settings')}</Text>; })}
    </View>)}
  </SurfaceCard>; }
  if (program.isPending) return <Screen><LoadingSkeleton /></Screen>;
  if (!current || program.isError) return <Screen><ErrorState body={ar ? 'تعذر التحميل' : 'Could not load'} onRetry={() => void program.refetch()} /></Screen>;
  return <Screen><ScreenBody><AppHeader showBack title={ar ? 'إدارة البرنامج' : 'Manage program'} subtitle={current.name} />
    <Text accessibilityLiveRegion="polite" style={{ color: theme.text }}>{message}</Text>
    {!current.archivedAt ? <>
      <Field label={ar ? 'اسم البرنامج أو النسخة' : 'Program or copy name'} value={name} onChangeText={setName} />
      <Button label={ar ? 'تغيير الاسم' : 'Rename'} disabled={!name.trim() || action.isPending} onPress={() => action.mutate('rename')} />
      <Button label={ar ? 'نسخ البرنامج' : 'Duplicate'} disabled={!name.trim() || action.isPending} onPress={() => action.mutate('duplicate')} />
      <Button label={ar ? 'تعديل التمارين' : 'Edit exercises'} onPress={() => router.push({ pathname: '/program-edit', params: { id } })} />
      {!current.active ? <Button label={ar ? 'تفعيل البرنامج' : 'Make active'} disabled={action.isPending} onPress={() => action.mutate('activate')} /> : null}
      <Button label={ar ? 'أرشفة البرنامج' : 'Archive program'} variant="secondary" disabled={action.isPending} onPress={() => setConfirm('archive')} />
    </> : <Text style={{ color: theme.text }}>{ar ? 'هذا البرنامج مؤرشف. الإصدارات للقراءة فقط.' : 'This program is archived. History is read-only.'}</Text>}
    {confirm ? <SurfaceCard><Text style={{ color: theme.text }}>{confirm === 'restore' ? (ar ? 'إنشاء إصدار جديد من الإصدار المختار؟ لن يتغير سجل التمارين.' : 'Create a new version from this selection? Past workouts stay unchanged.') : (ar ? 'أرشفة البرنامج وإلغاء تفعيله مع الاحتفاظ بالسجل؟' : 'Archive and deactivate this program while retaining history?')}</Text>
      <Button label={ar ? 'تأكيد' : 'Confirm'} disabled={action.isPending} onPress={() => action.mutate(confirm)} /><Button label={ar ? 'إلغاء' : 'Cancel'} variant="secondary" onPress={() => setConfirm(null)} /></SurfaceCard> : null}
    <SectionLabel>{ar ? 'الإصدارات والمقارنة' : 'Versions and comparison'}</SectionLabel>
    {history.isPending ? <LoadingSkeleton /> : history.isError ? <ErrorState body={ar ? 'تعذر التحميل' : 'Could not load'} onRetry={() => void history.refetch()} /> : history.data?.versions.map(version => <View key={version.version}>
      <Button label={`${ar ? 'عرض إصدار' : 'View version'} ${version.version}`} variant="secondary" onPress={() => { setSelected(version); setConfirm(null); }} />
      <Button label={`${ar ? 'مقارنة مع' : 'Compare with'} ${version.version}`} variant="secondary" onPress={() => setComparison(version)} />
    </View>)}
    {history.data?.nextBefore ? <Button label={ar ? 'إصدارات أقدم' : 'Older versions'} onPress={() => setBefore(history.data!.nextBefore)} /> : null}
    {before !== null ? <Button label={ar ? 'أحدث الإصدارات' : 'Latest versions'} onPress={() => setBefore(null)} /> : null}
    {selected ? versionView(selected) : null}{comparison ? versionView(comparison) : null}
    {selected && comparison ? <Text style={{ color: theme.text }}>{JSON.stringify(selected.document.days) === JSON.stringify(comparison.document.days) ? (ar ? 'التمارين والوصفات متطابقة' : 'Exercises and prescriptions match') : (ar ? 'توجد تغييرات في الأيام أو التمارين أو الوصفات. راجع الإصدارين أعلاه.' : 'Days, exercises or prescriptions differ. Review the two versions above.')}</Text> : null}
    {selected && !current.archivedAt ? <Button label={ar ? 'استعادة كإصدار جديد' : 'Restore as a new version'} disabled={action.isPending} onPress={() => setConfirm('restore')} /> : null}
  </ScreenBody></Screen>;
}
