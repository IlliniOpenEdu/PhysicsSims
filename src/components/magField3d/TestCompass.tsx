import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import { sampleFieldDirection } from '../../lib/enm/magField3d/field';
import type { MagFieldParams } from '../../lib/enm/magField3d/types';

const UP = new Vector3(0, 1, 0);

/**
 * A small magnetic dipole / compass needle that aligns with the local field
 * direction at its position. North (red) points along B.
 */
export function TestCompass({ params }: { params: MagFieldParams }) {
  const quaternion = useMemo(() => {
    const dir = sampleFieldDirection(params.compass, params);
    const v = new Vector3(dir.x, dir.y, dir.z);
    if (v.lengthSq() < 1e-8) return new Quaternion();
    v.normalize();
    return new Quaternion().setFromUnitVectors(UP, v);
  }, [params]);

  const q: [number, number, number, number] = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
  const pos: [number, number, number] = [params.compass.x, params.compass.y, params.compass.z];

  return (
    <group position={pos}>
      {/* pivot */}
      <mesh>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} />
      </mesh>
      <group quaternion={q}>
        {/* north half (red) */}
        <mesh position={[0, 0.34, 0]}>
          <coneGeometry args={[0.12, 0.68, 12]} />
          <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.35} toneMapped={false} />
        </mesh>
        {/* south half (white) */}
        <mesh position={[0, -0.34, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.12, 0.68, 12]} />
          <meshStandardMaterial color="#e2e8f0" emissive="#94a3b8" emissiveIntensity={0.2} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
