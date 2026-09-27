import {
  BufferGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
export const RADIUS = 9;
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

/** Dual of a frequency-n geodesic icosahedron. No external geometry dependency. */
export function goldberg(n = 10): Tile[] {
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
      .multiplyScalar(RADIUS);
    for (const id of face) {
      corners[id].push(corner);
      for (const other of face) if (other !== id) adj[id].add(other);
    }
  }
  return points.map((normal, id) => {
    const center = normal.clone().multiplyScalar(RADIUS),
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
export const tiles = goldberg();
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
export function nearestTile(point: Vector3) {
  const n = point.clone().normalize();
  let best = tiles[0],
    dot = -2;
  for (const tile of tiles) {
    const d = tile.normal.dot(n);
    if (d > dot) {
      dot = d;
      best = tile;
    }
  }
  return best;
}
