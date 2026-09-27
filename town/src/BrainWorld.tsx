// Brain to planet: plates, building, rail and dressing placements and per-node
// details, all inside the knowledge planet's group.
import { Suspense, useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { AssetBatches, assets, type Placement } from "./Assets";
import { biomeColors, Plates, type PlateStyle } from "./Scene";
import {
  BRAIN_POS,
  facingOf,
  hexAligned,
  nearestTile,
  orientation,
  RADIUS,
  slerpNormal,
  surface,
  tiles,
  travelFrame,
  turned,
  type Tile,
} from "./planet";
import { maturity, type Layout, hash } from "./layout";
import { ASKS, progress, QUEST_COLORS, type QuestKind } from "./game";
import { depots } from "./depots";
import { Keepers } from "./Keepers";
import { Pet } from "./Robots";
import { useTown } from "./store";
import { brainGate } from "./transit";
import type { Brain, BrainNode } from "./types";
export function nodeAsset(node: BrainNode, brain: Brain) {
  const growth = `growth.${node.type}.${maturity(node, brain)}`;
  return assets.has(growth)
    ? growth
    : assets.has(`node.${node.type}`)
      ? `node.${node.type}`
      : "node.note";
}
export function buildingPlacements(brain: Brain, layout: Layout): Placement[] {
  return brain.nodes.flatMap((n) => {
    const tile = layout.positions.get(n.id);
    if (tile === undefined || tile < 0) return [];
    // Buildings face their region's square, the seed tile, like houses round a green.
    const square = layout.seeds.get(layout.groupOf.get(n.id) || "");
    return [
      {
        key: n.id,
        nodeId: n.id,
        asset: nodeAsset(n, brain),
        position: surface(tile),
        quaternion:
          square !== undefined && square !== tile
            ? facingOf(tiles[tile], tiles[square])
            : orientation(tile),
        scale: ["goal", "project"].includes(n.type)
          ? 1
          : 0.72 + maturity(n, brain) * 0.09,
        dim:
          Date.now() - Date.parse(n.updated || n.created || "") > 90 * 86400000,
      },
    ];
  });
}
/** A short burst of rising sparks over a place whose quest was just done. */
function Burst({ id }: { id: string }) {
  const until = useTown((s) => s.tended[id] || 0);
  const ref = useRef<Group>(null!);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const left = until - performance.now();
    if (left <= 0) {
      g.visible = false;
      return;
    }
    const t = 1 - left / 4000;
    g.visible = true;
    g.children.forEach((c, i) => {
      const a = (i / g.children.length) * Math.PI * 2,
        r = 0.15 + t * 0.45;
      c.position.set(
        Math.cos(a) * r,
        0.2 + t * 1.4 + Math.sin(t * 9 + i) * 0.05,
        Math.sin(a) * r,
      );
      c.scale.setScalar(Math.max(0.001, 1 - t));
    });
  });
  if (until <= performance.now()) return null;
  return (
    <group ref={ref}>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.045, 6, 5]} />
          <meshStandardMaterial
            color="#fff1b8"
            emissive="#ffd25e"
            emissiveIntensity={2.2}
          />
        </mesh>
      ))}
    </group>
  );
}
/**
 * Per-place markers, one system: a selection ring, the pinned flag, a pennant
 * in the quest's colour when the place needs tending, fog over a question, a
 * lamp, and a burst when its quest gets done.
 * @param quest the place's open quest kind, if any
 */
function Details({
  node,
  tile,
  quest,
}: {
  node: BrainNode;
  tile: number;
  quest?: QuestKind;
}) {
  const old =
    Date.now() - Date.parse(node.updated || node.created || "") > 90 * 86400000;
  const selected = useTown((s) => s.selected === node.id);
  return (
    <group position={surface(tile, 0.2)} quaternion={orientation(tile)}>
      <Burst id={node.id} />
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.43, 0.47, 32]} />
          <meshBasicMaterial color="#f8d89c" />
        </mesh>
      )}
      {node.pinned && (
        <group position={[0.3, 0, 0.2]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 1.1, 5]} />
            <meshStandardMaterial color="#e5dfc7" />
          </mesh>
          <mesh position={[0.13, 0.95, 0]}>
            <boxGeometry args={[0.25, 0.16, 0.025]} />
            <meshStandardMaterial color="#f5bf62" />
          </mesh>
        </group>
      )}
      {quest && quest !== "question" && (
        <group
          position={[0.32, 0, -0.24]}
          onPointerOver={() => useTown.setState({ hover: ASKS[quest] })}
          onPointerOut={() => useTown.setState({ hover: null })}
        >
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.013, 0.013, 0.64, 5]} />
            <meshStandardMaterial color="#e5dfc7" />
          </mesh>
          <mesh position={[0.075, 0.57, 0]} castShadow>
            <boxGeometry args={[0.15, 0.1, 0.02]} />
            <meshStandardMaterial color={QUEST_COLORS[quest]} />
          </mesh>
        </group>
      )}
      {node.type === "question" && (
        <mesh position={[0, 0.32, 0]} scale={[0.6, 0.3, 0.6]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#c7d8e7"
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh position={[0.22, 0.12, 0.28]}>
        <boxGeometry args={[0.045, 0.06, 0.04]} />
        <meshStandardMaterial
          color={old ? "#697168" : "#f3d898"}
          emissive="#f3bc66"
          emissiveIntensity={old ? 0.03 : 0.7}
        />
      </mesh>
    </group>
  );
}
/**
 * The town hall yard: one banner per level, and a brazier that burns while
 * the streak is alive and sits cold when it is broken.
 */
function Hall({
  tile,
  level,
  streak,
}: {
  tile: number;
  level: number;
  streak: number;
}) {
  const flame = useRef<Group>(null!);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const t = clock.elapsedTime;
    flame.current.scale.set(
      1 + Math.sin(t * 13) * 0.12,
      1 + Math.sin(t * 17) * 0.2,
      1 + Math.cos(t * 11) * 0.12,
    );
    flame.current.rotation.y = t * 2;
  });
  const fire = streak
    ? `${streak}-day streak · the fire burns while you keep tending`
    : "Streak broken · tend a place today to relight the fire";
  const banners = Array.from({ length: level }, (_, i) => {
    const ring = Math.floor(i / 12),
      angle = (i % 12) * (Math.PI / 6) + ring * 0.26,
      r = 0.46 + ring * 0.14;
    return {
      key: i,
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      angle,
      color: i % 2 ? "#f5bf62" : "#e0705f",
    };
  });
  return (
    <group position={surface(tile, 0.2)} quaternion={orientation(tile)}>
      <group
        onPointerOver={() =>
          useTown.setState({ hover: `Level ${level} · one banner per level` })
        }
        onPointerOut={() => useTown.setState({ hover: null })}
      >
        {banners.map((b) => (
          <group
            key={b.key}
            position={[b.x, 0, b.z]}
            rotation={[0, -b.angle, 0]}
          >
            <mesh position={[0, 0.3, 0]} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 0.6, 5]} />
              <meshStandardMaterial color="#e5dfc7" />
            </mesh>
            <mesh position={[0.08, 0.5, 0]} castShadow>
              <boxGeometry args={[0.14, 0.11, 0.02]} />
              <meshStandardMaterial color={b.color} />
            </mesh>
          </group>
        ))}
      </group>
      <group
        position={[0.13, 0, -0.48]}
        onPointerOver={() => useTown.setState({ hover: fire })}
        onPointerOut={() => useTown.setState({ hover: null })}
      >
        <mesh position={[0, 0.08, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.06, 0.16, 8]} />
          <meshStandardMaterial color="#4a4038" />
        </mesh>
        {streak > 0 ? (
          <group ref={flame} position={[0, 0.17, 0]}>
            <mesh position={[0, 0.12, 0]}>
              <coneGeometry args={[0.08, 0.28, 6]} />
              <meshStandardMaterial
                color="#ffb347"
                emissive="#ff7a1a"
                emissiveIntensity={2.4}
              />
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <coneGeometry args={[0.045, 0.16, 5]} />
              <meshStandardMaterial
                color="#fff2b0"
                emissive="#ffd86b"
                emissiveIntensity={3}
              />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.05, 6, 5]} />
            <meshStandardMaterial
              color="#3a2f2a"
              emissive="#5a2a14"
              emissiveIntensity={0.35}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}
export function railPlacements(
  brain: Brain,
  layout: Layout,
  selected: string | null,
  all: boolean,
) {
  const placements: Placement[] = [];
  for (const edge of brain.edges) {
    if (!all && edge.from !== selected && edge.to !== selected) continue;
    const a = layout.positions.get(edge.from),
      b = layout.positions.get(edge.to);
    if (a === undefined || b === undefined || a < 0 || b < 0 || a === b)
      continue;
    const from = tiles[a].normal,
      to = tiles[b].normal,
      angle = Math.acos(Math.max(-1, Math.min(1, from.dot(to)))),
      steps = Math.max(2, Math.ceil((angle * RADIUS) / 0.65));
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps,
        n = slerpNormal(from, to, t),
        tangent = slerpNormal(from, to, Math.min(1, t + 0.005))
          .sub(n)
          .normalize();
      const ocean = !layout.owners.has(nearestTile(n).id);
      placements.push({
        key: `${edge.id}:${i}`,
        asset: ocean ? "link.bridge" : "link.rail",
        position: n.clone().multiplyScalar(RADIUS + 0.25),
        quaternion: travelFrame(n, tangent, "z"),
        scale: 0.65,
        label: brain.rels[edge.rel] || edge.rel,
      });
    }
  }
  return placements;
}
const ocean: PlateStyle = { color: "#2f617b", height: -0.07 };
export function BrainWorld({
  layout,
  allLinks = false,
}: {
  layout: Layout | null;
  allLinks?: boolean;
}) {
  const brain = useTown((s) => s.brain),
    selected = useTown((s) => s.selected);
  const style = useCallback(
    (tile: Tile): PlateStyle => {
      const owner = layout?.owners.get(tile.id);
      return owner === undefined
        ? ocean
        : {
            color: biomeColors[owner % biomeColors.length],
            height: 0.08,
            lighten: (layout!.patches.get(tile.id) || 0) * 0.035,
          };
    },
    [layout],
  );
  const buildings = useMemo(
    () => (brain && layout ? buildingPlacements(brain, layout) : []),
    [brain, layout],
  );
  const game = useMemo(() => (brain ? progress(brain) : null), [brain]);
  const questOf = useMemo(
    () => new Map(game?.quests.map((q) => [q.id, q.kind])),
    [game],
  );
  const hall =
    brain && layout
      ? layout.positions.get(
          brain.nodes.find((n) => n.type === "identity" && !n.parent)?.id || "",
        )
      : undefined;
  const rails = useMemo(
    () =>
      brain && layout ? railPlacements(brain, layout, selected, allLinks) : [],
    [brain, layout, selected, allLinks],
  );
  const dressing = useMemo(() => {
    if (!layout) return [];
    const placements: Placement[] = [];
    const occupied = new Set(layout.positions.values()),
      taken = new Set<number>();
    const put = (
      key: string,
      asset: string,
      tile: number,
      scale = 1,
      quaternion = orientation(tile),
      height?: number,
      label?: string,
    ) => {
      if (!assets.has(asset)) return;
      placements.push({
        key,
        asset,
        position: surface(tile, height),
        quaternion,
        scale,
        label,
      });
      taken.add(tile);
    };
    const spin = (tile: number) => (hash(`${tile}:spin`) % 628) / 100;
    const free = (tile: number) =>
      tiles[tile].neighbors.length === 6 &&
      !occupied.has(tile) &&
      !taken.has(tile);
    const region = (id: string) =>
      [...layout.owners]
        .filter(
          ([tile, owner]) => layout.groups[owner]?.id === id && free(tile),
        )
        .map(([tile]) => tile);
    // The twelve pentagons stay ocean; a mountain hides each one.
    for (const t of tiles)
      if (t.neighbors.length === 5)
        put(
          `mountain:${t.id}`,
          "pentagon.mountain",
          t.id,
          1,
          turned(t.id, spin(t.id)),
          0.02,
        );
    // The tunnel gate: a base module on the tile that faces the factory.
    if (!occupied.has(brainGate.id))
      put(
        "gate",
        "ares.base",
        brainGate.id,
        1,
        orientation(brainGate.id),
        layout.owners.has(brainGate.id) ? 0.18 : 0.02,
        "Tunnel gate",
      );
    // Keeper depots: a charging pad by each region's square and quarters beside it.
    const titles = new Map(layout.groups.map((g) => [g.id, g.title]));
    for (const d of depots(layout)) {
      const title = titles.get(d.region) || d.region;
      put(
        `depot:${d.region}`,
        "factory.pad",
        d.pad,
        1,
        orientation(d.pad),
        0.17,
        `Keeper's depot · ${title}`,
      );
      if (d.home >= 0)
        put(
          `home:${d.region}`,
          "factory.container",
          d.home,
          0.9,
          facingOf(tiles[d.home], tiles[d.pad]),
          0.18,
          `Keeper's quarters · ${title}`,
        );
    }
    const inbox = layout.positions.get("inbox");
    if (inbox !== undefined && inbox >= 0)
      put("pad", "inbox.pad", inbox, 1, orientation(inbox), 0.19);
    const coast = region("oceanaid")
      .map((tile) => ({
        tile,
        sea: tiles[tile].neighbors.find((n) => !layout.owners.has(n)),
      }))
      .find((c) => c.sea !== undefined);
    if (coast)
      put(
        "dock",
        "biome.oceanaid.dock",
        coast.tile,
        1,
        hexAligned(coast.tile),
        0.09,
      );
    // Ares launch ground: one radar mast as the landmark.
    const [mast] = region("ares");
    if (mast !== undefined)
      put(
        "ares.radar",
        "ares.radar",
        mast,
        1,
        turned(mast, spin(mast)),
        undefined,
        "Ares radar mast",
      );
    // Coast trees: the region's tree on every other free tile that touches the sea.
    const shore = [...layout.owners]
      .filter(
        ([tile]) =>
          free(tile) &&
          tiles[tile].neighbors.some((n) => !layout.owners.has(n)),
      )
      .sort((a, b) => a[0] - b[0]);
    shore.forEach(([tile, owner], i) => {
      const id = layout.groups[owner]?.id;
      if (id && i % 2 === 0)
        put(
          `tree:${tile}`,
          `biome.${id}.tree`,
          tile,
          0.7,
          turned(tile, spin(tile)),
        );
    });
    return placements;
  }, [layout]);
  return (
    <group position={BRAIN_POS}>
      <Plates
        tiles={tiles}
        style={style}
        onTile={(tile) =>
          useTown.getState().look({
            focus: { planet: "brain", tile },
            selected:
              (layout &&
                [...layout.positions].find(([, t]) => t === tile)?.[0]) ||
              null,
          })
        }
      />
      {brain && layout && (
        <>
          <Suspense fallback={null}>
            <AssetBatches placements={[...buildings, ...dressing, ...rails]} />
          </Suspense>
          {brain.nodes.map((n) => {
            const tile = layout.positions.get(n.id);
            return tile !== undefined && tile >= 0 ? (
              <Details
                key={n.id}
                node={n}
                tile={tile}
                quest={questOf.get(n.id)}
              />
            ) : null;
          })}
          {game && <Keepers layout={layout} game={game} />}
          {hall !== undefined && hall >= 0 && game && (
            <Hall tile={hall} level={game.level} streak={game.streak} />
          )}
          <Pet layout={layout} />
        </>
      )}
    </group>
  );
}
