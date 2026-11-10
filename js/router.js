// PunAcc — escena 3D del hero: router con ondas Wi-Fi y pulsos de datos
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const canvas = document.getElementById('scene');
const hero = document.getElementById('inicio');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 820px)').matches;

const COLORS = {
  deep: new THREE.Color('#000216'),
  bg: new THREE.Color('#020A30'),
  navy: new THREE.Color('#001257'),
  primary: new THREE.Color('#1E6BFF'),
  accent: new THREE.Color('#00C8FF'),
};

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  console.warn('[PunAcc] WebGL no disponible', e);
}
if (renderer) init();

function init() {
  // Gráficas integradas (Intel, móviles): arrancan ya en resolución baja.
  // Así nunca hace falta cambiarla a mitad de la animación (eso provocaba un tirón).
  const gl = renderer.getContext();
  const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : '';
  const lowPower = isMobile || /Intel|UHD|Iris|HD Graphics|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(gpu);
  const BASE_PR = isMobile ? Math.min(window.devicePixelRatio, 1.5) * 0.6 : (lowPower ? 0.62 : 0.85);
  renderer.setPixelRatio(BASE_PR);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 3.2, 11.5);
  camera.lookAt(0, 0.4, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const shared = {
    uTime: { value: 0 },
    uIntro: { value: reduced ? 1 : 0 },
    uColA: { value: COLORS.primary },
    uColB: { value: COLORS.accent },
  };

  // ---------- Fondo ----------
  const bgMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uDeep: { value: COLORS.deep },
      uBg: { value: COLORS.bg },
      uNavy: { value: COLORS.navy },
      uBlue: { value: COLORS.primary },
      uHead: { value: new THREE.Vector2(0.75, 0.45) },
      uAspect: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep, uBg, uNavy, uBlue;
      uniform vec2 uHead;
      uniform float uAspect;
      varying vec2 vUv;
      void main() {
        vec3 col = mix(uDeep, uBg, smoothstep(0.0, 1.0, vUv.y));
        vec2 q = vUv - vec2(0.1, 0.95); q.x *= uAspect;
        col = mix(col, uNavy, 0.7 * smoothstep(0.9, 0.0, length(q)));
        vec2 h = vUv - uHead; h.x *= uAspect;
        col += uBlue * 0.14 * smoothstep(0.6, 0.0, length(h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -1;
  scene.add(bg);

  const root = new THREE.Group();
  scene.add(root);

  // ---------- Cuadrícula luminosa con pulsos de datos ----------
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 50),
    new THREE.ShaderMaterial({
      uniforms: shared,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        varying vec2 vP;
        void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform float uIntro;
        uniform vec3 uColA;
        uniform vec3 uColB;
        varying vec2 vP;
        float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
        void main() {
          float S = 0.6;                         // separación de líneas
          vec2 c = vP / S;
          vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
          float lx = 1.0 - min(g.x, 1.0);         // líneas verticales
          float ly = 1.0 - min(g.y, 1.0);         // líneas horizontales
          float line = max(lx, ly);

          float d = length(vP);
          float fade = smoothstep(26.0, 1.0, d) * 0.85 + 0.15 * smoothstep(30.0, 20.0, d);
          float reveal = smoothstep(uIntro * 30.0, uIntro * 30.0 - 3.0, d);

          // Pulsos que viajan por algunas líneas hacia el router
          float idx = floor(c.x + 0.5);
          float hx = hash(idx);
          float px = (1.0 - fract(uTime * 0.06 * (0.6 + hx) + hx * 7.0)) * 22.0;
          float pulseX = lx * step(0.55, hx) * smoothstep(0.9, 0.0, abs(abs(vP.y) - px)) * step(abs(vP.y) - px, 0.0);
          float idy = floor(c.y + 0.5);
          float hy = hash(idy + 31.0);
          float py = (1.0 - fract(uTime * 0.06 * (0.6 + hy) + hy * 5.0)) * 22.0;
          float pulseY = ly * step(0.55, hy) * smoothstep(0.9, 0.0, abs(abs(vP.x) - py)) * step(abs(vP.x) - py, 0.0);
          float pulse = max(pulseX, pulseY);

          float center = smoothstep(3.2, 0.0, d);
          vec3 col = uColA * (line * 0.22 * fade) + uColB * (pulse * 1.3 * fade) + uColA * center * 0.35;
          float a = (line * 0.22 + pulse * 1.3) * fade + center * 0.35;
          gl_FragColor = vec4(col / max(a, 0.001), a * reveal);
        }
      `,
    })
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -0.02;
  root.add(grid);

  // ---------- Router ----------
  const router = new THREE.Group();
  root.add(router);

  const bodyMat = new THREE.MeshStandardMaterial({ color: '#08113a', metalness: 0.75, roughness: 0.32, envMapIntensity: 0.8 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.42, 1.6, 6, 0.14), bodyMat);
  body.position.y = 0.36;
  router.add(body);

  // Franja de luz alrededor del cuerpo
  const stripMat = new THREE.MeshBasicMaterial({ color: COLORS.accent });
  const strip = new THREE.Mesh(new RoundedBoxGeometry(2.63, 0.035, 1.63, 4, 0.016), stripMat);
  strip.position.y = 0.3;
  router.add(strip);

  // Base con brillo
  const foot = new THREE.Mesh(
    new RoundedBoxGeometry(2.3, 0.08, 1.35, 4, 0.04),
    new THREE.MeshStandardMaterial({ color: '#050c2a', metalness: 0.5, roughness: 0.5 })
  );
  foot.position.y = 0.11;
  router.add(foot);

  // Luces de estado en el frente
  const leds = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshBasicMaterial({ color: COLORS.accent });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.02), m);
    led.position.set(-0.5 + i * 0.25, 0.43, 0.81);
    router.add(led);
    leds.push(m);
  }

  // Antenas
  const antMat = new THREE.MeshStandardMaterial({ color: '#0d1a52', metalness: 0.6, roughness: 0.35 });
  const tipMat = new THREE.MeshBasicMaterial({ color: COLORS.accent });
  const antennas = [];
  [-0.95, -0.32, 0.32, 0.95].forEach((x, i) => {
    const a = new THREE.Group();
    a.position.set(x, 0.55, -0.55);
    a.rotation.z = -x * 0.14;
    a.rotation.x = -0.12;
    const stick = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 1.25, 6, 16), antMat);
    stick.position.y = 0.68;
    a.add(stick);
    const tip = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.012, 8, 24), tipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.y = 1.15;
    a.add(tip);
    a.userData.i = i;
    router.add(a);
    antennas.push(a);
  });

  // ---------- Ondas Wi-Fi (arcos que suben) ----------
  const WAVES = 4;
  const waves = [];
  for (let i = 0; i < WAVES; i++) {
    const m = new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const w = new THREE.Mesh(new THREE.TorusGeometry(1, 0.014, 8, 80, Math.PI * 0.55), m);
    w.rotation.z = Math.PI / 2 - (Math.PI * 0.55) / 2; // arco centrado hacia arriba
    w.position.set(0, 1.62, -0.62); // a la altura de las puntas de las antenas
    router.add(w);
    waves.push(w);
  }

  // ---------- Anillos de señal sobre la cuadrícula ----------
  const RINGS = 4; // uno por cada onda Wi-Fi: salen juntos
  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const m = new THREE.MeshBasicMaterial({ color: COLORS.primary, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const r = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), m);
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.01;
    root.add(r);
    rings.push(r);
  }

  // ---------- Partículas de fondo ----------
  const DUST = isMobile ? 140 : 280;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 18;
    dustPos[i * 3 + 1] = Math.random() * 7 - 1;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    dustSeed[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const prUniform = { value: BASE_PR };
  root.add(new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    uniforms: { ...shared, uPixelRatio: prUniform },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uPixelRatio;
      attribute float aSeed;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.08 + aSeed * 0.12) + 1.0, 7.0) - 1.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = 0.2 + 0.3 * (0.5 + 0.5 * sin(uTime * 1.5 + aSeed * 50.0));
        gl_PointSize = (1.5 + aSeed * 2.5) * uPixelRatio * (12.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColB;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(uColB, smoothstep(0.5, 0.0, d) * vA);
      }
    `,
  })));

  // Luces
  scene.add(new THREE.AmbientLight('#1a2a6b', 0.7));
  const key = new THREE.DirectionalLight('#1E6BFF', 2.6);
  key.position.set(-4, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#00C8FF', 2.2);
  rim.position.set(5, 2, -4);
  scene.add(rim);
  const under = new THREE.PointLight('#00C8FF', 4, 5, 2);
  under.position.set(0, 0.2, 1.4);
  router.add(under);

  // ---------- Post-procesado ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), isMobile ? 0.7 : 0.9, 0.6, 0.18);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- Layout responsive ----------
  const basePos = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  function layout() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    bgMat.uniforms.uAspect.value = camera.aspect;

    const dist = camera.position.length();
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * camera.aspect;
    if (camera.aspect >= 1.1) {
      basePos.set(halfW * 0.42, -1.25, 0);
      root.scale.setScalar(Math.min(1.35, halfW * 0.6 / 3.2));
    } else {
      basePos.set(halfW * 0.25, -1.15, 0); // celular: más arriba para que se vea entre los botones y los beneficios
      root.scale.setScalar(0.75);
    }
    root.position.copy(basePos);
    tmp.set(basePos.x, basePos.y + 0.8, 0).project(camera);
    bgMat.uniforms.uHead.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
  }
  layout();
  new ResizeObserver(layout).observe(hero);

  // ---------- Interacción ----------
  const mouse = new THREE.Vector2();
  const mouseTarget = new THREE.Vector2();
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      mouseTarget.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    }, { passive: true });
  }

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio > 0.2; }, { threshold: [0, 0.2, 0.5] }).observe(hero);

  // ---------- Bucle (a la frecuencia de la pantalla, para que las ondas se vean fluidas) ----------
  const INTRO = 2.6;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  let time = 0;

  function frame(dt) {
    // Tiempo real: solo se descuenta una pausa larga (cambio de pestaña), nunca un cuadro lento
    // Tiempo real; un cuadro excepcionalmente largo cuenta como uno normal (sin saltos)
    time += (dt > 120 ? 16.7 : dt) / 1000;
    const t = time;
    const intro = easeOut(Math.min(1, t / INTRO));
    shared.uIntro.value = intro;
    shared.uTime.value = t;

    if (!finePointer) mouseTarget.set(Math.sin(t * 0.3) * 0.4, Math.cos(t * 0.23) * 0.2);
    mouse.lerp(mouseTarget, 0.05);

    // Giro suave de la escena + respuesta al mouse
    root.rotation.y = -0.45 + mouse.x * 0.35 + Math.sin(t * 0.1) * 0.12;
    root.rotation.x = mouse.y * 0.05;

    // El router aparece desde abajo y flota levemente
    const rIn = easeOut(Math.min(1, Math.max(0, (t - 0.4) / 1.6)));
    router.position.y = (1 - rIn) * -1.2 + Math.sin(t * 0.7) * 0.05;
    router.scale.setScalar(0.85 + 0.15 * rIn);

    // Luces de estado: parpadeo tipo actividad de red
    leds.forEach((m, i) => {
      const on = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1.6 + i * 0.9) + i * 2.1));
      m.color.copy(COLORS.accent).multiplyScalar(on * rIn);
    });
    // Ondas Wi-Fi: cada una nace pequeña en las puntas de las antenas, una tras otra,
    // cuando el router ya se acomodó (nunca aparecen a mitad de camino)
    const WAVE_START = 2.0;
    const WAVE_LIFE = 4.5;
    let emit = 0;
    waves.forEach((w, i) => {
      const local = t - WAVE_START - i * (WAVE_LIFE / WAVES);
      if (local < 0) { w.material.opacity = 0; return; }
      const k = (local / WAVE_LIFE) % 1;
      const r = 0.22 + k * 2.0;
      w.scale.set(r, r, 1);
      w.material.opacity = Math.pow(1 - k, 1.2) * THREE.MathUtils.smoothstep(k, 0, 0.08) * 0.95;
      if (k < 0.15) emit = Math.max(emit, 1 - k / 0.15);
    });
    // Las puntas de las antenas destellan al emitir cada onda
    tipMat.color.copy(COLORS.accent).multiplyScalar(rIn * (1 + emit * 1.8));

    // Anillos del piso: mismo ritmo y mismo inicio que su onda Wi-Fi,
    // así cada pulso de señal sale a la vez por el aire y por el piso
    rings.forEach((r, i) => {
      const local = t - WAVE_START - i * (WAVE_LIFE / WAVES);
      if (local < 0) { r.material.opacity = 0; return; }
      const k = (local / WAVE_LIFE) % 1;
      const sc = 1.3 + k * 6;
      r.scale.set(sc, sc, 1);
      r.material.opacity = Math.pow(1 - k, 1.2) * THREE.MathUtils.smoothstep(k, 0, 0.08) * 0.6;
    });

    // La franja del router también late con cada pulso
    stripMat.color.copy(COLORS.accent).multiplyScalar(rIn * (0.8 + emit * 0.9));

    composer.render();
  }

  let last = performance.now();
  let started = false;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) { last = now; return; }
    if (!started) { started = true; last = now; }
    const dt = now - last;
    last = now;
    frame(dt);
  }

  function start() {
    warmUp(renderer, scene, camera, composer).then(() => {
      document.documentElement.classList.remove('no-webgl'); // el canvas aparece con fundido
      requestAnimationFrame(loop);
    });
  }

  if (reduced) {
    time = 5;
    const still = () => frame(0);
    still();
    new ResizeObserver(still).observe(hero);
    document.documentElement.classList.remove('no-webgl');
  } else {
    start();
  }
}

// Arranque sin tirones: espera a que la página termine de cargar (fuentes incluidas),
// compila TODOS los shaders de forma asíncrona y dibuja un par de cuadros de calentamiento
// sin mostrarlos. Solo entonces aparece el canvas y empieza la intro.
async function warmUp(renderer, scene, camera, composer) {
  if (document.readyState !== 'complete') await new Promise((r) => window.addEventListener('load', r, { once: true }));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
  composer.render();
  await new Promise((r) => requestAnimationFrame(() => { composer.render(); requestAnimationFrame(r); }));
}
