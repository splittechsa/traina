import { describe, expect, it } from 'vitest';
import { attributionCoversPurchase, resolveAttribution, type GymAttribution } from './attribution.js';

const contract = { id: 'contract-1', status: 'active' as const, attributionWindowDays: 30 };
const code = {
  code: 'GYM-RIYADH-01',
  status: 'active' as const,
  gymOrganizationId: 'gym-1',
  branchId: 'branch-1',
  contractId: 'contract-1',
  expiresAt: null,
};

describe('gym attribution', () => {
  it('locks the first attribution and ignores a later code', () => {
    const created = resolveAttribution({
      userId: 'user-1',
      existing: null,
      code,
      contract,
      scannedAt: '2026-06-01T09:00:00.000Z',
      newAttributionId: 'attr-1',
    });
    expect(created.result).toBe('created');
    if (created.result !== 'created') {
      throw new Error('expected created');
    }
    const second = resolveAttribution({
      userId: 'user-1',
      existing: created.attribution,
      code: { ...code, code: 'OTHER', gymOrganizationId: 'gym-2', contractId: 'contract-9' },
      contract: { ...contract, id: 'contract-9', status: 'terminated' },
      scannedAt: '2026-06-02T09:00:00.000Z',
      newAttributionId: 'attr-2',
    });
    expect(second.result).toBe('existing');
    if (second.result === 'existing') {
      expect(second.attribution.id).toBe('attr-1');
      expect(second.attribution.gymOrganizationId).toBe('gym-1');
    }
  });

  it('rejects inactive codes and inactive contracts', () => {
    expect(
      resolveAttribution({
        userId: 'user-1',
        existing: null,
        code: { ...code, status: 'revoked' },
        contract,
        scannedAt: '2026-06-01T09:00:00.000Z',
        newAttributionId: 'attr-1',
      }).result,
    ).toBe('rejected');
    expect(
      resolveAttribution({
        userId: 'user-1',
        existing: null,
        code,
        contract: { ...contract, status: 'draft' },
        scannedAt: '2026-06-01T09:00:00.000Z',
        newAttributionId: 'attr-1',
      }),
    ).toMatchObject({ result: 'rejected', reason: 'contract_inactive' });
  });

  it('applies the contract window to a later purchase', () => {
    const attribution: GymAttribution = {
      id: 'attr-1',
      userId: 'user-1',
      gymOrganizationId: 'gym-1',
      branchId: 'branch-1',
      contractId: 'contract-1',
      referralCode: code.code,
      attributedAt: '2026-06-01T00:00:00.000Z',
      locked: true,
    };
    expect(attributionCoversPurchase(attribution, contract, '2026-06-20T00:00:00.000Z')).toBe(true);
    expect(attributionCoversPurchase(attribution, contract, '2026-07-15T00:00:00.000Z')).toBe(false);
  });
});
