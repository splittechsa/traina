import type { LedgerLine } from '@sahhti/domain';
import { DomainError } from '@sahhti/domain';

const COLUMNS = [
  'idempotency_key',
  'payment_event_id',
  'account',
  'direction',
  'amount_minor',
  'currency',
  'contract_id',
  'gym_organization_id',
  'policy_version',
  'attribution_id',
] as const;

export function insertLedgerStatement(lines: readonly LedgerLine[]): { text: string; values: unknown[] } {
  if (lines.length === 0) {
    throw new DomainError('EMPTY_LEDGER', 'Refusing to build an empty ledger insert');
  }
  const values: unknown[] = [];
  const tuples = lines.map((line) => {
    const offset = values.length;
    values.push(
      line.idempotencyKey,
      line.paymentEventId,
      line.account,
      line.direction,
      line.amountMinor,
      line.currency,
      line.contractId,
      line.gymOrganizationId,
      line.policyVersion,
      line.attributionId,
    );
    const placeholders = COLUMNS.map((_, index) => `$${offset + index + 1}`);
    return `(${placeholders.join(', ')})`;
  });
  return {
    text: `INSERT INTO financial_ledger_entries (${COLUMNS.join(', ')}) VALUES ${tuples.join(', ')}`,
    values,
  };
}
