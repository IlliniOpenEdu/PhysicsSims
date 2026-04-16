import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONTROLS } from '../lib/collider/constants';
import {
  createInitialBunches,
  createInitialRuntime,
  createLog,
  pushLog,
  updateSimulation,
} from '../lib/collider/physics';
import type { ColliderControls, ColliderRuntime, ColliderSnapshot, ViewMode } from '../lib/collider/types';

const SNAPSHOT_INTERVAL_MS = 120;

export function useColliderSimulation() {
  const [controls, setControls] = useState<ColliderControls>(DEFAULT_CONTROLS);
  const [mode, setMode] = useState<ViewMode>('ring');
  const [isPlaying, setIsPlaying] = useState(true);
  const runtimeRef = useRef<ColliderRuntime>(createInitialRuntime(DEFAULT_CONTROLS));
  const controlsRef = useRef<ColliderControls>(DEFAULT_CONTROLS);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef(0);

  const [snapshot, setSnapshot] = useState<ColliderSnapshot>({
    time: 0,
    collisionRate: 0,
    collisionsActive: 0,
    logs: runtimeRef.current.logs,
  });

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    runtimeRef.current.bunches = createInitialBunches(controlsRef.current);
    pushLog(
      runtimeRef.current,
      createLog('beam', runtimeRef.current.time, 'Beam packet layout rebuilt')
    );
  }, [controls.bunchCount, controls.particleType]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
      return;
    }

    const frame = (ts: number) => {
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
      }

      const dt = Math.min(0.04, Math.max(0.001, (ts - lastTsRef.current) / 1000));
      lastTsRef.current = ts;

      updateSimulation(runtimeRef.current, controlsRef.current, dt);

      if (ts - lastSnapshotRef.current >= SNAPSHOT_INTERVAL_MS) {
        lastSnapshotRef.current = ts;
        const rt = runtimeRef.current;
        setSnapshot({
          time: rt.time,
          collisionRate: rt.collisionRate,
          collisionsActive: rt.collisions.length,
          logs: rt.logs,
        });
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [isPlaying]);

  const setControl = useCallback(<K extends keyof ColliderControls>(key: K, value: ColliderControls[K]) => {
    setControls((prev) => ({ ...prev, [key]: value }));

    if (key === 'collisionsEnabled') {
      pushLog(
        runtimeRef.current,
        createLog('system', runtimeRef.current.time, value ? 'Collisions armed' : 'Collisions disabled')
      );
    }

    if (key === 'particleType') {
      pushLog(
        runtimeRef.current,
        createLog('beam', runtimeRef.current.time, `Particle beam set to ${String(value)}`)
      );
    }

    if (key === 'bunchCount') {
      pushLog(
        runtimeRef.current,
        createLog('beam', runtimeRef.current.time, `Bunch count set to ${String(value)} per direction`)
      );
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
    pushLog(
      runtimeRef.current,
      createLog('system', runtimeRef.current.time, isPlaying ? 'Simulation paused' : 'Simulation resumed')
    );
  }, [isPlaying]);

  const reset = useCallback(() => {
    const next = createInitialRuntime(controlsRef.current);
    runtimeRef.current = next;
    setSnapshot({
      time: next.time,
      collisionRate: next.collisionRate,
      collisionsActive: next.collisions.length,
      logs: next.logs,
    });
  }, []);

  const readout = useMemo(
    () => ({
      beamEnergy: controls.beamEnergy,
      magneticField: controls.magneticField,
      bunchCount: controls.bunchCount * 2,
      particleType: controls.particleType,
      collisionRate: snapshot.collisionRate,
      collisionsEnabled: controls.collisionsEnabled,
      detectorSensitivity: controls.detectorSensitivity,
    }),
    [controls, snapshot.collisionRate]
  );

  return {
    controls,
    setControl,
    mode,
    setMode,
    isPlaying,
    togglePlay,
    reset,
    runtimeRef,
    snapshot,
    readout,
  };
}
