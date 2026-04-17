import { Grid } from '@react-three/drei';
import type { EMDisplayMode, WaveMode } from '../../lib/waveEq/types';

type WaveGridProps = {
  mode: WaveMode;
  emDisplayMode?: EMDisplayMode;
};

export function WaveGrid({ mode, emDisplayMode }: WaveGridProps) {
  if (mode === 'em') {
    const isVolume = emDisplayMode === 'volume';

    return (
      <Grid
        position={[0, isVolume ? -7 : -6, 0]}
        args={[isVolume ? 180 : 120, isVolume ? 180 : 120]}
        cellSize={isVolume ? 3 : 2}
        cellThickness={isVolume ? 0.12 : 0.2}
        cellColor={isVolume ? '#0b1220' : '#0f172a'}
        sectionSize={isVolume ? 12 : 8}
        sectionThickness={isVolume ? 0.28 : 0.45}
        sectionColor={isVolume ? '#14203a' : '#1e293b'}
        fadeDistance={isVolume ? 220 : 160}
        fadeStrength={isVolume ? 1.1 : 1}
        followCamera={false}
        infiniteGrid
      />
    );
  }

  return (
    <Grid
      position={[0, -3, 0]}
      args={[28, 28]}
      cellSize={1}
      cellThickness={0.35}
      cellColor="#1e293b"
      sectionSize={4}
      sectionThickness={0.9}
      sectionColor="#334155"
      fadeDistance={30}
      fadeStrength={1}
      followCamera={false}
      infiniteGrid
    />
  );
}
