import { DomainError } from './errors.js';

export const ROLES = [
  'member',
  'gym_owner',
  'gym_branch_manager',
  'support_agent',
  'coach_reviewer',
  'coach_supervisor',
  'finance',
  'moderator',
  'admin',
] as const;

export type Role = (typeof ROLES)[number];

export type Actor = {
  userId: string;
  roles: readonly Role[];
  gymOrganizationIds: readonly string[];
};

export type Resource =
  | { kind: 'user'; userId: string }
  | { kind: 'gym'; organizationId: string }
  | { kind: 'coaching_rule' }
  | { kind: 'finance' }
  | { kind: 'support_ticket' };

export type Action =
  | 'profile.read'
  | 'profile.write'
  | 'member_state.read'
  | 'gym.read'
  | 'gym.write'
  | 'commission.read'
  | 'commission.settle'
  | 'rule.read'
  | 'rule.author'
  | 'rule.approve'
  | 'ticket.read'
  | 'admin.users';

export type AccessScope = 'own' | 'non_health' | 'tenant' | 'internal';

export type AuthorizationDecision = {
  allowed: boolean;
  scope: AccessScope | null;
  audit: 'required' | 'not_required';
  code: string | null;
};

function deny(code: string): AuthorizationDecision {
  return { allowed: false, scope: null, audit: 'not_required', code };
}

function allow(scope: AccessScope, audit: 'required' | 'not_required' = 'not_required'): AuthorizationDecision {
  return { allowed: true, scope, audit, code: null };
}

function hasRole(actor: Actor, role: Role): boolean {
  return actor.roles.includes(role);
}

function inTenant(actor: Actor, organizationId: string): boolean {
  return actor.gymOrganizationIds.includes(organizationId);
}

export function authorize(actor: Actor, action: Action, resource: Resource): AuthorizationDecision {
  if (actor.userId.trim().length === 0) {
    return deny('INVALID_ACTOR');
  }
  if (hasRole(actor, 'admin')) {
    return allow(resource.kind === 'gym' ? 'tenant' : 'internal', 'required');
  }

  switch (action) {
    case 'profile.read':
    case 'profile.write': {
      if (resource.kind !== 'user') {
        return deny('RESOURCE_MISMATCH');
      }
      if (hasRole(actor, 'member') && resource.userId === actor.userId) {
        return allow('own');
      }
      if (action === 'profile.read' && hasRole(actor, 'support_agent')) {
        return allow('non_health', 'required');
      }
      return deny('FORBIDDEN');
    }
    case 'member_state.read': {
      // Health-adjacent coaching state — own member, or assigned coach (enforced in human-coach).
      // Support agents intentionally cannot read MemberState (non_health ≠ coaching facts).
      if (resource.kind !== 'user') {
        return deny('RESOURCE_MISMATCH');
      }
      if (resource.userId === actor.userId && (hasRole(actor, 'member') || hasRole(actor, 'admin'))) {
        return allow('own', 'required');
      }
      // authorize() alone cannot prove assignment; store/domain assertCanReadMemberStateFor does.
      if (hasRole(actor, 'coach_reviewer') || hasRole(actor, 'coach_supervisor')) {
        return deny('ASSIGNMENT_REQUIRED');
      }
      return deny('FORBIDDEN');
    }
    case 'gym.read':
    case 'commission.read': {
      if (resource.kind !== 'gym') {
        return deny('RESOURCE_MISMATCH');
      }
      const staff = hasRole(actor, 'gym_owner') || hasRole(actor, 'gym_branch_manager');
      if (staff && inTenant(actor, resource.organizationId)) {
        return allow('tenant');
      }
      if (action === 'commission.read' && hasRole(actor, 'finance')) {
        return allow('internal', 'required');
      }
      return deny(staff ? 'TENANT_ISOLATION' : 'FORBIDDEN');
    }
    case 'gym.write': {
      if (resource.kind !== 'gym') {
        return deny('RESOURCE_MISMATCH');
      }
      if (!hasRole(actor, 'gym_owner')) {
        return deny('FORBIDDEN');
      }
      if (!inTenant(actor, resource.organizationId)) {
        return deny('TENANT_ISOLATION');
      }
      return allow('tenant', 'required');
    }
    case 'commission.settle': {
      if (resource.kind !== 'finance' && resource.kind !== 'gym') {
        return deny('RESOURCE_MISMATCH');
      }
      if (resource.kind === 'gym' && !hasRole(actor, 'finance')) {
        return deny('FORBIDDEN');
      }
      if (hasRole(actor, 'finance')) {
        return allow('internal', 'required');
      }
      return deny('FORBIDDEN');
    }
    case 'rule.read':
    case 'rule.author':
    case 'rule.approve': {
      if (resource.kind !== 'coaching_rule') {
        return deny('RESOURCE_MISMATCH');
      }
      if (hasRole(actor, 'coach_reviewer')) {
        return allow('internal', action === 'rule.approve' ? 'required' : 'not_required');
      }
      return deny('FORBIDDEN');
    }
    case 'ticket.read': {
      if (resource.kind !== 'support_ticket') {
        return deny('RESOURCE_MISMATCH');
      }
      if (hasRole(actor, 'support_agent')) {
        return allow('internal', 'required');
      }
      return deny('FORBIDDEN');
    }
    case 'admin.users':
      return deny('FORBIDDEN');
    default:
      return deny('FORBIDDEN');
  }
}

export function assertAllowed(decision: AuthorizationDecision): void {
  if (!decision.allowed) {
    throw new DomainError(decision.code ?? 'FORBIDDEN', 'Authorization denied');
  }
}
