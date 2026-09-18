import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  OrbitControls,
  RoundedBox,
  Stars,
  Text,
} from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/* ============================================================
   EDUSPHERE 3D HERO
   - Futuristic education globe
   - White + cyan/blue EduSphere branding
   - Neon orbital rings
   - Floating glass cards
   - Fully rotatable with OrbitControls
============================================================ */

function CoreSphere() {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += delta * 0.08;
    mesh.current.rotation.x += delta * 0.012;
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[2.05, 6]} />
      <meshStandardMaterial
        color="#102e9d"
        emissive="#09277f"
        emissiveIntensity={0.9}
        metalness={0.62}
        roughness={0.24}
        transparent
        opacity={0.78}
      />
    </mesh>
  );
}

function WireSphere() {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.y -= delta * 0.055;
    mesh.current.rotation.z += delta * 0.012;
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[2.1, 5]} />
      <meshBasicMaterial
        color="#67dfff"
        wireframe
        transparent
        opacity={0.34}
      />
    </mesh>
  );
}

function GlobeGlow() {
  return (
    <mesh scale={1.035}>
      <sphereGeometry args={[2.05, 64, 64]} />
      <meshBasicMaterial
        color="#248dff"
        transparent
        opacity={0.045}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

function OrbitRing({
  rotation,
  radius,
  color,
  speed,
  tilt = 0,
}: {
  rotation: [number, number, number];
  radius: number;
  color: string;
  speed: number;
  tilt?: number;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * speed;
    group.current.rotation.x += delta * tilt;
  });

  return (
    <group ref={group} rotation={rotation}>
      <mesh>
        <torusGeometry args={[radius, 0.027, 16, 180]} />
        <meshBasicMaterial color={color} transparent opacity={0.72} />
      </mesh>

      {/* Bright orbit node */}
      <mesh position={[radius, 0, 0]}>
        <sphereGeometry args={[0.075, 24, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight position={[radius, 0, 0]} color={color} intensity={1.8} distance={2} />
    </group>
  );
}

function EnergyNodes() {
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 220;
    const data = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const radius = 2.25 + Math.random() * 1.55;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      data[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      data[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      data[i * 3 + 2] = radius * Math.cos(phi);
    }

    return data;
  }, []);

  useFrame((_, delta) => {
    if (!points.current) return;
    points.current.rotation.y += delta * 0.018;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#9b8cff"
        size={0.028}
        transparent
        opacity={0.72}
        sizeAttenuation
      />
    </points>
  );
}

function BrandText() {
  return (
    <group position={[0, 0.05, 2.32]}>
      <Text
        position={[-0.68, 0, 0]}
        fontSize={0.47}
        color="#ffffff"
        anchorX="right"
        anchorY="middle"
        fontWeight={800}
        outlineWidth={0.008}
        outlineColor="#ffffff"
      >
        Edu
      </Text>

      <Text
        position={[-0.58, 0, 0]}
        fontSize={0.47}
        color="#18bfff"
        anchorX="left"
        anchorY="middle"
        fontWeight={800}
        outlineWidth={0.008}
        outlineColor="#168cff"
      >
        Sphere
      </Text>
    </group>
  );
}

function GlassCard({
  position,
  title,
  subtitle,
  accent,
  icon,
}: {
  position: [number, number, number];
  title: string;
  subtitle: string;
  accent: string;
  icon: string;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.7 + position[0]) * 0.035;
  });

  return (
    <group ref={group} position={position}>
      <RoundedBox args={[3.15, 0.82, 0.075]} radius={0.16} smoothness={5}>
        <meshPhysicalMaterial
          color="#111b48"
          transparent
          opacity={0.88}
          roughness={0.28}
          metalness={0.18}
          transmission={0.05}
        />
      </RoundedBox>

      <RoundedBox
        position={[-1.17, 0, 0.055]}
        args={[0.5, 0.5, 0.04]}
        radius={0.12}
        smoothness={4}
      >
        <meshBasicMaterial color="#22226c" transparent opacity={0.95} />
      </RoundedBox>

      <Text
        position={[-1.17, 0.015, 0.085]}
        fontSize={0.27}
        color={accent}
        anchorX="center"
        anchorY="middle"
        fontWeight={700}
      >
        {icon}
      </Text>

      <Text
        position={[-0.72, 0.13, 0.09]}
        fontSize={0.19}
        color="#ffffff"
        anchorX="left"
        anchorY="middle"
        fontWeight={700}
      >
        {title}
      </Text>

      <Text
        position={[-0.72, -0.13, 0.09]}
        fontSize={0.125}
        color="#8390b5"
        anchorX="left"
        anchorY="middle"
      >
        {subtitle}
      </Text>

      <mesh position={[1.25, 0, 0.09]}>
        <sphereGeometry args={[0.045, 20, 20]} />
        <meshBasicMaterial color={accent} />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />

      <pointLight position={[4, 4, 5]} intensity={12} color="#5467ff" />
      <pointLight position={[-4, -2, 4]} intensity={10} color="#27dfff" />
      <pointLight position={[0, 0, 3]} intensity={4} color="#725cff" />

      <Stars
        radius={22}
        depth={12}
        count={1000}
        factor={2.2}
        saturation={0}
        fade
        speed={0.3}
      />

      <Float speed={1.05} rotationIntensity={0.04} floatIntensity={0.18}>
        <CoreSphere />
        <WireSphere />
        <GlobeGlow />
        <EnergyNodes />
        <BrandText />

        <OrbitRing
          rotation={[0.42, 0.1, 0]}
          radius={2.72}
          color="#8b5cff"
          speed={0.13}
        />

        <OrbitRing
          rotation={[-0.72, 0.2, 0.32]}
          radius={3.0}
          color="#42e7ff"
          speed={-0.09}
        />

        <OrbitRing
          rotation={[1.05, -0.18, 0.5]}
          radius={3.28}
          color="#aa7cff"
          speed={0.06}
        />

        <GlassCard
          position={[-3.65, 1.7, -0.2]}
          title="Courses"
          subtitle="Academic learning"
          accent="#8d7cff"
          icon="▢"
        />

        <GlassCard
          position={[3.6, 0.55, -0.15]}
          title="AI Assistant"
          subtitle="Smart academic help"
          accent="#c18cff"
          icon="✦"
        />

        <GlassCard
          position={[-3.15, -2.05, -0.1]}
          title="Timetable"
          subtitle="Stay organized"
          accent="#55e7ff"
          icon="▦"
        />
      </Float>

      <OrbitControls
        enableZoom
        enablePan={false}
        enableDamping
        dampingFactor={0.055}
        rotateSpeed={0.55}
        zoomSpeed={0.65}
        minDistance={6}
        maxDistance={11}
        minPolarAngle={Math.PI / 2.9}
        maxPolarAngle={Math.PI / 1.55}
      />
    </>
  );
}

export default function EduSphere3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8.2], fov: 43 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <Scene />
    </Canvas>
  );
}
