export type LeaveGuard = (proceed: () => void) => void;
const guards = new Map<symbol, LeaveGuard>();
export function registerLeaveGuard(guard: LeaveGuard): () => void { const key = Symbol(); guards.set(key, guard); return () => { guards.delete(key); }; }
export function requestNavigation(proceed: () => void): void { const guard = [...guards.values()].at(-1); if (guard) guard(proceed); else proceed(); }
