import { describe, expect, it, vi } from 'vitest';
import { transitionSession } from './sessionTransition';

describe('transitionSession', () => {
  it('clears member data before replacing tokens on login', async () => {
    const events: string[] = [];
    const clear = vi.fn(() => events.push('clear'));
    const persist = vi.fn(async () => {
      events.push('persist');
    });

    await transitionSession(clear, persist, { accessToken: 'next-access', refreshToken: 'next-refresh' });

    expect(events).toEqual(['clear', 'persist']);
    expect(clear).toHaveBeenCalledOnce();
  });

  it('clears member data before deleting tokens on logout', async () => {
    const clear = vi.fn();
    const persist = vi.fn(async () => undefined);

    await transitionSession(clear, persist, null);

    expect(clear).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith(null);
  });
});
