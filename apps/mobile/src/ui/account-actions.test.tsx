import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestRenderer, { act } from 'react-test-renderer';
import AccountScreen from '../../app/account';
const mocks = vi.hoisted(() => ({ api: vi.fn(), clear: vi.fn(), replace: vi.fn(), alert: vi.fn(), share: vi.fn() }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Alert: { alert: mocks.alert }, Share: { share: mocks.share, sharedAction: 'sharedAction' } }));
vi.mock('expo-router', () => ({ router: { replace: mocks.replace, push: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { profile: null, goals: [] } }) }));
vi.mock('../api/client', () => ({ apiRequest: mocks.api }));
vi.mock('../auth/SessionProvider', () => ({ useSession: () => ({ tokens: {}, clear: mocks.clear }) }));
vi.mock('../i18n/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en' }) }));
vi.mock('../theme/ThemeProvider', () => ({ useTheme: () => ({}) }));
vi.mock('./Screen', () => ({ Screen: 'Screen', ScreenBody: 'ScreenBody' }));
vi.mock('./kit', () => ({ AppHeader: 'AppHeader', ProfileAvatar: 'ProfileAvatar', SettingsGroup: 'SettingsGroup', SettingsRow: 'SettingsRow' }));

beforeEach(() => { vi.clearAllMocks(); mocks.api.mockResolvedValue({}); mocks.clear.mockResolvedValue(undefined); });
async function mount() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<AccountScreen />); });
  return tree;
}
function row(tree: TestRenderer.ReactTestRenderer, title: string) {
  return tree.root.findAll(node => node.type === ('SettingsRow' as never)).find(node => node.props.title === title)!;
}

describe('account actions', () => {
  it('requires explicit confirmation before closing an account', async () => {
    const tree = await mount();
    await act(async () => row(tree, 'Close account').props.onPress());
    expect(mocks.api).not.toHaveBeenCalled();
    const buttons = mocks.alert.mock.calls[0][2];
    expect(buttons[0].style).toBe('cancel');
    expect(mocks.alert.mock.calls[0][1]).toContain('not immediately erased');
    await act(async () => buttons[1].onPress());
    expect(mocks.api).toHaveBeenCalledWith('/v1/account', { method: 'DELETE' });
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith('/(auth)/login');
    await act(async () => tree.unmount());
  });
  it('keeps the session and reports an error if closure fails', async () => {
    mocks.api.mockRejectedValue(new Error('offline'));
    const tree = await mount();
    await act(async () => row(tree, 'Close account').props.onPress());
    await act(async () => mocks.alert.mock.calls[0][2][1].onPress());
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledTimes(2);
    await act(async () => tree.unmount());
  });
  it('does not report success when the export share sheet is dismissed', async () => {
    mocks.share.mockResolvedValue({ action: 'dismissedAction' });
    const tree = await mount();
    await act(async () => row(tree, 'Export account summary').props.onPress());
    expect(mocks.share).toHaveBeenCalledOnce();
    expect(mocks.alert).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });
});
