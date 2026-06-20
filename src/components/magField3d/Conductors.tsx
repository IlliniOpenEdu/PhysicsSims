import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  CatmullRomCurve3,
  InstancedMesh,
  Matrix4,
  Quaternion,
  TubeGeometry,
  Vector3,
} from 'three';
import { TWO_PI } from '../../utils/constants';
import {
  CM_TO_SCENE,
  LOOP_RADIUS,
  WIRE_HALF_LENGTH,
  generateCurrentArrows,
  twoWirePositions,
} from '../../lib/enm/magField3d/field';
import type { CurrentArrow, MagFieldParams } from '../../lib/enm/magField3d/types';

const COPPER = '#f59e0b';
const UP = new Vector3(0, 1, 0);

/** Instanced cones marking conventional current direction along the conductor(s). */
function CurrentArrows({ arrows }: { arrows: CurrentArrow[] }) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    const direction = new Vector3();
    const scale = new Vector3(1, 1, 1);

    for (let i = 0; i < arrows.length; i += 1) {
      const a = arrows[i];
      position.set(a.position.x, a.position.y, a.position.z);
      direction.set(a.direction.x, a.direction.y, a.direction.z).normalize();
      quaternion.setFromUnitVectors(UP, direction);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.count = arrows.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [arrows]);

  return (
    <instancedMesh key={arrows.length} ref={ref} args={[undefined, undefined, Math.max(1, arrows.length)]}>
      <coneGeometry args={[0.1, 0.34, 12]} />
      <meshStandardMaterial color="#fde68a" emissive={COPPER} emissiveIntensity={0.45} toneMapped={false} />
    </instancedMesh>
  );
}

function CopperMaterial() {
  return <meshStandardMaterial color={COPPER} metalness={0.85} roughness={0.3} emissive="#7c2d12" emissiveIntensity={0.12} />;
}

function StraightWire() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.08, 0.08, WIRE_HALF_LENGTH * 2, 20]} />
      <CopperMaterial />
    </mesh>
  );
}

function CurrentLoop() {
  return (
    <mesh>
      <torusGeometry args={[LOOP_RADIUS, 0.07, 16, 64]} />
      <CopperMaterial />
    </mesh>
  );
}

function SolenoidCoil({ params }: { params: MagFieldParams }) {
  const geometry = useMemo(() => {
    const halfLen = Math.max(0.6, (params.coilLengthCm * CM_TO_SCENE) / 2);
    const R = Math.max(0.4, params.coilRadiusCm * CM_TO_SCENE);
    const turns = Math.max(2, Math.round(params.turns));
    const segsPerTurn = 24;
    const total = turns * segsPerTurn;
    const pts: Vector3[] = [];
    for (let i = 0; i <= total; i += 1) {
      const t = i / total;
      const a = t * turns * TWO_PI * params.direction;
      const z = -halfLen + t * 2 * halfLen;
      pts.push(new Vector3(R * Math.cos(a), R * Math.sin(a), z));
    }
    const curve = new CatmullRomCurve3(pts, false);
    return new TubeGeometry(curve, total, 0.05, 7, false);
  }, [params.coilLengthCm, params.coilRadiusCm, params.turns, params.direction]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <CopperMaterial />
    </mesh>
  );
}

function TwoWires({ params }: { params: MagFieldParams }) {
  const wires = twoWirePositions(params);
  return (
    <group>
      {wires.map((w, i) => (
        <mesh key={i} position={[w.x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, WIRE_HALF_LENGTH * 2, 20]} />
          <CopperMaterial />
        </mesh>
      ))}
    </group>
  );
}

export function Conductors({ params }: { params: MagFieldParams }) {
  const arrows = useMemo(() => generateCurrentArrows(params), [params]);

  return (
    <group>
      {params.mode === 'wire' ? <StraightWire /> : null}
      {params.mode === 'loop' ? <CurrentLoop /> : null}
      {params.mode === 'solenoid' ? <SolenoidCoil params={params} /> : null}
      {params.mode === 'two-wire' ? <TwoWires params={params} /> : null}
      <CurrentArrows arrows={arrows} />
    </group>
  );
}
