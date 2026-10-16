import { describe, expect, it } from 'vitest';
import { poseAt, resolveEquipmentProp, resolveMovementProfile } from './movementPose';

describe('resolveMovementProfile', () => {
  it('keeps known athletic patterns and falls back safely', () => {
    expect(resolveMovementProfile('squat')).toBe('squat');
    expect(resolveMovementProfile('unknown_move')).toBe('neutral');
    expect(resolveMovementProfile(null)).toBe('neutral');
  });
});

describe('resolveEquipmentProp', () => {
  it('maps owned equipment labels to original primitive props', () => {
    expect(resolveEquipmentProp(['barbell'])).toBe('barbell');
    expect(resolveEquipmentProp(['dumbbell', 'bench'])).toBe('dumbbell');
    expect(resolveEquipmentProp(['kettlebell'])).toBe('kettlebell');
    expect(resolveEquipmentProp(['machine'])).toBe('machine');
    expect(resolveEquipmentProp(['bodyweight'])).toBe('none');
  });
});

describe('poseAt', () => {
  it('drops the hips at the bottom of a squat', () => {
    const bottom = poseAt('squat', Math.PI / 2);
    const top = poseAt('squat', (3 * Math.PI) / 2);
    expect(bottom.rootY).toBeLessThan(top.rootY);
    expect(bottom.leftThighX).toBeLessThan(top.leftThighX);
  });

  it('hinges the torso more than a standing pose', () => {
    const stand = poseAt('neutral', 0);
    const hinge = poseAt('hinge', (3 * Math.PI) / 2);
    expect(hinge.hipsX).toBeGreaterThan(stand.hipsX);
    expect(hinge.torsoX).toBeGreaterThan(stand.torsoX);
  });

  it('raises the arms through a vertical press', () => {
    const start = poseAt('vertical_push', (3 * Math.PI) / 2);
    const lockout = poseAt('vertical_push', Math.PI / 2);
    expect(lockout.leftUpperArmX).toBeLessThan(start.leftUpperArmX);
    expect(lockout.propLift).toBeGreaterThan(start.propLift);
  });
});
