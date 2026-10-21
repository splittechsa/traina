export type Flight<T> = { key: string; promise: Promise<T> };
/** Share an in-flight drain within the same owned workout, without blocking a different account. */
export function singleFlight<T>(slot: { current: Flight<T> | null }, key: string, operation: () => Promise<T>): Promise<T> {
  if (slot.current?.key === key) return slot.current.promise;
  const flight: Flight<T> = { key, promise: Promise.resolve().then(operation) };
  flight.promise = flight.promise.finally(() => { if (slot.current === flight) slot.current = null; });
  slot.current = flight;
  return flight.promise;
}
