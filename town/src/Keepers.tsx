// Keeper robots live on the knowledge planet: one per region, charging on the
// depot pad by the region's square and walking to whichever places need
// tending. They never leave their region's land.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import type { Progress } from "./game";
import { depots, regionPath, type Depot } from "./depots";
import type { Layout } from "./layout";
import { RADIUS, tiles } from "./planet";
import { Robot } from "./Robots";
import { biomeColors } from "./Scene";
import { useTown } from "./store";
const Y = new Vector3(0, 1, 0);
const STEP_MS = 420,
  WORK_MS = 3200;
type Task = { tile: number; title: string };
type Phase = "rest" | "go" | "work" | "back";
type State = {
  phase: Phase;
  until: number;
  route: number[];
  step: number;
  stepStart: number;
  next: number;
  task: Task | null;
  label: string;
};
/**
 * One keeper: rests on its pad, walks to the next place that needs tending,
 * works there facing the building, walks home and charges again.
 * @param tasks places in this region with an open quest, visited in order
 */
function Keeper({
  depot,
  region,
  color,
  tasks,
  layout,
}: {
  depot: Depot;
  region: string;
  color: string;
  tasks: Task[];
  layout: Layout;
}) {
  const body = useRef<Group>(null!),
    model = useRef<Group>(null!);
  const motion = useRef({ walk: false, carry: false });
  const state = useRef<State>({
    phase: "rest",
    until: performance.now() + 2000 + Math.random() * 8000,
    route: [depot.pad],
    step: 0,
    stepStart: 0,
    next: 0,
    task: null,
    label: "charging",
  });
  const owner = layout.owners.get(depot.pad);
  const allowed = (t: number) => layout.owners.get(t) === owner;
  useFrame(({ clock }) => {
    const now = performance.now(),
      s = state.current;
    if (s.phase === "rest" && now > s.until) {
      const task = tasks.length ? tasks[s.next % tasks.length] : null;
      if (task) {
        const route = regionPath(depot.pad, task.tile, allowed);
        if (route.length > 1) route.pop();
        s.next++;
        s.task = task;
        s.route = route;
        s.step = 0;
        s.stepStart = now;
        s.phase = "go";
        s.label = `checking on ${task.title}`;
      } else s.until = now + 8000;
    } else if (s.phase === "work" && now > s.until) {
      s.route = regionPath(s.route[s.route.length - 1], depot.pad, allowed);
      s.step = 0;
      s.stepStart = now;
      s.phase = "back";
      s.label = "heading home";
    }
    const walking = s.phase === "go" || s.phase === "back";
    if (walking) {
      while (s.step < s.route.length - 1 && now - s.stepStart > STEP_MS) {
        s.step++;
        s.stepStart += STEP_MS;
      }
      if (s.step >= s.route.length - 1) {
        if (s.phase === "go") {
          s.phase = "work";
          s.until = now + WORK_MS;
          s.label = `tending ${s.task?.title}`;
        } else {
          s.phase = "rest";
          s.until = now + 5000 + Math.random() * 10000;
          s.label = "charging";
        }
      }
    }
    const last = s.route.length - 1,
      from = tiles[s.route[Math.min(s.step, last)]],
      to = tiles[s.route[Math.min(s.step + 1, last)]],
      f = walking ? Math.min(1, (now - s.stepStart) / STEP_MS) : 0;
    const n = from.normal.clone().lerp(to.normal, f).normalize();
    const destination = n.clone().multiplyScalar(RADIUS + 0.2);
    const direction = destination.clone().sub(body.current.position);
    body.current.quaternion.setFromUnitVectors(Y, n);
    const inverse = body.current.quaternion.clone().invert();
    if (walking && direction.lengthSq() > 0.000001 && direction.length() < 1) {
      direction.applyQuaternion(inverse);
      model.current.rotation.y = Math.atan2(direction.x, direction.z);
    }
    if (s.phase === "work" && s.task) {
      const toward = tiles[s.task.tile].center
        .clone()
        .sub(destination)
        .applyQuaternion(inverse);
      model.current.rotation.y = Math.atan2(toward.x, toward.z);
    }
    body.current.position.copy(destination);
    motion.current = { walk: walking, carry: s.phase === "work" };
    model.current.position.y =
      s.phase === "work" ? Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.03 : 0;
  });
  return (
    <group
      ref={body}
      onPointerOver={() =>
        useTown.setState({
          hover: `Keeper of ${region} · ${state.current.label}`,
        })
      }
      onPointerOut={() => useTown.setState({ hover: null })}
    >
      <group ref={model}>
        <Robot role="keeper" color={color} motion={motion} />
      </group>
    </group>
  );
}
/**
 * All keepers, inside the knowledge planet's group.
 * @param game progress of the same brain; its quests are the keepers' rounds
 */
export function Keepers({ layout, game }: { layout: Layout; game: Progress }) {
  const homes = useMemo(() => depots(layout), [layout]);
  const titles = useMemo(
    () => new Map(layout.groups.map((g) => [g.id, g.title])),
    [layout],
  );
  const rounds = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const q of game.quests) {
      const region = layout.groupOf.get(q.id),
        tile = layout.positions.get(q.id) ?? -1;
      if (!region || tile < 0) continue;
      map.set(region, [...(map.get(region) || []), { tile, title: q.title }]);
    }
    return map;
  }, [game, layout]);
  return (
    <>
      {homes.map((d) => {
        const owner = layout.groups.findIndex((g) => g.id === d.region);
        return (
          <Keeper
            key={d.region}
            depot={d}
            region={titles.get(d.region) || d.region}
            color={biomeColors[owner % biomeColors.length]}
            tasks={rounds.get(d.region) || []}
            layout={layout}
          />
        );
      })}
    </>
  );
}
