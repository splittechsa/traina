export function uniqueById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }
  return unique;
}

export type SessionSummary = { id: string; status: string; scheduled_for: string };

/** One session to feature: the active one, otherwise the next scheduled session. */
export function featuredSession<T extends SessionSummary>(rows: readonly T[], today: string): T | null {
  const active = rows.find((row) => row.status === 'in_progress' || row.status === 'paused');
  if (active !== undefined) return active;
  const scheduled = rows
    .filter((row) => row.status === 'scheduled')
    .slice()
    .sort((left, right) => String(left.scheduled_for).localeCompare(String(right.scheduled_for)));
  return scheduled.find((row) => String(row.scheduled_for).slice(0, 10) >= today) ?? scheduled[0] ?? null;
}
