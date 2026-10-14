export function createThrottle(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now: number): boolean {
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}
