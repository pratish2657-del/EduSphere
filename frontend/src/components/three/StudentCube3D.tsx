import { useRef } from "react";

import {
  Canvas,
  useFrame,
} from "@react-three/fiber";

import {
  Float,
  OrbitControls,
} from "@react-three/drei";

import * as THREE from "three";

function Cube() {
  const cube = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!cube.current) return;

    cube.current.rotation.x += delta * 0.18;
    cube.current.rotation.y += delta * 0.32;
    cube.current.rotation.z += delta * 0.08;
  });

  return (
    <group ref={cube}>

      {/* Main glass cube */}

      <mesh>

        <boxGeometry args={[2.35, 2.35, 2.35]} />

        <meshPhysicalMaterial
          color="#5546c9"
          metalness={0.65}
          roughness={0.18}
          transmission={0.18}
          transparent
          opacity={0.72}
          clearcoat={1}
          clearcoatRoughness={0.12}
          emissive="#20186b"
          emissiveIntensity={0.45}
        />

      </mesh>

      {/* Outer wireframe */}

      <mesh scale={[1.015, 1.015, 1.015]}>

        <boxGeometry args={[2.35, 2.35, 2.35]} />

        <meshBasicMaterial
          color="#9b8cff"
          wireframe
          transparent
          opacity={0.75}
        />

      </mesh>

      {/* Inner cube */}

      <mesh scale={[0.72, 0.72, 0.72]}>

        <boxGeometry args={[2.35, 2.35, 2.35]} />

        <meshBasicMaterial
          color="#7b68ff"
          wireframe
          transparent
          opacity={0.18}
        />

      </mesh>

      {/* Center core */}

      <mesh scale={[0.18, 0.18, 0.18]}>

        <octahedronGeometry args={[1, 2]} />

        <meshStandardMaterial
          color="#d8d2ff"
          emissive="#8d7cff"
          emissiveIntensity={3}
          metalness={0.2}
          roughness={0.15}
        />

      </mesh>

      {/* Edge points */}

      {[
        [-1.18, -1.18, -1.18],
        [-1.18, -1.18, 1.18],
        [-1.18, 1.18, -1.18],
        [-1.18, 1.18, 1.18],
        [1.18, -1.18, -1.18],
        [1.18, -1.18, 1.18],
        [1.18, 1.18, -1.18],
        [1.18, 1.18, 1.18],
      ].map((position, index) => (
        <mesh
          key={index}
          position={
            position as [
              number,
              number,
              number,
            ]
          }
        >

          <sphereGeometry args={[0.055, 12, 12]} />

          <meshBasicMaterial
            color="#65ddff"
          />

        </mesh>
      ))}

    </group>
  );
}

function OrbitRing({
  rotation,
  radius,
  color,
  speed,
}: {
  rotation: [
    number,
    number,
    number,
  ];
  radius: number;
  color: string;
  speed: number;
}) {
  const ring = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ring.current) return;

    ring.current.rotation.z +=
      delta * speed;
  });

  return (
    <mesh
      ref={ring}
      rotation={rotation}
    >

      <torusGeometry
        args={[
          radius,
          0.012,
          12,
          160,
        ]}
      />

      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.65}
      />

    </mesh>
  );
}

function Scene() {
  return (
    <>

      {/* Lighting */}

      <ambientLight intensity={0.35} />

      <pointLight
        position={[4, 4, 5]}
        intensity={9}
        color="#7062ff"
      />

      <pointLight
        position={[-4, -2, 3]}
        intensity={7}
        color="#43dfff"
      />

      <pointLight
        position={[0, 0, -4]}
        intensity={4}
        color="#806fff"
      />

      {/* Cube */}

      <Float
        speed={1.15}
        rotationIntensity={0.08}
        floatIntensity={0.35}
      >

        <Cube />

        {/* Orbiting rings */}

        <OrbitRing
          rotation={[
            0.65,
            0.2,
            0.2,
          ]}
          radius={2.05}
          color="#796aff"
          speed={0.22}
        />

        <OrbitRing
          rotation={[
            -0.75,
            0.25,
            0.45,
          ]}
          radius={2.35}
          color="#48dcff"
          speed={-0.15}
        />

        <OrbitRing
          rotation={[
            1.05,
            -0.25,
            0.35,
          ]}
          radius={2.65}
          color="#9a89ff"
          speed={0.09}
        />

      </Float>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
      />

    </>
  );
}

export default function StudentCube3D() {
  return (
    <Canvas
      camera={{
        position: [
          0,
          0,
          7,
        ],
        fov: 40,
      }}
      dpr={[1, 2]}
    >

      <Scene />

    </Canvas>
  );
}