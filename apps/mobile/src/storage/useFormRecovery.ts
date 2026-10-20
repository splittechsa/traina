import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useNavigation } from 'expo-router';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import { useSession } from '../auth/SessionProvider';
import { useLocale } from '../i18n/LocaleProvider';
import { registerLeaveGuard } from './navigationDrafts';
import { accountScope } from '../offline/resource';
import { readAccountSnapshot, removeAccountSnapshot, writeAccountSnapshot } from '../offline/sqlite';

/** Account-bound autosave complements navigation prompts: background/process termination cannot be blocked. */
export function useFormRecovery<T>(key: string, value: T, restore: (value: T) => void, dirty: boolean, enabled = true) {
  const { tokens } = useSession(); const { locale } = useLocale(); const ar = locale === 'ar'; const navigation = useNavigation();
  const owner = tokens?.userId ? accountScope() : null;
  const [hydrated, setHydrated] = useState<string | null>(null); const [saved, setSaved] = useState<string | null>(null);
  const latest = useRef(value); const restoreRef = useRef(restore); const dirtyRef = useRef(dirty);
  useEffect(() => { latest.current = value; restoreRef.current = restore; dirtyRef.current = dirty; });
  const baseline = useRef(value); const focused = useIsFocused();
  const serialized = JSON.stringify(value); const identity = owner && enabled ? owner + ':' + key : null;
  useEffect(() => {
    if (!owner || !enabled) return; let cancelled = false;
    void readAccountSnapshot<T>(owner, 'draft:' + key).then(draft => {
      if (cancelled || accountScope() !== owner) return;
      baseline.current = latest.current;
      if (draft !== null) restoreRef.current(draft);
      setHydrated(identity);
    }).catch(() => { if (!cancelled) Alert.alert(ar ? 'تعذر قراءة المسودة' : 'Draft could not be read'); });
    return () => { cancelled = true; };
  }, [owner, enabled, key, identity, ar]);
  const persist = useCallback(async () => {
    if (owner && accountScope() === owner && hydrated === identity && dirtyRef.current) await writeAccountSnapshot(owner, 'draft:' + key, latest.current);
  }, [owner, hydrated, identity, key]);
  useEffect(() => {
    if (dirty && serialized !== saved) void persist().catch(() => Alert.alert(ar ? 'تعذر حفظ المسودة' : 'Draft could not be saved'));
  }, [serialized, saved, dirty, persist, ar]);
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state !== 'active') void persist().catch(() => undefined); }); return () => sub.remove(); }, [persist]);
  const clear = useCallback(async () => { baseline.current = latest.current; setSaved(JSON.stringify(latest.current)); if (owner) await removeAccountSnapshot(owner, 'draft:' + key); }, [owner, key]);
  const confirmLeave = useCallback((proceed: () => void) => {
    Alert.alert(ar ? 'تغييرات غير محفوظة' : 'Unsaved changes', ar ? 'احفظ مسودة على هذا الجهاز أو تجاهل التغييرات أو تابع التحرير.' : 'Save a draft on this device, discard changes, or continue editing.', [
      { text: ar ? 'متابعة التحرير' : 'Continue editing', style: 'cancel' },
      { text: ar ? 'تجاهل' : 'Discard', style: 'destructive', onPress: () => { void (async () => { if (owner) await removeAccountSnapshot(owner, 'draft:' + key); restoreRef.current(baseline.current); setSaved(JSON.stringify(baseline.current)); proceed(); })().catch(() => Alert.alert(ar ? 'تعذر تجاهل المسودة' : 'Could not discard draft')); } },
      { text: ar ? 'حفظ مسودة والمغادرة' : 'Save draft and leave', onPress: () => {
        if (!owner || hydrated !== identity) return;
        void persist().then(proceed).catch(() => Alert.alert(ar ? 'تعذر الحفظ' : 'Could not save'));
      } },
    ]);
  }, [ar, owner, key, hydrated, identity, persist]);
  const blocked = dirty && serialized !== saved;
  usePreventRemove(blocked, ({ data }) => confirmLeave(() => navigation.dispatch(data.action)));
  useEffect(() => { if (!focused || !blocked) return; return registerLeaveGuard(confirmLeave); }, [focused, blocked, confirmLeave]);
  return { clear, ready: identity !== null && hydrated === identity };
}
