import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  OrbitControls,
  Stars,
  Text,
} from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/* ============================================================
   EDUSPHERE 3D — EARTH EDITION
   - Earth-like blue oceans + green land masses
   - NO globe grid / wireframe lines
   - Atmospheric glow + cloud layer
   - Neon education orbit rings
   - EduSphere wordmark remains readable in front
   - Sphere text = BLUE → CYAN gradient
   - Mouse + touch rotatable
============================================================ */

function makeEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 768;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  /* ----------------------------------------------------------
     OCEAN
  ---------------------------------------------------------- */

  const ocean = ctx.createLinearGradient(
    0,
    0,
    0,
    canvas.height
  );

  ocean.addColorStop(0, "#061c62");
  ocean.addColorStop(0.48, "#0b3fa8");
  ocean.addColorStop(1, "#041a63");

  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* ----------------------------------------------------------
     OCEAN LIGHT
  ---------------------------------------------------------- */

  const glow = ctx.createRadialGradient(
    canvas.width * 0.58,
    canvas.height * 0.38,
    10,
    canvas.width * 0.58,
    canvas.height * 0.38,
    canvas.width * 0.7
  );

  glow.addColorStop(
    0,
    "rgba(55,180,255,.25)"
  );

  glow.addColorStop(
    1,
    "rgba(0,40,130,0)"
  );

  ctx.fillStyle = glow;
  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  /* ----------------------------------------------------------
     DETERMINISTIC RANDOM
  ---------------------------------------------------------- */

  let seed = 82731;

  const random = () => {
    seed =
      (seed * 1664525 + 1013904223) >>> 0;

    return seed / 4294967296;
  };

  /* ----------------------------------------------------------
     LAND COLORS
  ---------------------------------------------------------- */

  const landColors = [
    "#28784c",
    "#3d8b55",
    "#6b9b45",
    "#8e9f52",
  ];

  /* ----------------------------------------------------------
     CONTINENTS
  ---------------------------------------------------------- */

  const continents = [
    {
      x: 0.18,
      y: 0.31,
      w: 0.23,
      h: 0.25,
      rot: -0.18,
    },
    {
      x: 0.31,
      y: 0.59,
      w: 0.12,
      h: 0.31,
      rot: 0.18,
    },
    {
      x: 0.48,
      y: 0.27,
      w: 0.25,
      h: 0.20,
      rot: -0.08,
    },
    {
      x: 0.57,
      y: 0.53,
      w: 0.19,
      h: 0.31,
      rot: 0.16,
    },
    {
      x: 0.73,
      y: 0.32,
      w: 0.22,
      h: 0.18,
      rot: 0.1,
    },
    {
      x: 0.82,
      y: 0.63,
      w: 0.12,
      h: 0.18,
      rot: -0.2,
    },
    {
      x: 0.07,
      y: 0.69,
      w: 0.10,
      h: 0.10,
      rot: 0.1,
    },
  ];

  /* ----------------------------------------------------------
     DRAW CONTINENTS
  ---------------------------------------------------------- */

  for (const continent of continents) {
    const cx =
      continent.x * canvas.width;

    const cy =
      continent.y * canvas.height;

    const w =
      continent.w * canvas.width;

    const h =
      continent.h * canvas.height;

    ctx.save();

    ctx.translate(cx, cy);
    ctx.rotate(continent.rot);

    ctx.beginPath();

    const points = 18;

    for (
      let i = 0;
      i < points;
      i += 1
    ) {
      const angle =
        (i / points) *
        Math.PI *
        2;

      const radial =
        0.68 +
        random() * 0.38;

      const px =
        Math.cos(angle) *
        (w / 2) *
        radial;

      const py =
        Math.sin(angle) *
        (h / 2) *
        radial;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.closePath();

    const land =
      ctx.createLinearGradient(
        -w / 2,
        -h / 2,
        w / 2,
        h / 2
      );

    land.addColorStop(
      0,
      landColors[
        Math.floor(
          random() *
            landColors.length
        )
      ]
    );

    land.addColorStop(
      0.55,
      "#4e984f"
    );

    land.addColorStop(
      1,
      "#236b47"
    );

    ctx.fillStyle = land;
    ctx.fill();

    /* --------------------------------------------------------
       TERRAIN FLECKS
    -------------------------------------------------------- */

    for (
      let i = 0;
      i < 18;
      i += 1
    ) {
      const px =
        (random() - 0.5) *
        w *
        0.75;

      const py =
        (random() - 0.5) *
        h *
        0.7;

      ctx.fillStyle =
        "rgba(170,170,95,.22)";

      ctx.beginPath();

      ctx.ellipse(
        px,
        py,
        7 + random() * 14,
        3 + random() * 7,
        random(),
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.restore();
  }

  /* ----------------------------------------------------------
     NORTH POLAR CAP
  ---------------------------------------------------------- */

  const cap =
    ctx.createLinearGradient(
      0,
      0,
      0,
      canvas.height * 0.15
    );

  cap.addColorStop(
    0,
    "rgba(245,252,255,.95)"
  );

  cap.addColorStop(
    1,
    "rgba(220,245,255,0)"
  );

  ctx.fillStyle = cap;

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height * 0.14
  );

  /* ----------------------------------------------------------
     SOUTH POLAR CAP
  ---------------------------------------------------------- */

  const southCap =
    ctx.createLinearGradient(
      0,
      canvas.height,
      0,
      canvas.height * 0.84
    );

  southCap.addColorStop(
    0,
    "rgba(245,252,255,.92)"
  );

  southCap.addColorStop(
    1,
    "rgba(220,245,255,0)"
  );

  ctx.fillStyle = southCap;

  ctx.fillRect(
    0,
    canvas.height * 0.86,
    canvas.width,
    canvas.height * 0.14
  );

  /*
     IMPORTANT:
     NO latitude lines.
     NO longitude lines.
     NO grid.
     NO wireframe texture.
  */

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return texture;
}

/* ============================================================
   CLOUD TEXTURE
============================================================ */

function makeCloudTexture() {
  const canvas =
    document.createElement("canvas");

  canvas.width = 1536;
  canvas.height = 768;

  const ctx =
    canvas.getContext("2d");

  if (!ctx) return null;

  let seed = 19283;

  const random = () => {
    seed =
      (seed * 1103515245 + 12345) >>>
      0;

    return seed / 4294967296;
  };

  for (
    let i = 0;
    i < 95;
    i += 1
  ) {
    const x =
      random() *
      canvas.width;

    const y =
      canvas.height *
      (0.12 + random() * 0.76);

    const w =
      25 + random() * 150;

    const h =
      5 + random() * 22;

    const gradient =
      ctx.createRadialGradient(
        x,
        y,
        0,
        x,
        y,
        w
      );

    gradient.addColorStop(
      0,
      "rgba(255,255,255,.30)"
    );

    gradient.addColorStop(
      1,
      "rgba(255,255,255,0)"
    );

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.ellipse(
      x,
      y,
      w,
      h,
      random() * Math.PI,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.anisotropy = 8;

  return texture;
}

/* ============================================================
   EARTH ATMOSPHERE
============================================================ */

function EarthAtmosphere({
  color,
  scale,
  opacity,
}: {
  color: string;
  scale: number;
  opacity: number;
}) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: {
          value: new THREE.Color(color),
        },

        glowOpacity: {
          value: opacity,
        },
      },

      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
          vec4 worldPosition =
            modelMatrix *
            vec4(position, 1.0);

          vWorldPosition =
            worldPosition.xyz;

          vNormal =
            normalize(
              mat3(modelMatrix) *
              normal
            );

          gl_Position =
            projectionMatrix *
            viewMatrix *
            worldPosition;
        }
      `,

      fragmentShader: `
        uniform vec3 glowColor;
        uniform float glowOpacity;

        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {

          vec3 viewDir =
            normalize(
              cameraPosition -
              vWorldPosition
            );

          float fresnel =
            pow(
              1.0 -
              max(
                dot(
                  normalize(vNormal),
                  viewDir
                ),
                0.0
              ),
              3.2
            );

          float intensity =
            fresnel *
            glowOpacity;

          gl_FragColor =
            vec4(
              glowColor,
              intensity
            );
        }
      `,

      transparent: true,

      blending:
        THREE.AdditiveBlending,

      side:
        THREE.BackSide,

      depthWrite: false,
    });
  }, [color, opacity]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh
      scale={scale}
      renderOrder={5}
    >
      <sphereGeometry
        args={[
          2.05,
          64,
          64,
        ]}
      />

      <primitive
        object={material}
        attach="material"
      />
    </mesh>
  );
}

/* ============================================================
   EARTH OUTER GLOW
============================================================ */

function EarthGlowShell({
  color,
  scale,
  opacity,
}: {
  color: string;
  scale: number;
  opacity: number;
}) {
  return (
    <mesh
      scale={scale}
      renderOrder={4}
    >
      <sphereGeometry
        args={[
          2.05,
          64,
          64,
        ]}
      />

      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.BackSide}
        blending={
          THREE.AdditiveBlending
        }
        depthWrite={false}
      />
    </mesh>
  );
}

/* ============================================================
   EARTH
============================================================ */

function EarthGlobe() {
  const group =
    useRef<THREE.Group>(null);

  const earthTexture =
    useMemo(
      () => makeEarthTexture(),
      []
    );

  const cloudTexture =
    useMemo(
      () => makeCloudTexture(),
      []
    );

  useEffect(() => {
    return () => {
      earthTexture?.dispose();
      cloudTexture?.dispose();
    };
  }, [
    earthTexture,
    cloudTexture,
  ]);

  useFrame((_, delta) => {
    if (!group.current) return;

    group.current.rotation.y +=
      delta * 0.022;
  });

  return (
    <group ref={group}>

      {/* ======================================================
          MAIN EARTH
      ====================================================== */}

      <mesh>
        <sphereGeometry
          args={[
            2.05,
            96,
            64,
          ]}
        />

        <meshStandardMaterial
          map={
            earthTexture ??
            undefined
          }
          color="#ffffff"
          emissive="#064bdb"
          emissiveIntensity={0.12}
          metalness={0.05}
          roughness={0.72}
        />
      </mesh>

      {/* ======================================================
          CLOUD LAYER
      ====================================================== */}

      <mesh scale={1.012}>
        <sphereGeometry
          args={[
            2.05,
            96,
            64,
          ]}
        />

        <meshStandardMaterial
          map={
            cloudTexture ??
            undefined
          }
          transparent
          opacity={0.34}
          depthWrite={false}
          roughness={1}
        />
      </mesh>

      {/* ======================================================
          NO WIREFRAME
          NO GRID
          NO TRIANGULAR LINES
      ====================================================== */}

      {/* ======================================================
          OUTER GLOW
      ====================================================== */}

      <EarthGlowShell
        color="#19bfff"
        scale={1.045}
        opacity={0.055}
      />

      <EarthGlowShell
        color="#35dfff"
        scale={1.055}
        opacity={0.42}
      />


      {/* ======================================================
          ATMOSPHERIC RIM
      ====================================================== */}

      <EarthAtmosphere
        color="#55dfff"
        scale={1.045}
        opacity={0.8}
      />

      <mesh
        scale={1.045}
        renderOrder={6}
      >
        <sphereGeometry
          args={[
            2.05,
            64,
            64,
          ]}
        />

        <meshBasicMaterial
          color="#8feeff"
          transparent
          opacity={0.055}
          side={THREE.BackSide}
          blending={
            THREE.AdditiveBlending
          }
          depthWrite={false}
        />
      </mesh>

      {/* ======================================================
          RIM LIGHTS
      ====================================================== */}

      <pointLight
        position={[
          1.4,
          0.8,
          2.7,
        ]}
        color="#4ddcff"
        intensity={1.35}
        distance={6}
      />

      <pointLight
        position={[
          -1.5,
          -0.8,
          2.3,
        ]}
        color="#6758ff"
        intensity={0.8}
        distance={5}
      />
    </group>
  );
}

/* ============================================================
   ORBIT RING
============================================================ */

function OrbitRing({
  rotation,
  radius,
  color,
  speed,
}: {
  rotation: [
    number,
    number,
    number
  ];
  radius: number;
  color: string;
  speed: number;
}) {
  const group =
    useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;

    group.current.rotation.z +=
      delta * speed;
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
            0.018,
            12,
            180,
          ]}
        />

        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.72}
          blending={
            THREE.AdditiveBlending
          }
        />
      </mesh>

      <mesh
        position={[
          radius,
          0,
          0,
        ]}
      >
        <sphereGeometry
          args={[
            0.085,
            24,
            24,
          ]}
        />

        <meshBasicMaterial
          color={color}
          blending={
            THREE.AdditiveBlending
          }
        />
      </mesh>

      <pointLight
        position={[
          radius,
          0,
          0,
        ]}
        color={color}
        intensity={2}
        distance={2.2}
      />
    </group>
  );
}

/* ============================================================
   ENERGY NODES
============================================================ */

function EnergyNodes() {
  const points =
    useRef<THREE.Points>(null);

  const positions =
    useMemo(() => {
      const count = 180;

      const data =
        new Float32Array(
          count * 3
        );

      let seed = 91821;

      const random = () => {
        seed =
          (seed * 1664525 +
            1013904223) >>>
          0;

        return (
          seed / 4294967296
        );
      };

      for (
        let i = 0;
        i < count;
        i += 1
      ) {
        const radius =
          2.25 +
          random() * 1.45;

        const theta =
          random() *
          Math.PI *
          2;

        const phi =
          Math.acos(
            2 * random() - 1
          );

        data[i * 3] =
          radius *
          Math.sin(phi) *
          Math.cos(theta);

        data[i * 3 + 1] =
          radius *
          Math.sin(phi) *
          Math.sin(theta);

        data[i * 3 + 2] =
          radius *
          Math.cos(phi);
      }

      return data;
    }, []);

  useFrame((_, delta) => {
    if (points.current) {
      points.current.rotation.y +=
        delta * 0.015;
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
        color="#b09cff"
        size={0.025}
        transparent
        opacity={0.72}
        sizeAttenuation
      />
    </points>
  );
}

/* ============================================================
   SPHERE GRADIENT MATERIAL
   BLUE → CYAN
============================================================ */

function GradientSphereText() {
  const material =
    useMemo(() => {

      const mat =
        new THREE.MeshBasicMaterial({
          color: "#ffffff",
          transparent: true,
          depthWrite: false,
        });

      /*
         Force UV coordinates so the shader
         can calculate the horizontal gradient.
      */

      mat.defines = {
        ...(mat.defines || {}),
        USE_UV: "",
      };

      mat.onBeforeCompile =
        (shader) => {

          /* --------------------------------------------------
             VERTEX UV
          -------------------------------------------------- */

          shader.vertexShader =
            shader.vertexShader.replace(
              "#include <uv_pars_vertex>",
              `#include <uv_pars_vertex>
varying vec2 vGradientUv;`
            );

          shader.vertexShader =
            shader.vertexShader.replace(
              "#include <uv_vertex>",
              `#include <uv_vertex>
vGradientUv = uv;`
            );

          /* --------------------------------------------------
             FRAGMENT UV
          -------------------------------------------------- */

          shader.fragmentShader =
            shader.fragmentShader.replace(
              "#include <uv_pars_fragment>",
              `#include <uv_pars_fragment>
varying vec2 vGradientUv;`
            );

          /* --------------------------------------------------
             BLUE → CYAN
          -------------------------------------------------- */

          shader.fragmentShader =
            shader.fragmentShader.replace(
              "#include <color_fragment>",
              `#include <color_fragment>

              /*
                 Smooth horizontal
                 BLUE → CYAN gradient
              */

              float gradient =
                smoothstep(
                  0.08,
                  0.92,
                  vGradientUv.x
                );

              vec3 blue =
                vec3(
                  0.02,
                  0.42,
                  1.0
                );

              vec3 cyan =
                vec3(
                  0.05,
                  0.92,
                  1.0
                );

              diffuseColor.rgb =
                mix(
                  blue,
                  cyan,
                  gradient
                );`
            );
        };

      return mat;
    }, []);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <Text
      position={[
        -0.01,
        0,
        0,
      ]}
      fontSize={0.47}
      anchorX="left"
      anchorY="middle"
      fontWeight={800}
      outlineWidth={0.014}
      outlineColor="#087dff"
      material={material}
    >
      Sphere
    </Text>
  );
}

/* ============================================================
   EDUSPHERE BRAND
============================================================ */

function BrandText() {
  return (
    <group
      position={[
        0,
        0.03,
        2.32,
      ]}
    >

      {/* ======================================================
          EDU — WHITE
      ====================================================== */}

      <Text
        position={[
          -0.08,
          0,
          0,
        ]}
        fontSize={0.47}
        color="#ffffff"
        anchorX="right"
        anchorY="middle"
        fontWeight={800}
        outlineWidth={0.014}
        outlineColor="#ffffff"
      >
        Edu
      </Text>

      {/* ======================================================
          SPHERE — BLUE → CYAN
      ====================================================== */}

      <GradientSphereText />

    </group>
  );
}

/* ============================================================
   SCENE
============================================================ */

function Scene() {
  return (
    <>

      {/* ======================================================
          LIGHTING
      ====================================================== */}

      <ambientLight
        intensity={0.32}
      />

      <pointLight
        position={[
          4,
          4,
          5,
        ]}
        intensity={7}
        color="#5276ff"
      />

      <pointLight
        position={[
          -4,
          -2,
          4,
        ]}
        intensity={6}
        color="#20dfff"
      />

      <pointLight
        position={[
          0,
          0,
          3,
        ]}
        intensity={4}
        color="#795cff"
      />

      {/* ======================================================
          STARS
      ====================================================== */}

      <Stars
        radius={24}
        depth={14}
        count={1100}
        factor={2.2}
        saturation={0}
        fade
        speed={0.28}
      />

      {/* ======================================================
          FLOATING EARTH GROUP
      ====================================================== */}

      <Float
        speed={1.0}
        rotationIntensity={0.025}
        floatIntensity={0.16}
      >

        <EarthGlobe />

        <EnergyNodes />

        <BrandText />

        {/* ==================================================
            PURPLE ORBIT
        ================================================== */}

        <OrbitRing
          rotation={[
            0.42,
            0.1,
            0,
          ]}
          radius={2.72}
          color="#9b62ff"
          speed={0.13}
        />

        {/* ==================================================
            CYAN ORBIT
        ================================================== */}

        <OrbitRing
          rotation={[
            -0.72,
            0.2,
            0.32,
          ]}
          radius={3.0}
          color="#42e7ff"
          speed={-0.09}
        />

        {/* ==================================================
            OUTER PURPLE ORBIT
        ================================================== */}

        <OrbitRing
          rotation={[
            1.05,
            -0.18,
            0.5,
          ]}
          radius={3.28}
          color="#b17cff"
          speed={0.06}
        />

      </Float>

      {/* ======================================================
          CAMERA CONTROLS
      ====================================================== */}

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.055}
        rotateSpeed={0.55}
        zoomSpeed={0.65}
        minDistance={6}
        maxDistance={11}
        minPolarAngle={
          Math.PI / 2.9
        }
        maxPolarAngle={
          Math.PI / 1.55
        }
      />

    </>
  );
}

/* ============================================================
   EDUSPHERE 3D COMPONENT
============================================================ */

export default function EduSphere3D() {
  return (
    <Canvas
      camera={{
        position: [
          0,
          0,
          8.4,
        ],
        fov: 40,
      }}
      dpr={[
        1,
        2,
      ]}
      gl={{
        antialias: true,
        alpha: true,
      }}
    >
      <Scene />
    </Canvas>
  );
}