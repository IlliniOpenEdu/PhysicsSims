import { useLayoutEffect, useRef } from 'react';
import { BufferAttribute, BufferGeometry, DynamicDrawUsage } from 'three';
import type { EMWaveSample } from '../../lib/waveEq/types';

type EMWaveLineProps = {
  samples: EMWaveSample[];
  kind: 'electric' | 'magnetic';
};

export function EMWaveLine({ samples, kind }: EMWaveLineProps) {
  const geometryRef = useRef<BufferGeometry>(null);

  useLayoutEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry) {
      return;
    }

    const positions = new Float32Array(samples.length * 3);
    for (let i = 0; i < samples.length; i += 1) {
      const idx = i * 3;
      const sample = samples[i];
      if (kind === 'electric') {
        positions[idx] = sample.e;
        positions[idx + 1] = 0;
        positions[idx + 2] = sample.z;
      } else {
        positions[idx] = 0;
        positions[idx + 1] = sample.b;
        positions[idx + 2] = sample.z;
      }
    }

    let positionAttribute = geometry.getAttribute('position') as BufferAttribute | undefined;
    if (!positionAttribute || positionAttribute.array.length !== positions.length) {
      positionAttribute = new BufferAttribute(positions, 3);
      positionAttribute.setUsage(DynamicDrawUsage);
      geometry.setAttribute('position', positionAttribute);
    } else {
      positionAttribute.copyArray(positions);
      positionAttribute.needsUpdate = true;
    }

    geometry.setDrawRange(0, samples.length);
    geometry.computeBoundingSphere();
  }, [kind, samples]);

  const color = kind === 'electric' ? '#f59e0b' : '#22d3ee';

  return (
    <line>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial color={color} transparent opacity={0.95} linewidth={1.8} toneMapped={false} />
    </line>
  );
}
