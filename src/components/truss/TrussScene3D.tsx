// ─────────────────────────────────────────────
//  3D truss viewport — @react-three/fiber scene.
//  Orbit/zoom reuses the drei OrbitControls setup from the wave-3d module.
//  There is no animation loop of our own: the scene re-renders when the
//  structure or solution changes. Same editor logic as 2D (clicks flow
//  through the shared tool-aware handlers); node coordinates are edited
//  in the inspector, and "Add node" clicks land on the ground plane.
// ─────────────────────────────────────────────

import { useMemo } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { clamp } from '../../utils/mathUtils';
import type { EditorMember, EditorNode, Selection, Tool } from './editorState';
import { memberColor, memberIntensity, type NodeVec, type SolutionView } from './renderModel';

const ADD_SNAP = 0.5; // m
const CLICK_MAX_DRAG = 6; // px — orbit drags should not count as clicks

interface Props {
  nodes: EditorNode[];
  members: EditorMember[];
  selection: Selection;
  pendingNode: number | null;
  tool: Tool;
  solutionView: SolutionView | null;
  ghostScale: number;
  showGhost: boolean;
  span: number;
  onNodeClick: (id: number) => void;
  onMemberClick: (id: number) => void;
  onMiss: () => void;
  onAddNode: (x: number, y: number, z: number) => void;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Cylinder between two points, oriented via quaternion. */
function Strut({
  a,
  b,
  radius,
  color,
  opacity = 1,
  emissive,
  onClick,
}: {
  a: NodeVec;
  b: NodeVec;
  radius: number;
  color: string;
  opacity?: number;
  emissive?: string;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { mid, quat, len } = useMemo(() => {
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = dir.length();
    const quat =
      len > 1e-9
        ? new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize())
        : new THREE.Quaternion();
    return {
      mid: new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2),
      quat,
      len,
    };
  }, [a.x, a.y, a.z, b.x, b.y, b.z]);

  if (len < 1e-9) return null;
  return (
    <mesh position={mid} quaternion={quat} onClick={onClick}>
      <cylinderGeometry args={[radius, radius, len, 10]} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissive ? 0.55 : 0}
      />
    </mesh>
  );
}

/** Arrow with its head at `tip`, pointing along unit `dir`. */
function Arrow3D({
  tip,
  dir,
  length,
  color,
}: {
  tip: NodeVec;
  dir: NodeVec;
  length: number;
  color: string;
}) {
  const { quat, shaftMid, headMid, shaftLen, headLen } = useMemo(() => {
    const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    const headLen = Math.min(0.28, length * 0.35);
    const shaftLen = length - headLen;
    const t = new THREE.Vector3(tip.x, tip.y, tip.z);
    return {
      quat: new THREE.Quaternion().setFromUnitVectors(UP, d),
      headMid: t.clone().addScaledVector(d, -headLen / 2),
      shaftMid: t.clone().addScaledVector(d, -(headLen + shaftLen / 2)),
      shaftLen,
      headLen,
    };
  }, [tip.x, tip.y, tip.z, dir.x, dir.y, dir.z, length]);

  return (
    <group>
      <mesh position={shaftMid} quaternion={quat}>
        <cylinderGeometry args={[0.028, 0.028, shaftLen, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={headMid} quaternion={quat}>
        <coneGeometry args={[0.085, headLen, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function SupportGlyph({ node }: { node: EditorNode }) {
  if (node.support === 'none') return null;
  const h = 0.32;
  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh position={[0, -h / 2, 0]}>
        <coneGeometry args={[0.2, h, 4]} />
        <meshStandardMaterial
          color="#94a3b8"
          transparent
          opacity={node.support === 'roller' ? 0.55 : 0.85}
        />
      </mesh>
      {node.support === 'roller' && (
        <mesh position={[0, -h - 0.06, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      )}
    </group>
  );
}

export function TrussScene3D({
  nodes,
  members,
  selection,
  pendingNode,
  tool,
  solutionView,
  ghostScale,
  showGhost,
  span,
  onNodeClick,
  onMemberClick,
  onMiss,
  onAddNode,
}: Props) {
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const baseRadius = clamp(span * 0.009, 0.03, 0.09);

  const ghostPoints = useMemo(() => {
    if (!showGhost || !solutionView || ghostScale <= 0) return null;
    const pts: [number, number, number][] = [];
    for (const m of members) {
      const a = nodeById.get(m.i);
      const b = nodeById.get(m.j);
      if (!a || !b) continue;
      const da = solutionView.dispByNode.get(m.i) ?? { x: 0, y: 0, z: 0 };
      const db = solutionView.dispByNode.get(m.j) ?? { x: 0, y: 0, z: 0 };
      pts.push(
        [a.x + da.x * ghostScale, a.y + da.y * ghostScale, a.z + da.z * ghostScale],
        [b.x + db.x * ghostScale, b.y + db.y * ghostScale, b.z + db.z * ghostScale],
      );
    }
    return pts.length > 0 ? pts : null;
  }, [showGhost, solutionView, ghostScale, members, nodeById]);

  const clickGuard =
    (fn: () => void) =>
    (e: ThreeEvent<MouseEvent>): void => {
      if (e.delta > CLICK_MAX_DRAG) return;
      e.stopPropagation();
      fn();
    };

  return (
    <Canvas
      camera={{ position: [span * 1.1, span * 0.7, span * 1.25], fov: 48, far: 500 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => onMiss()}
    >
      <color attach="background" args={['#030507']} />
      <fog attach="fog" args={['#030507', span * 4, span * 14]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 14, 8]} intensity={0.8} color="#dbeafe" />
      <pointLight position={[-9, 5, -10]} intensity={0.4} color="#f472b6" />

      <gridHelper args={[40, 40, '#1e3a5f', '#0c1a2e']} />
      <axesHelper args={[1.4]} />

      {/* Invisible ground plane: "Add node" clicks land here (y = 0) */}
      {tool === 'add-node' && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            if (e.delta > CLICK_MAX_DRAG) return;
            e.stopPropagation();
            onAddNode(
              Math.round(e.point.x / ADD_SNAP) * ADD_SNAP,
              0,
              Math.round(e.point.z / ADD_SNAP) * ADD_SNAP,
            );
          }}
        >
          <planeGeometry args={[80, 80]} />
          <meshBasicMaterial transparent opacity={0.03} color="#38bdf8" />
        </mesh>
      )}

      {/* Deflected-shape ghost */}
      {ghostPoints && (
        <Line points={ghostPoints} segments color="#e2e8f0" transparent opacity={0.45} lineWidth={1} />
      )}

      {/* Members */}
      {members.map((m) => {
        const a = nodeById.get(m.i);
        const b = nodeById.get(m.j);
        if (!a || !b) return null;
        const selected = selection?.kind === 'member' && selection.id === m.id;
        return (
          <Strut
            key={m.id}
            a={a}
            b={b}
            radius={baseRadius * (0.8 + 0.7 * memberIntensity(solutionView, m.id))}
            color={memberColor(solutionView, m.id)}
            emissive={selected ? '#fbbf24' : undefined}
            onClick={clickGuard(() => onMemberClick(m.id))}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const selected = selection?.kind === 'node' && selection.id === n.id;
        const pending = pendingNode === n.id;
        return (
          <mesh
            key={n.id}
            position={[n.x, n.y, n.z]}
            onClick={clickGuard(() => onNodeClick(n.id))}
          >
            <sphereGeometry args={[baseRadius * 2.1, 16, 16]} />
            <meshStandardMaterial
              color={pending ? '#22d3ee' : selected ? '#fbbf24' : '#e2e8f0'}
              emissive={pending ? '#22d3ee' : selected ? '#fbbf24' : '#334155'}
              emissiveIntensity={pending || selected ? 0.7 : 0.25}
            />
          </mesh>
        );
      })}

      {/* Support glyphs */}
      {nodes.map((n) => (
        <SupportGlyph key={`s${n.id}`} node={n} />
      ))}

      {/* Load arrows (rose) */}
      {nodes.map((n) => {
        const mag = Math.hypot(n.load.fx, n.load.fy, n.load.fz);
        if (mag === 0) return null;
        return (
          <Arrow3D
            key={`l${n.id}`}
            tip={n}
            dir={{ x: n.load.fx / mag, y: n.load.fy / mag, z: n.load.fz / mag }}
            length={clamp(span * 0.22, 0.7, 2.2)}
            color="#fb7185"
          />
        );
      })}

      {/* Reaction arrows (emerald) at supports */}
      {solutionView &&
        nodes.map((n) => {
          const r = solutionView.reactionByNode.get(n.id);
          if (!r) return null;
          const mag = Math.hypot(r.x, r.y, r.z);
          if (mag < 1) return null;
          return (
            <Arrow3D
              key={`r${n.id}`}
              tip={{ x: n.x + (r.x / mag) * 0.12, y: n.y + (r.y / mag) * 0.12, z: n.z + (r.z / mag) * 0.12 }}
              dir={{ x: r.x / mag, y: r.y / mag, z: r.z / mag }}
              length={clamp(span * 0.18, 0.6, 1.8)}
              color="#34d399"
            />
          );
        })}

      <OrbitControls
        enablePan
        enableZoom
        maxDistance={span * 8}
        minDistance={span * 0.25}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI - 0.15}
      />
    </Canvas>
  );
}
