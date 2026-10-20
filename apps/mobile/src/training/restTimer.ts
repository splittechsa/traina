export type RestTimerState = { endsAt: number; paused?: boolean; remainingSeconds?: number };

export function remainingRest(state: RestTimerState | null, now: number): number {
  if (state === null || !Number.isFinite(state.endsAt)) return 0;
  const seconds = state.paused && Number.isFinite(state.remainingSeconds)
    ? state.remainingSeconds!
    : (state.endsAt - now) / 1000;
  return Math.max(0, Math.ceil(seconds));
}

export function startRestTimer(seconds: number, now: number): RestTimerState {
  const duration = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  return { endsAt: now + duration * 1000, paused: false };
}

export function pauseRestTimer(state: RestTimerState | null, now: number): RestTimerState {
  return { endsAt: state?.endsAt ?? now, paused: true, remainingSeconds: remainingRest(state, now) };
}

export function resumeRestTimer(state: RestTimerState | null, now: number): RestTimerState {
  return startRestTimer(remainingRest(state, now), now);
}
