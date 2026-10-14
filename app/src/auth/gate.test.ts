import { describe, expect, it } from 'vitest';
import { gateDestination, profileIsComplete } from './gate';

describe('onboarding route guard', () => {
  it('waits for a fresh profile instead of returning to setup', () => {
    expect(
      gateDestination({ ready: true, hasSession: true, onboardingCompleted: false, fetching: true, failed: false }),
    ).toBe('loading');
  });

  it('opens the dashboard after the backend confirms the profile', () => {
    expect(
      gateDestination({ ready: true, hasSession: true, onboardingCompleted: true, fetching: true, failed: false }),
    ).toBe('home');
    expect(profileIsComplete({ onboardingCompleted: true, profile: null })).toBe(true);
    expect(profileIsComplete({ profile: { height_mm: 1950 } })).toBe(true);
    expect(profileIsComplete({ onboardingCompleted: false, profile: {} })).toBe(false);
    expect(profileIsComplete(undefined)).toBe(false);
  });

  it('sends a signed-in member without a profile to setup once loading has finished', () => {
    expect(
      gateDestination({ ready: true, hasSession: true, onboardingCompleted: false, fetching: false, failed: false }),
    ).toBe('onboarding');
  });

  it('does not treat a network or session failure as an incomplete profile', () => {
    expect(
      gateDestination({ ready: true, hasSession: true, onboardingCompleted: false, fetching: false, failed: true }),
    ).toBe('error');
    expect(gateDestination({ ready: true, hasSession: false, onboardingCompleted: false, fetching: false, failed: false })).toBe(
      'login',
    );
    expect(gateDestination({ ready: false, hasSession: true, onboardingCompleted: true, fetching: false, failed: false })).toBe(
      'loading',
    );
  });

  it('keeps a confirmed profile on the dashboard during a slow reload', () => {
    expect(gateDestination({ ready: true, hasSession: true, onboardingCompleted: true, fetching: true, failed: false })).toBe('home');
    expect(gateDestination({ ready: true, hasSession: true, onboardingCompleted: false, fetching: true, failed: true })).toBe('loading');
  });
});
