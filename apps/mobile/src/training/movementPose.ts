export const MOVEMENT_PROFILES = [
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'horizontal_pull',
  'vertical_push',
  'vertical_pull',
  'brace',
  'jump',
  'conditioning',
  'squat_to_press',
  'knee_flexion',
  'neutral',
] as const;

export type MovementProfile = (typeof MOVEMENT_PROFILES)[number];
export type EquipmentProp = 'none' | 'barbell' | 'dumbbell' | 'kettlebell' | 'machine';

export type JointPose = {
  rootY: number;
  rootYaw: number;
  rootRoll: number;
  hipsX: number;
  torsoX: number;
  leftThighX: number;
  rightThighX: number;
  leftShinX: number;
  rightShinX: number;
  leftUpperArmX: number;
  rightUpperArmX: number;
  leftUpperArmZ: number;
  rightUpperArmZ: number;
  leftForearmX: number;
  rightForearmX: number;
  prop: EquipmentProp;
  propLift: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function wave(phase: number): number {
  return (Math.sin(phase) + 1) / 2;
}

export function resolveMovementProfile(pattern: string | null | undefined): MovementProfile {
  const value = pattern?.trim() ?? '';
  return (MOVEMENT_PROFILES as readonly string[]).includes(value) ? (value as MovementProfile) : 'neutral';
}

export function resolveEquipmentProp(equipment: readonly string[] = []): EquipmentProp {
  if (equipment.includes('barbell') || equipment.includes('bar')) return 'barbell';
  if (equipment.includes('dumbbell')) return 'dumbbell';
  if (equipment.includes('kettlebell')) return 'kettlebell';
  if (equipment.includes('machine')) return 'machine';
  return 'none';
}

export function poseAt(profile: MovementProfile, phase: number, prop: EquipmentProp = 'none'): JointPose {
  const motion = clamp01(wave(phase));
  const idle = {
    rootY: 0,
    rootYaw: -0.28,
    rootRoll: 0,
    hipsX: 0.06,
    torsoX: 0.04,
    leftThighX: -0.08,
    rightThighX: -0.08,
    leftShinX: 0.08,
    rightShinX: 0.08,
    leftUpperArmX: -0.18,
    rightUpperArmX: -0.18,
    leftUpperArmZ: 0.22,
    rightUpperArmZ: -0.22,
    leftForearmX: -0.2,
    rightForearmX: -0.2,
    prop,
    propLift: 0,
  };

  if (profile === 'squat' || profile === 'squat_to_press') {
    const press = profile === 'squat_to_press' ? 1 - motion : 0;
    return {
      ...idle,
      rootY: -motion * 0.42,
      hipsX: 0.18 + motion * 0.38,
      torsoX: 0.12 + motion * 0.28,
      leftThighX: -0.18 - motion * 1.12,
      rightThighX: -0.18 - motion * 1.12,
      leftShinX: 0.16 + motion * 0.92,
      rightShinX: 0.16 + motion * 0.92,
      leftUpperArmX: -1.05 - press * 1.35,
      rightUpperArmX: -1.05 - press * 1.35,
      leftForearmX: -0.45,
      rightForearmX: -0.45,
      propLift: press * 0.7,
    };
  }

  if (profile === 'hinge') {
    return {
      ...idle,
      rootY: -motion * 0.08,
      hipsX: 0.18 + motion * 0.95,
      torsoX: 0.12 + motion * 0.72,
      leftThighX: -0.22 - motion * 0.28,
      rightThighX: -0.22 - motion * 0.28,
      leftShinX: 0.18 + motion * 0.12,
      rightShinX: 0.18 + motion * 0.12,
      leftUpperArmX: -0.85,
      rightUpperArmX: -0.85,
      leftForearmX: -0.15,
      rightForearmX: -0.15,
      propLift: -motion * 0.35,
    };
  }

  if (profile === 'lunge') {
    return {
      ...idle,
      rootY: -motion * 0.22,
      leftThighX: -0.18 - motion * 0.95,
      rightThighX: 0.35 + motion * 0.42,
      leftShinX: 0.18 + motion * 0.82,
      rightShinX: 0.12 + motion * 0.2,
      leftUpperArmX: -0.55,
      rightUpperArmX: 0.35,
    };
  }

  if (profile === 'horizontal_push' || profile === 'horizontal_pull') {
    const push = profile === 'horizontal_push' ? 1 : -1;
    const travel = 0.35 + motion * 1.15;
    return {
      ...idle,
      rootY: 1.15,
      rootYaw: Math.PI,
      hipsX: 0,
      torsoX: 0,
      leftThighX: 1.45,
      rightThighX: 1.45,
      leftShinX: 0.12,
      rightShinX: 0.12,
      leftUpperArmX: push * travel,
      rightUpperArmX: push * travel,
      leftForearmX: push * (0.2 + motion * 0.55),
      rightForearmX: push * (0.2 + motion * 0.55),
      leftUpperArmZ: 0.55,
      rightUpperArmZ: -0.55,
      propLift: profile === 'horizontal_push' ? motion * 0.18 : -motion * 0.12,
    };
  }

  if (profile === 'vertical_push' || profile === 'vertical_pull') {
    const overhead = profile === 'vertical_push' ? 0.35 + motion * 2.2 : 0.2 + (1 - motion) * 2.3;
    return {
      ...idle,
      leftUpperArmX: -overhead,
      rightUpperArmX: -overhead,
      leftUpperArmZ: 0.08,
      rightUpperArmZ: -0.08,
      leftForearmX: profile === 'vertical_pull' ? -0.7 : -0.15,
      rightForearmX: profile === 'vertical_pull' ? -0.7 : -0.15,
      leftThighX: -0.12,
      rightThighX: -0.12,
      propLift: profile === 'vertical_push' ? motion * 0.85 : (1 - motion) * 0.7,
    };
  }

  if (profile === 'jump' || profile === 'conditioning') {
    const flight = motion * motion;
    return {
      ...idle,
      rootY: flight * 0.55,
      leftThighX: -0.7 + flight * 0.85,
      rightThighX: -0.7 + flight * 0.85,
      leftShinX: 0.55 - flight * 0.5,
      rightShinX: 0.55 - flight * 0.5,
      leftUpperArmZ: 0.35 + flight * 1.6,
      rightUpperArmZ: -0.35 - flight * 1.6,
      leftUpperArmX: -0.35 - flight * 0.4,
      rightUpperArmX: -0.35 - flight * 0.4,
    };
  }

  if (profile === 'brace') {
    return {
      ...idle,
      rootY: 0.42,
      rootRoll: Math.PI / 2,
      rootYaw: 0,
      hipsX: 0,
      torsoX: 0.08,
      leftThighX: 0,
      rightThighX: 0,
      leftShinX: 0,
      rightShinX: 0,
      leftUpperArmZ: -1.05,
      rightUpperArmZ: 1.05,
      leftUpperArmX: -0.2,
      rightUpperArmX: -0.2,
      prop: 'none',
    };
  }

  if (profile === 'knee_flexion') {
    return {
      ...idle,
      rootY: 1.05,
      rootYaw: Math.PI,
      hipsX: 0,
      torsoX: 0,
      leftThighX: 1.52,
      rightThighX: 1.52,
      leftShinX: 0.2 + motion * 1.35,
      rightShinX: 0.2 + motion * 1.35,
      leftUpperArmX: -0.35,
      rightUpperArmX: -0.35,
      prop: prop === 'none' ? 'machine' : prop,
    };
  }

  return {
    ...idle,
    leftThighX: -0.08 + Math.sin(phase * 0.5) * 0.04,
    rightThighX: -0.08 - Math.sin(phase * 0.5) * 0.04,
  };
}
