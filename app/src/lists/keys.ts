export function stableRecordKey(id: string): string {
  const key = id.trim();
  if (key.length === 0) {
    throw new Error('A list row needs a stable id');
  }
  return key;
}
