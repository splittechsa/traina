/**
 * Honest capability registry. Tests fail if a claim is marked validated
 * without a corresponding evidence record in this repository.
 */
export const PLATFORM_CAPABILITIES = {
  product: 'sahhti',
  implemented: [
    'money.integer_minor_units',
    'nutrition.diary_arithmetic',
    'nutrition.targets_require_approved_formula',
    'coaching.rule_evaluation',
    'coaching.approval_workflow',
    'commerce.subscription_state_machine',
    'partnerships.attribution',
    'partnerships.commission_ledger_math',
    'training.session_lifecycle',
    'identity.onboarding_validation',
    'identity.rbac',
    'ai.tool_authorization',
    'persistence.dev_pglite_restart',
    'auth.email_session',
    'coaching.rule_admin_api',
    'clients.expo_source',
  ],
  notImplemented: [
    'auth.production_idp',
    'persistence.verified_against_postgres',
    'ai.model_provider',
    'ai.evaluation_with_live_model',
    'payments.storekit_server_verification',
    'payments.play_billing_server_verification',
    'payments.saudi_web_gateway',
    'clients.ios_compiled',
    'clients.android_compiled',
    'clients.admin_web',
    'clients.gym_portal',
    'healthkit',
    'health_connect',
    'food.authoritative_saudi_database',
    'food.image_recognition',
    'community',
    'load_test.evidence',
    'backup_restore.evidence',
    'store_listing.published',
    'pdpl.certified',
  ],
  scale: {
    registeredUsersTarget: 1_000_000,
    dailyActiveUsersAssumption: 100_000,
    peakConcurrentSessionsAssumption: 10_000,
    peakRequestsPerSecondAssumption: 2_000,
    validated: false,
    evidence: null,
  },
} as const;

export function assertCapabilitiesHonest(): void {
  if (PLATFORM_CAPABILITIES.scale.validated) {
    throw new Error('Scale cannot be marked validated without evidence');
  }
  if (PLATFORM_CAPABILITIES.scale.evidence !== null) {
    throw new Error('Scale evidence must stay empty until a measured run is archived');
  }
}
