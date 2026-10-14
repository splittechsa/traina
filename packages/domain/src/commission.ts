import { DomainError, assertSafeNonNegativeInteger } from './errors.js';
import { applyBasisPoints, assertCurrency, type CurrencyCode } from './money.js';

export type CommissionModel = 'first_payment_only' | 'recurring_revenue';
export type CommissionBase = 'gross' | 'net_of_store_fee' | 'net_of_store_fee_and_tax';
export type TaxTreatment = 'inclusive' | 'exclusive' | 'none';
export type LedgerAccount =
  | 'cash_clearing'
  | 'store_fee_payable'
  | 'tax_payable'
  | 'gym_commission_payable'
  | 'platform_revenue';
export type LedgerDirection = 'debit' | 'credit';

export type TaxPolicy = {
  id: string;
  treatment: TaxTreatment;
  rateBps: number;
  legalReview: 'unreviewed' | 'reviewed';
};

export type CommissionPolicy = {
  contractId: string;
  policyVersion: number;
  model: CommissionModel;
  rateBps: number;
  commissionBase: CommissionBase;
  currency: CurrencyCode;
};

export type StoreVerifierName = 'app_store_server_notification' | 'play_developer_notification' | 'test_fixture';

export type VerifiedCharge = {
  paymentEventId: string;
  currency: CurrencyCode;
  cashCollectedMinor: number;
  storeFeeMinor: number;
  taxMinor: number;
  isRenewal: boolean;
  verifier: StoreVerifierName;
};

export type LedgerLine = {
  idempotencyKey: string;
  paymentEventId: string;
  account: LedgerAccount;
  direction: LedgerDirection;
  amountMinor: number;
  currency: CurrencyCode;
  contractId: string;
  gymOrganizationId: string;
  policyVersion: number;
  attributionId: string;
};

export type CommissionDecision = {
  idempotencyKey: string;
  paymentEventId: string;
  attributionId: string;
  contractId: string;
  policyVersion: number;
  model: CommissionModel;
  kind: 'accrual' | 'skipped';
  skipReason: 'first_payment_already_accrued' | null;
  baseMinor: number;
  commissionMinor: number;
  settlementAllowed: boolean;
};

export type CommissionPosting = {
  decision: CommissionDecision;
  lines: readonly LedgerLine[];
};

export type PriorCommissionPosting = {
  paymentEventId: string;
  kind: 'accrual' | 'skipped';
};

function assertAmount(value: number, code: string): void {
  assertSafeNonNegativeInteger(value, code);
}

export function taxFromPolicy(cashOrNetMinor: number, policy: TaxPolicy): number {
  assertAmount(cashOrNetMinor, 'INVALID_AMOUNT');
  assertSafeNonNegativeInteger(policy.rateBps, 'INVALID_BASIS_POINTS');
  if (policy.rateBps > 10_000) {
    throw new DomainError('INVALID_BASIS_POINTS', 'Tax rate cannot exceed 10000 basis points');
  }
  if (policy.treatment === 'none' || policy.rateBps === 0) {
    return 0;
  }
  if (policy.treatment === 'inclusive') {
    const rate = BigInt(policy.rateBps);
    return Number((BigInt(cashOrNetMinor) * rate) / (10_000n + rate));
  }
  return applyBasisPoints(cashOrNetMinor, policy.rateBps);
}

export function assertBalanced(lines: readonly LedgerLine[]): void {
  let debits = 0n;
  let credits = 0n;
  for (const line of lines) {
    assertAmount(line.amountMinor, 'INVALID_AMOUNT');
    if (line.direction === 'debit') {
      debits += BigInt(line.amountMinor);
    } else {
      credits += BigInt(line.amountMinor);
    }
  }
  if (debits !== credits) {
    throw new DomainError('UNBALANCED_LEDGER', 'Debits and credits are not equal');
  }
}

export function findIdempotentReplay(
  existingKeys: readonly string[],
  lines: readonly LedgerLine[],
): 'new' | 'replay' | 'conflict' {
  const keys = lines.map((line) => line.idempotencyKey);
  const existing = new Set(existingKeys);
  const hits = keys.filter((key) => existing.has(key));
  if (hits.length === 0) {
    return 'new';
  }
  if (hits.length === keys.length) {
    return 'replay';
  }
  return 'conflict';
}

export function reverseLedgerLines(lines: readonly LedgerLine[], refundEventId: string): LedgerLine[] {
  if (refundEventId.trim().length === 0) {
    throw new DomainError('INVALID_REFUND', 'Refund event id is required');
  }
  const reversed = lines.map((line) => ({
    ...line,
    idempotencyKey: `refund:${refundEventId}:${line.account}`,
    paymentEventId: refundEventId,
    direction: line.direction === 'debit' ? 'credit' as const : 'debit' as const,
  }));
  assertBalanced(reversed);
  return reversed;
}

function commissionBaseMinor(charge: VerifiedCharge, policy: CommissionPolicy): number {
  switch (policy.commissionBase) {
    case 'gross':
      return charge.cashCollectedMinor;
    case 'net_of_store_fee':
      return charge.cashCollectedMinor - charge.storeFeeMinor;
    case 'net_of_store_fee_and_tax':
      return charge.cashCollectedMinor - charge.storeFeeMinor - charge.taxMinor;
    default:
      throw new DomainError('INVALID_POLICY', 'Unknown commission base');
  }
}

export function calculateCommissionPosting(input: {
  purpose: 'quote' | 'settle';
  policy: CommissionPolicy;
  charge: VerifiedCharge;
  gymOrganizationId: string;
  attributionId: string;
  priorPostings: readonly PriorCommissionPosting[];
  taxPolicy: TaxPolicy;
  allowTestFixtures: boolean;
}): CommissionPosting {
  assertCurrency(input.policy.currency);
  assertCurrency(input.charge.currency);
  if (input.policy.currency !== input.charge.currency) {
    throw new DomainError('CURRENCY_MISMATCH', 'Policy and charge currencies differ');
  }
  assertAmount(input.charge.cashCollectedMinor, 'INVALID_AMOUNT');
  assertAmount(input.charge.storeFeeMinor, 'INVALID_AMOUNT');
  assertAmount(input.charge.taxMinor, 'INVALID_AMOUNT');
  assertSafeNonNegativeInteger(input.policy.rateBps, 'INVALID_BASIS_POINTS');
  if (input.policy.rateBps > 10_000) {
    throw new DomainError('INVALID_BASIS_POINTS', 'Commission rate cannot exceed 10000 basis points');
  }
  if (input.charge.storeFeeMinor + input.charge.taxMinor > input.charge.cashCollectedMinor) {
    throw new DomainError('INVALID_CHARGE', 'Store fee and tax exceed cash collected');
  }
  if (
    input.charge.verifier !== 'test_fixture' &&
    input.charge.verifier !== 'app_store_server_notification' &&
    input.charge.verifier !== 'play_developer_notification'
  ) {
    throw new DomainError('UNVERIFIED_STORE_EVENT', 'Unknown store verifier');
  }

  let settlementAllowed = false;
  if (input.purpose === 'settle') {
    if (input.charge.verifier === 'test_fixture' && !input.allowTestFixtures) {
      throw new DomainError('UNVERIFIED_STORE_EVENT', 'Test fixtures cannot settle outside tests');
    }
    if (input.taxPolicy.legalReview !== 'reviewed') {
      throw new DomainError('TAX_POLICY_NOT_REVIEWED', 'Settlement requires a reviewed tax policy');
    }
    settlementAllowed = input.charge.verifier !== 'test_fixture';
  }

  const skip =
    input.policy.model === 'first_payment_only' &&
    input.priorPostings.some((posting) => posting.paymentEventId !== input.charge.paymentEventId);

  const baseMinor = commissionBaseMinor(input.charge, input.policy);
  if (baseMinor < 0) {
    throw new DomainError('INVALID_CHARGE', 'Commission base is negative');
  }
  const commissionMinor = skip ? 0 : applyBasisPoints(baseMinor, input.policy.rateBps);
  const allocated = input.charge.storeFeeMinor + input.charge.taxMinor + commissionMinor;
  if (allocated > input.charge.cashCollectedMinor) {
    throw new DomainError('COMMISSION_EXCEEDS_PROCEEDS', 'Commission, fees, and tax exceed cash collected');
  }
  const platformMinor = input.charge.cashCollectedMinor - allocated;
  const paymentEventId = input.charge.paymentEventId;

  const line = (account: LedgerAccount, direction: LedgerDirection, amountMinor: number): LedgerLine => ({
    idempotencyKey: `charge:${paymentEventId}:${account}`,
    paymentEventId,
    account,
    direction,
    amountMinor,
    currency: input.charge.currency,
    contractId: input.policy.contractId,
    gymOrganizationId: input.gymOrganizationId,
    policyVersion: input.policy.policyVersion,
    attributionId: input.attributionId,
  });

  const lines: LedgerLine[] = [
    line('cash_clearing', 'debit', input.charge.cashCollectedMinor),
    line('store_fee_payable', 'credit', input.charge.storeFeeMinor),
    line('tax_payable', 'credit', input.charge.taxMinor),
    line('gym_commission_payable', 'credit', commissionMinor),
    line('platform_revenue', 'credit', platformMinor),
  ];
  assertBalanced(lines);

  return {
    decision: {
      idempotencyKey: `decision:${paymentEventId}`,
      paymentEventId,
      attributionId: input.attributionId,
      contractId: input.policy.contractId,
      policyVersion: input.policy.policyVersion,
      model: input.policy.model,
      kind: skip ? 'skipped' : 'accrual',
      skipReason: skip ? 'first_payment_already_accrued' : null,
      baseMinor,
      commissionMinor,
      settlementAllowed,
    },
    lines,
  };
}

/**
 * Test-only durable stand-in. It enforces idempotency and the lack of mutation
 * methods. It is not a production ledger and must not be wired to a public API.
 */
export class InMemoryLedger {
  private readonly lines: LedgerLine[] = [];

  post(lines: readonly LedgerLine[]): 'posted' | 'replay' {
    const disposition = findIdempotentReplay(
      this.lines.map((line) => line.idempotencyKey),
      lines,
    );
    if (disposition === 'conflict') {
      throw new DomainError('IDEMPOTENCY_CONFLICT', 'Partial idempotency key overlap');
    }
    if (disposition === 'replay') {
      return 'replay';
    }
    assertBalanced(lines);
    this.lines.push(...lines);
    return 'posted';
  }

  commissionPayableMinor(gymOrganizationId: string): number {
    return this.lines
      .filter((line) => line.account === 'gym_commission_payable' && line.gymOrganizationId === gymOrganizationId)
      .reduce((sum, line) => sum + (line.direction === 'credit' ? line.amountMinor : -line.amountMinor), 0);
  }

  entryCount(): number {
    return this.lines.length;
  }
}
