import { describe, expect, it } from 'vitest';
import { pauseRestTimer, remainingRest, resumeRestTimer, startRestTimer } from './restTimer';

describe('workout rest timer persistence', () => {
  it('uses wall-clock time after backgrounding and clamps expired timers', () => {
    const state = startRestTimer(90, 1000);
    expect(remainingRest(state, 61500)).toBe(30);
    expect(remainingRest(state, 100000)).toBe(0);
  });
  it('restores a paused timer without counting the time the app was closed', () => {
    const paused = pauseRestTimer(startRestTimer(90, 1000), 31000);
    const restored = JSON.parse(JSON.stringify(paused));
    expect(remainingRest(restored, 1000000)).toBe(60);
    const resumed = resumeRestTimer(restored, 1000000);
    expect(remainingRest(resumed, 1010000)).toBe(50);
  });
  it('accepts legacy running timers and safely handles missing or invalid data', () => {
    expect(remainingRest({ endsAt: 30000 }, 10000)).toBe(20);
    expect(remainingRest(null, 10000)).toBe(0);
    expect(remainingRest({ endsAt: NaN }, 10000)).toBe(0);
    expect(remainingRest(startRestTimer(NaN, 10000), 10000)).toBe(0);
  });
});
