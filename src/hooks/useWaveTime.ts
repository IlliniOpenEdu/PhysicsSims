import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PLAYBACK_SPEED = 1;

export type WaveClockState = {
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  setTime: (nextTime: number) => void;
  setPlaybackSpeed: (nextSpeed: number) => void;
  togglePlay: () => void;
  reset: () => void;
};

export function useWaveTime(initialTime = 0): WaveClockState {
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(DEFAULT_PLAYBACK_SPEED);

  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const setTime = useCallback((nextTime: number) => {
    setCurrentTime(nextTime);
    lastFrameTimeRef.current = null;
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const reset = useCallback(() => {
    setCurrentTime(initialTime);
    lastFrameTimeRef.current = null;
  }, [initialTime]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      lastFrameTimeRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }

      const dtSeconds = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      setCurrentTime((prev) => prev + dtSeconds * playbackSpeed);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [isPlaying, playbackSpeed]);

  return {
    currentTime,
    isPlaying,
    playbackSpeed,
    setTime,
    setPlaybackSpeed,
    togglePlay,
    reset,
  };
}

export const useWaveClock = useWaveTime;
