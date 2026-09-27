// Brain to planet: building, rail and dressing placements plus per-node details.
import { Suspense, useMemo } from "react";
import { Quaternion, Vector3, Matrix4 } from "three";
import { AssetBatches, assets, type Placement } from "./Assets";
import { Plates } from "./Scene";
import { tiles, RADIUS, nearestTile } from "./planet";
import { layoutBrain, maturity, type Layout, hash } from "./layout";
import { useTown } from "./store";
import type { Brain, BrainNode } from "./types";
export function surface(tile: number, height = 0.18) {
  return tiles[tile].normal.clone().multiplyScalar(RADIUS + height);
}
const up = new Vector3(0, 1, 0);
export function orientation(tile: number) {
  return new Quaternion().setFromUnitVectors(up, tiles[tile].normal);
}
/** Orientation on a tile with an extra turn (radians) about the tile normal. */
export function turned(tile: number, angle: number) {
  return orientation(tile).multiply(
    new Quaternion().setFromAxisAngle(up, angle),
  );
}
/** Frame for a full hex tile model (Kenney kit) so its corners match the plate. */
export function hexAligned(tile: number) {
  return tiles[tile].quaternion
    .clone()
    .multiply(new Quaternion().setFromAxisAngle(up, Math.PI / 2));
}
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
    return [
      {
        key: n.id,
        nodeId: n.id,
        asset: nodeAsset(n, brain),
        position: surface(tile),
        quaternion: orientation(tile),
        scale: ["goal", "project"].includes(n.type)
          ? 1
          : 0.72 + maturity(n, brain) * 0.09,
        dim:
          Date.now() - Date.parse(n.updated || n.created || "") > 90 * 86400000,
      },
    ];
  });
}
function Details({ node, tile }: { node: BrainNode; tile: number }) {
  const old =
    Date.now() - Date.parse(node.updated || node.created || "") > 90 * 86400000;
  const selected = useTown((s) => s.selected === node.id);
  return (
    <group position={surface(tile, 0.2)} quaternion={orientation(tile)}>
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
      {node.confidence === "low" && (
        <group>
          {[-0.38, 0.38].flatMap((x) =>
            [-0.3, 0.3].map((z) => (
              <mesh key={`${x},${z}`} position={[x, 0.35, z]}>
                <boxGeometry args={[0.035, 0.7, 0.035]} />
                <meshStandardMaterial color="#c6ad7c" />
              </mesh>
            )),
          )}
          {[0.2, 0.55].map((y) => (
            <mesh key={y} position={[0, y, 0.32]}>
              <boxGeometry args={[0.82, 0.025, 0.025]} />
              <meshStandardMaterial color="#c6ad7c" />
            </mesh>
          ))}
        </group>
      )}
      {old && (
        <mesh position={[-0.18, 0.025, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.26, 7]} />
          <meshStandardMaterial color="#72895d" roughness={1} />
        </mesh>
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
    const point = (t: number) =>
      Math.sin(angle) < 0.0001
        ? from.clone().lerp(to, t).normalize()
        : from
            .clone()
            .multiplyScalar(Math.sin((1 - t) * angle) / Math.sin(angle))
            .addScaledVector(to, Math.sin(t * angle) / Math.sin(angle))
            .normalize();
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps,
        n = point(t),
        tangent = point(Math.min(1, t + 0.005))
          .sub(n)
          .normalize(),
        right = n.clone().cross(tangent).normalize(),
        forward = right.clone().cross(n).normalize();
      const ocean = !layout.owners.has(nearestTile(n).id);
      placements.push({
        key: `${edge.id}:${i}`,
        asset: ocean ? "link.bridge" : "link.rail",
        position: n.clone().multiplyScalar(RADIUS + 0.25),
        quaternion: new Quaternion().setFromRotationMatrix(
          new Matrix4().makeBasis(right, n, forward),
        ),
        scale: 0.65,
        label: brain.rels[edge.rel] || edge.rel,
      });
    }
  }
  return placements;
}
export function BrainWorld({
  allLinks = false,
  children,
}: {
  allLinks?: boolean;
  children?: (layout: Layout) => React.ReactNode;
}) {
  const brain = useTown((s) => s.brain),
    selected = useTown((s) => s.selected);
  const layout = useMemo(() => (brain ? layoutBrain(brain) : null), [brain]);
  const buildings = useMemo(
    () => (brain && layout ? buildingPlacements(brain, layout) : []),
    [brain, layout],
  );
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
    ) => {
      if (!assets.has(asset)) return;
      placements.push({
        key,
        asset,
        position: surface(tile, height),
        quaternion,
        scale,
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
    const inbox = layout.positions.get("inbox");
    if (inbox !== undefined && inbox >= 0) {
      put("pad", "inbox.pad", inbox, 1, orientation(inbox), 0.19);
      const owner = layout.owners.get(inbox);
      tiles[inbox].neighbors
        .filter((n) => free(n) && layout.owners.get(n) === owner)
        .slice(0, 2)
        .forEach((n, i) =>
          put(
            `inbox:${n}`,
            i ? "inbox.crate-small" : "inbox.planks",
            n,
            1,
            turned(n, spin(n)),
          ),
        );
    }
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
    const ground = region("ares");
    ["ares.dome", "ares.base", "ares.radar", "ares.rover"].forEach(
      (asset, i) => {
        const tile = ground[i];
        if (tile !== undefined)
          put(asset, asset, tile, 1, turned(tile, spin(tile)));
      },
    );
    for (const [tile, owner] of layout.owners) {
      const id = layout.groups[owner]?.id;
      if (!id || !free(tile)) continue;
      const roll = hash(String(tile)) % 8;
      if (roll < 2)
        put(
          `tree:${tile}`,
          `biome.${id}.tree`,
          tile,
          0.75,
          turned(tile, spin(tile)),
        );
      else if (roll === 2)
        put(
          `rock:${tile}`,
          `biome.${id}.rock`,
          tile,
          0.7,
          turned(tile, spin(tile)),
        );
    }
    return placements;
  }, [layout]);
  if (!brain || !layout) return <Plates />;
  return (
    <>
      <Plates
        owners={layout.owners}
        patches={layout.patches}
        onTile={(focus) =>
          useTown.setState({
            focus,
            selected:
              [...layout.positions].find(([, tile]) => tile === focus)?.[0] ||
              null,
          })
        }
      />
      <Suspense fallback={null}>
        <AssetBatches placements={[...buildings, ...dressing, ...rails]} />
      </Suspense>
      {brain.nodes.map((n) => {
        const tile = layout.positions.get(n.id);
        return tile !== undefined && tile >= 0 ? (
          <Details key={n.id} node={n} tile={tile} />
        ) : null;
      })}
      {children?.(layout)}
    </>
  );
}
