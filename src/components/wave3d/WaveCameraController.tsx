import { useMemo } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useKeyboardCamera } from '../../hooks/useKeyboardCamera';
import type { NavigationMode } from '../../lib/waveEq/types';

type WaveCameraControllerProps = {
  navMode: NavigationMode;
  controlsRef: RefObject<OrbitControlsImpl>;
  moveSpeed?: number;
  sprintMultiplier?: number;
};

export function WaveCameraController({
  navMode,
  controlsRef,
  moveSpeed = 6,
  sprintMultiplier = 2.5,
}: WaveCameraControllerProps) {
  const { camera, gl } = useThree();
  const enabled = navMode === 'fly';
  const { keysRef, mouseDeltaRef } = useKeyboardCamera({ enabled, domElement: gl.domElement });

  const worldUp = useMemo(() => new Vector3(0, 1, 0), []);
  const forward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const move = useMemo(() => new Vector3(), []);

  useFrame((_state, delta) => {
    if (!enabled) {
      return;
    }

    const controls = controlsRef.current;
    if (controls) {
      controls.enabled = false;
    }

    const dx = mouseDeltaRef.current.dx;
    const dy = mouseDeltaRef.current.dy;
    mouseDeltaRef.current.dx = 0;
    mouseDeltaRef.current.dy = 0;

    if (dx !== 0 || dy !== 0) {
      camera.rotation.order = 'YXZ';
      camera.rotation.y -= dx * 0.0025;
      camera.rotation.x -= dy * 0.0025;
      camera.rotation.x = Math.max(-1.45, Math.min(1.45, camera.rotation.x));
    }

    const keys = keysRef.current;
    const isSprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = moveSpeed * (isSprinting ? sprintMultiplier : 1);

    camera.getWorldDirection(forward);
    right.crossVectors(forward, worldUp).normalize();
    move.set(0, 0, 0);

    if (keys.has('KeyW')) move.add(forward);
    if (keys.has('KeyS')) move.sub(forward);
    if (keys.has('KeyD')) move.add(right);
    if (keys.has('KeyA')) move.sub(right);
    if (keys.has('KeyE')) move.y += 1;
    if (keys.has('KeyQ')) move.y -= 1;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * delta);
      camera.position.add(move);

      if (controls) {
        controls.target.add(move);
      }
    }
  });

  return null;
}
