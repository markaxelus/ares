// The space tunnel between the planets and the knowledge packages that ride it.
// Pure state and math; Tunnel.tsx draws it and Robots.tsx rides it.
import { Color, QuadraticBezierCurve3, Vector3 } from "three";
import {
  BRAIN_POS,
  FACTORY_POS,
  factoryTiles,
  nearestTile,
  surfaceOf,
  tiles,
} from "./planet";
/** Gate tiles face the other planet. Geometry fixes them; the brain never moves them. */
export const brainGate = nearestTile(FACTORY_POS.clone().sub(BRAIN_POS), tiles);
export const factoryGate = nearestTile(
  BRAIN_POS.clone().sub(FACTORY_POS),
  factoryTiles,
);
/** Tunnel mouths hover above each gate, in world space. */
export const brainMouth = BRAIN_POS.clone().add(surfaceOf(brainGate, 1.2));
export const factoryMouth = FACTORY_POS.clone().add(
  surfaceOf(factoryGate, 1.2),
);
export const tunnel = new QuadraticBezierCurve3(
  brainMouth,
  brainMouth
    .clone()
    .lerp(factoryMouth, 0.5)
    .add(new Vector3(0, 4.5, 0)),
  factoryMouth,
);
export const RIDE_SECONDS = 2.6;
export type Package = {
  start: number;
  to: "factory" | "brain";
  from: Vector3;
  target: Vector3;
  color: Color;
};
/** Packages in flight. Tunnel.tsx drains the ones that have landed. */
export const packages: Package[] = [];
/** The factory keeps working for a few seconds after every download. */
export const factoryState = { busyUntil: 0, downloads: 0 };
/**
 * Queue a knowledge package.
 * @param to which planet receives it
 * @param from world position it rises from
 * @param target world position it lands on
 * @param delayMs stagger so a burst of reads becomes a stream
 */
export function sendPackage(
  to: Package["to"],
  from: Vector3,
  target: Vector3,
  delayMs = 0,
  color = to === "factory" ? "#8fd8ff" : "#ffd27a",
) {
  packages.push({
    start: performance.now() + delayMs,
    to,
    from: from.clone(),
    target: target.clone(),
    color: new Color(color),
  });
}
const LIFT = 0.7,
  HOP = 0.9,
  DROP = 0.6;
export const PACKAGE_SECONDS = LIFT + HOP + RIDE_SECONDS + HOP + DROP;
const ease = (x: number) => x * x * (3 - 2 * x);
/**
 * Writes where a package is at a moment: up from its building, over to the
 * mouth, through the tunnel, over to the far gate, down onto the target.
 * Returns false once it has landed.
 */
export function packagePose(
  p: Package,
  now: number,
  out: { position: Vector3; scale: number },
) {
  const t = (now - p.start) / 1000;
  if (t < 0) {
    out.scale = 0;
    return true;
  }
  const origin = p.to === "factory" ? BRAIN_POS : FACTORY_POS,
    destination = p.to === "factory" ? FACTORY_POS : BRAIN_POS,
    entry = p.to === "factory" ? brainMouth : factoryMouth,
    exit = p.to === "factory" ? factoryMouth : brainMouth;
  const lift = p.from
    .clone()
    .sub(origin)
    .normalize()
    .multiplyScalar(2)
    .add(p.from);
  const land = p.target
    .clone()
    .sub(destination)
    .normalize()
    .multiplyScalar(1.4)
    .add(p.target);
  let u = t;
  if (u < LIFT) {
    out.position.lerpVectors(p.from, lift, ease(u / LIFT));
    out.scale = Math.min(1, u / 0.25);
    return true;
  }
  if ((u -= LIFT) < HOP) {
    out.position.lerpVectors(lift, entry, ease(u / HOP));
    out.scale = 1;
    return true;
  }
  if ((u -= HOP) < RIDE_SECONDS) {
    const s = u / RIDE_SECONDS;
    tunnel.getPointAt(p.to === "factory" ? s : 1 - s, out.position);
    out.scale = 1;
    return true;
  }
  if ((u -= RIDE_SECONDS) < HOP) {
    out.position.lerpVectors(exit, land, ease(u / HOP));
    out.scale = 1;
    return true;
  }
  if ((u -= HOP) < DROP) {
    out.position.lerpVectors(land, p.target, u / DROP);
    out.scale = 1 - u / DROP;
    return true;
  }
  return false;
}
