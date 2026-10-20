import { useState } from 'react';
import { Text } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../src/api/client';
import { accountResource } from '../src/offline/resource';
import { useFormRecovery } from '../src/storage/useFormRecovery';
import { useLocale } from '../src/i18n/LocaleProvider';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, Field, Screen, ScreenBody } from '../src/ui/Screen';
import { AppHeader, ErrorState, LoadingSkeleton } from '../src/ui/kit';
export default function ProfileEdit() {
  const { locale } = useLocale(); const ar = locale === 'ar'; const theme = useTheme(); const client = useQueryClient();
  const [name, setName] = useState(''); const [initial, setInitial] = useState<string | null>(null); const [message, setMessage] = useState('');
  const me = useQuery({ queryKey: ['profile-edit'], queryFn: () => accountResource<{ profile: { display_name: string | null } | null }>('/v1/me') });
  if (initial === null && me.data) { const value = me.data.profile?.display_name ?? ''; setInitial(value); setName(value); }
  const draft = useFormRecovery('profile', { name }, value => setName(value.name), initial !== null && name !== initial, initial !== null);
  const save = useMutation({ mutationFn: () => apiRequest('/v1/profile', { method: 'PATCH', body: { displayName: name.trim() } }),
    onSuccess: async () => { await draft.clear(); setInitial(name); setMessage(ar ? 'تم الحفظ' : 'Saved'); await Promise.all(['me', 'home', 'profile-edit'].map(key => client.invalidateQueries({ queryKey: [key] }))); },
    onError: () => setMessage(ar ? 'تعذر الحفظ. المسودة محفوظة على الجهاز.' : 'Could not save. The draft remains on this device.'),
  });
  if (me.isPending) return <Screen><LoadingSkeleton /></Screen>;
  if (me.isError) return <Screen><ErrorState body={ar ? 'تعذر التحميل' : 'Could not load'} onRetry={() => void me.refetch()} /></Screen>;
  return <Screen><ScreenBody><AppHeader showBack title={ar ? 'تعديل الملف' : 'Edit profile'} />
    <Field label={ar ? 'الاسم الظاهر' : 'Display name'} value={name} onChangeText={setName} />
    <Text accessibilityLiveRegion="polite" style={{ color: theme.text }}>{message}</Text>
    <Button label={ar ? 'حفظ' : 'Save'} disabled={save.isPending || !name.trim() || name.trim().length > 80} onPress={() => save.mutate()} />
  </ScreenBody></Screen>;
}
