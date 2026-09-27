// Scene shell: generic plates, the camera, sun and shadows, moons, stars and the renderer.
// Full resolution with MSAA is the default; the pixel-art pass is an opt-in look.
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Stars, useProgress } from "@react-three/drei";
import CameraControlsImpl from "camera-controls";
import {
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPixelatedPass } from "three/addons/postprocessing/RenderPixelatedPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Asset } from "./Assets";
import {
  BRAIN_POS,
  FACTORY_POS,
  planets,
  plateGeometry,
  surfaceOf,
  type Tile,
} from "./planet";
import { useTown, type Focus } from "./store";

export const biomeColors = [
  "#71a793",
  "#c5af84",
  "#7fabc0",
  "#8c9fca",
  "#b59fae",
  "#a6b97d",
  "#91b1bb",
  "#a49ec1",
  "#bb997c",
  "#829c9a",
];
export type PlateStyle = { color: string; height: number; lighten?: number };
/**
 * Instanced plates for one planet, in that planet's local frame.
 * @param style memoised by the caller; it runs once per tile per change
 */
export function Plates({
  tiles: set,
  style,
  onTile,
}: {
  tiles: Tile[];
  style: (tile: Tile) => PlateStyle;
  onTile?: (id: number) => void;
}) {
  const batches = useMemo(() => {
    const groups = new Map<string, Tile[]>();
    for (const t of set) {
      const arr = groups.get(t.shape) || [];
      arr.push(t);
      groups.set(t.shape, arr);
    }
    return [...groups.values()];
  }, [set]);
  return (
    <>
      {batches.map((batch, i) => (
        <PlateBatch key={i} batch={batch} style={style} onTile={onTile} />
      ))}
    </>
  );
}
function PlateBatch({
  batch,
  style,
  onTile,
}: {
  batch: Tile[];
  style: (tile: Tile) => PlateStyle;
  onTile?: (id: number) => void;
}) {
  const ref = useRef<InstancedMesh>(null!);
  const geo = useMemo(() => plateGeometry(batch[0]), [batch]);
  const material = useMemo(
    () => new MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
    [],
  );
  useEffect(() => {
    batch.forEach((tile, i) => {
      const s = style(tile);
      ref.current.setMatrixAt(
        i,
        new Matrix4().compose(
          tile.center.clone().addScaledVector(tile.normal, s.height),
          tile.quaternion,
          new Vector3(1, 1, 1),
        ),
      );
      ref.current.setColorAt(
        i,
        new Color(s.color).offsetHSL(0, 0, s.lighten || 0),
      );
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [batch, style]);
  useEffect(
    () => () => {
      geo.dispose();
      material.dispose();
    },
    [geo, material],
  );
  return (
    <instancedMesh
      ref={ref}
      args={[geo, material, batch.length]}
      castShadow
      receiveShadow
      onClick={(e) => {
        if (e.instanceId !== undefined) {
          e.stopPropagation();
          onTile?.(batch[e.instanceId].id);
        }
      }}
    />
  );
}
/** World point the camera and the pixel grid anchor to for a focus. */
export function focusAnchor(focus: Focus) {
  const planet = planets[focus.planet];
  return planet.origin.clone().add(surfaceOf(planet.tiles[focus.tile], 0.35));
}
/**
 * Draws every frame. Full resolution renders straight to the canvas with MSAA.
 * A pixel size above zero routes through the Three pixelated pass instead and
 * snaps the projection so the focused tile sits on the pixel grid.
 */
function Renderer() {
  const pixelSize = useTown((s) => s.pixelSize);
  const { gl, scene, camera, size } = useThree();
  const frame = useRef({ start: performance.now(), frames: 0 });
  const composer = useMemo(() => {
    if (!pixelSize) return null;
    const c = new EffectComposer(gl);
    c.addPass(
      new RenderPixelatedPass(pixelSize, scene, camera, {
        normalEdgeStrength: 0.25,
        depthEdgeStrength: 0.35,
      }),
    );
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera, pixelSize]);
  useEffect(() => {
    composer?.setSize(size.width, size.height);
  }, [composer, size]);
  useEffect(() => () => composer?.dispose(), [composer]);
  useFrame((_, delta) => {
    if (composer) {
      const cam = camera as PerspectiveCamera,
        step = pixelSize / gl.getPixelRatio();
      const focus = useTown.getState().focus;
      const anchor = focus ? focusAnchor(focus) : new Vector3();
      const ndc = anchor.project(camera),
        px = ((ndc.x + 1) * size.width) / 2,
        py = ((1 - ndc.y) * size.height) / 2;
      cam.setViewOffset(
        size.width,
        size.height,
        px - Math.round(px / step) * step,
        py - Math.round(py / step) * step,
        size.width,
        size.height,
      );
      composer.render(delta);
      cam.clearViewOffset();
    } else {
      gl.render(scene, camera);
    }
    const f = frame.current;
    f.frames++;
    const now = performance.now();
    if (now - f.start > 1000) {
      useTown
        .getState()
        .set({ fps: Math.round((f.frames * 1000) / (now - f.start)) });
      f.start = now;
      f.frames = 0;
    }
  }, 1);
  return null;
}
function LoadTelemetry() {
  const { active, total } = useProgress();
  const brain = useTown((s) => s.brain);
  const recorded = useRef(false);
  useEffect(() => {
    if (!active && total > 0 && brain && !recorded.current) {
      const frame = requestAnimationFrame(() => {
        useTown.setState({ loadMs: performance.now() });
        recorded.current = true;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [active, total, brain]);
  return null;
}
/**
 * Three ways to look: the whole system, one planet, or one tile. A focused
 * tile becomes the orbit centre with its own normal as up, so buildings can be
 * seen from the side and up close. Left drag orbits, wheel zooms, no panning.
 */
function Camera() {
  const dragging = useTown((s) => s.dragging),
    focus = useTown((s) => s.focus),
    view = useTown((s) => s.view);
  const ref = useRef<CameraControlsImpl>(null!);
  const { camera } = useThree();
  useEffect(() => {
    const c = ref.current;
    c.mouseButtons.right = CameraControlsImpl.ACTION.NONE;
    c.mouseButtons.middle = CameraControlsImpl.ACTION.DOLLY;
    c.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY;
    c.touches.three = CameraControlsImpl.ACTION.NONE;
  }, []);
  useEffect(() => {
    const c = ref.current;
    if (focus) {
      const planet = planets[focus.planet],
        tile = planet.tiles[focus.tile],
        target = focusAnchor(focus);
      camera.up.copy(tile.normal);
      c.updateCameraUp();
      c.minDistance = 1.2;
      c.maxDistance = 16;
      c.minPolarAngle = 0.15;
      c.maxPolarAngle = 1.35;
      // Stand off along the normal and a little toward the planet's north.
      const side = new Vector3(0, 1, 0).cross(tile.normal);
      if (side.lengthSq() < 0.01) side.set(1, 0, 0);
      const back = tile.normal.clone().cross(side.normalize()).normalize();
      const eye = target
        .clone()
        .addScaledVector(tile.normal, 3.4)
        .addScaledVector(back, 3.2);
      void c.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, true);
    } else {
      camera.up.set(0, 1, 0);
      c.updateCameraUp();
      c.minPolarAngle = 0;
      c.maxPolarAngle = Math.PI;
      const target =
          view === "brain"
            ? BRAIN_POS
            : view === "factory"
              ? FACTORY_POS
              : new Vector3(1.5, 0, 0),
        distance = view === "brain" ? 27 : view === "factory" ? 17 : 62;
      c.minDistance = view === "system" ? 20 : view === "brain" ? 11 : 7;
      c.maxDistance = 120;
      const eye = target
        .clone()
        .add(new Vector3(0.35, 0.55, 1).normalize().multiplyScalar(distance));
      void c.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, true);
    }
  }, [focus, view, camera]);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      enabled={!dragging}
      smoothTime={0.6}
      draggingSmoothTime={0.08}
      dollyToCursor={false}
      infinityDolly={false}
    />
  );
}
function Sun() {
  const ref = useRef<DirectionalLight>(null!);
  useFrame(() => {
    const date = new Date(),
      angle =
        ((date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600) /
          24) *
        Math.PI *
        2;
    ref.current.position.set(Math.cos(angle) * 34, 14, Math.sin(angle) * 34);
  });
  return (
    <directionalLight
      ref={ref}
      intensity={3}
      castShadow
      shadow-mapSize={[4096, 4096]}
      shadow-bias={-0.0003}
      shadow-normalBias={0.04}
    >
      <orthographicCamera
        attach="shadow-camera"
        args={[-26, 26, 26, -26, 8, 66]}
      />
    </directionalLight>
  );
}
const moons = [
  {
    id: "sky.moon.1",
    radius: 62,
    scale: 1.6,
    speed: 0.012,
    lift: 0.35,
    phase: 0.8,
  },
  {
    id: "sky.moon.2",
    radius: 80,
    scale: 1.2,
    speed: 0.008,
    lift: -0.25,
    phase: 2.9,
  },
  {
    id: "sky.moon.3",
    radius: 100,
    scale: 2.4,
    speed: 0.005,
    lift: 0.15,
    phase: 4.6,
  },
];
function Moons() {
  const ref = useRef<Group>(null!);
  useFrame(({ clock }) => {
    ref.current.children.forEach((moon, i) => {
      const m = moons[i],
        t = clock.elapsedTime * m.speed + m.phase;
      moon.position.set(
        Math.cos(t) * m.radius,
        Math.sin(t) * m.radius * m.lift,
        Math.sin(t) * m.radius,
      );
      moon.rotation.y = t * 4;
    });
  });
  return (
    <group ref={ref}>
      {moons.map((m) => (
        <group key={m.id}>
          <Suspense fallback={null}>
            <Asset id={m.id} scale={m.scale} shadow={false} />
          </Suspense>
        </group>
      ))}
    </group>
  );
}
export function PlanetScene({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <color attach="background" args={["#080e20"]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#b6d6f5", "#34415a", 0.9]} />
      <Sun />
      <Stars radius={130} depth={60} count={2200} factor={2.4} fade speed={0} />
      <Moons />
      <Camera />
      {children}
      <LoadTelemetry />
      <Renderer />
    </>
  );
}
export function World({ children }: { children?: React.ReactNode }) {
  return (
    <Canvas
      shadows
      camera={{ position: [22, 34, 64], fov: 42, near: 0.1, far: 400 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <PlanetScene>{children}</PlanetScene>
    </Canvas>
  );
}
