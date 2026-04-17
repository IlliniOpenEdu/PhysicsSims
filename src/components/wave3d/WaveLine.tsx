import { useLayoutEffect, useRef } from 'react';
import { BufferAttribute, BufferGeometry, DynamicDrawUsage } from 'three';

type WaveLineProps = {
  positions: Float32Array;
  color: string;
  opacity?: number;
  lineWidth?: number;
  updateVersion?: number;
};

export function WaveLine({ positions, color, opacity = 1, lineWidth = 2, updateVersion = 0 }: WaveLineProps) {
  const geometryRef = useRef<BufferGeometry>(null);

  useLayoutEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry) {
      return;
    }

    let positionAttribute = geometry.getAttribute('position') as BufferAttribute | undefined;

    if (!positionAttribute || positionAttribute.array.length !== positions.length) {
      positionAttribute = new BufferAttribute(positions, 3);
      positionAttribute.setUsage(DynamicDrawUsage);
      geometry.setAttribute('position', positionAttribute);
    } else {
      positionAttribute.array.set(positions);
      positionAttribute.needsUpdate = true;
    }

    geometry.setDrawRange(0, positions.length / 3);
    geometry.computeBoundingSphere();
  }, [positions, updateVersion]);

  return (
    <line>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={lineWidth} toneMapped={false} />
    </line>
  );
}
