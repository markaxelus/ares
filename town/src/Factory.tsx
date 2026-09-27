// The factory: Ares HQ as an industrial planet that is also a neural network.
// Knowledge lands on the scanner, rides a belt through named stations, and
// twelve named neurons joined by axons fire signals all the time, cascading
// whenever a package is downloaded. Robots charge in the yard by the gate.
import { Suspense, useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CatmullRomCurve3,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  TubeGeometry,
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
  factoryTiles,
  nearestTile,
  orientationOf,
  slerpNormal,
  surfaceOf,
  travelFrame,
  turnedOf,
  type Tile,
} from "./planet";
import { factoryGate, factoryState } from "./transit";
import { hash } from "./layout";
import { useTown } from "./store";
export type WorkerRole = "courier" | "builder" | "archivist";
type Station = {
  tile: number;
  asset: string;
  label: string;
  facing: Vector3;
  arm: boolean;
};
type Neuron = { tile: number; name: string; color: string };
type Axon = { from: number; to: number; points: Vector3[]; length: number };
export type FactoryLayout = {
  gate: number;
  beltTiles: Set<number>;
  stations: Station[];
  neurons: Neuron[];
  axons: Axon[];
  pads: Record<WorkerRole, number>;
  cogs: number[];
  decor: Placement[];
};
const R = FACTORY_RADIUS,
  BELT_R = R + 0.16,
  up = new Vector3(0, 1, 0);
const gateNormal = factoryGate.normal.clone();
const beltAxis = gateNormal
  .clone()
  .cross(new Vector3(0.25, 1, 0.1))
  .normalize();
const beltAhead = beltAxis.clone().cross(gateNormal).normalize();
/** Unit direction of the belt circle at angle theta; theta 0 is the gate. */
export function beltPoint(theta: number) {
  return gateNormal
    .clone()
    .multiplyScalar(Math.cos(theta))
    .addScaledVector(beltAhead, Math.sin(theta));
}
function beltTangent(theta: number) {
  return gateNormal
    .clone()
    .multiplyScalar(-Math.sin(theta))
    .addScaledVector(beltAhead, Math.cos(theta));
}
/** Orientation on a tile whose local +Z axis points at a local-frame point. */
function facingPoint(tile: Tile, toward: Vector3) {
  const q = orientationOf(tile);
  const dir = toward
    .clone()
    .sub(tile.center)
    .applyQuaternion(q.clone().invert());
  return q.multiply(
    new Quaternion().setFromAxisAngle(up, Math.atan2(dir.x, dir.z)),
  );
}
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
const spin = (tile: number) => (hash(`f:${tile}:spin`) % 628) / 100;
const STATIONS: [string, string, boolean][] = [
  ["factory.hopper", "Sorter", false],
  ["factory.machine", "Parser", false],
  ["factory.arm", "Assembler", true],
  ["factory.press", "Memory press", false],
  ["factory.machine-fortified", "Planner", false],
  ["factory.piston", "Compressor", false],
  ["factory.press", "Core press", false],
  ["factory.arm-b", "Welder", true],
  ["factory.console", "Router", false],
  ["factory.hopper", "Sorter", false],
  ["factory.machine", "Tokenizer", false],
  ["factory.screen", "Monitor", false],
];
const NEURONS = [
  "Attention",
  "Recall",
  "Curiosity",
  "Planning",
  "Memory",
  "Language",
  "Vision",
  "Reasoning",
  "Intuition",
  "Focus",
  "Empathy",
  "Habit",
];
const NEURON_COLORS = ["#7fd0ff", "#b39dff", "#ffd27a", "#8ff0c8"];
/** Everything sits where geometry puts it; nothing here depends on the brain. */
export const factoryLayout: FactoryLayout = (() => {
  const set = factoryTiles,
    gate = factoryGate.id,
    taken = new Set<number>([gate]);
  const beltTiles = new Set<number>();
  for (let i = 0; i < 240; i++)
    beltTiles.add(nearestTile(beltPoint((i / 240) * Math.PI * 2), set).id);
  const free = (id: number) =>
    !beltTiles.has(id) && !taken.has(id) && set[id].neighbors.length === 6;
  // Stations beside the belt, alternating sides, in processing order.
  const stations: Station[] = [];
  STATIONS.forEach(([asset, label, arm], k) => {
    const theta = ((k + 1) / (STATIONS.length + 1)) * Math.PI * 2,
      side = k % 2 ? 1 : -1,
      centre = beltPoint(theta);
    for (const lean of [0.2, 0.32]) {
      const site = centre
        .clone()
        .multiplyScalar(Math.cos(lean))
        .addScaledVector(beltAxis, side * Math.sin(lean));
      const tile = nearestTile(site, set).id;
      if (!free(tile)) continue;
      taken.add(tile);
      stations.push({
        tile,
        asset,
        label,
        facing: centre.clone().multiplyScalar(R),
        arm,
      });
      break;
    }
  });
  // Charging yard: three pads two steps from the gate, off the belt.
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
  const decor: Placement[] = [];
  // Yard clutter: a container beside each pad, cones by the gate, screens at intake.
  for (const [role, padTile] of Object.entries(pads)) {
    const spot = set[padTile].neighbors.find(free);
    if (spot !== undefined) {
      taken.add(spot);
      decor.push(
        place(
          `yard:${role}`,
          "factory.container",
          set[spot],
          1,
          turnedOf(set[spot], spin(spot)),
          0.18,
          "Spare parts",
        ),
      );
    }
  }
  rings[1]
    .filter(free)
    .slice(0, 2)
    .forEach((t, i) => {
      taken.add(t);
      decor.push(
        place(
          `intake:${t}`,
          i ? "factory.screen" : "factory.warning",
          set[t],
          1,
          facingPoint(set[t], set[gate].center),
          0.18,
          i ? "Intake monitor" : "Mind the belt",
        ),
      );
    });
  // The core district: crane and a second console beside the core press.
  const core = stations.find((s) => s.label === "Core press");
  if (core) {
    const around = set[core.tile].neighbors.filter(free);
    const [craneTile, consoleTile] = around;
    if (craneTile !== undefined) {
      taken.add(craneTile);
      decor.push(
        place(
          "crane",
          "factory.crane",
          set[craneTile],
          1,
          facingPoint(set[craneTile], set[core.tile].center),
          0.18,
          "Loading crane",
        ),
      );
    }
    if (consoleTile !== undefined) {
      taken.add(consoleTile);
      decor.push(
        place(
          "core-console",
          "factory.console",
          set[consoleTile],
          1,
          facingPoint(set[consoleTile], set[core.tile].center),
          0.18,
          "Core console",
        ),
      );
    }
  }
  // Neurons spread evenly over the planet on a Fibonacci sphere.
  const neurons: Neuron[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  NEURONS.forEach((name, i) => {
    const y = 1 - (2 * (i + 0.5)) / NEURONS.length,
      r = Math.sqrt(1 - y * y),
      phi = i * golden;
    const dir = new Vector3(r * Math.cos(phi), y, r * Math.sin(phi));
    let tile = nearestTile(dir, set).id;
    if (!free(tile)) tile = set[tile].neighbors.find(free) ?? -1;
    if (tile < 0) return;
    taken.add(tile);
    neurons.push({
      tile,
      name,
      color: NEURON_COLORS[i % NEURON_COLORS.length],
    });
  });
  // Axons: each neuron to its two nearest, plus the intake and the core into the web.
  const nodes = [
    ...neurons.map((n) => n.tile),
    gate,
    ...(core ? [core.tile] : []),
  ];
  const pairs = new Set<string>();
  const link = (a: number, b: number) => {
    if (a !== b) pairs.add(a < b ? `${a}:${b}` : `${b}:${a}`);
  };
  for (const a of nodes) {
    const nearest = nodes
      .filter((b) => b !== a)
      .sort(
        (u, v) =>
          set[v].normal.dot(set[a].normal) - set[u].normal.dot(set[a].normal),
      )
      .slice(0, 2);
    nearest.forEach((b) => link(a, b));
  }
  const axons: Axon[] = [...pairs].map((key) => {
    const [from, to] = key.split(":").map(Number);
    const a = set[from].normal,
      b = set[to].normal,
      length = Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * R;
    const points: Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      points.push(
        slerpNormal(a, b, t).multiplyScalar(
          R + 0.34 + Math.sin(t * Math.PI) * Math.min(0.5, length * 0.12),
        ),
      );
    }
    return { from, to, points, length };
  });
  // Spinning cogs and domes on the pentagons.
  const cogs: number[] = [];
  for (const t of set) {
    if (t.neighbors.length === 5) {
      if (!beltTiles.has(t.id))
        decor.push(
          place(
            `dome:${t.id}`,
            "ares.dome",
            t,
            1.1,
            turnedOf(t, spin(t.id)),
            0.18,
            "Memory dome",
          ),
        );
      continue;
    }
    if (free(t.id) && hash(`cog:${t.id}`) % 37 === 0 && cogs.length < 4) {
      cogs.push(t.id);
      taken.add(t.id);
    }
  }
  return { gate, beltTiles, stations, neurons, axons, pads, cogs, decor };
})();
const beltNeighbours = new Set<number>();
for (const id of factoryLayout.beltTiles)
  for (const n of factoryTiles[id].neighbors)
    if (!factoryLayout.beltTiles.has(n)) beltNeighbours.add(n);
const plateStyle = (tile: Tile): PlateStyle =>
  factoryLayout.beltTiles.has(tile.id)
    ? { color: "#22272e", height: 0.06 }
    : beltNeighbours.has(tile.id) && hash(`stripe:${tile.id}`) % 3 === 0
      ? { color: "#b7712a", height: 0.08 }
      : {
          color: "#464c55",
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
    // Belt pieces evenly along the exact circle, so the loop is seamless.
    const pieces = Math.round((2 * Math.PI * BELT_R) / 1.0);
    for (let i = 0; i < pieces; i++) {
      const theta = ((i + 0.5) / pieces) * Math.PI * 2,
        n = beltPoint(theta);
      out.push({
        key: `belt:${i}`,
        asset: "factory.conveyor",
        position: n.clone().multiplyScalar(BELT_R),
        quaternion: travelFrame(n, beltTangent(theta), "x"),
        scale: 1,
        label: "Conveyor belt",
      });
    }
    for (const s of L.stations)
      if (!s.arm)
        out.push(
          place(
            `station:${s.tile}`,
            s.asset,
            factoryTiles[s.tile],
            1,
            facingPoint(factoryTiles[s.tile], s.facing),
            0.18,
            s.label,
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
          useTown
            .getState()
            .look({ focus: { planet: "factory", tile }, selected: null })
        }
      />
      <Suspense fallback={null}>
        <AssetBatches placements={placements} />
        <BeltPackages />
        {factoryLayout.stations
          .filter((s) => s.arm)
          .map((s) => (
            <Arm key={s.tile} station={s} />
          ))}
        {factoryLayout.cogs.map((tile, i) => (
          <Cog key={tile} tile={tile} phase={i} />
        ))}
        <Satellites />
      </Suspense>
      <NeuralWeb />
      {Object.values(factoryLayout.pads).map((tile) => (
        <PadGlow key={tile} tile={tile} />
      ))}
      <ScannerGlow />
    </group>
  );
}
const BOXES = 16;
/** Packages that ride the belt forever, faster while the factory is busy. */
function BeltPackages() {
  const travelled = useRef(0);
  useFrame((_, dt) => {
    travelled.current +=
      dt * (factoryState.busyUntil > performance.now() ? 0.45 : 0.15);
  });
  const position = useMemo(() => new Vector3(), []),
    one = useMemo(() => new Vector3(1, 1, 1), []);
  const update = useCallback(
    (i: number, m: Matrix4) => {
      const theta = travelled.current + (i / BOXES) * Math.PI * 2,
        n = beltPoint(theta);
      position.copy(n).multiplyScalar(BELT_R + 0.2);
      m.compose(position, travelFrame(n, beltTangent(theta), "x"), one);
    },
    [position, one],
  );
  return <MovingAssets id="factory.box" count={BOXES} update={update} />;
}
function Arm({ station }: { station: Station }) {
  const ref = useRef<Group>(null!);
  const tile = factoryTiles[station.tile];
  useFrame(({ clock }) => {
    const busy = factoryState.busyUntil > performance.now();
    ref.current.rotation.y =
      Math.sin(clock.elapsedTime * (busy ? 3.4 : 1.1) + station.tile) * 0.9;
  });
  return (
    <group
      position={surfaceOf(tile)}
      quaternion={facingPoint(tile, station.facing)}
      onPointerOver={() => useTown.setState({ hover: station.label })}
      onPointerOut={() => useTown.setState({ hover: null })}
    >
      <group ref={ref}>
        <Asset id={station.asset} />
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
const MAX_SIGNALS = 160;
type Signal = { axon: number; t: number; forward: boolean; speed: number };
/**
 * The neural web: neuron cores on pedestals, axons arching between them, and
 * signals that never stop. Idle, a few fire a second; after a download the
 * intake neuron fires and every arrival fans out, so activity ripples across
 * the whole planet while the factory is busy.
 */
function NeuralWeb() {
  const { neurons, axons, gate } = factoryLayout;
  const geometries = useMemo(
    () =>
      axons.map(
        (a) => new TubeGeometry(new CatmullRomCurve3(a.points), 28, 0.035, 6),
      ),
    [axons],
  );
  const byTile = useMemo(() => {
    const map = new Map<number, number[]>();
    axons.forEach((a, i) => {
      map.set(a.from, [...(map.get(a.from) || []), i]);
      map.set(a.to, [...(map.get(a.to) || []), i]);
    });
    return map;
  }, [axons]);
  const signals = useRef<Signal[]>([]),
    glow = useRef(new Map<number, number>()),
    spawnClock = useRef(0),
    downloads = useRef(factoryState.downloads);
  const cores = useRef<(MeshStandardMaterial | null)[]>([]);
  const sparks = useRef<InstancedMesh>(null!);
  const dummy = useMemo(() => new Object3D(), []);
  const fire = (tile: number, exclude = -1) => {
    const options = (byTile.get(tile) || []).filter((i) => i !== exclude);
    if (!options.length || signals.current.length >= MAX_SIGNALS) return;
    const axon = options[Math.floor(Math.random() * options.length)];
    signals.current.push({
      axon,
      t: 0,
      forward: axons[axon].from === tile,
      speed: 2.4 + Math.random() * 1.2,
    });
  };
  useFrame(({ clock }, dt) => {
    const now = performance.now(),
      busy = factoryState.busyUntil > now;
    if (factoryState.downloads !== downloads.current) {
      downloads.current = factoryState.downloads;
      glow.current.set(gate, now + 600);
      for (let i = 0; i < 3; i++) fire(gate);
    }
    spawnClock.current += dt;
    const interval = busy ? 0.12 : 0.45;
    while (spawnClock.current > interval) {
      spawnClock.current -= interval;
      const from = neurons[Math.floor(Math.random() * neurons.length)];
      if (from) fire(from.tile);
    }
    const alive: Signal[] = [];
    for (const s of signals.current) {
      s.t += (dt * s.speed) / Math.max(0.8, axons[s.axon].length);
      if (s.t < 1) {
        alive.push(s);
        continue;
      }
      const end = s.forward ? axons[s.axon].to : axons[s.axon].from;
      glow.current.set(end, now + 450);
      if (busy && Math.random() < 0.75) fire(end, s.axon);
    }
    signals.current = alive;
    for (let i = 0; i < MAX_SIGNALS; i++) {
      const s = alive[i];
      if (s) {
        const curve = axons[s.axon].points,
          f = (s.forward ? s.t : 1 - s.t) * (curve.length - 1),
          k = Math.min(curve.length - 2, Math.floor(f));
        dummy.position.lerpVectors(curve[k], curve[k + 1], f - k);
        dummy.scale.setScalar(1);
      } else dummy.scale.setScalar(0);
      dummy.updateMatrix();
      sparks.current.setMatrixAt(i, dummy.matrix);
    }
    sparks.current.instanceMatrix.needsUpdate = true;
    neurons.forEach((n, i) => {
      const m = cores.current[i];
      if (!m) return;
      const lit = (glow.current.get(n.tile) || 0) > now;
      m.emissiveIntensity = lit
        ? 3.2
        : 0.55 + 0.25 * Math.sin(clock.elapsedTime * 1.7 + i);
    });
  });
  return (
    <group>
      {axons.map((a, i) => (
        <mesh key={i} geometry={geometries[i]}>
          <meshStandardMaterial
            color="#5fb6ff"
            emissive="#3a8fe0"
            emissiveIntensity={0.7}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
      <instancedMesh
        ref={sparks}
        args={[undefined, undefined, MAX_SIGNALS]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.075, 8, 6]} />
        <meshBasicMaterial color="#dff3ff" />
      </instancedMesh>
      {neurons.map((n, i) => {
        const tile = factoryTiles[n.tile];
        return (
          <group
            key={n.tile}
            position={surfaceOf(tile, 0.16)}
            quaternion={orientationOf(tile)}
            onPointerOver={() =>
              useTown.setState({ hover: `Neuron · ${n.name}` })
            }
            onPointerOut={() => useTown.setState({ hover: null })}
          >
            <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.13, 0.17, 0.24, 8]} />
              <meshStandardMaterial color="#2b3038" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.42, 0]}>
              <icosahedronGeometry args={[0.17, 1]} />
              <meshStandardMaterial
                ref={(m) => {
                  cores.current[i] = m;
                }}
                color={n.color}
                emissive={n.color}
                emissiveIntensity={0.6}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.26, 0.014, 6, 24]} />
              <meshStandardMaterial
                color="#9fd6ff"
                emissive="#4fb3ff"
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>
        );
      })}
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
