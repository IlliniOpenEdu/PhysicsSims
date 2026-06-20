import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { CatmullRomCurve3, Color, InstancedMesh, Matrix4, Vector3 } from 'three';
import type { FieldLine } from '../../lib/enm/magField3d/types';

// Brightness ramp: dim indigo (weak field) → cyan → near-white (strong field).
const COLD = new Color('#1e3a8a');
const WARM = new Color('#22d3ee');
const HOT = new Color('#f0f9ff');

function strengthColor(s: number, out: Color): Color {
  const t = Math.min(1, Math.max(0, s));
  if (t < 0.5) out.copy(COLD).lerp(WARM, t / 0.5);
  else out.copy(WARM).lerp(HOT, (t - 0.5) / 0.5);
  return out;
}

type FieldLinesProps = {
  lines: FieldLine[];
  /** Particle drift toggle (animated streamlines). */
  animate?: boolean;
};

const PARTICLES_PER_LINE = 3;

export function FieldLines({ lines, animate = true }: FieldLinesProps) {
  const built = useMemo(() => {
    const tmp = new Color();
    return lines
      .filter((line) => line.points.length > 1)
      .map((line) => {
        const pts = line.points.map((p) => new Vector3(p.x, p.y, p.z));
        const colors = line.strength.map((s) => strengthColor(s, tmp).clone());
        const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
        const avg = line.strength.reduce((a, b) => a + b, 0) / line.strength.length;
        return { pts, colors, curve, avg };
      });
  }, [lines]);

  const particles = useMemo(() => {
    const arr: { curve: CatmullRomCurve3; phase: number; speed: number }[] = [];
    for (const b of built) {
      for (let i = 0; i < PARTICLES_PER_LINE; i += 1) {
        arr.push({ curve: b.curve, phase: i / PARTICLES_PER_LINE, speed: 0.05 + 0.05 * b.avg });
      }
    }
    return arr;
  }, [built]);

  const particleRef = useRef<InstancedMesh>(null);
  const matrix = useMemo(() => new Matrix4(), []);
  const point = useMemo(() => new Vector3(), []);

  useFrame((state) => {
    const mesh = particleRef.current;
    if (!mesh || !animate || particles.length === 0) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const u = (p.phase + t * p.speed) % 1;
      try {
        p.curve.getPointAt(u, point);
      } catch {
        continue;
      }
      matrix.makeTranslation(point.x, point.y, point.z);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {built.map((b, i) => (
        <Line
          key={i}
          points={b.pts}
          vertexColors={b.colors}
          lineWidth={1.4}
          transparent
          opacity={0.82}
          toneMapped={false}
        />
      ))}

      {animate && particles.length > 0 ? (
        <instancedMesh
          key={particles.length}
          ref={particleRef}
          args={[undefined, undefined, particles.length]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#e0f2fe" toneMapped={false} />
        </instancedMesh>
      ) : null}
    </group>
  );
}
