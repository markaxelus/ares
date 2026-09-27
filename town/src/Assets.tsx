// Manifest lookup, single GLB assets, and instanced batches with drag-to-move.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, type ThreeEvent } from "@react-three/fiber";
import {
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Sphere,
  Vector3,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import manifest from "../assets/manifest.json";
import { nearestTile, RADIUS } from "./planet";
import { moveBuilding, useTown } from "./store";
import { layoutBrain } from "./layout";
export const assets = new Map(manifest.entries.map((e) => [e.id, e]));
export type Placement = {
  key: string;
  asset: string;
  position: Vector3;
  quaternion?: Quaternion;
  scale?: number;
  nodeId?: string;
  dim?: boolean;
  label?: string;
};
/** One placed GLB. Orbiting bodies pass shadow false so they never darken the ground. */
export function Asset({
  id,
  scale = 1,
  shadow = true,
}: {
  id: string;
  scale?: number;
  shadow?: boolean;
}) {
  const entry = assets.get(id)!;
  const gltf = useLoader(GLTFLoader, `/town/${entry.file}`, (loader) =>
    loader.setMeshoptDecoder(MeshoptDecoder),
  );
  const clone = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse((o) => {
      o.castShadow = shadow;
      o.receiveShadow = shadow;
    });
    return c;
  }, [gltf, shadow]);
  return (
    <group scale={scale}>
      <group position={[0, entry.yOffset, 0]} scale={entry.scale}>
        <primitive object={clone} />
      </group>
    </group>
  );
}
export function AssetBatches({ placements }: { placements: Placement[] }) {
  const batches = useMemo(() => {
    const map = new Map<string, Placement[]>();
    for (const p of placements) {
      const values = map.get(p.asset) || [];
      values.push(p);
      map.set(p.asset, values);
    }
    return [...map];
  }, [placements]);
  return (
    <>
      {batches.map(([id, items]) => (
        <AssetBatch key={id} id={id} items={items} />
      ))}
    </>
  );
}
function AssetBatch({ id, items }: { id: string; items: Placement[] }) {
  const entry = assets.get(id)!;
  const gltf = useLoader(GLTFLoader, `/town/${entry.file}`, (loader) =>
    loader.setMeshoptDecoder(MeshoptDecoder),
  );
  const meshes = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const parts: Mesh[] = [];
    gltf.scene.traverse((o) => {
      if ((o as Mesh).isMesh) parts.push(o as Mesh);
    });
    return parts;
  }, [gltf]);
  return (
    <>
      {meshes.map((mesh, i) => (
        <Part key={i} mesh={mesh} entry={entry} items={items} />
      ))}
    </>
  );
}
function Part({
  mesh,
  entry,
  items,
}: {
  mesh: Mesh;
  entry: (typeof manifest.entries)[number];
  items: Placement[];
}) {
  const ref = useRef<InstancedMesh>(null!);
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);
  const matrices = useMemo(
    () =>
      items.map((p) =>
        new Matrix4()
          .compose(
            p.position,
            p.quaternion || new Quaternion(),
            new Vector3().setScalar(p.scale || 1),
          )
          .multiply(new Matrix4().makeTranslation(0, entry.yOffset, 0))
          .multiply(
            new Matrix4().makeScale(entry.scale, entry.scale, entry.scale),
          )
          .multiply(mesh.matrixWorld),
      ),
    [items, entry, mesh],
  );
  useEffect(() => {
    matrices.forEach((m, i) => {
      ref.current.setMatrixAt(i, m);
      ref.current.setColorAt(
        i,
        new Color(items[i].dim ? "#8b9c83" : "#ffffff"),
      );
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [matrices, items]);
  const temp = useMemo(() => new Matrix4(), []),
    shift = useMemo(() => new Matrix4(), []);
  const colors = useMemo(
    () => items.map((p) => new Color(p.dim ? "#8b9c83" : "#ffffff")),
    [items],
  );
  const glow = useMemo(() => new Color("#91dcff").multiplyScalar(2.5), []);
  useFrame(() => {
    const now = performance.now(),
      state = useTown.getState();
    let dirty = false;
    items.forEach((p, i) => {
      if (!p.nodeId) return;
      const rise = state.builds[p.nodeId];
      const lit = state.illuminated[p.nodeId] > now;
      if (rise !== undefined) {
        const progress = Math.max(0, Math.min(1, (now - rise) / 1700)),
          offset = (1 - progress) * 1.8;
        temp.copy(matrices[i]);
        shift.makeTranslation(
          (-p.position.x / RADIUS) * offset,
          (-p.position.y / RADIUS) * offset,
          (-p.position.z / RADIUS) * offset,
        );
        ref.current.setMatrixAt(i, temp.premultiply(shift));
        dirty = true;
      }
      ref.current.setColorAt(i, lit ? glow : colors[i]);
    });
    if (dirty) ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  const down = (e: ThreeEvent<PointerEvent>) => {
    const p = items[e.instanceId!];
    if (!p?.nodeId) return;
    e.stopPropagation();
    drag.current = { id: p.nodeId, x: e.clientX, y: e.clientY };
    useTown.setState({ dragging: p.nodeId });
    (
      e.target as unknown as { setPointerCapture: (id: number) => void }
    ).setPointerCapture(e.pointerId);
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    const d = drag.current;
    drag.current = null;
    useTown.setState({ dragging: null });
    (
      e.target as unknown as { releasePointerCapture: (id: number) => void }
    ).releasePointerCapture(e.pointerId);
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) {
      const tile = nearestTile(items.find((p) => p.nodeId === d.id)!.position);
      useTown.setState({ selected: d.id, focus: tile.id });
      return;
    }
    const hit = e.ray.intersectSphere(
      new Sphere(new Vector3(), RADIUS + 0.15),
      new Vector3(),
    );
    if (hit) {
      const tile = nearestTile(hit);
      if (tile.neighbors.length === 5) {
        useTown.setState({ error: "Pentagons stay ocean. Choose a hex tile." });
        return;
      }
      const brain = useTown.getState().brain;
      if (
        brain &&
        [...layoutBrain(brain).positions].some(
          ([id, t]) => id !== d.id && t === tile.id,
        )
      ) {
        useTown.setState({
          error: "That tile already has a building. Choose an empty tile.",
        });
        return;
      }
      void moveBuilding(d.id, tile.id);
    }
  };
  return (
    <instancedMesh
      ref={ref}
      args={[mesh.geometry, mesh.material, items.length]}
      castShadow
      receiveShadow
      onPointerDown={down}
      onPointerUp={up}
      onPointerOver={(e) => {
        const item = items[e.instanceId!];
        if (item?.label) {
          e.stopPropagation();
          useTown.setState({ hover: item.label });
        }
        const id = item?.nodeId;
        if (id) {
          e.stopPropagation();
          useTown.setState({
            hover:
              useTown.getState().brain?.nodes.find((n) => n.id === id)?.title ||
              null,
          });
        }
      }}
      onPointerOut={() => useTown.setState({ hover: null })}
    />
  );
}
