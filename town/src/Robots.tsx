// Robots rest on charging pads at the factory and ride the tunnel to jobs on the
// knowledge planet; the courier flies its shuttle; the Ares station circles the
// factory; the scout circles the planet; a dog wanders the town hall land.
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  Vector3,
} from "three";
import { Asset } from "./Assets";
import { eventJobs, tilePath, type Job, type Role } from "./behavior";
import { factoryLayout, type WorkerRole } from "./Factory";
import type { Layout } from "./layout";
import {
  BRAIN_POS,
  FACTORY_POS,
  FACTORY_RADIUS,
  factoryTiles,
  RADIUS,
  slerpNormal,
  surface,
  surfaceOf,
  tiles,
  type Tile,
} from "./planet";
import { useTown } from "./store";
import {
  brainGate,
  brainMouth,
  factoryGate,
  factoryMouth,
  factoryState,
  RIDE_SECONDS,
  tunnel,
} from "./transit";
const Y = new Vector3(0, 1, 0);
const colors: Record<Role, string> = {
  courier: "#cd9368",
  builder: "#ddc35e",
  archivist: "#9b9bc9",
  scout: "#74b6c6",
  ares: "#d7c597",
  keeper: "#9fb3a6",
};
const labels: Record<WorkerRole, string> = {
  courier: "Courier",
  builder: "Builder",
  archivist: "Archivist",
};
/**
 * Robot body from primitives: capsule torso with a heart light, a visor with
 * two blinking eyes, a pulsing antenna, hinged arms and legs, and gear per
 * role. Riders in orbit pass shadow false.
 * @param color overrides the role colour, so keepers wear their region's colour
 * @param motion per-frame walk and carry flags from the worker, if any
 */
export function Robot({
  role,
  color: tint,
  walking = false,
  carrying = false,
  shadow = true,
  motion,
}: {
  role: Role;
  color?: string;
  walking?: boolean;
  carrying?: boolean;
  shadow?: boolean;
  motion?: React.RefObject<{ walk: boolean; carry: boolean }>;
}) {
  const rig = useRef<Group>(null!),
    head = useRef<Group>(null!),
    leftLeg = useRef<Group>(null!),
    rightLeg = useRef<Group>(null!),
    leftArm = useRef<Group>(null!),
    rightArm = useRef<Group>(null!),
    tip = useRef<MeshStandardMaterial>(null!);
  const color = tint ?? colors[role];
  const eyes = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#bff4ff",
        emissive: "#7fe0ff",
        emissiveIntensity: 1.4,
      }),
    [],
  );
  useEffect(() => () => eyes.dispose(), [eyes]);
  useEffect(() => {
    rig.current.traverse((o) => {
      o.castShadow = shadow;
      o.receiveShadow = shadow;
    });
  }, [role, carrying, shadow]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime,
      walk = motion?.current.walk ?? walking,
      carry = motion?.current.carry ?? carrying,
      swing = walk ? Math.sin(t * 11) : 0;
    rig.current.position.y = walk
      ? Math.abs(Math.sin(t * 11)) * 0.02
      : 0.012 * Math.sin(t * 2);
    leftLeg.current.rotation.x = swing * 0.6;
    rightLeg.current.rotation.x = -swing * 0.6;
    leftArm.current.rotation.x = carry ? -1.25 : -swing * 0.5;
    rightArm.current.rotation.x = carry ? -1.25 : swing * 0.5;
    head.current.rotation.y = walk ? 0 : Math.sin(t * 0.7) * 0.35;
    head.current.rotation.x = carry ? 0.15 : 0;
    tip.current.emissiveIntensity = Math.sin(t * 5) > 0.6 ? 1.2 : 0.35;
    eyes.emissiveIntensity = Math.sin(t * 1.3) > 0.97 ? 0.1 : 1.4;
  });
  return (
    <group ref={rig} scale={1.15}>
      <mesh position={[0, 0.3, 0]}>
        <capsuleGeometry args={[0.12, 0.12, 4, 10]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.31, 0.11]}>
        <boxGeometry args={[0.09, 0.09, 0.03]} />
        <meshStandardMaterial
          color="#1c2a3a"
          emissive={color}
          emissiveIntensity={0.9}
        />
      </mesh>
      <group ref={head} position={[0, 0.5, 0]}>
        <mesh>
          <boxGeometry args={[0.26, 0.2, 0.22]} />
          <meshStandardMaterial color="#e4e8e6" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.01, 0.105]}>
          <boxGeometry args={[0.2, 0.09, 0.03]} />
          <meshStandardMaterial color="#17273a" />
        </mesh>
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.01, 0.125]} material={eyes}>
            <sphereGeometry args={[0.022, 8, 6]} />
          </mesh>
        ))}
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.03, 8]} />
            <meshStandardMaterial color="#8fa0a8" />
          </mesh>
        ))}
        <mesh position={[0.06, 0.16, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.12, 5]} />
          <meshStandardMaterial color="#a8b6bc" />
        </mesh>
        <mesh position={[0.06, 0.23, 0]}>
          <sphereGeometry args={[0.026, 6, 5]} />
          <meshStandardMaterial
            ref={tip}
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
          />
        </mesh>
        {role === "builder" && (
          <group position={[0, 0.1, 0]}>
            <mesh position={[0, 0.02, 0]}>
              <sphereGeometry
                args={[0.16, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial color="#f1c55c" />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.19, 0.19, 0.03, 10]} />
              <meshStandardMaterial color="#f1c55c" />
            </mesh>
          </group>
        )}
        {role === "archivist" &&
          [-0.05, 0.05].map((x) => (
            <mesh key={x} position={[x, 0.01, 0.135]}>
              <torusGeometry args={[0.04, 0.009, 4, 10]} />
              <meshStandardMaterial color="#a793d0" />
            </mesh>
          ))}
        {role === "scout" && (
          <>
            <mesh position={[0, 0.12, -0.04]} rotation={[-0.5, 0, 0]}>
              <sphereGeometry
                args={[0.12, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial color="#85c2cf" side={2} />
            </mesh>
            <mesh position={[0, 0.06, 0.1]}>
              <boxGeometry args={[0.22, 0.05, 0.04]} />
              <meshStandardMaterial color="#3c5a66" />
            </mesh>
          </>
        )}
        {role === "ares" && (
          <group position={[0, 0.1, 0]}>
            <mesh>
              <cylinderGeometry args={[0.14, 0.12, 0.07, 7, 1, true]} />
              <meshStandardMaterial color="#edd083" side={2} />
            </mesh>
            {[-0.09, 0, 0.09].map((x) => (
              <mesh key={x} position={[x, 0.065, 0.07]}>
                <coneGeometry args={[0.04, 0.12, 4]} />
                <meshStandardMaterial color="#edd083" />
              </mesh>
            ))}
          </group>
        )}
      </group>
      {[-1, 1].map((s) => (
        <group
          key={s}
          ref={s < 0 ? leftArm : rightArm}
          position={[s * 0.16, 0.4, 0]}
        >
          <mesh position={[0, -0.09, 0]} rotation={[0, 0, s * 0.1]}>
            <capsuleGeometry args={[0.028, 0.14, 3, 6]} />
            <meshStandardMaterial color="#b8c5cc" />
          </mesh>
          <mesh position={[0, -0.19, 0]}>
            <sphereGeometry args={[0.038, 7, 6]} />
            <meshStandardMaterial color="#8fa0a8" />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group
          key={s}
          ref={s < 0 ? leftLeg : rightLeg}
          position={[s * 0.07, 0.19, 0]}
        >
          <mesh position={[0, -0.08, 0]}>
            <capsuleGeometry args={[0.033, 0.1, 3, 6]} />
            <meshStandardMaterial color="#b5c3c9" />
          </mesh>
          <mesh position={[0, -0.17, 0.02]}>
            <boxGeometry args={[0.08, 0.04, 0.12]} />
            <meshStandardMaterial color="#5c6a73" />
          </mesh>
        </group>
      ))}
      {role === "courier" && (
        <group position={[0, 0.3, -0.15]}>
          {[-0.06, 0.06].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.04, 0.045, 0.2, 8]} />
                <meshStandardMaterial color="#8a7d6f" />
              </mesh>
              <mesh position={[0, -0.12, 0]}>
                <coneGeometry args={[0.03, 0.05, 8]} />
                <meshStandardMaterial
                  color="#ffb060"
                  emissive="#ff8a3a"
                  emissiveIntensity={1.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {role === "builder" && (
        <>
          <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.13, 0.02, 5, 12]} />
            <meshStandardMaterial color="#6b4e2e" />
          </mesh>
          <mesh position={[0.05, 0.32, -0.15]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.03, 0.22, 0.03]} />
            <meshStandardMaterial color="#9aa7ae" />
          </mesh>
        </>
      )}
      {role === "archivist" && (
        <>
          <mesh position={[0.17, 0.24, 0]}>
            <boxGeometry args={[0.06, 0.11, 0.13]} />
            <meshStandardMaterial color="#6a4f7a" />
          </mesh>
          <mesh position={[0, 0.33, 0]} rotation={[0, 0, 0.9]}>
            <boxGeometry args={[0.03, 0.34, 0.14]} />
            <meshStandardMaterial color="#8d7aa3" />
          </mesh>
        </>
      )}
      {role === "ares" && (
        <mesh position={[0, 0.27, -0.14]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.24, 0.3, 0.02]} />
          <meshStandardMaterial color="#8b2f3a" side={2} />
        </mesh>
      )}
      {role === "keeper" && (
        <group position={[-0.12, 0.3, -0.13]} rotation={[0.35, 0, 0.5]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.012, 0.5, 5]} />
            <meshStandardMaterial color="#a88a5c" />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[0.14, 0.03, 0.03]} />
            <meshStandardMaterial color="#7c8a92" />
          </mesh>
        </group>
      )}
      {carrying && (
        <mesh position={[0, 0.28, 0.22]}>
          <boxGeometry args={[0.22, 0.2, 0.18]} />
          <meshStandardMaterial color="#bba17b" />
        </mesh>
      )}
    </group>
  );
}
/** Where a robot is and what it is doing, in world space. */
type Pose = {
  position: Vector3;
  up: Vector3;
  walking: boolean;
  carrying: boolean;
  riding: boolean;
  flying: boolean;
  unloading: boolean;
};
/** One leg of a job. at() writes the pose for a fraction of the leg. */
type Segment = {
  duration: number;
  at: (u: number, pose: Pose) => void;
  activity?: string;
};
const ease = (x: number) => x * x * (3 - 2 * x);
function brainPoint(tile: number, height = 0.22) {
  return BRAIN_POS.clone().add(surface(tile, height));
}
function factoryPoint(tile: number, height = 0.22) {
  return FACTORY_POS.clone().add(surfaceOf(factoryTiles[tile], height));
}
/** Walk a tile path over a planet. */
function walk(
  set: Tile[],
  origin: Vector3,
  radius: number,
  path: number[],
  carrying = false,
  activity?: string,
): Segment {
  const last = path.length - 1;
  return {
    duration: Math.max(0.6, last * 0.24),
    activity,
    at(u, pose) {
      const f = u * last,
        i = Math.min(last, Math.floor(f));
      const n = last
        ? slerpNormal(
            set[path[i]].normal,
            set[path[Math.min(last, i + 1)]].normal,
            f - i,
          )
        : set[path[0]].normal.clone();
      pose.position.copy(origin).addScaledVector(n, radius + 0.22);
      pose.up.copy(n);
      pose.walking = u < 1;
      pose.carrying = carrying;
    },
  };
}
/** Ride the tunnel in a capsule. */
function ride(to: "brain" | "factory", activity?: string): Segment {
  return {
    duration: RIDE_SECONDS,
    activity,
    at(u, pose) {
      tunnel.getPointAt(to === "factory" ? u : 1 - u, pose.position);
      pose.up.copy(Y);
      pose.riding = true;
    },
  };
}
/** Straight eased move between two world points. */
function hop(
  from: Vector3,
  to: Vector3,
  up: Vector3,
  duration: number,
  flags: Partial<Pose> = {},
): Segment {
  return {
    duration,
    at(u, pose) {
      pose.position.lerpVectors(from, to, ease(u));
      pose.up.copy(up);
      Object.assign(pose, flags);
    },
  };
}
function stand(
  at: Vector3,
  up: Vector3,
  duration: number,
  flags: Partial<Pose> = {},
  activity?: string,
): Segment {
  return {
    duration,
    activity,
    at(_, pose) {
      pose.position.copy(at);
      pose.up.copy(up);
      Object.assign(pose, flags);
    },
  };
}
/** Fly an arc between two world points; the courier shuttle. */
function fly(
  from: Vector3,
  to: Vector3,
  duration: number,
  activity?: string,
): Segment {
  const curve = new QuadraticBezierCurve3(
    from,
    from
      .clone()
      .lerp(to, 0.5)
      .add(new Vector3(0, 7, 0)),
    to,
  );
  return {
    duration,
    activity,
    at(u, pose) {
      curve.getPointAt(ease(u), pose.position);
      pose.up.copy(Y);
      pose.flying = true;
    },
  };
}
type Plan = { segments: Segment[]; workAt: number };
/**
 * Lay out a whole trip for a job, from the charging pad and back to it.
 * Returns null while the target tile is unknown (the brain may not have
 * refreshed yet) so the caller can retry.
 */
function planJob(
  role: WorkerRole,
  job: Job,
  layout: Layout,
  inbox: number,
  pad: number,
): Plan | null {
  const name = labels[role];
  const home = factoryPoint(pad),
    homeUp = factoryTiles[pad].normal;
  if (role === "courier") {
    const inboxUp = tiles[inbox].normal,
      inboxTop = brainPoint(inbox, 2.6),
      inboxPad = brainPoint(inbox, 0.3),
      homeTop = factoryPoint(pad, 2.4);
    const segments = [
      hop(home, homeTop, homeUp, 0.9, { flying: true }),
      fly(homeTop, inboxTop, 3, `${name} is flying a note to the Inbox`),
      hop(inboxTop, inboxPad, inboxUp, 0.9, { flying: true }),
      stand(
        inboxPad,
        inboxUp,
        2.2,
        { unloading: true },
        `${name} is unloading at the Inbox`,
      ),
      hop(inboxPad, inboxTop, inboxUp, 0.9, { flying: true }),
      fly(inboxTop, homeTop, 3, `${name} is flying home`),
      hop(homeTop, home, homeUp, 0.9, { flying: true }),
    ];
    return { segments, workAt: 5.7 };
  }
  const target = layout.positions.get(job.ids[0]);
  if (target === undefined || target < 0) return null;
  const brainWalk = (path: number[], carrying = false, activity?: string) =>
    walk(tiles, BRAIN_POS, RADIUS, path, carrying, activity);
  const factoryWalk = (path: number[]) =>
    walk(factoryTiles, FACTORY_POS, FACTORY_RADIUS, path);
  const gateOut = brainPoint(brainGate.id),
    gateIn = factoryPoint(factoryGate.id);
  const outbound = [
    factoryWalk(tilePath(pad, factoryGate.id, factoryTiles)),
    hop(gateIn, factoryMouth, factoryGate.normal, 0.5, { riding: true }),
    ride("brain", `${name} is riding the tunnel to the planet`),
    hop(brainMouth, gateOut, brainGate.normal, 0.5, { riding: true }),
  ];
  const inbound = [
    hop(gateOut, brainMouth, brainGate.normal, 0.5, { riding: true }),
    ride("factory", `${name} is heading home to charge`),
    hop(factoryMouth, gateIn, factoryGate.normal, 0.5, { riding: true }),
    factoryWalk(tilePath(factoryGate.id, pad, factoryTiles)),
  ];
  const targetAt = brainPoint(target),
    targetUp = tiles[target].normal;
  const work =
    role === "builder"
      ? [
          brainWalk(tilePath(brainGate.id, target)),
          stand(targetAt, targetUp, 2.4, {}, `${name} is raising a building`),
        ]
      : [
          brainWalk(tilePath(brainGate.id, inbox)),
          brainWalk(tilePath(inbox, target), true, `${name} is filing a crate`),
          stand(targetAt, targetUp, 1),
        ];
  const segments = [
    ...outbound,
    ...work,
    brainWalk(tilePath(target, brainGate.id)),
    ...inbound,
  ];
  const workAt = [...outbound, ...work.slice(0, -1)].reduce(
    (sum, s) => sum + s.duration,
    0,
  );
  return { segments, workAt };
}
function Worker({ role, layout }: { role: WorkerRole; layout: Layout }) {
  const body = useRef<Group>(null!),
    model = useRef<Group>(null!),
    shuttle = useRef<Group>(null!),
    capsule = useRef<Mesh>(null!),
    crates = useRef<Group>(null!);
  const queue = useRef<Job[]>([]),
    seen = useRef(new Set<string>()),
    plan = useRef<{ start: number; segments: Segment[]; index: number } | null>(
      null,
    );
  const motion = useRef({ walk: false, carry: false });
  const events = useTown((s) => s.events);
  const pad = factoryLayout.pads[role];
  const home = useMemo(
    () => ({ position: factoryPoint(pad), up: factoryTiles[pad].normal }),
    [pad],
  );
  const inbox = layout.positions.get("inbox") ?? layout.seeds.get("inbox") ?? 0;
  useEffect(() => {
    for (const event of events) {
      const key =
        event.sequence ||
        `${event.timestamp}:${event.kind}:${event.ids.join(",")}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      for (const job of eventJobs(event).filter((j) => j.role === role)) {
        if (
          role === "builder" &&
          queue.current.some((q) => q.ids[0] === job.ids[0])
        )
          continue;
        queue.current.push(job);
      }
    }
    if (seen.current.size > 1024)
      seen.current = new Set([...seen.current].slice(-512));
  }, [events, role]);
  const pose = useMemo<Pose>(
    () => ({
      position: home.position.clone(),
      up: home.up.clone(),
      walking: false,
      carrying: false,
      riding: false,
      flying: false,
      unloading: false,
    }),
    [home],
  );
  useFrame(({ clock }) => {
    const now = performance.now();
    if (!plan.current && queue.current.length) {
      const job = queue.current[0];
      const next = planJob(role, job, layout, inbox, pad);
      if (next) {
        queue.current.shift();
        plan.current = { start: now, segments: next.segments, index: -1 };
        if (role === "builder")
          useTown.setState((s) => ({
            builds: { ...s.builds, [job.ids[0]]: now + next.workAt * 1000 },
          }));
      } else if (Date.now() - Date.parse(job.event.timestamp) > 30000) {
        queue.current.shift();
      }
    }
    pose.walking =
      pose.carrying =
      pose.riding =
      pose.flying =
      pose.unloading =
        false;
    const p = plan.current;
    if (p) {
      let t = (now - p.start) / 1000,
        i = 0;
      while (i < p.segments.length && t > p.segments[i].duration) {
        t -= p.segments[i].duration;
        i++;
      }
      if (i >= p.segments.length) {
        plan.current = null;
        useTown.setState({
          activity: `${labels[role]} is back on the charging pad`,
        });
        pose.position.copy(home.position);
        pose.up.copy(home.up);
      } else {
        const segment = p.segments[i];
        if (i !== p.index) {
          p.index = i;
          if (segment.activity)
            useTown.setState({ activity: segment.activity });
        }
        segment.at(Math.min(1, t / segment.duration), pose);
      }
    } else {
      pose.position.copy(home.position);
      pose.up.copy(home.up);
    }
    const direction = pose.position.clone().sub(body.current.position);
    body.current.quaternion.setFromUnitVectors(Y, pose.up);
    if (direction.lengthSq() > 0.000001 && direction.length() < 1.5) {
      direction.applyQuaternion(body.current.quaternion.clone().invert());
      model.current.rotation.y = Math.atan2(direction.x, direction.z);
    }
    body.current.position.copy(pose.position);
    model.current.rotation.z = pose.walking
      ? Math.sin(clock.elapsedTime * 11) * 0.08
      : Math.sin(clock.elapsedTime * 2) * 0.025;
    motion.current = { walk: pose.walking, carry: pose.carrying };
    capsule.current.visible = pose.riding;
    shuttle.current.visible = pose.flying || pose.unloading;
    crates.current.visible = pose.unloading;
    model.current.children.forEach((child) => {
      if (child.name === "carry") child.visible = pose.carrying;
    });
  });
  return (
    <group ref={body}>
      <group ref={model}>
        <AnimatedRobot role={role} motion={motion} />
        <mesh name="carry" position={[0, 0.27, 0.27]} visible={false}>
          <boxGeometry args={[0.24, 0.22, 0.2]} />
          <meshStandardMaterial color="#bc9971" />
        </mesh>
      </group>
      <mesh ref={capsule} visible={false} position={[0, 0.4, 0]}>
        <capsuleGeometry args={[0.36, 0.5, 6, 12]} />
        <meshStandardMaterial
          color="#bfe6ff"
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>
      <group ref={shuttle} visible={false} position={[0, -0.14, 0]} scale={1.4}>
        <Suspense fallback={null}>
          <Asset id="ares.shuttle" />
        </Suspense>
      </group>
      <group ref={crates} visible={false}>
        <Suspense fallback={null}>
          {[-0.55, 0.55].map((x, i) => (
            <group key={i} position={[x, 0, 0.25]} scale={0.42}>
              <Asset id="inbox.crate" />
            </group>
          ))}
        </Suspense>
      </group>
    </group>
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
/**
 * The Ares station circles the factory with Ares aboard. Its beacon pulses
 * while Ares is reading a file from the inbox.
 */
function Station() {
  const ref = useRef<Group>(null!),
    beacon = useRef<MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.05,
      now = performance.now();
    ref.current.position.set(
      FACTORY_POS.x + Math.cos(t) * 8.6,
      FACTORY_POS.y + 3.4,
      FACTORY_POS.z + Math.sin(t) * 8.6,
    );
    ref.current.rotation.y = -t;
    // An ingest that never reports back stops counting as reading once the busy window ends.
    if (factoryState.reading && factoryState.busyUntil < now)
      factoryState.reading = null;
    beacon.current.emissiveIntensity = factoryState.reading
      ? 1.6 + Math.sin(clock.elapsedTime * 8) * 1.2
      : 0.25;
  });
  return (
    <group
      ref={ref}
      scale={0.68}
      onPointerOver={() =>
        useTown.setState({
          hover: factoryState.reading
            ? `Ares station · reading ${factoryState.reading}`
            : "Ares station · idle",
        })
      }
      onPointerOut={() => useTown.setState({ hover: null })}
    >
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial
          ref={beacon}
          color="#ffe6a8"
          emissive="#ffb347"
          emissiveIntensity={0.25}
        />
      </mesh>
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
  );
}
/** The scout satellite circles the knowledge planet and sweeps what agents read. */
function Scout({ layout }: { layout: Layout }) {
  const scout = useRef<Group>(null!),
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
    const read = active.current,
      first = read?.ids
        .map((id) => layout.positions.get(id))
        .find((id) => id !== undefined && id >= 0);
    const angle = -clock.elapsedTime * 0.06;
    const target =
      first !== undefined
        ? tiles[first].normal
        : new Vector3(Math.cos(angle), 0.45, Math.sin(angle)).normalize();
    scout.current.position.copy(BRAIN_POS).addScaledVector(target, RADIUS + 4);
    scout.current.quaternion.setFromUnitVectors(Y, target);
    sweep.current.visible = !!read && performance.now() - read.start < 6500;
    if (read && performance.now() - read.start > 6500) active.current = null;
  });
  return (
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
  );
}
/** A dog that wanders the town hall land, in the knowledge planet's frame. */
export function Pet({ layout }: { layout: Layout }) {
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
    body.current.quaternion.setFromUnitVectors(Y, n);
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
/** Everything that moves between or around the planets, in world space. */
export function Workers({ layout }: { layout: Layout }) {
  return (
    <>
      <Worker role="courier" layout={layout} />
      <Worker role="builder" layout={layout} />
      <Worker role="archivist" layout={layout} />
      <Station />
      <Scout layout={layout} />
    </>
  );
}
