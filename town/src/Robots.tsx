// Robot workers driven by brain events, the orbiting station and scout, and a pet.
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Vector3 } from "three";
import { Asset } from "./Assets";
import { orientation, surface } from "./BrainWorld";
import { tiles, RADIUS } from "./planet";
import { eventJobs, tilePath, type Job, type Role } from "./behavior";
import type { Layout } from "./layout";
import { useTown } from "./store";
const up = new Vector3(0, 1, 0);
const colors: Record<Role, string> = {
  courier: "#cd9368",
  builder: "#ddc35e",
  archivist: "#9b9bc9",
  scout: "#74b6c6",
  ares: "#d7c597",
};
/** Primitive robot body with role accessories. Riders in orbit pass shadow false. */
export function Robot({
  role,
  walking = false,
  carrying = false,
  shadow = true,
  motion,
}: {
  role: Role;
  walking?: boolean;
  carrying?: boolean;
  shadow?: boolean;
  motion?: React.RefObject<{ walk: boolean; carry: boolean }>;
}) {
  const rig = useRef<Group>(null!),
    left = useRef<Group>(null!),
    right = useRef<Group>(null!);
  useEffect(() => {
    rig.current.traverse((o) => {
      o.castShadow = shadow;
      o.receiveShadow = shadow;
    });
  }, [role, carrying, shadow]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    rig.current.position.y = 0.015 * Math.sin(t * 2);
    left.current.rotation.x =
      (motion?.current.walk ?? walking) ? Math.sin(t * 11) * 0.55 : 0;
    right.current.rotation.x = -left.current.rotation.x;
  });
  return (
    <group ref={rig} scale={1.15}>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.23, 0.24, 0.16]} />
        <meshStandardMaterial color={colors[role]} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial color="#e4e8e6" />
      </mesh>
      <mesh position={[0, 0.48, 0.12]}>
        <boxGeometry args={[0.18, 0.065, 0.03]} />
        <meshStandardMaterial
          color="#233b50"
          emissive="#5fbbd3"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0.04, 0.64, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 5]} />
        <meshStandardMaterial color="#a8b6bc" />
      </mesh>
      <mesh position={[0.04, 0.71, 0]}>
        <sphereGeometry args={[0.027, 6, 5]} />
        <meshStandardMaterial
          color={colors[role]}
          emissive={colors[role]}
          emissiveIntensity={0.4}
        />
      </mesh>
      <group ref={left} position={[-0.07, 0.17, 0]}>
        <mesh position={[0, -0.075, 0]}>
          <boxGeometry args={[0.065, 0.15, 0.09]} />
          <meshStandardMaterial color="#b5c3c9" />
        </mesh>
      </group>
      <group ref={right} position={[0.07, 0.17, 0]}>
        <mesh position={[0, -0.075, 0]}>
          <boxGeometry args={[0.065, 0.15, 0.09]} />
          <meshStandardMaterial color="#b5c3c9" />
        </mesh>
      </group>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.15, 0.26, carrying ? 0.07 : 0]}
          rotation={[carrying ? -0.8 : 0, 0, s * 0.12]}
        >
          <boxGeometry args={[0.05, 0.18, 0.06]} />
          <meshStandardMaterial color="#b8c5cc" />
        </mesh>
      ))}
      {role === "courier" && (
        <mesh position={[0, 0.29, -0.14]}>
          <boxGeometry args={[0.2, 0.25, 0.14]} />
          <meshStandardMaterial color="#766b61" />
        </mesh>
      )}
      {role === "builder" && (
        <group position={[0, 0.56, 0]}>
          <mesh>
            <sphereGeometry
              args={[0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial color="#f1c55c" />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 0.03, 10]} />
            <meshStandardMaterial color="#f1c55c" />
          </mesh>
        </group>
      )}
      {role === "archivist" &&
        [-0.06, 0.06].map((x) => (
          <mesh key={x} position={[x, 0.49, 0.147]}>
            <torusGeometry args={[0.043, 0.011, 4, 8]} />
            <meshStandardMaterial color="#a793d0" />
          </mesh>
        ))}
      {role === "scout" && (
        <mesh position={[0, 0.61, -0.08]} rotation={[-0.4, 0, 0]}>
          <sphereGeometry args={[0.12, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#85c2cf" side={2} />
        </mesh>
      )}
      {role === "ares" && (
        <group position={[0, 0.6, 0]}>
          <mesh>
            <cylinderGeometry args={[0.14, 0.12, 0.07, 7, 1, true]} />
            <meshStandardMaterial color="#edd083" />
          </mesh>
          {[-0.09, 0, 0.09].map((x) => (
            <mesh key={x} position={[x, 0.065, 0.07]}>
              <coneGeometry args={[0.04, 0.12, 4]} />
              <meshStandardMaterial color="#edd083" />
            </mesh>
          ))}
        </group>
      )}
      {carrying && (
        <mesh position={[0, 0.24, 0.22]}>
          <boxGeometry args={[0.22, 0.2, 0.18]} />
          <meshStandardMaterial color="#bba17b" />
        </mesh>
      )}
    </group>
  );
}
type Active = {
  job: Job;
  start: number;
  path: number[];
  walk: number;
  duration: number;
  tile: number;
};
function Worker({
  role,
  layout,
}: {
  role: "courier" | "builder" | "archivist";
  layout: Layout;
}) {
  const body = useRef<Group>(null!),
    pod = useRef<Group>(null!),
    crates = useRef<Group>(null!);
  const queue = useRef<Job[]>([]),
    seen = useRef(new Set<string>()),
    active = useRef<Active | null>(null);
  const latest = useTown((s) => s.events);
  const phase = useRef({ walk: false, carry: false });
  const model = useRef<Group>(null!);
  const home = layout.positions.get("inbox") ?? layout.seeds.get("inbox") ?? 0;
  const current = useRef(home);
  const wander = useRef({ start: 0, from: home, to: home });
  useEffect(() => {
    for (const event of latest) {
      const key =
        event.sequence ||
        `${event.timestamp}:${event.kind}:${event.ids.join(",")}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      for (const job of eventJobs(event).filter((j) => j.role === role)) {
        if (
          role === "builder" &&
          (queue.current.some((q) => q.ids[0] === job.ids[0]) ||
            active.current?.job.ids[0] === job.ids[0])
        )
          continue;
        queue.current.push(job);
      }
    }
    if (seen.current.size > 1024)
      seen.current = new Set([...seen.current].slice(-512));
  }, [latest, role]);
  useFrame(({ clock }) => {
    const now = performance.now();
    let a = active.current;
    if (!a && queue.current.length) {
      const job = queue.current[0];
      const target =
        role === "courier" ? home : layout.positions.get(job.ids[0]);
      if (target !== undefined && target >= 0) {
        queue.current.shift();
        const path = tilePath(
            role === "archivist" ? home : current.current,
            target,
          ),
          walk = Math.max(0.7, (path.length - 1) * 0.22);
        a = {
          job,
          start: now,
          path,
          walk,
          duration: role === "courier" ? 7 : walk + 2.5,
          tile: target,
        };
        active.current = a;
        const label =
          role === "courier"
            ? "Courier is delivering a note"
            : role === "builder"
              ? "Builder is raising a building"
              : "Archivist is filing a crate";
        useTown.setState({ activity: label });
        if (role === "builder")
          useTown.setState((s) => ({
            builds: { ...s.builds, [job.ids[0]]: now + walk * 1000 },
          }));
      } else if (Date.now() - Date.parse(job.event.timestamp) > 30000) {
        queue.current.shift();
      }
    }
    const t = a ? (now - a.start) / 1000 : 0;
    let n: Vector3;
    let walking = false,
      carrying = false;
    if (a) {
      const f = Math.min(1, t / a.walk) * (a.path.length - 1),
        i = Math.min(a.path.length - 1, Math.floor(f));
      n = tiles[a.path[i]].normal
        .clone()
        .lerp(tiles[a.path[Math.min(i + 1, a.path.length - 1)]].normal, f - i)
        .normalize();
      walking = t < a.walk;
      carrying = role === "archivist" && walking;
      if (role === "courier") {
        n = tiles[home].normal.clone();
        const altitude =
          t < 2
            ? Math.pow(1 - t / 2, 2) * 8
            : t > 5
              ? Math.pow((t - 5) / 2, 2) * 8
              : 0;
        pod.current.position.copy(n).multiplyScalar(RADIUS + 0.3 + altitude);
        pod.current.quaternion.copy(orientation(home));
        pod.current.visible = t < 2.8 || t > 4.8;
        crates.current.visible = t > 1.8;
      }
      if (t > a.duration) {
        current.current = a.tile;
        active.current = null;
        useTown.setState({
          activity:
            role === "courier"
              ? "Courier delivered to Inbox"
              : role === "builder"
                ? "Building ready"
                : "Crate filed",
        });
      }
    } else {
      if (now - wander.current.start > 4500) {
        const from = current.current;
        const choices = tiles[from].neighbors.filter(
          (id) => layout.owners.get(id) === layout.owners.get(from),
        );
        const to =
          choices[
            Math.floor(clock.elapsedTime) % Math.max(choices.length, 1)
          ] ?? from;
        wander.current = { start: now, from, to };
        current.current = to;
      }
      const w = wander.current,
        f = Math.min(1, (now - w.start) / 2200);
      n = tiles[w.from].normal.clone().lerp(tiles[w.to].normal, f).normalize();
      walking = f < 1;
      pod.current.visible = false;
    }
    const destination = n.clone().multiplyScalar(RADIUS + 0.22),
      direction = destination.clone().sub(body.current.position);
    body.current.quaternion.setFromUnitVectors(up, n);
    if (direction.lengthSq() > 0.000001 && direction.length() < 1) {
      direction.applyQuaternion(body.current.quaternion.clone().invert());
      model.current.rotation.y = Math.atan2(direction.x, direction.z);
    }
    body.current.position.copy(destination);
    model.current.rotation.z = walking
      ? Math.sin(clock.elapsedTime * 11) * 0.08
      : Math.sin(clock.elapsedTime * 2) * 0.025;
    // Accessory arms and a carried crate visibly distinguish archival work.
    phase.current = { walk: walking, carry: carrying };
    model.current.children.forEach((child) => {
      if (child.name === "carry") child.visible = carrying;
    });
  });
  return (
    <>
      <group ref={body}>
        <group ref={model}>
          <AnimatedRobot role={role} motion={phase} />
          <mesh name="carry" position={[0, 0.27, 0.27]} visible={false}>
            <boxGeometry args={[0.24, 0.22, 0.2]} />
            <meshStandardMaterial color="#bc9971" />
          </mesh>
        </group>
      </group>
      <group ref={pod} visible={false}>
        <Suspense fallback={null}>
          <group position={[0, 0.12, 0]} scale={1.4}>
            <Asset id="ares.shuttle" />
          </group>
        </Suspense>
      </group>
      <group
        ref={crates}
        position={surface(home, 0.23)}
        quaternion={orientation(home)}
        visible={false}
      >
        <Suspense fallback={null}>
          {[-0.25, 0.25].map((x, i) => (
            <group key={i} position={[x, 0, 0.15]} scale={0.42}>
              <Asset id="inbox.crate" />
            </group>
          ))}
        </Suspense>
      </group>
    </>
  );
}
function AnimatedRobot({
  role,
  motion,
}: {
  role: Role;
  motion: React.RefObject<{ walk: boolean; carry: boolean }>;
}) {
  const rig = useRef<Group>(null!);
  useFrame(({ clock }) => {
    rig.current.position.y = motion.current.walk
      ? Math.abs(Math.sin(clock.elapsedTime * 11)) * 0.05
      : 0;
    rig.current.rotation.x = motion.current.carry ? -0.12 : 0;
  });
  return (
    <group ref={rig}>
      <Robot role={role} motion={motion} />
    </group>
  );
}
function Orbit({ layout }: { layout: Layout }) {
  const station = useRef<Group>(null!),
    scout = useRef<Group>(null!),
    sweep = useRef<Mesh>(null!);
  const events = useTown((s) => s.events);
  const seen = useRef(new Set<string>());
  const active = useRef<{ start: number; ids: string[] } | null>(null);
  useEffect(() => {
    for (const event of events) {
      const key = event.sequence || event.timestamp;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      if (eventJobs(event).some((j) => j.role === "scout")) {
        active.current = { start: performance.now(), ids: event.ids };
        useTown.setState((s) => ({
          activity: `Scout is reading ${event.ids.length} places`,
          illuminated: {
            ...s.illuminated,
            ...Object.fromEntries(
              event.ids.map((id) => [id, performance.now() + 6500]),
            ),
          },
        }));
      }
    }
    if (seen.current.size > 1024)
      seen.current = new Set([...seen.current].slice(-512));
  }, [events]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.035;
    station.current.position.set(Math.cos(t) * 13, 5, Math.sin(t) * 13);
    station.current.rotation.y = -t;
    const read = active.current,
      first = read?.ids
        .map((id) => layout.positions.get(id))
        .find((id) => id !== undefined);
    const angle = -clock.elapsedTime * 0.06;
    const target =
      first !== undefined
        ? tiles[first].normal
        : new Vector3(Math.cos(angle), 0.45, Math.sin(angle)).normalize();
    scout.current.position.copy(target).multiplyScalar(RADIUS + 4);
    scout.current.quaternion.setFromUnitVectors(up, target);
    sweep.current.visible = !!read && performance.now() - read.start < 6500;
    if (read && performance.now() - read.start > 6500) active.current = null;
  });
  return (
    <>
      <group
        ref={station}
        scale={0.68}
        onPointerOver={() => useTown.setState({ hover: "Ares station" })}
        onPointerOut={() => useTown.setState({ hover: null })}
      >
        <Suspense fallback={null}>
          <Asset id="station.core" shadow={false} />
          <group position={[0, 0, 1]}>
            <Asset id="station.corridor" shadow={false} />
          </group>
          <group position={[0, 0, -1]}>
            <Asset id="station.corridor" shadow={false} />
          </group>
          {[-1, 1].map((x) => (
            <group key={x} position={[x * 1.5, 0.25, 0]}>
              <Asset id="station.solar" shadow={false} />
            </group>
          ))}
          <group position={[0, 1.1, 0]}>
            <Asset id="station.dish" shadow={false} />
          </group>
        </Suspense>
        <group position={[0.6, 0.6, 0.55]} scale={0.8}>
          <Robot role="ares" shadow={false} />
        </group>
      </group>
      <group
        ref={scout}
        onPointerOver={() => useTown.setState({ hover: "Scout satellite" })}
        onPointerOut={() => useTown.setState({ hover: null })}
      >
        <Suspense fallback={null}>
          <group scale={0.5}>
            <Asset id="scout.satellite" shadow={false} />
          </group>
        </Suspense>
        <group position={[0, 0.25, 0]} scale={0.65}>
          <Robot role="scout" shadow={false} />
        </group>
        <mesh ref={sweep} position={[0, -1.8, 0]}>
          <coneGeometry args={[1.4, 3.6, 24, 1, true]} />
          <meshBasicMaterial
            color="#81cadd"
            transparent
            opacity={0.12}
            depthWrite={false}
            side={2}
          />
        </mesh>
      </group>
    </>
  );
}
/** A dog that wanders the town hall land. Life on the planet, no job attached. */
function Pet({ layout }: { layout: Layout }) {
  const body = useRef<Group>(null!),
    model = useRef<Group>(null!);
  const home = layout.seeds.get("identity") ?? 0;
  const occupied = useMemo(() => new Set(layout.positions.values()), [layout]);
  const wander = useRef({ start: 0, from: home, to: home });
  useFrame(({ clock }) => {
    const now = performance.now(),
      w = wander.current;
    if (now - w.start > 3200) {
      const choices = tiles[w.to].neighbors.filter(
        (id) =>
          layout.owners.get(id) === layout.owners.get(home) &&
          !occupied.has(id),
      );
      wander.current = {
        start: now,
        from: w.to,
        to:
          choices[
            Math.floor(clock.elapsedTime * 7) % Math.max(1, choices.length)
          ] ?? w.to,
      };
    }
    const f = Math.min(1, (now - w.start) / 1800);
    const n = tiles[w.from].normal
      .clone()
      .lerp(tiles[w.to].normal, f)
      .normalize();
    const destination = n.clone().multiplyScalar(RADIUS + 0.18),
      direction = destination.clone().sub(body.current.position);
    body.current.quaternion.setFromUnitVectors(up, n);
    if (direction.lengthSq() > 0.000001 && direction.length() < 1) {
      direction.applyQuaternion(body.current.quaternion.clone().invert());
      model.current.rotation.y = Math.atan2(direction.x, direction.z);
    }
    body.current.position.copy(destination);
    model.current.position.y =
      f < 1 ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.04 : 0;
  });
  return (
    <group
      ref={body}
      onPointerOver={() => useTown.setState({ hover: "Town dog" })}
      onPointerOut={() => useTown.setState({ hover: null })}
    >
      <group ref={model}>
        <Suspense fallback={null}>
          <Asset id="life.dog" />
        </Suspense>
      </group>
    </group>
  );
}
export function Workers({ layout }: { layout: Layout }) {
  return (
    <>
      <Worker role="courier" layout={layout} />
      <Worker role="builder" layout={layout} />
      <Worker role="archivist" layout={layout} />
      <Pet layout={layout} />
      <Orbit layout={layout} />
    </>
  );
}
