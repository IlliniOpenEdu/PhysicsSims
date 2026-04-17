import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { EMVolumeSample, WaveParams } from '../../lib/waveEq/types.ts';

type FieldKind = 'electric' | 'magnetic';

type ArrowFieldProps = {
  samples: EMVolumeSample[];
  kind: FieldKind;
  color: string;
  visible: boolean;
  volumeArrowScale: number;
  skipNearZero: boolean;
  minMagnitude: number;
};

const UP = new Vector3(0, 1, 0);
const POS_X = new Vector3(1, 0, 0);
const NEG_X = new Vector3(-1, 0, 0);
const POS_Y = new Vector3(0, 1, 0);
const NEG_Y = new Vector3(0, -1, 0);

function getFieldValue(kind: FieldKind, sample: EMVolumeSample) {
  return kind === 'electric' ? sample.e : sample.b;
}

function getFieldAxis(kind: FieldKind, value: number) {
  if (kind === 'electric') {
    return value >= 0 ? POS_X : NEG_X;
  }

  return value >= 0 ? POS_Y : NEG_Y;
}

function ArrowFieldInstances({
  samples,
  kind,
  color,
  visible,
  volumeArrowScale,
  skipNearZero,
  minMagnitude,
}: ArrowFieldProps) {
  const shaftRef = useRef<InstancedMesh>(null);
  const tipRef = useRef<InstancedMesh>(null);

  const shaftGeometry = useMemo(() => new CylinderGeometry(0.055, 0.055, 1, 6, 1, false), []);
  const tipGeometry = useMemo(() => new ConeGeometry(0.12, 1, 6, 1, false), []);
  const shaftMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.15,
        emissive: color,
        emissiveIntensity: 0.08,
      }),
    [color],
  );
  const tipMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.1,
        emissive: color,
        emissiveIntensity: 0.12,
      }),
    [color],
  );
  const positiveQuaternion = useMemo(() => new Quaternion().setFromUnitVectors(UP, kind === 'electric' ? POS_X : POS_Y), [kind]);
  const negativeQuaternion = useMemo(() => new Quaternion().setFromUnitVectors(UP, kind === 'electric' ? NEG_X : NEG_Y), [kind]);
  const matrix = useMemo(() => new Matrix4(), []);
  const position = useMemo(() => new Vector3(), []);
  const scale = useMemo(() => new Vector3(), []);

  useEffect(() => {
    return () => {
      shaftGeometry.dispose();
      tipGeometry.dispose();
      shaftMaterial.dispose();
      tipMaterial.dispose();
    };
  }, [shaftGeometry, shaftMaterial, tipGeometry, tipMaterial]);

  useLayoutEffect(() => {
    const shaftMesh = shaftRef.current;
    const tipMesh = tipRef.current;

    if (!shaftMesh || !tipMesh) {
      return;
    }

    if (!visible) {
      shaftMesh.count = 0;
      tipMesh.count = 0;
      shaftMesh.instanceMatrix.needsUpdate = true;
      tipMesh.instanceMatrix.needsUpdate = true;
      return;
    }

    let instanceIndex = 0;
    const shaftLengthFactor = 0.72;
    const tipLengthFactor = 0.28;

    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i];
      const fieldValue = getFieldValue(kind, sample);
      const magnitude = Math.abs(fieldValue);

      if (skipNearZero && magnitude < minMagnitude) {
        continue;
      }

      const direction = getFieldAxis(kind, fieldValue);
      const arrowLength = Math.max(0.08, magnitude * volumeArrowScale);
      const shaftLength = Math.max(0.05, arrowLength * shaftLengthFactor);
      const tipLength = Math.max(0.06, arrowLength * tipLengthFactor);
      const quaternion = fieldValue >= 0 ? positiveQuaternion : negativeQuaternion;

      position.set(
        sample.x + direction.x * (shaftLength * 0.5),
        sample.y + direction.y * (shaftLength * 0.5),
        sample.z + direction.z * (shaftLength * 0.5),
      );
      scale.set(0.95, shaftLength, 0.95);
      matrix.compose(position, quaternion, scale);
      shaftMesh.setMatrixAt(instanceIndex, matrix);

      position.set(
        sample.x + direction.x * (shaftLength + tipLength * 0.5),
        sample.y + direction.y * (shaftLength + tipLength * 0.5),
        sample.z + direction.z * (shaftLength + tipLength * 0.5),
      );
      scale.set(1.05, tipLength, 1.05);
      matrix.compose(position, quaternion, scale);
      tipMesh.setMatrixAt(instanceIndex, matrix);
      instanceIndex += 1;
    }

    shaftMesh.count = instanceIndex;
    tipMesh.count = instanceIndex;
    shaftMesh.instanceMatrix.needsUpdate = true;
    tipMesh.instanceMatrix.needsUpdate = true;
  }, [kind, minMagnitude, negativeQuaternion, positiveQuaternion, samples, skipNearZero, visible, volumeArrowScale, matrix, position, scale]);

  if (!visible) {
    return null;
  }

  return (
    <group>
      <instancedMesh ref={shaftRef} args={[shaftGeometry, shaftMaterial, samples.length]}>
      </instancedMesh>
      <instancedMesh ref={tipRef} args={[tipGeometry, tipMaterial, samples.length]}>
      </instancedMesh>
    </group>
  );
}

type EMVolumeArrowsProps = {
  samples: EMVolumeSample[];
  params: WaveParams;
};

export function EMVolumeArrows({ samples, params }: EMVolumeArrowsProps) {
  const volumeArrowScale = params.volumeArrowScale ?? 0.85;
  const showElectric = params.volumeShowElectric ?? true;
  const showMagnetic = params.volumeShowMagnetic ?? true;
  const skipNearZero = params.volumeSkipNearZero ?? true;
  const minMagnitude = params.volumeMinMagnitude ?? 0.08;

  return (
    <group>
      <ArrowFieldInstances
        samples={samples}
        kind="electric"
        color="#f59e0b"
        visible={showElectric}
        volumeArrowScale={volumeArrowScale}
        skipNearZero={skipNearZero}
        minMagnitude={minMagnitude}
      />
      <ArrowFieldInstances
        samples={samples}
        kind="magnetic"
        color="#22d3ee"
        visible={showMagnetic}
        volumeArrowScale={volumeArrowScale}
        skipNearZero={skipNearZero}
        minMagnitude={minMagnitude}
      />
    </group>
  );
}
