import {
  Canvas,
  useFrame,
} from "@react-three/fiber";

import {
  Float,
  OrbitControls,
  Stars,
  Text,
} from "@react-three/drei";

import {
  useRef,
} from "react";

import * as THREE from "three";

function CoreSphere() {
  const mesh =
    useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y +=
        delta * 0.12;

      mesh.current.rotation.x +=
        delta * 0.025;
    }
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry
        args={[2.15, 6]}
      />

      <meshStandardMaterial
        color="#2636c9"
        emissive="#1824a8"
        emissiveIntensity={0.7}
        metalness={0.55}
        roughness={0.28}
        transparent
        opacity={0.94}
        wireframe={false}
      />
    </mesh>
  );
}

function WireSphere() {
  const mesh =
    useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y -=
        delta * 0.08;
    }
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry
        args={[2.22, 4]}
      />

      <meshBasicMaterial
        color="#65d9ff"
        wireframe
        transparent
        opacity={0.16}
      />
    </mesh>
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
  const group =
    useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.z +=
        delta * speed;
    }
  });

  return (
    <group
      ref={group}
      rotation={rotation}
    >
      <mesh>
        <torusGeometry
          args={[
            radius,
            0.025,
            16,
            160,
          ]}
        />

        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

function EnergyParticles() {
  const points =
    useRef<THREE.Points>(null);

  const count = 180;

  const positions =
    new Float32Array(
      count * 3,
    );

  for (
    let i = 0;
    i < count;
    i++
  ) {
    const radius =
      2.7 +
      Math.random() * 1.5;

    const theta =
      Math.random() *
      Math.PI *
      2;

    const phi =
      Math.acos(
        2 * Math.random() - 1,
      );

    positions[i * 3] =
      radius *
      Math.sin(phi) *
      Math.cos(theta);

    positions[i * 3 + 1] =
      radius *
      Math.sin(phi) *
      Math.sin(theta);

    positions[i * 3 + 2] =
      radius *
      Math.cos(phi);
  }

  useFrame((_, delta) => {
    if (points.current) {
      points.current.rotation.y +=
        delta * 0.025;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            positions,
            3,
          ]}
        />
      </bufferGeometry>

      <pointsMaterial
        color="#8d7cff"
        size={0.035}
        transparent
        opacity={0.8}
      />
    </points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight
        intensity={0.45}
      />

      <pointLight
        position={[4, 3, 5]}
        intensity={12}
        color="#686cff"
      />

      <pointLight
        position={[-4, -2, 3]}
        intensity={8}
        color="#41dfff"
      />

      <Stars
        radius={20}
        depth={10}
        count={700}
        factor={2}
        saturation={0}
        fade
        speed={0.4}
      />

      <Float
        speed={1.3}
        rotationIntensity={0.12}
        floatIntensity={0.3}
      >
        <CoreSphere />
        <WireSphere />

        <OrbitRing
          rotation={[
            0.35,
            0.15,
            0,
          ]}
          radius={2.75}
          color="#7b68ff"
          speed={0.18}
        />

        <OrbitRing
          rotation={[
            -0.7,
            0.25,
            0.4,
          ]}
          radius={3.05}
          color="#4de5ff"
          speed={-0.12}
        />

        <OrbitRing
          rotation={[
            1.15,
            -0.2,
            0.5,
          ]}
          radius={3.35}
          color="#927eff"
          speed={0.08}
        />

        <EnergyParticles />

        {/* EduSphere brand text: white "Edu" + cyan/blue/purple "Sphere" */}
        <Text
          position={[-0.72, 0.5, 2.5]}
          fontSize={0.42}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fontWeight={700}
        >
          Edu
        </Text>

        <Text
          position={[0.68, 0.5, 2.5]}
          fontSize={0.42}
          anchorX="center"
          anchorY="middle"
          fontWeight={700}
        >
          <shaderMaterial
            transparent
            depthWrite={false}
            uniforms={{
              uColorStart: { value: new THREE.Color("#24c7ff") },
              uColorMiddle: { value: new THREE.Color("#3f8cff") },
              uColorEnd: { value: new THREE.Color("#a855f7") },
            }}
            vertexShader={`
              varying vec2 vUv;

              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform vec3 uColorStart;
              uniform vec3 uColorMiddle;
              uniform vec3 uColorEnd;

              varying vec2 vUv;

              void main() {
                vec3 color;

                if (vUv.x < 0.5) {
                  color = mix(uColorStart, uColorMiddle, vUv.x * 2.0);
                } else {
                  color = mix(uColorMiddle, uColorEnd, (vUv.x - 0.5) * 2.0);
                }

                gl_FragColor = vec4(color, 1.0);
              }
            `}
          />
          Sphere
        </Text>
      </Float>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.35}
        minPolarAngle={Math.PI / 2.4}
        maxPolarAngle={
          Math.PI / 1.8
        }
      />
    </>
  );
}

export default function EduSphere3D() {
  return (
    <Canvas
      camera={{
        position: [
          0,
          0,
          8,
        ],
        fov: 42,
      }}
      dpr={[1, 2]}
    >
      <Scene />
    </Canvas>
  );
}