// Goldberg planets: tile geometry for the knowledge planet and the factory, and
// the frame helpers shared by everything that stands on, or travels over, a tile.
import {
  BufferGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
export const RADIUS = 9;
export const FACTORY_RADIUS = 5.5;
/** World positions of the two planets. The system origin sits between them. */
export const BRAIN_POS = new Vector3(-14, 0, 0);
export const FACTORY_POS = new Vector3(17, 0, 0);
export type Tile = {
  id: number;
  center: Vector3;
  normal: Vector3;
  boundary: Vector3[];
  neighbors: number[];
  quaternion: Quaternion;
  shape: string;
  local: Vector3[];
};

/**
 * Dual of a frequency-n geodesic icosahedron. No external geometry dependency.
 * @param n subdivision frequency; the result has 10n² + 2 tiles
 * @param radius distance of tile centres from the planet centre
 */
export function goldberg(n = 10, radius = RADIUS): Tile[] {
  const base = new IcosahedronGeometry(1, 0).getAttribute("position");
  const points: Vector3[] = [],
    faces: number[][] = [],
    lookup = new Map<string, number>();
  function vertex(v: Vector3) {
    v.normalize();
    const key = v
      .toArray()
      .map((x) => x.toFixed(7))
      .join(",");
    let id = lookup.get(key);
    if (id === undefined) {
      id = points.length;
      points.push(v);
      lookup.set(key, id);
    }
    return id;
  }
  for (let f = 0; f < base.count; f += 3) {
    const a = new Vector3().fromBufferAttribute(base, f),
      b = new Vector3().fromBufferAttribute(base, f + 1),
      c = new Vector3().fromBufferAttribute(base, f + 2);
    const grid = new Map<string, number>();
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n - i; j++)
        grid.set(
          `${i},${j}`,
          vertex(
            a
              .clone()
              .multiplyScalar(1 - (i + j) / n)
              .addScaledVector(b, i / n)
              .addScaledVector(c, j / n),
          ),
        );
    const at = (i: number, j: number) => grid.get(`${i},${j}`)!;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n - i; j++) {
        faces.push([at(i, j), at(i + 1, j), at(i, j + 1)]);
        if (i + j < n - 1)
          faces.push([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
      }
  }
  const corners: Vector3[][] = points.map(() => []),
    adj = points.map(() => new Set<number>());
  for (const face of faces) {
    const corner = face
      .reduce((v, id) => v.add(points[id]), new Vector3())
      .normalize()
      .multiplyScalar(radius);
    for (const id of face) {
      corners[id].push(corner);
      for (const other of face) if (other !== id) adj[id].add(other);
    }
  }
  return points.map((normal, id) => {
    const center = normal.clone().multiplyScalar(radius),
      x = new Vector3(0, 1, 0).cross(normal).normalize();
    if (x.lengthSq() < 0.1) x.set(1, 0, 0);
    const z = x.clone().cross(normal);
    const boundary = corners[id].sort(
      (a, b) => Math.atan2(a.dot(z), a.dot(x)) - Math.atan2(b.dot(z), b.dot(x)),
    );
    let shape = "",
      local: Vector3[] = [],
      quaternion = new Quaternion();
    // Canonical rotational frame allows exact irregular plates to share instanced geometry.
    for (let start = 0; start < boundary.length; start++) {
      const axis = boundary[start].clone().sub(center);
      axis.addScaledVector(normal, -axis.dot(normal)).normalize();
      const cross = axis.clone().cross(normal),
        basis = new Matrix4().makeBasis(axis, normal, cross);
      const candidate = boundary
        .map((_, i) =>
          boundary[(start + i) % boundary.length].clone().sub(center),
        )
        .map((v) => new Vector3(v.dot(axis), v.dot(normal), v.dot(cross)));
      const key = candidate
        .flatMap((v) => v.toArray().map((a) => a.toFixed(4)))
        .join(",");
      if (!shape || key < shape) {
        shape = key;
        local = candidate;
        quaternion.setFromRotationMatrix(basis);
      }
    }
    return {
      id,
      center,
      normal,
      boundary,
      neighbors: [...adj[id]].sort((a, b) => a - b),
      shape,
      local,
      quaternion,
    };
  });
}
/** The knowledge planet: 1,002 tiles. */
export const tiles = goldberg(10, RADIUS);
/** The factory: 362 tiles, a smaller industrial world. */
export const factoryTiles = goldberg(6, FACTORY_RADIUS);
export function plateGeometry(tile: Tile) {
  const positions: number[] = [];
  const top = tile.local.map(
      (p) => new Vector3(p.x * 0.96, p.y + 0.08, p.z * 0.96),
    ),
    bottom = top.map((p) => p.clone().add(new Vector3(0, -0.24, 0)));
  const tri = (a: Vector3, b: Vector3, c: Vector3) =>
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    tri(new Vector3(0, 0.08, 0), top[j], top[i]);
    tri(top[i], top[j], bottom[j]);
    tri(top[i], bottom[j], bottom[i]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
/** Tile of a planet whose centre direction is closest to a local-frame point. */
export function nearestTile(point: Vector3, set: Tile[] = tiles) {
  const n = point.clone().normalize();
  let best = set[0],
    dot = -2;
  for (const tile of set) {
    const d = tile.normal.dot(n);
    if (d > dot) {
      dot = d;
      best = tile;
    }
  }
  return best;
}
/** Breadth-first route over neighbouring tiles, inclusive of both ends. */
export function tilePath(start: number, end: number, set: Tile[] = tiles) {
  const queue = [start],
    previous = new Map<number, number | null>([[start, null]]);
  for (let i = 0; i < queue.length && !previous.has(end); i++)
    for (const n of set[queue[i]].neighbors)
      if (!previous.has(n)) {
        previous.set(n, queue[i]);
        queue.push(n);
      }
  const path: number[] = [];
  let next: number | null = end;
  while (next !== null) {
    path.unshift(next);
    next = previous.get(next) ?? null;
  }
  return path;
}
/**
 * Closed loop of tile ids that follows the great circle around an axis, with
 * every tile adjacent to the next so belts and walkers can follow it.
 */
export function ring(set: Tile[], axis: Vector3, samples = 200) {
  const a = axis.clone().normalize(),
    u = new Vector3(0, 1, 0).cross(a);
  if (u.lengthSq() < 0.01) u.set(1, 0, 0);
  u.normalize();
  const v = a.clone().cross(u);
  const coarse: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const id = nearestTile(
      u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t)),
      set,
    ).id;
    if (id !== coarse[coarse.length - 1] && id !== coarse[0]) coarse.push(id);
  }
  const loop: number[] = [];
  for (let i = 0; i < coarse.length; i++) {
    const from = coarse[i],
      to = coarse[(i + 1) % coarse.length];
    const leg = set[from].neighbors.includes(to)
      ? [from]
      : tilePath(from, to, set).slice(0, -1);
    for (const id of leg) if (!loop.includes(id)) loop.push(id);
  }
  return loop;
}
const up = new Vector3(0, 1, 0);
/** Point above a tile in its planet's local frame. */
export function surfaceOf(tile: Tile, height = 0.18) {
  return tile.center.clone().addScaledVector(tile.normal, height);
}
export function surface(tile: number, height = 0.18) {
  return surfaceOf(tiles[tile], height);
}
/** Rotation that stands a model up on a tile. */
export function orientationOf(tile: Tile) {
  return new Quaternion().setFromUnitVectors(up, tile.normal);
}
export function orientation(tile: number) {
  return orientationOf(tiles[tile]);
}
/** Orientation on a tile with an extra turn (radians) about the tile normal. */
export function turnedOf(tile: Tile, angle: number) {
  return orientationOf(tile).multiply(
    new Quaternion().setFromAxisAngle(up, angle),
  );
}
export function turned(tile: number, angle: number) {
  return turnedOf(tiles[tile], angle);
}
/** Orientation on a tile whose local +Z axis points at another tile of the same planet. */
export function facingOf(tile: Tile, toward: Tile) {
  const q = orientationOf(tile);
  const dir = toward.center
    .clone()
    .sub(tile.center)
    .applyQuaternion(q.clone().invert());
  return q.multiply(
    new Quaternion().setFromAxisAngle(up, Math.atan2(dir.x, dir.z)),
  );
}
export type PlanetName = "brain" | "factory";
/** Everything a component needs to work in one planet's local frame. */
export const planets: Record<
  PlanetName,
  { tiles: Tile[]; origin: Vector3; radius: number }
> = {
  brain: { tiles, origin: BRAIN_POS, radius: RADIUS },
  factory: { tiles: factoryTiles, origin: FACTORY_POS, radius: FACTORY_RADIUS },
};
/** Frame for a full hex tile model (Kenney kit) so its corners match the plate. */
export function hexAligned(tile: number) {
  return tiles[tile].quaternion
    .clone()
    .multiply(new Quaternion().setFromAxisAngle(up, Math.PI / 2));
}
/** Unit direction along the great circle from a to b at fraction t. */
export function slerpNormal(a: Vector3, b: Vector3, t: number) {
  const angle = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
  return Math.sin(angle) < 0.0001
    ? a.clone().lerp(b, t).normalize()
    : a
        .clone()
        .multiplyScalar(Math.sin((1 - t) * angle) / Math.sin(angle))
        .addScaledVector(b, Math.sin(t * angle) / Math.sin(angle))
        .normalize();
}
/**
 * Rotation for a piece lying on the surface at normal n that travels along
 * tangent. Kenney rails run along their local Z, conveyors along local X.
 */
export function travelFrame(n: Vector3, tangent: Vector3, along: "x" | "z") {
  const right = n.clone().cross(tangent).normalize(),
    forward = right.clone().cross(n).normalize();
  const basis =
    along === "z"
      ? new Matrix4().makeBasis(right, n, forward)
      : new Matrix4().makeBasis(forward, n, right.clone().negate());
  return new Quaternion().setFromRotationMatrix(basis);
}
