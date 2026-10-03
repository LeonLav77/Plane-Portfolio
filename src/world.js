import * as THREE from 'three';

const HORIZON = new THREE.Color('#cfeeff');
const ZENITH = new THREE.Color('#3f9bff');
const SUN_OFFSET = new THREE.Vector3(160, 260, 90);
const OCEAN_SIZE = 4000;
const OCEAN_SEGMENTS = 200;
const OCEAN_STEP = OCEAN_SIZE / OCEAN_SEGMENTS;

export function createWorld(scene, islands) {
  scene.fog = new THREE.Fog(HORIZON, 380, 1500);

  // --- Sky dome (gradient) ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4000, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTop: { value: ZENITH }, uHorizon: { value: HORIZON } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 1.8, 0.0, 1.0);
          gl_FragColor = vec4(mix(uHorizon, uTop, pow(h, 0.6)), 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // --- Lights ---
  const hemi = new THREE.HemisphereLight('#e4f6ff', '#3aa6c2', 1.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff0d4', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -150; sc.right = 150; sc.top = 150; sc.bottom = -150;
  sc.near = 10; sc.far = 700;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;
  scene.add(sun, sun.target);

  // --- Low-poly ocean with GPU waves + shallow lagoons around islands ---
  const oceanUniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color('#62efd9') },
    uIslands: { value: islands.map((i) => new THREE.Vector3(i.center.x, i.center.z, i.radius)) },
  };
  const oceanGeo = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEGMENTS, OCEAN_SEGMENTS);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: '#1c9fd0',
    flatShading: true,
    roughness: 0.35,
    metalness: 0.05,
  });
  oceanMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, oceanUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uTime;
        varying float vH;
        varying vec2 vW;
        float wave(vec2 p) {
          return sin(p.x * 0.045 + uTime * 1.1) * 0.9
               + cos(p.y * 0.06 + uTime * 0.8) * 0.7
               + sin((p.x + p.y) * 0.11 + uTime * 1.6) * 0.35;
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        vec4 wpos = modelMatrix * vec4(position, 1.0);
        float h = wave(wpos.xz);
        transformed.y += h;
        vH = h;
        vW = wpos.xz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        #define ISLAND_COUNT ${islands.length}
        uniform vec3 uIslands[ISLAND_COUNT];
        uniform vec3 uShallow;
        varying float vH;
        varying vec2 vW;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        float lagoon = 0.0;
        for (int i = 0; i < ISLAND_COUNT; i++) {
          float d = distance(vW, uIslands[i].xy);
          lagoon = max(lagoon, 1.0 - smoothstep(uIslands[i].z * 1.05, uIslands[i].z * 2.2, d));
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, uShallow, lagoon * 0.85);
        diffuseColor.rgb += smoothstep(0.9, 1.9, vH) * 0.12;`,
      );
  };
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.receiveShadow = true;
  ocean.frustumCulled = false;
  scene.add(ocean);

  // --- Clouds ---
  const cloudGeo = new THREE.IcosahedronGeometry(1, 0);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    flatShading: true,
    roughness: 1,
    emissive: '#ffffff',
    emissiveIntensity: 0.2,
  });
  const clouds = [];
  for (let i = 0; i < 60; i++) {
    const cloud = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      const s = 6 + Math.random() * 8;
      puff.scale.set(s, s * 0.72, s);
      puff.position.set((k - n / 2) * 7 + Math.random() * 3, Math.random() * 3, (Math.random() - 0.5) * 7);
      puff.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      puff.castShadow = true;
      cloud.add(puff);
    }
    const a = Math.random() * Math.PI * 2;
    const d = 140 + Math.random() * 1050;
    cloud.position.set(Math.cos(a) * d, 75 + Math.random() * 85, Math.sin(a) * d);
    cloud.rotation.y = Math.random() * Math.PI;
    cloud.userData.speed = 2 + Math.random() * 4;
    scene.add(cloud);
    clouds.push(cloud);
  }

  return {
    update(t, dt, camera, focus) {
      oceanUniforms.uTime.value = t;
      ocean.position.x = Math.round(focus.x / OCEAN_STEP) * OCEAN_STEP;
      ocean.position.z = Math.round(focus.z / OCEAN_STEP) * OCEAN_STEP;
      sky.position.copy(camera.position);
      sun.position.copy(focus).add(SUN_OFFSET);
      sun.target.position.copy(focus);
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 1300) c.position.x = -1300;
      }
    },
  };
}
