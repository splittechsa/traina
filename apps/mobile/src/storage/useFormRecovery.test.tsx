import { useEffect, useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFormRecovery } from './useFormRecovery';
import { requestNavigation } from './navigationDrafts';
const state = vi.hoisted(() => ({ owner: 'account-a', data: new Map<string, unknown>(), alert: vi.fn(), dispatch: vi.fn(), remove: null as null | ((input: { data: { action: { type: string } } }) => void), background: null as null | ((next: string) => void) }));
vi.mock('react-native', () => ({ Alert: { alert: state.alert }, AppState: { addEventListener: (_event: string, callback: (next: string) => void) => { state.background = callback; return { remove: () => undefined }; } } }));
vi.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: state.dispatch }) }));
vi.mock('expo-router/react-navigation', () => ({ useIsFocused: () => true, usePreventRemove: (blocked: boolean, callback: typeof state.remove) => { state.remove = blocked ? callback : null; } }));
vi.mock('../auth/SessionProvider', () => ({ useSession: () => ({ tokens: { userId: state.owner } }) }));
vi.mock('../i18n/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en' }) }));
vi.mock('../offline/resource', () => ({ accountScope: () => 'https://test|' + state.owner }));
vi.mock('../offline/sqlite', () => ({
  readAccountSnapshot: async (owner: string, key: string) => state.data.get(owner + key) ?? null,
  writeAccountSnapshot: async (owner: string, key: string, value: unknown) => { state.data.set(owner + key, value); },
  removeAccountSnapshot: async (owner: string, key: string) => { state.data.delete(owner + key); },
}));
let change: (next: string) => void; let current = ''; let renderer: TestRenderer.ReactTestRenderer | undefined;
function Form() { const [value, setValue] = useState(''); useEffect(() => { change = setValue; current = value; }, [value]); useFormRecovery('form', { value }, draft => setValue(draft.value), value !== ''); return null; }
async function open() { await act(async () => { renderer = TestRenderer.create(<Form />); }); }
async function close() { await act(async () => renderer?.unmount()); renderer = undefined; }
beforeEach(() => { state.owner = 'account-a'; state.data.clear(); state.alert.mockClear(); state.dispatch.mockClear(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(close);
describe('form recovery and navigation choices', () => {
  it('retains a backgrounded draft across remount while isolating a different account', async () => {
    await open(); await act(async () => change('unsaved member input'));
    await act(async () => state.background?.('background')); await close();
    await open(); expect(current).toBe('unsaved member input'); await close();
    state.owner = 'account-b'; await open(); expect(current).toBe('');
  });
  it('guards route removal and tab navigation; continue, draft/save and discard have distinct effects', async () => {
    await open(); await act(async () => change('my edit'));
    await act(async () => state.remove?.({ data: { action: { type: 'GO_BACK' } } }));
    const choices = state.alert.mock.calls.at(-1)![2];
    expect(choices[0].text).toBe('Continue editing'); expect(state.dispatch).not.toHaveBeenCalled();
    await act(async () => choices[2].onPress()); expect(state.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    const navigate = vi.fn(); await act(async () => requestNavigation(navigate)); expect(navigate).not.toHaveBeenCalled();
    await act(async () => state.alert.mock.calls.at(-1)![2][1].onPress());
    expect(navigate).toHaveBeenCalledOnce(); expect(current).toBe(''); expect(state.data.size).toBe(0);
  });
});
