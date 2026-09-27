// Draws the space tunnel: a glass tube with light rings, pulses running toward
// the factory, glowing mouths at both gates, and the knowledge packages in transit.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  DoubleSide,
  InstancedMesh,
  Object3D,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";
import { eventTransfers } from "./behavior";
import type { Layout } from "./layout";
import { BRAIN_POS, FACTORY_POS, surface, surfaceOf } from "./planet";
import { useTown } from "./store";
import {
  brainMouth,
  factoryGate,
  factoryMouth,
  factoryState,
  packagePose,
  packages,
  sendPackage,
  tunnel,
} from "./transit";
const RINGS = 11,
  PULSES = 10,
  MAX_PACKAGES = 64,
  BURST = 12;
const forward = new Vector3(0, 0, 1);
export function Tunnel({ layout }: { layout: Layout }) {
  const tube = useMemo(() => new TubeGeometry(tunnel, 72, 0.55, 14, false), []);
  const rings = useRef<InstancedMesh>(null!),
    pulses = useRef<InstancedMesh>(null!),
    boxes = useRef<InstancedMesh>(null!);
  const dummy = useMemo(() => new Object3D(), []);
  const seen = useRef(new Set<string>());
  const events = useTown((s) => s.events);
  useEffect(() => {
    for (const event of events) {
      const key =
        event.sequence ||
        `${event.timestamp}:${event.kind}:${event.ids.join(",")}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      for (const transfer of eventTransfers(event)) {
        const ids = transfer.ids
          .filter((id) => (layout.positions.get(id) ?? -1) >= 0)
          .slice(0, BURST);
        const scanner = FACTORY_POS.clone().add(surfaceOf(factoryGate, 0.6));
        ids.forEach((id, i) => {
          const building = BRAIN_POS.clone().add(
            surface(layout.positions.get(id)!, 0.45),
          );
          if (transfer.to === "factory")
            sendPackage("factory", building, scanner, i * 260);
          else sendPackage("brain", scanner, building, i * 260);
        });
        if (ids.length) {
          const places = `${ids.length} place${ids.length > 1 ? "s" : ""}`;
          useTown.setState({
            activity:
              transfer.to === "factory"
                ? `Downloading ${places} into the factory`
                : `Shipping output back to ${places}`,
          });
        }
      }
    }
    if (seen.current.size > 1024)
      seen.current = new Set([...seen.current].slice(-512));
  }, [events, layout]);
  useEffect(() => {
    for (let i = 0; i < RINGS; i++) {
      const u = (i + 0.5) / RINGS;
      tunnel.getPointAt(u, dummy.position);
      dummy.quaternion.setFromUnitVectors(forward, tunnel.getTangentAt(u));
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      rings.current.setMatrixAt(i, dummy.matrix);
    }
    rings.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);
  const pose = useMemo(() => ({ position: new Vector3(), scale: 1 }), []);
  useFrame(({ clock }) => {
    const now = performance.now();
    for (let i = 0; i < PULSES; i++) {
      const u = (clock.elapsedTime * 0.12 + i / PULSES) % 1;
      tunnel.getPointAt(u, dummy.position);
      dummy.quaternion.identity();
      dummy.scale.setScalar(0.6 + 0.4 * Math.sin(u * Math.PI));
      dummy.updateMatrix();
      pulses.current.setMatrixAt(i, dummy.matrix);
    }
    pulses.current.instanceMatrix.needsUpdate = true;
    for (let i = packages.length - 1; i >= 0; i--) {
      const p = packages[i];
      if (!packagePose(p, now, pose)) {
        packages.splice(i, 1);
        if (p.to === "factory") {
          factoryState.busyUntil = now + 4500;
          factoryState.downloads++;
        }
      }
    }
    for (let i = 0; i < MAX_PACKAGES; i++) {
      const p = packages[i];
      if (p && packagePose(p, now, pose)) {
        dummy.position.copy(pose.position);
        dummy.scale.setScalar(pose.scale * 0.3);
        dummy.rotation.set(now / 900, now / 700, 0);
        dummy.updateMatrix();
        boxes.current.setMatrixAt(i, dummy.matrix);
        boxes.current.setColorAt(i, p.color);
      } else {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        boxes.current.setMatrixAt(i, dummy.matrix);
      }
    }
    boxes.current.instanceMatrix.needsUpdate = true;
    if (boxes.current.instanceColor)
      boxes.current.instanceColor.needsUpdate = true;
  });
  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial
          color="#5fb7ff"
          emissive="#1f6fd0"
          emissiveIntensity={0.35}
          transparent
          opacity={0.2}
          depthWrite={false}
          side={DoubleSide}
          roughness={0.2}
        />
      </mesh>
      <instancedMesh ref={rings} args={[undefined, undefined, RINGS]}>
        <torusGeometry args={[0.66, 0.045, 8, 28]} />
        <meshStandardMaterial
          color="#9fd6ff"
          emissive="#4fb3ff"
          emissiveIntensity={1.2}
        />
      </instancedMesh>
      <instancedMesh ref={pulses} args={[undefined, undefined, PULSES]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshBasicMaterial color="#c9ecff" />
      </instancedMesh>
      <instancedMesh
        ref={boxes}
        args={[undefined, undefined, MAX_PACKAGES]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.3}
        />
      </instancedMesh>
      <Mouth at={brainMouth} tangent={tunnel.getTangentAt(0)} />
      <Mouth at={factoryMouth} tangent={tunnel.getTangentAt(1).negate()} />
    </group>
  );
}
/** Glowing ring and a short glass throat where the tunnel meets a planet. */
function Mouth({ at, tangent }: { at: Vector3; tangent: Vector3 }) {
  const q = useMemo(
    () => new Quaternion().setFromUnitVectors(forward, tangent),
    [tangent],
  );
  return (
    <group position={at} quaternion={q}>
      <mesh>
        <torusGeometry args={[0.74, 0.09, 10, 32]} />
        <meshStandardMaterial
          color="#d7ecff"
          emissive="#62c4ff"
          emissiveIntensity={1.6}
        />
      </mesh>
      <mesh position={[0, 0, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.62, 0.7, 1.1, 20, 1, true]} />
        <meshStandardMaterial
          color="#8fd0ff"
          transparent
          opacity={0.22}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
