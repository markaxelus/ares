// The factory: Ares HQ as an industrial planet. A conveyor belt rings it, machines
// and robot arms work beside the belt, robots charge on floor pads, relay
// satellites circle overhead, and knowledge from the tunnel lands on the scanner.
import { Suspense, useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Group,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";
import {
  Asset,
  AssetBatches,
  assets,
  MovingAssets,
  type Placement,
} from "./Assets";
import { Plates, type PlateStyle } from "./Scene";
import {
  FACTORY_POS,
  FACTORY_RADIUS,
  facingOf,
  factoryTiles,
  orientationOf,
  ring,
  slerpNormal,
  surfaceOf,
  travelFrame,
  turnedOf,
  type Tile,
} from "./planet";
import { factoryGate, factoryState } from "./transit";
import { hash } from "./layout";
import { useTown } from "./store";
type Machine = { tile: number; asset: string; toward: number };
export type WorkerRole = "courier" | "builder" | "archivist";
export type FactoryLayout = {
  belt: number[];
  gate: number;
  machines: Machine[];
  arms: Machine[];
  pads: Record<WorkerRole, number>;
  cogs: number[];
  decor: Placement[];
};
const spin = (tile: number) => (hash(`f:${tile}:spin`) % 628) / 100;
function place(
  key: string,
  asset: string,
  tile: Tile,
  scale = 1,
  quaternion = orientationOf(tile),
  height = 0.18,
  label?: string,
): Placement {
  return {
    key,
    asset,
    position: surfaceOf(tile, height),
    quaternion,
    scale,
    label,
  };
}
/** Everything sits where geometry puts it; nothing here depends on the brain. */
export const factoryLayout: FactoryLayout = (() => {
  const set = factoryTiles,
    gate = factoryGate.id;
  const belt = ring(set, new Vector3(0.3, 1, 0.2));
  const onBelt = new Set(belt),
    taken = new Set<number>([gate, ...set[gate].neighbors]);
  const free = (id: number) =>
    !onBelt.has(id) && !taken.has(id) && set[id].neighbors.length === 6;
  const machines: Machine[] = [],
    arms: Machine[] = [];
  const kinds = [
    "factory.machine",
    "factory.hopper",
    "factory.press",
    "factory.machine-fortified",
    "factory.piston",
    "factory.console",
    "factory.screen",
    "factory.container",
  ];
  belt.forEach((id, i) => {
    if (i % 3 !== 1) return;
    const side = set[id].neighbors.filter(free);
    const pick = side[hash(`side:${id}`) % Math.max(1, side.length)];
    if (pick === undefined) return;
    taken.add(pick);
    if ((machines.length + arms.length) % 4 === 3)
      arms.push({
        tile: pick,
        asset: arms.length % 2 ? "factory.arm-b" : "factory.arm",
        toward: id,
      });
    else
      machines.push({
        tile: pick,
        asset: kinds[machines.length % kinds.length],
        toward: id,
      });
  });
  // Charging pads two or three steps from the gate, off the belt.
  const rings: number[][] = [[gate]],
    seen = new Set([gate]);
  for (let d = 1; d <= 3; d++) {
    const next: number[] = [];
    for (const id of rings[d - 1])
      for (const n of set[id].neighbors)
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
    rings.push(next);
  }
  const padTiles = [...rings[2], ...rings[3]].filter(free).slice(0, 3);
  padTiles.forEach((t) => taken.add(t));
  const pads = {
    courier: padTiles[0] ?? gate,
    builder: padTiles[1] ?? gate,
    archivist: padTiles[2] ?? gate,
  };
  const decor: Placement[] = [],
    cogs: number[] = [];
  const crane = [...rings[3], ...rings[2]].find(free);
  if (crane !== undefined) {
    taken.add(crane);
    decor.push(
      place(
        "crane",
        "factory.crane",
        set[crane],
        1,
        turnedOf(set[crane], 0.7),
        0.18,
        "Loading crane",
      ),
    );
  }
  for (const t of set) {
    if (t.neighbors.length === 5) {
      if (!onBelt.has(t.id))
        decor.push(
          place(`dome:${t.id}`, "ares.dome", t, 1.1, turnedOf(t, spin(t.id))),
        );
      continue;
    }
    if (!free(t.id)) continue;
    const roll = hash(`f:${t.id}`) % 21;
    if (roll === 0 && cogs.length < 4) {
      cogs.push(t.id);
      taken.add(t.id);
    } else if (roll === 1)
      decor.push(
        place(`cone:${t.id}`, "factory.warning", t, 1, turnedOf(t, spin(t.id))),
      );
    else if (roll === 2)
      decor.push(
        place(`box:${t.id}`, "factory.box", t, 1, turnedOf(t, spin(t.id))),
      );
    else if (roll === 3)
      decor.push(
        place(
          `container:${t.id}`,
          "factory.container",
          t,
          1,
          turnedOf(t, spin(t.id)),
        ),
      );
    else if (roll === 4)
      decor.push(
        place(`pipe:${t.id}`, "factory.pipe", t, 0.7, turnedOf(t, spin(t.id))),
      );
  }
  return { belt, gate, machines, arms, pads, cogs, decor };
})();
const onBelt = new Set(factoryLayout.belt);
const plateStyle = (tile: Tile): PlateStyle =>
  onBelt.has(tile.id)
    ? { color: "#22272e", height: 0.05 }
    : {
        color: hash(`plate:${tile.id}`) % 9 === 0 ? "#b7712a" : "#464c55",
        height: 0.08,
        lighten: ((hash(`shade:${tile.id}`) % 5) - 2) * 0.02,
      };
const labels: Record<WorkerRole, string> = {
  courier: "Courier",
  builder: "Builder",
  archivist: "Archivist",
};
export function FactoryWorld() {
  const placements = useMemo(() => {
    const L = factoryLayout,
      out: Placement[] = [...L.decor];
    L.belt.forEach((id, i) => {
      const a = factoryTiles[id],
        b = factoryTiles[L.belt[(i + 1) % L.belt.length]];
      const n = slerpNormal(a.normal, b.normal, 0.5),
        tangent = slerpNormal(a.normal, b.normal, 0.55).sub(n).normalize();
      out.push({
        key: `belt:${i}`,
        asset: "factory.conveyor",
        position: n.clone().multiplyScalar(FACTORY_RADIUS + 0.14),
        quaternion: travelFrame(n, tangent, "x"),
        scale: 1,
        label: "Conveyor belt",
      });
    });
    for (const m of L.machines)
      out.push(
        place(
          `machine:${m.tile}`,
          m.asset,
          factoryTiles[m.tile],
          1,
          facingOf(factoryTiles[m.tile], factoryTiles[m.toward]),
          0.18,
          "Factory machine",
        ),
      );
    for (const [role, tile] of Object.entries(L.pads))
      out.push(
        place(
          `pad:${role}`,
          "factory.pad",
          factoryTiles[tile],
          1,
          orientationOf(factoryTiles[tile]),
          0.17,
          `${labels[role as WorkerRole]} charging pad`,
        ),
      );
    out.push(
      place(
        "scanner",
        "factory.scanner",
        factoryTiles[L.gate],
        1.2,
        turnedOf(factoryTiles[L.gate], Math.PI / 2),
        0.17,
        "Download scanner",
      ),
    );
    return out.filter((p) => assets.has(p.asset));
  }, []);
  return (
    <group position={FACTORY_POS}>
      <Plates
        tiles={factoryTiles}
        style={plateStyle}
        onTile={(tile) =>
          useTown.setState({
            focus: { planet: "factory", tile },
            selected: null,
          })
        }
      />
      <Suspense fallback={null}>
        <AssetBatches placements={placements} />
        <BeltPackages />
        {factoryLayout.arms.map((a) => (
          <Arm key={a.tile} machine={a} />
        ))}
        {factoryLayout.cogs.map((tile, i) => (
          <Cog key={tile} tile={tile} phase={i} />
        ))}
        <Satellites />
      </Suspense>
      {Object.values(factoryLayout.pads).map((tile) => (
        <PadGlow key={tile} tile={tile} />
      ))}
      <ScannerGlow />
    </group>
  );
}
const BOXES = 14;
/** Packages that ride the belt forever, faster while the factory is busy. */
function BeltPackages() {
  const belt = factoryLayout.belt,
    L = belt.length;
  const normals = useMemo(
    () => belt.map((id) => factoryTiles[id].normal),
    [belt],
  );
  const travelled = useRef(0);
  useFrame((_, dt) => {
    travelled.current +=
      dt * (factoryState.busyUntil > performance.now() ? 2.4 : 0.8);
  });
  const n = useMemo(() => new Vector3(), []),
    tangent = useMemo(() => new Vector3(), []),
    position = useMemo(() => new Vector3(), []),
    one = useMemo(() => new Vector3(1, 1, 1), []);
  const update = useCallback(
    (i: number, m: Matrix4) => {
      const s = (travelled.current + (i * L) / BOXES) % L,
        k = Math.floor(s),
        f = s - k,
        a = normals[k],
        b = normals[(k + 1) % L];
      n.copy(slerpNormal(a, b, f));
      tangent
        .copy(slerpNormal(a, b, Math.min(1, f + 0.05)))
        .sub(n)
        .normalize();
      position.copy(n).multiplyScalar(FACTORY_RADIUS + 0.14 + 0.2);
      m.compose(position, travelFrame(n, tangent, "x"), one);
    },
    [L, normals, n, tangent, position, one],
  );
  return <MovingAssets id="factory.box" count={BOXES} update={update} />;
}
function Arm({ machine }: { machine: Machine }) {
  const ref = useRef<Group>(null!);
  const tile = factoryTiles[machine.tile];
  useFrame(({ clock }) => {
    const busy = factoryState.busyUntil > performance.now();
    ref.current.rotation.y =
      Math.sin(clock.elapsedTime * (busy ? 3.4 : 1.1) + machine.tile) * 0.9;
  });
  return (
    <group
      position={surfaceOf(tile)}
      quaternion={facingOf(tile, factoryTiles[machine.toward])}
      onPointerOver={() => useTown.setState({ hover: "Robot arm" })}
      onPointerOut={() => useTown.setState({ hover: null })}
    >
      <group ref={ref}>
        <Asset id={machine.asset} />
      </group>
    </group>
  );
}
function Cog({ tile, phase }: { tile: number; phase: number }) {
  const ref = useRef<Group>(null!);
  useFrame((_, dt) => {
    ref.current.rotation.y += dt * (phase % 2 ? -0.9 : 0.9);
  });
  const t = factoryTiles[tile];
  return (
    <group position={surfaceOf(t)} quaternion={orientationOf(t)}>
      <group ref={ref}>
        <Asset id="factory.cog" />
      </group>
    </group>
  );
}
/** Slow pulse on each charging pad. */
function PadGlow({ tile }: { tile: number }) {
  const material = useRef<MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    material.current.opacity =
      0.35 + 0.3 * Math.sin(clock.elapsedTime * 2 + tile);
  });
  const t = factoryTiles[tile];
  return (
    <group position={surfaceOf(t, 0.22)} quaternion={orientationOf(t)}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.37, 28]} />
        <meshBasicMaterial
          ref={material}
          color="#7fe3ff"
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
/** Ring over the scanner that burns bright while knowledge is being processed. */
function ScannerGlow() {
  const material = useRef<MeshStandardMaterial>(null!);
  const ref = useRef<Group>(null!);
  useFrame(({ clock }) => {
    const busy = factoryState.busyUntil > performance.now();
    material.current.emissiveIntensity = busy
      ? 2.2 + Math.sin(clock.elapsedTime * 9)
      : 0.5 + 0.2 * Math.sin(clock.elapsedTime * 1.5);
    ref.current.rotation.y += busy ? 0.05 : 0.006;
  });
  const t = factoryGate;
  return (
    <group position={surfaceOf(t, 0.95)} quaternion={orientationOf(t)}>
      <group ref={ref}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.05, 8, 32]} />
          <meshStandardMaterial
            ref={material}
            color="#bfe7ff"
            emissive="#4fb8ff"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>
    </group>
  );
}
/** Two relay satellites in low orbit, in the factory's local frame. */
function Satellites() {
  const a = useRef<Group>(null!),
    b = useRef<Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    a.current.position.set(
      Math.cos(t * 0.09) * 7.6,
      Math.sin(t * 0.09) * 2.4,
      Math.sin(t * 0.09) * 7.6,
    );
    a.current.rotation.y = t * 0.3;
    b.current.position.set(
      Math.sin(t * 0.06) * 8.4,
      1.5 + Math.cos(t * 0.06) * 3,
      Math.cos(t * 0.06) * 8.4,
    );
    b.current.rotation.set(0.4, -t * 0.2, 0);
  });
  const hover = (label: string | null) => () =>
    useTown.setState({ hover: label });
  return (
    <>
      <group
        ref={a}
        onPointerOver={hover("Relay satellite")}
        onPointerOut={hover(null)}
      >
        <group scale={0.32}>
          <Asset id="scout.satellite" shadow={false} />
        </group>
      </group>
      <group
        ref={b}
        onPointerOver={hover("Relay dish")}
        onPointerOut={hover(null)}
      >
        <group scale={0.5}>
          <Asset id="station.dish" shadow={false} />
        </group>
      </group>
    </>
  );
}
