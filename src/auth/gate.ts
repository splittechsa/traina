export type GateDestination = 'loading' | 'login' | 'onboarding' | 'home' | 'error';

export function gateDestination(input: {
  ready: boolean;
  hasSession: boolean;
  onboardingCompleted: boolean;
  fetching: boolean;
  failed: boolean;
}): GateDestination {
  if (!input.ready) {
    return 'loading';
  }
  if (!input.hasSession) {
    return 'login';
  }
  if (input.onboardingCompleted) {
    return 'home';
  }
  if (input.fetching) {
    return 'loading';
  }
  if (input.failed) {
    return 'error';
  }
  return 'onboarding';
}

function hasStoredMeasurements(profile: unknown): boolean {
  if (profile == null || typeof profile !== 'object') {
    return false;
  }
  const row = profile as Record<string, unknown>;
  return row.height_mm != null || row.age_years_reported != null || row.heightMm != null;
}

export function profileIsComplete(me: { onboardingCompleted?: boolean; profile?: unknown } | null | undefined): boolean {
  if (me == null) {
    return false;
  }
  if (me.onboardingCompleted === true) {
    return true;
  }
  return hasStoredMeasurements(me.profile);
}
