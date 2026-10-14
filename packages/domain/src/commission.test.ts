import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  InMemoryLedger,
  calculateCommissionPosting,
  findIdempotentReplay,
  reverseLedgerLines,
  taxFromPolicy,
  type CommissionPolicy,
  type TaxPolicy,
  type VerifiedCharge,
} from './commission.js';

const policy: CommissionPolicy = {
  contractId: 'contract-1',
  policyVersion: 3,
  model: 'recurring_revenue',
  rateBps: 2_000,
  commissionBase: 'net_of_store_fee_and_tax',
  currency: 'SAR',
};

const reviewedTax: TaxPolicy = {
  id: 'test-vat-not-a-legal-determination',
  treatment: 'inclusive',
  rateBps: 1_500,
  legalReview: 'reviewed',
};

function charge(overrides: Partial<VerifiedCharge> = {}): VerifiedCharge {
  return {
    paymentEventId: 'pay-1',
    currency: 'SAR',
    cashCollectedMinor: 11_500,
    storeFeeMinor: 1_725,
    taxMinor: 1_500,
    isRenewal: false,
    verifier: 'test_fixture',
    ...overrides,
  };
}

describe('commission ledger', () => {
  it('extracts inclusive tax as an integer', () => {
    expect(taxFromPolicy(11_500, reviewedTax)).toBe(1_500);
  });

  it('posts a balanced commission and ignores any precomputed commission', () => {
    const posting = calculateCommissionPosting({
      purpose: 'quote',
      policy,
      charge: charge(),
      gymOrganizationId: 'gym-1',
      attributionId: 'attr-1',
      priorPostings: [],
      taxPolicy: reviewedTax,
      allowTestFixtures: true,
    });
    expect(posting.decision.baseMinor).toBe(8_275);
    expect(posting.decision.commissionMinor).toBe(1_655);
    expect(posting.decision.settlementAllowed).toBe(false);
    const platform = posting.lines.find((line) => line.account === 'platform_revenue');
    expect(platform?.amountMinor).toBe(6_620);
    expect(posting.lines.reduce((sum, line) => sum + (line.direction === 'debit' ? line.amountMinor : -line.amountMinor), 0)).toBe(0);
  });

  it('skips later charges under a first-payment contract and records why', () => {
    const firstOnly: CommissionPolicy = { ...policy, model: 'first_payment_only' };
    const posting = calculateCommissionPosting({
      purpose: 'quote',
      policy: firstOnly,
      charge: charge({ paymentEventId: 'pay-2', isRenewal: true }),
      gymOrganizationId: 'gym-1',
      attributionId: 'attr-1',
      priorPostings: [{ paymentEventId: 'pay-1', kind: 'accrual' }],
      taxPolicy: reviewedTax,
      allowTestFixtures: true,
    });
    expect(posting.decision.kind).toBe('skipped');
    expect(posting.decision.commissionMinor).toBe(0);
    expect(posting.decision.skipReason).toBe('first_payment_already_accrued');
    expect(posting.lines.find((line) => line.account === 'platform_revenue')?.amountMinor).toBe(8_275);
  });

  it('reverses refunds from the original lines and rejects a second partial post', () => {
    const posting = calculateCommissionPosting({
      purpose: 'quote',
      policy,
      charge: charge(),
      gymOrganizationId: 'gym-1',
      attributionId: 'attr-1',
      priorPostings: [],
      taxPolicy: reviewedTax,
      allowTestFixtures: true,
    });
    const ledger = new InMemoryLedger();
    expect(ledger.post(posting.lines)).toBe('posted');
    expect(ledger.post(posting.lines)).toBe('replay');
    expect(ledger.entryCount()).toBe(posting.lines.length);
    const reversal = reverseLedgerLines(posting.lines, 'refund-1');
    expect(ledger.post(reversal)).toBe('posted');
    expect(ledger.commissionPayableMinor('gym-1')).toBe(0);
    expect(findIdempotentReplay(['charge:pay-1:cash_clearing'], posting.lines)).toBe('conflict');
  });

  it('refuses test fixtures in settlement mode and unreviewed tax on live verifiers', () => {
    expect(() =>
      calculateCommissionPosting({
        purpose: 'settle',
        policy,
        charge: charge(),
        gymOrganizationId: 'gym-1',
        attributionId: 'attr-1',
        priorPostings: [],
        taxPolicy: reviewedTax,
        allowTestFixtures: false,
      }),
    ).toThrow(DomainError);

    expect(() =>
      calculateCommissionPosting({
        purpose: 'settle',
        policy,
        charge: charge({ verifier: 'app_store_server_notification' }),
        gymOrganizationId: 'gym-1',
        attributionId: 'attr-1',
        priorPostings: [],
        taxPolicy: { ...reviewedTax, legalReview: 'unreviewed' },
        allowTestFixtures: false,
      }),
    ).toThrow(DomainError);

    const live = calculateCommissionPosting({
      purpose: 'settle',
      policy,
      charge: charge({ verifier: 'app_store_server_notification' }),
      gymOrganizationId: 'gym-1',
      attributionId: 'attr-1',
      priorPostings: [],
      taxPolicy: reviewedTax,
      allowTestFixtures: false,
    });
    expect(live.decision.settlementAllowed).toBe(true);
    expect(live.decision.commissionMinor).toBe(1_655);
  });

  it('rejects a commission rate that consumes fees already taken', () => {
    expect(() =>
      calculateCommissionPosting({
        purpose: 'quote',
        policy: { ...policy, commissionBase: 'gross', rateBps: 10_000 },
        charge: charge(),
        gymOrganizationId: 'gym-1',
        attributionId: 'attr-1',
        priorPostings: [],
        taxPolicy: reviewedTax,
        allowTestFixtures: true,
      }),
    ).toThrow(DomainError);
  });
});
