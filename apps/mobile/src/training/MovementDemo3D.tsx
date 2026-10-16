import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GLView } from 'expo-gl';
import { SymbolView } from 'expo-symbols';
import * as THREE from 'three';
import { useLocale } from '../i18n/LocaleProvider';
import { useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, radius, spacing, typeScale } from '../theme/tokens';
import { adaptExpoGl } from './adaptExpoGl';
import { MovementSilhouette } from './MovementSilhouette';
import {
  poseAt,
  resolveEquipmentProp,
  resolveMovementProfile,
  type EquipmentProp,
  type JointPose,
} from './movementPose';

class DemoBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    return;
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type Limb = {
  upper: THREE.Group;
  lower: THREE.Group;
};

type DemoRig = {
  root: THREE.Group;
  torso: THREE.Group;
  arms: [Limb, Limb];
  legs: [Limb, Limb];
  prop: THREE.Group;
};

function skin(color: number, roughness = 0.46): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08 });
}

function capsule(material: THREE.Material, radiusValue: number, length: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radiusValue, length, 4, 8), material);
  mesh.position.y = -length / 2;
  return mesh;
}

function makeLimb(material: THREE.Material, upperLength: number, lowerLength: number, radiusValue: number): Limb {
  const upper = new THREE.Group();
  upper.add(capsule(material, radiusValue, upperLength));
  const lower = new THREE.Group();
  lower.position.y = -upperLength;
  lower.add(capsule(material, radiusValue * 0.86, lowerLength));
  upper.add(lower);
  return { upper, lower };
}

function makeBarbell(): THREE.Group {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xb7c0c4, metalness: 0.72, roughness: 0.28 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x2a3330, metalness: 0.4, roughness: 0.45 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.85, 10), steel);
  bar.rotation.z = Math.PI / 2;
  group.add(bar);
  for (const x of [-0.78, 0.78]) {
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), plate);
    disk.rotation.z = Math.PI / 2;
    disk.position.x = x;
    group.add(disk);
  }
  return group;
}

function makeDumbbells(): THREE.Group {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc5b07a, metalness: 0.55, roughness: 0.32 });
  for (const x of [-0.42, 0.42]) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 8), steel);
    handle.rotation.z = Math.PI / 2;
    handle.position.x = x;
    group.add(handle);
    for (const side of [-0.14, 0.14]) {
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), steel);
      bell.position.set(x + side, 0, 0);
      group.add(bell);
    }
  }
  return group;
}

function makeKettlebell(): THREE.Group {
  const group = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x3e4a45, metalness: 0.5, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), iron);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 16), iron);
  handle.position.y = 0.16;
  handle.rotation.x = Math.PI / 2;
  group.add(body, handle);
  return group;
}

function makeMachine(): THREE.Group {
  const group = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x315c49, metalness: 0.35, roughness: 0.48 });
  for (const x of [-0.7, 0.7]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), frame);
    post.position.set(x, 0.8, -0.35);
    group.add(post);
  }
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.42), frame);
  pad.position.set(0, 0.62, -0.05);
  group.add(pad);
  return group;
}

function createRig(): DemoRig {
  const body = skin(0xc4a36a);
  const joint = skin(0xe8d5a8, 0.58);
  const accent = skin(0xd6a54a, 0.35);
  const root = new THREE.Group();
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), body);
  pelvis.scale.set(1.15, 0.7, 0.9);
  root.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 0.16;
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.52, 6, 12), body);
  chest.position.y = 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), joint);
  head.position.y = 0.92;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16), accent);
  collar.position.y = 0.74;
  collar.rotation.x = Math.PI / 2;
  torso.add(chest, head, collar);
  root.add(torso);

  const arms = [-1, 1].map((side) => {
    const limb = makeLimb(body, 0.38, 0.34, 0.075);
    limb.upper.position.set(side * 0.34, 0.68, 0);
    torso.add(limb.upper);
    return limb;
  }) as [Limb, Limb];

  const legs = [-1, 1].map((side) => {
    const limb = makeLimb(body, 0.5, 0.48, 0.1);
    limb.upper.position.set(side * 0.13, 0.02, 0);
    root.add(limb.upper);
    return limb;
  }) as [Limb, Limb];

  const prop = new THREE.Group();
  root.add(prop);
  return { root, torso, arms, legs, prop };
}

function applyPose(rig: DemoRig, pose: JointPose, yawOffset: number): void {
  rig.root.position.y = pose.rootY;
  rig.root.rotation.set(0, pose.rootYaw + yawOffset, pose.rootRoll);
  rig.torso.rotation.x = pose.torsoX;
  rig.legs[0].upper.rotation.set(pose.leftThighX, 0, 0.04);
  rig.legs[1].upper.rotation.set(pose.rightThighX, 0, -0.04);
  rig.legs[0].lower.rotation.x = pose.leftShinX;
  rig.legs[1].lower.rotation.x = pose.rightShinX;
  rig.arms[0].upper.rotation.set(pose.leftUpperArmX, 0, pose.leftUpperArmZ);
  rig.arms[1].upper.rotation.set(pose.rightUpperArmX, 0, pose.rightUpperArmZ);
  rig.arms[0].lower.rotation.x = pose.leftForearmX;
  rig.arms[1].lower.rotation.x = pose.rightForearmX;
  rig.prop.position.set(0, 1.05 + pose.propLift, 0.12);
  rig.prop.rotation.set(0.12, 0, 0);
  rig.prop.visible = pose.prop !== 'none';
}

function mountProp(rig: DemoRig, kind: EquipmentProp): void {
  while (rig.prop.children.length > 0) {
    const child = rig.prop.children[0];
    if (child) rig.prop.remove(child);
  }
  if (kind === 'barbell') rig.prop.add(makeBarbell());
  if (kind === 'dumbbell') rig.prop.add(makeDumbbells());
  if (kind === 'kettlebell') rig.prop.add(makeKettlebell());
  if (kind === 'machine') rig.prop.add(makeMachine());
}

export function MovementDemo3D({
  profile,
  equipment = [],
  compact = false,
}: {
  profile: string;
  equipment?: readonly string[];
  compact?: boolean;
}) {
  const theme = useTheme();
  const { locale } = useLocale();
  const { reduce } = useMotion();
  const [paused, setPaused] = useState(reduce);
  const [useFallback, setUseFallback] = useState(false);
  const pausedRef = useRef(paused);
  const mountedRef = useRef(true);
  const profileRef = useRef(resolveMovementProfile(profile));
  const propRef = useRef(resolveEquipmentProp(equipment));
  const disposeRef = useRef<(() => void) | null>(null);
  const mountPropRef = useRef<(kind: EquipmentProp) => void>(() => undefined);
  const resolvedProfile = resolveMovementProfile(profile);
  const resolvedProp = resolveEquipmentProp(equipment);

  const resumeRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) resumeRef.current?.();
  }, [paused]);

  useEffect(() => {
    profileRef.current = resolveMovementProfile(profile);
    const nextProp = resolveEquipmentProp(equipment);
    if (propRef.current !== nextProp) {
      propRef.current = nextProp;
      mountPropRef.current(nextProp);
    }
  }, [equipment, profile]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      disposeRef.current?.();
    },
    [],
  );

  const renderSilhouette = () => (
    <MovementSilhouette profile={resolvedProfile} prop={resolvedProp} paused={paused} />
  );

  return (
    <View
      style={{
        overflow: 'hidden',
        height: compact ? 188 : 268,
        borderRadius: radius.hero,
        backgroundColor: theme.hero,
        marginBottom: spacing[3],
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <DemoBoundary fallback={renderSilhouette()}>
        {useFallback ? (
          renderSilhouette()
        ) : (
          <GLView
            style={{ flex: 1 }}
            onContextCreate={(gl) => {
              try {
                disposeRef.current?.();
                const context = adaptExpoGl(gl);
                const scene = new THREE.Scene();
                scene.background = new THREE.Color(0x102a21);
                scene.fog = new THREE.Fog(0x102a21, 6.2, 11);
                const camera = new THREE.PerspectiveCamera(36, gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight), 0.1, 40);
                camera.position.set(0.15, 1.55, 5.1);
                camera.lookAt(0, 1.15, 0);
                const canvas = {
                  width: gl.drawingBufferWidth,
                  height: gl.drawingBufferHeight,
                  clientHeight: gl.drawingBufferHeight,
                  style: {},
                  addEventListener: () => undefined,
                  removeEventListener: () => undefined,
                } as unknown as HTMLCanvasElement;
                const renderer = new THREE.WebGLRenderer({
                  canvas,
                  context: context as unknown as WebGL2RenderingContext,
                  antialias: true,
                });
                renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
                renderer.setPixelRatio(1);
                scene.add(new THREE.HemisphereLight(0xfff1d6, 0x17382d, 1.7));
                const key = new THREE.DirectionalLight(0xe2b65e, 2.1);
                key.position.set(2.4, 4.6, 3.2);
                scene.add(key);
                const fill = new THREE.DirectionalLight(0x8eb79d, 0.9);
                fill.position.set(-3, 2.2, 1.4);
                scene.add(fill);
                const floor = new THREE.Mesh(
                  new THREE.CircleGeometry(1.8, 40),
                  new THREE.MeshStandardMaterial({ color: 0x1c3329, roughness: 0.92 }),
                );
                floor.rotation.x = -Math.PI / 2;
                scene.add(floor);
                const ring = new THREE.Mesh(
                  new THREE.TorusGeometry(1.15, 0.018, 8, 48),
                  new THREE.MeshStandardMaterial({ color: 0xd6a54a, metalness: 0.4, roughness: 0.35 }),
                );
                ring.rotation.x = Math.PI / 2;
                ring.position.y = 0.02;
                scene.add(ring);
                const rig = createRig();
                mountProp(rig, propRef.current);
                mountPropRef.current = (kind) => mountProp(rig, kind);
                scene.add(rig.root);
                let frameId = 0;
                let disposed = false;
                const startedAt = Date.now();
                const failToFallback = () => {
                  disposed = true;
                  cancelAnimationFrame(frameId);
                  if (mountedRef.current) setUseFallback(true);
                };
                const renderFrame = () => {
                  if (disposed) return;
                  try {
                    const elapsed = pausedRef.current ? 0.9 : (Date.now() - startedAt) / 720;
                    const pose = poseAt(profileRef.current, elapsed, propRef.current);
                    applyPose(rig, pose, pausedRef.current ? 0 : Math.sin(elapsed * 0.18) * 0.22);
                    renderer.render(scene, camera);
                    gl.endFrameEXP();
                  } catch {
                    failToFallback();
                    return;
                  }
                  if (!pausedRef.current) {
                    frameId = requestAnimationFrame(renderFrame);
                  }
                };
                resumeRef.current = () => {
                  cancelAnimationFrame(frameId);
                  renderFrame();
                };
                renderFrame();
                disposeRef.current = () => {
                  disposed = true;
                  cancelAnimationFrame(frameId);
                  scene.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                      object.geometry.dispose();
                      const materials = Array.isArray(object.material) ? object.material : [object.material];
                      materials.forEach((material) => material.dispose());
                    }
                  });
                  renderer.dispose();
                };
              } catch {
                disposeRef.current?.();
                if (mountedRef.current) setUseFallback(true);
              }
            }}
          />
        )}
      </DemoBoundary>
      <View style={{ position: 'absolute', start: spacing[3], end: spacing[3], bottom: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingEnd: spacing[2] }}>
          <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: typeScale.label, textAlign: locale === 'ar' ? 'right' : 'left' }}>
            {locale === 'ar' ? 'حركة ثلاثية الأبعاد' : '3D movement'}
          </Text>
          <Text style={{ color: 'rgba(255,249,239,0.72)', fontFamily: fontFamily.regular, fontSize: typeScale.micro, textAlign: locale === 'ar' ? 'right' : 'left' }}>
            {locale === 'ar' ? 'تصور أصلي من ترينا، وليس فيديو تدريبي معتمد' : 'Original Traina visualization, not reviewed coaching media'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? (locale === 'ar' ? 'تشغيل' : 'Play') : (locale === 'ar' ? 'إيقاف مؤقت' : 'Pause')}
          onPress={() => setPaused((value) => !value)}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,249,239,0.14)', alignItems: 'center', justifyContent: 'center' }}
        >
          <SymbolView
            name={paused
              ? { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }
              : { ios: 'pause.fill', android: 'pause', web: 'pause' }}
            size={19}
            tintColor="#FFF9EF"
          />
        </Pressable>
      </View>
    </View>
  );
}

