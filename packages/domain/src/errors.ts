export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function assertSafeNonNegativeInteger(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError(code, 'Expected a non-negative safe integer');
  }
}

export function assertIsoDateTime(value: string, code: string): void {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new DomainError(code, 'Expected an ISO-8601 timestamp');
  }
}
