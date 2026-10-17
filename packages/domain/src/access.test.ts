import { describe, expect, it } from 'vitest';
import { authorize } from './access.js';

describe('authorization', () => {
  it('lets a member read only their own profile', () => {
    const self = authorize(
      { userId: 'user-1', roles: ['member'], gymOrganizationIds: [] },
      'profile.read',
      { kind: 'user', userId: 'user-1' },
    );
    const other = authorize(
      { userId: 'user-1', roles: ['member'], gymOrganizationIds: [] },
      'profile.read',
      { kind: 'user', userId: 'user-2' },
    );
    expect(self.allowed).toBe(true);
    expect(self.scope).toBe('own');
    expect(other.allowed).toBe(false);
  });

  it('keeps MemberState readable only by the member (not support)', () => {
    const self = authorize(
      { userId: 'user-1', roles: ['member'], gymOrganizationIds: [] },
      'member_state.read',
      { kind: 'user', userId: 'user-1' },
    );
    expect(self.allowed).toBe(true);
    expect(self.audit).toBe('required');
    const other = authorize(
      { userId: 'user-1', roles: ['member'], gymOrganizationIds: [] },
      'member_state.read',
      { kind: 'user', userId: 'user-2' },
    );
    expect(other.allowed).toBe(false);
    const support = authorize(
      { userId: 'agent-1', roles: ['support_agent'], gymOrganizationIds: [] },
      'member_state.read',
      { kind: 'user', userId: 'user-2' },
    );
    expect(support.allowed).toBe(false);
    const coach = authorize(
      { userId: 'coach-1', roles: ['coach_reviewer'], gymOrganizationIds: [] },
      'member_state.read',
      { kind: 'user', userId: 'user-2' },
    );
    expect(coach.allowed).toBe(false);
    expect(coach.code).toBe('ASSIGNMENT_REQUIRED');
  });

  it('limits support agents to non-health profile reads', () => {
    const decision = authorize(
      { userId: 'agent-1', roles: ['support_agent'], gymOrganizationIds: [] },
      'profile.read',
      { kind: 'user', userId: 'user-2' },
    );
    expect(decision.allowed).toBe(true);
    expect(decision.scope).toBe('non_health');
    expect(decision.audit).toBe('required');
    const write = authorize(
      { userId: 'agent-1', roles: ['support_agent'], gymOrganizationIds: [] },
      'profile.write',
      { kind: 'user', userId: 'user-2' },
    );
    expect(write.allowed).toBe(false);
  });

  it('isolates gym tenants', () => {
    const actor = { userId: 'owner-1', roles: ['gym_owner'] as const, gymOrganizationIds: ['gym-a'] };
    expect(authorize(actor, 'commission.read', { kind: 'gym', organizationId: 'gym-a' }).allowed).toBe(true);
    const cross = authorize(actor, 'commission.read', { kind: 'gym', organizationId: 'gym-b' });
    expect(cross.allowed).toBe(false);
    expect(cross.code).toBe('TENANT_ISOLATION');
  });

  it('allows branch managers to read but not change contracts', () => {
    const actor = {
      userId: 'manager-1',
      roles: ['gym_branch_manager'] as const,
      gymOrganizationIds: ['gym-a'],
    };
    expect(authorize(actor, 'gym.read', { kind: 'gym', organizationId: 'gym-a' }).allowed).toBe(true);
    expect(authorize(actor, 'gym.write', { kind: 'gym', organizationId: 'gym-a' }).allowed).toBe(false);
  });

  it('requires finance for settlement and audits admin access', () => {
    const finance = authorize(
      { userId: 'fin-1', roles: ['finance'], gymOrganizationIds: [] },
      'commission.settle',
      { kind: 'finance' },
    );
    expect(finance.allowed).toBe(true);
    expect(finance.audit).toBe('required');
    const owner = authorize(
      { userId: 'owner-1', roles: ['gym_owner'], gymOrganizationIds: ['gym-a'] },
      'commission.settle',
      { kind: 'gym', organizationId: 'gym-a' },
    );
    expect(owner.allowed).toBe(false);
    const admin = authorize(
      { userId: 'admin-1', roles: ['admin'], gymOrganizationIds: [] },
      'admin.users',
      { kind: 'user', userId: 'user-1' },
    );
    expect(admin.allowed).toBe(true);
    expect(admin.audit).toBe('required');
  });
});
