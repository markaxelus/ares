// Globe camera. The anchor stays on a planet's surface: left drag slides the
// planet under the cursor, right drag or Shift drag orbits around the anchor,
// the wheel zooms toward the cursor and crosses to the other planet, arrows and
// WASD pan, Q and E turn, R and F tilt. Explore and clicks move the anchor too.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Sphere,
  Vector2,
  Vector3,
} from "three";
import { planets, type PlanetName } from "./planet";
import { useTown } from "./store";
type Where = PlanetName | "system";
type Anchor = {
  where: Where;
  dir: Vector3;
  distance: number;
  yaw: number;
  pitch: number;
};
const SYSTEM_CENTER = new Vector3(1.5, 0, 0);
const Y = new Vector3(0, 1, 0),
  X = new Vector3(1, 0, 0),
  BACK = new Vector3(0, 0, -1);
const NEAREST = 0.7,
  FARTHEST = 95,
  PITCH_MAX = 1.5;
/** Pixels the pointer moved since it went down, so a drag never counts as a click. */
export const pointer = { moved: 0 };
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
function slerp(a: Vector3, b: Vector3, t: number) {
  const turn = new Quaternion().setFromUnitVectors(a, b);
  return a.clone().applyQuaternion(new Quaternion().slerp(turn, t)).normalize();
}
/** Camera placement for an anchor: above it, tilted south by pitch, turned by yaw. */
function placement(a: Anchor) {
  const system = a.where === "system";
  const up = system ? Y.clone() : a.dir.clone();
  const lookAt =
    a.where === "system"
      ? SYSTEM_CENTER.clone()
      : planets[a.where].origin
          .clone()
          .addScaledVector(a.dir, planets[a.where].radius + 0.2);
  const pole = system ? BACK : Y;
  const north = pole.clone().addScaledVector(up, -up.dot(pole));
  if (north.lengthSq() < 0.001) north.copy(X);
  north.normalize();
  const east = north.clone().cross(up);
  const offset = up
    .clone()
    .applyAxisAngle(east, a.pitch)
    .applyAxisAngle(up, a.yaw);
  return {
    position: lookAt.clone().addScaledVector(offset, a.distance),
    lookAt,
    up,
  };
}
export function GlobeCamera() {
  const { camera, gl, size } = useThree();
  const target = useRef<Anchor>({
    where: "system",
    dir: new Vector3(0, 0, 1),
    distance: 62,
    yaw: 0.3,
    pitch: 1.05,
  });
  const smooth = useRef<{
    position: Vector3;
    lookAt: Vector3;
    up: Vector3;
    started: boolean;
  }>({
    position: new Vector3(),
    lookAt: new Vector3(),
    up: Y.clone(),
    started: false,
  });
  const focus = useTown((s) => s.focus),
    view = useTown((s) => s.view),
    jump = useTown((s) => s.jump);
  // Navigation from the interface: a tile, a planet, or the whole system.
  useEffect(() => {
    const a = target.current;
    if (focus) {
      const planet = planets[focus.planet];
      if (a.where !== focus.planet || a.distance > 14) {
        a.distance = 6;
        a.pitch = 0.9;
      }
      a.where = focus.planet;
      a.dir = planet.tiles[focus.tile].normal.clone();
    } else if (view === "system") {
      a.where = "system";
      a.distance = 62;
      a.pitch = 1.05;
      a.yaw = 0.3;
    } else {
      const planet = planets[view];
      if (a.where !== view)
        a.dir = smooth.current.position.clone().sub(planet.origin).normalize();
      a.where = view;
      a.distance = view === "brain" ? 24 : 15;
      a.pitch = 0.35;
    }
  }, [focus, view, jump]);
  useEffect(() => {
    const element = gl.domElement,
      raycaster = new Raycaster();
    let drag: { x: number; y: number; orbit: boolean } | null = null;
    const orbit = (dx: number, dy: number) => {
      const a = target.current;
      a.yaw -= dx * 0.006;
      a.pitch = clamp(a.pitch + dy * 0.006, 0.02, PITCH_MAX);
    };
    /** Slide the surface so the point under the cursor follows it. */
    const pan = (dx: number, dy: number) => {
      const a = target.current;
      if (a.where === "system") return orbit(dx, dy);
      const up = a.dir;
      const right = X.clone().applyQuaternion(camera.quaternion);
      right.addScaledVector(up, -right.dot(up));
      const forward = Y.clone().applyQuaternion(camera.quaternion);
      forward.addScaledVector(up, -forward.dot(up));
      if (right.lengthSq() < 0.000001 || forward.lengthSq() < 0.000001) return;
      const move = right
        .normalize()
        .multiplyScalar(-dx)
        .addScaledVector(forward.normalize(), dy);
      const pixels = move.length();
      if (pixels < 0.001) return;
      const fov = ((camera as PerspectiveCamera).fov * Math.PI) / 360;
      const perPixel = (2 * a.distance * Math.tan(fov)) / size.height;
      const angle = (pixels * perPixel) / planets[a.where].radius;
      const axis = up.clone().cross(move.normalize()).normalize();
      a.dir.applyAxisAngle(axis, angle).normalize();
    };
    /** Zoom toward the cursor; zooming in over the other planet crosses to it. */
    const zoom = (factor: number, clientX: number, clientY: number) => {
      const a = target.current;
      const rect = element.getBoundingClientRect();
      raycaster.setFromCamera(
        new Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const candidates = (["brain", "factory"] as PlanetName[])
        .map((name) => {
          const p = planets[name];
          const point = raycaster.ray.intersectSphere(
            new Sphere(p.origin, p.radius + 0.2),
            new Vector3(),
          );
          const near = raycaster.ray.closestPointToPoint(
            p.origin,
            new Vector3(),
          );
          return {
            name,
            point,
            near,
            miss: near.distanceTo(p.origin) - p.radius,
          };
        })
        .sort((u, v) => u.miss - v.miss);
      const best = candidates[0];
      if (a.where === "system") {
        const distance = clamp(a.distance * factor, 12, FARTHEST);
        if (factor < 1 && distance < 46) {
          const p = planets[best.name];
          a.where = best.name;
          a.dir = (best.point ?? best.near).clone().sub(p.origin).normalize();
          a.distance = Math.min(distance, p.radius * 2.6);
          a.pitch = 0.4;
        } else a.distance = distance;
        return;
      }
      const distance = clamp(a.distance * factor, NEAREST, FARTHEST);
      if (factor < 1 && best.point) {
        const hitDir = best.point
          .clone()
          .sub(planets[best.name].origin)
          .normalize();
        if (best.name !== a.where) {
          a.where = best.name;
          a.dir = hitDir;
        } else a.dir = slerp(a.dir, hitDir, 1 - factor);
      }
      a.distance = distance;
    };
    const down = (e: PointerEvent) => {
      pointer.moved = 0;
      if (useTown.getState().dragging) return;
      drag = {
        x: e.clientX,
        y: e.clientY,
        orbit: e.button !== 0 || e.shiftKey || e.ctrlKey,
      };
      element.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag || useTown.getState().dragging) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.orbit) orbit(dx, dy);
      else pan(dx, dy);
    };
    const up = () => {
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.0011), e.clientX, e.clientY);
    };
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const step = 70;
      const keys: Record<string, () => void> = {
        ArrowLeft: () => pan(step, 0),
        ArrowRight: () => pan(-step, 0),
        ArrowUp: () => pan(0, step),
        ArrowDown: () => pan(0, -step),
        a: () => pan(step, 0),
        d: () => pan(-step, 0),
        w: () => pan(0, step),
        s: () => pan(0, -step),
        q: () => orbit(-25, 0),
        e: () => orbit(25, 0),
        r: () => orbit(0, -25),
        f: () => orbit(0, 25),
        "+": () => zoom(0.8, size.width / 2, size.height / 2),
        "=": () => zoom(0.8, size.width / 2, size.height / 2),
        "-": () => zoom(1.25, size.width / 2, size.height / 2),
      };
      const action = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    const menu = (e: Event) => e.preventDefault();
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("contextmenu", menu);
    window.addEventListener("keydown", key);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("contextmenu", menu);
      window.removeEventListener("keydown", key);
    };
  }, [camera, gl, size]);
  useFrame((_, dt) => {
    const desired = placement(target.current),
      s = smooth.current;
    if (!s.started) {
      s.position.copy(desired.position);
      s.lookAt.copy(desired.lookAt);
      s.up.copy(desired.up);
      s.started = true;
    }
    const k = 1 - Math.exp(-dt * 10);
    s.position.lerp(desired.position, k);
    s.lookAt.lerp(desired.lookAt, k);
    s.up.lerp(desired.up, k).normalize();
    camera.position.copy(s.position);
    camera.up.copy(s.up);
    camera.lookAt(s.lookAt);
  });
  return null;
}
