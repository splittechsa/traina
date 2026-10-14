import { DomainError, assertIsoDateTime, assertSafeNonNegativeInteger } from './errors.js';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';
export type ReferralCodeStatus = 'active' | 'revoked';

export type AttributionContract = {
  id: string;
  status: ContractStatus;
  attributionWindowDays: number;
};

export type ReferralCode = {
  code: string;
  status: ReferralCodeStatus;
  gymOrganizationId: string;
  branchId: string;
  contractId: string;
  expiresAt: string | null;
};

export type GymAttribution = {
  id: string;
  userId: string;
  gymOrganizationId: string;
  branchId: string;
  contractId: string;
  referralCode: string;
  attributedAt: string;
  locked: true;
};

export type AttributionResolution =
  | { result: 'existing'; attribution: GymAttribution }
  | { result: 'created'; attribution: GymAttribution }
  | { result: 'rejected'; reason: 'code_inactive' | 'code_expired' | 'contract_inactive' | 'contract_mismatch' };

export function resolveAttribution(input: {
  userId: string;
  existing: GymAttribution | null;
  code: ReferralCode;
  contract: AttributionContract;
  scannedAt: string;
  newAttributionId: string;
}): AttributionResolution {
  if (input.existing !== null) {
    if (input.existing.userId !== input.userId) {
      throw new DomainError('ATTRIBUTION_USER_MISMATCH', 'Existing attribution belongs to another user');
    }
    return { result: 'existing', attribution: input.existing };
  }
  assertIsoDateTime(input.scannedAt, 'INVALID_SCAN_TIME');
  if (input.code.status !== 'active') {
    return { result: 'rejected', reason: 'code_inactive' };
  }
  if (input.code.expiresAt !== null) {
    assertIsoDateTime(input.code.expiresAt, 'INVALID_CODE_EXPIRY');
    if (Date.parse(input.scannedAt) > Date.parse(input.code.expiresAt)) {
      return { result: 'rejected', reason: 'code_expired' };
    }
  }
  if (input.contract.status !== 'active') {
    return { result: 'rejected', reason: 'contract_inactive' };
  }
  if (input.contract.id !== input.code.contractId) {
    return { result: 'rejected', reason: 'contract_mismatch' };
  }
  if (input.newAttributionId.trim().length === 0 || input.userId.trim().length === 0) {
    throw new DomainError('INVALID_ATTRIBUTION', 'User and attribution ids are required');
  }
  return {
    result: 'created',
    attribution: {
      id: input.newAttributionId,
      userId: input.userId,
      gymOrganizationId: input.code.gymOrganizationId,
      branchId: input.code.branchId,
      contractId: input.contract.id,
      referralCode: input.code.code,
      attributedAt: input.scannedAt,
      locked: true,
    },
  };
}

export function attributionCoversPurchase(
  attribution: GymAttribution,
  contract: AttributionContract,
  purchasedAt: string,
): boolean {
  assertIsoDateTime(attribution.attributedAt, 'INVALID_ATTRIBUTION');
  assertIsoDateTime(purchasedAt, 'INVALID_PURCHASE_TIME');
  assertSafeNonNegativeInteger(contract.attributionWindowDays, 'INVALID_WINDOW');
  if (contract.attributionWindowDays < 1) {
    throw new DomainError('INVALID_WINDOW', 'Attribution window must be at least one day');
  }
  const start = Date.parse(attribution.attributedAt);
  const end = start + contract.attributionWindowDays * 86_400_000;
  const at = Date.parse(purchasedAt);
  return at >= start && at <= end;
}
