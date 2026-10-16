import { useEffect, useRef, useState } from 'react';
import Svg, { Circle, Line } from 'react-native-svg';
import { poseAt, type EquipmentProp, type JointPose, type MovementProfile } from './movementPose';

function point(origin: { x: number; y: number }, length: number, angle: number) {
  return {
    x: origin.x + Math.sin(angle) * length,
    y: origin.y + Math.cos(angle) * length,
  };
}

function figurePoints(pose: JointPose) {
  const hip = { x: 100, y: 118 - pose.rootY * 42 };
  const shoulder = point(hip, 46, pose.torsoX);
  const head = point(shoulder, 22, pose.torsoX);
  const leftKnee = point(hip, 38, pose.leftThighX);
  const rightKnee = point(hip, 38, pose.rightThighX);
  const leftFoot = point(leftKnee, 34, pose.leftThighX + pose.leftShinX);
  const rightFoot = point(rightKnee, 34, pose.rightThighX + pose.rightShinX);
  const leftElbow = point(shoulder, 28, pose.leftUpperArmX + pose.leftUpperArmZ * 0.35);
  const rightElbow = point(shoulder, 28, pose.rightUpperArmX + pose.rightUpperArmZ * 0.35);
  const leftHand = point(leftElbow, 24, pose.leftUpperArmX + pose.leftForearmX);
  const rightHand = point(rightElbow, 24, pose.rightUpperArmX + pose.rightForearmX);
  return { hip, shoulder, head, leftKnee, rightKnee, leftFoot, rightFoot, leftElbow, rightElbow, leftHand, rightHand };
}

function Bone({ a, b, color, width }: { a: { x: number; y: number }; b: { x: number; y: number }; color: string; width: number }) {
  return <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeLinecap="round" />;
}

export function MovementSilhouette({
  profile,
  prop,
  paused,
}: {
  profile: MovementProfile;
  prop: EquipmentProp;
  paused: boolean;
}) {
  const [phase, setPhase] = useState(0.9);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    let frame = 0;
    const tick = () => {
      if (pausedRef.current) return;
      setPhase((Date.now() - started) / 720);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, profile]);

  const pose = poseAt(profile, phase, prop);
  const points = figurePoints(pose);
  const gold = '#E2B65E';
  const body = '#F4E2B8';
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 220" accessibilityRole="image">
      <Circle cx="100" cy="198" r="52" fill="rgba(214,165,74,0.12)" />
      <Bone a={points.hip} b={points.shoulder} color={gold} width={10} />
      <Bone a={points.shoulder} b={points.leftElbow} color={body} width={7} />
      <Bone a={points.leftElbow} b={points.leftHand} color={body} width={6} />
      <Bone a={points.shoulder} b={points.rightElbow} color={body} width={7} />
      <Bone a={points.rightElbow} b={points.rightHand} color={body} width={6} />
      <Bone a={points.hip} b={points.leftKnee} color={gold} width={8} />
      <Bone a={points.leftKnee} b={points.leftFoot} color={gold} width={7} />
      <Bone a={points.hip} b={points.rightKnee} color={gold} width={8} />
      <Bone a={points.rightKnee} b={points.rightFoot} color={gold} width={7} />
      <Circle cx={points.hip.x} cy={points.hip.y} r={8} fill={gold} />
      <Circle cx={points.shoulder.x} cy={points.shoulder.y} r={7} fill={body} />
      <Circle cx={points.head.x} cy={points.head.y} r={11} fill={body} />
      {pose.prop !== 'none' ? <Circle cx={points.leftHand.x} cy={points.leftHand.y - 8 - pose.propLift * 12} r={pose.prop === 'barbell' ? 9 : 6} fill={gold} /> : null}
    </Svg>
  );
}
