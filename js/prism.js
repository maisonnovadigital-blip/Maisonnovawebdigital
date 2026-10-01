/* ==========================================================================
   NOVA WEB — artefact WebGL « prisme »
   Cubes de verre arrondis traversés par un champ de lumière invisible :
   chaque canal (rouge / vert / bleu) est réfracté séparément, ce qui
   disperse la lumière en franges prismatiques sur fond d’obsidienne.
   Chargé en script classique : Three.js arrive par import() dynamique
   (fonctionne aussi en ouvrant index.html directement depuis le disque).
   ========================================================================== */
(() => {
  'use strict';

  const canvas = document.querySelector('.prism');
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 700px)').matches;
  const autoPointer = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const state = {
    visible: true,
    ready: false,
    wantIntro: false,
    introAt: 0,
    scroll: 0, scrollS: 0,
    contact: 0, contactS: 0,
    px: 0, py: 0, pxS: 0, pyS: 0,
    pulse: 0,
  };

  let resolveReady;
  let wake = () => {};
  let startIntro = () => {};

  /* API utilisée par main.js */
  window.Prism = {
    ready: new Promise(resolve => { resolveReady = resolve; }),
    intro() { state.wantIntro = true; if (state.ready) startIntro(); },
    setVisible(v) { state.visible = v; if (v) wake(); },
    setScroll(p) { state.scroll = p; },
    setContact(p) { state.contact = p; },
    setPointer(x, y) { state.px = x; state.py = y; },
    pulse() { state.pulse = 1; },
  };

  const fail = err => {
    if (err) console.warn('[Nova Web] WebGL indisponible, affichage de secours.', err);
    html.classList.add('no-webgl');
    resolveReady(false);
  };

  const hasWebGL = () => {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      return false;
    }
  };

  if (!canvas || !hasWebGL()) { fail(); return; }

  /* ---------- Shaders ---------- */
  const QUAD_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  /* Champ de lumière : jamais affiché tel quel, seulement vu à travers le verre. */
  const LIGHT_FRAG = /* glsl */ `
    uniform float uTime;
    uniform float uAspect;
    uniform vec2 uPointer;
    uniform float uPulse;
    uniform float uScroll;
    varying vec2 vUv;

    mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
    float bar(float x, float center, float width) {
      return 1.0 - smoothstep(width * 0.3, width, abs(x - center));
    }

    void main() {
      vec2 p = vUv - 0.5;
      p.x *= uAspect;
      p /= min(uAspect, 1.0); // en portrait, on garde la même lumière relative à la largeur
      p += uPointer * vec2(-0.12, 0.09);
      float t = uTime;

      // Fentes de lumière blanche
      vec2 q = rot(0.42 + uScroll * 1.1) * p;
      float w = 0.0;
      w += bar(q.x, -0.58 + 0.05 * sin(t * 0.31), 0.025);
      w += bar(q.x, -0.33 + 0.06 * sin(t * 0.23 + 1.3), 0.07);
      w += bar(q.x, -0.07 + 0.04 * cos(t * 0.27), 0.016);
      w += bar(q.x,  0.17 + 0.07 * sin(t * 0.19 + 2.1), 0.09);
      w += bar(q.x,  0.43 + 0.05 * cos(t * 0.29 + 0.7), 0.03);
      w += bar(q.x,  0.68 + 0.04 * sin(t * 0.21 + 4.0), 0.05);
      vec3 col = vec3(min(w, 1.0)) * 0.9;

      // Blocs saturés rouge / vert / bleu
      vec2 s = rot(-0.8 + uScroll * 0.6) * p;
      col += vec3(1.0, 0.165, 0.165) * bar(s.x, -0.36 + 0.07 * sin(t * 0.17), 0.075) * 0.85;
      col += vec3(0.165, 1.0, 0.165) * bar(s.x,  0.00 + 0.07 * cos(t * 0.21 + 1.0), 0.045) * 0.75;
      col += vec3(0.165, 0.5, 1.0)   * bar(s.x,  0.35 + 0.07 * sin(t * 0.15 + 2.0), 0.08) * 0.9;

      // Cœur sombre : les faces vues de face restent noires comme l'obsidienne
      float r = length(p);
      col *= smoothstep(0.1, 0.32, r) * (1.0 - smoothstep(0.4, 1.3, r));
      col *= 1.0 + uPulse * 1.3;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* Fond visible : dégradé ardoise → obsidienne + caustiques très discrètes. */
  const BG_FRAG = /* glsl */ `
    uniform float uTime;
    uniform float uAspect;
    uniform vec2 uPointer;
    uniform float uIntro;
    varying vec2 vUv;

    void main() {
      vec2 p = vUv - 0.5;
      p.x *= uAspect;
      vec3 base = vec3(0.0627);
      vec3 slate = vec3(0.286, 0.341, 0.392);
      vec2 c = vec2(uPointer.x * 0.04, -0.02 + uPointer.y * 0.03);
      float d = length((p - c) * vec2(0.85, 1.0));
      vec3 col = mix(slate * 0.42, base, smoothstep(0.0, 0.62, d));

      vec2 g = p - vec2(0.0, -0.3);
      float breathe = 0.75 + 0.25 * sin(uTime * 0.5);
      vec2 gr = g + vec2(0.16, 0.0);
      vec2 gb = g - vec2(0.16, 0.0);
      col += vec3(1.0, 0.165, 0.165) * exp(-dot(gr, gr) * 26.0) * 0.06 * breathe;
      col += vec3(0.165, 1.0, 0.165) * exp(-dot(g, g) * 30.0) * 0.04 * breathe;
      col += vec3(0.165, 0.5, 1.0)   * exp(-dot(gb, gb) * 26.0) * 0.07 * breathe;

      col = mix(base, col, uIntro);
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const GLASS_VERT = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vEye;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(mat3(modelMatrix) * normal);
      vEye = normalize(world.xyz - cameraPosition);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `;

  const GLASS_FRAG = /* glsl */ `
    uniform sampler2D uLight;
    uniform vec2 uResolution;
    uniform vec3 uIor;
    uniform float uRefract;
    uniform float uChroma;
    uniform float uFresnel;
    uniform float uScreenMix;
    uniform float uShine;
    uniform vec3 uLightDir;
    varying vec3 vNormal;
    varying vec3 vEye;

    #define SAMPLES ${small ? 8 : 12}

    void main() {
      vec2 screen = gl_FragCoord.xy / uResolution - 0.5;
      vec2 base = 0.5 + screen * uScreenMix;
      vec3 n = normalize(vNormal);
      vec3 e = normalize(vEye);

      // Un indice de réfraction par canal = dispersion
      vec2 rr = refract(e, n, 1.0 / uIor.r).xy;
      vec2 rg = refract(e, n, 1.0 / uIor.g).xy;
      vec2 rb = refract(e, n, 1.0 / uIor.b).xy;

      vec3 col = vec3(0.0);
      for (int i = 0; i < SAMPLES; i++) {
        float k = float(i) / float(SAMPLES - 1) * uChroma;
        col.r += texture2D(uLight, base + rr * (uRefract + k * 0.05)).r;
        col.g += texture2D(uLight, base + rg * (uRefract + k * 0.10)).g;
        col.b += texture2D(uLight, base + rb * (uRefract + k * 0.15)).b;
      }
      col /= float(SAMPLES);

      // Faces de face plus sombres, arêtes rasantes plus lumineuses
      float facing = clamp(dot(-e, n), 0.0, 1.0);
      col *= 0.42 + 0.58 * smoothstep(0.0, 0.65, 1.0 - facing);

      // Arêtes blanc os : Fresnel + reflet spéculaire
      float fres = pow(1.0 - facing, uFresnel);
      vec3 h = normalize(uLightDir - e);
      float spec = pow(max(dot(n, h), 0.0), 80.0);
      col += vec3(1.0, 0.992, 0.976) * (fres * 0.8 + spec * uShine);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ---------- Composition ---------- */
  // p : position (grappe du hero) · c : position (section contact)
  // s : taille · r : rotation initiale · w : vitesse de rotation
  const CUBES = [
    { p: [-1.75,  0.95,  0.10], c: [-1.05,  1.05,  0.2], s: 1.30, r: [0.62, 0.78, 0.18], w: [0.07, 0.10, 0.03] },
    { p: [ 0.05,  1.45, -0.80], c: [ 0.75,  1.45, -0.6], s: 0.95, r: [0.30, 0.45, 0.60], w: [0.09, 0.06, 0.04] },
    { p: [ 1.55,  0.40,  0.35], c: [ 1.65,  0.05,  0.3], s: 1.55, r: [0.85, 0.35, 0.40], w: [0.05, 0.08, 0.02] },
    { p: [-0.45, -0.70,  0.85], c: [ 0.05, -0.55,  0.8], s: 1.15, r: [0.40, 0.90, 0.10], w: [0.08, 0.05, 0.05] },
    { p: [ 0.95, -1.40, -0.55], c: [ 1.35, -1.55, -0.4], s: 0.80, r: [0.95, 0.20, 0.75], w: [0.06, 0.11, 0.03] },
    { p: [-2.25, -1.25, -0.70], c: [-1.45, -1.35, -0.8], s: 0.60, r: [0.20, 0.65, 0.95], w: [0.10, 0.07, 0.06] },
  ];

  Promise.all([import('three'), import('three/addons/geometries/RoundedBoxGeometry.js')])
    .then(([THREE, mod]) => setup(THREE, mod.RoundedBoxGeometry))
    .catch(fail);

  function setup(THREE, RoundedBoxGeometry) {
    THREE.ColorManagement.enabled = false;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (err) {
      fail(err);
      return;
    }
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x101010, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.autoClear = false;

    // Plans plein écran (champ de lumière + fond)
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadCam = new THREE.Camera();
    const fullscreen = material => {
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(quadGeo, material);
      mesh.frustumCulled = false;
      scene.add(mesh);
      return scene;
    };

    const shared = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uPointer: { value: new THREE.Vector2() },
    };

    const lightMat = new THREE.ShaderMaterial({
      uniforms: { ...shared, uPulse: { value: 0 }, uScroll: { value: 0 } },
      vertexShader: QUAD_VERT,
      fragmentShader: LIGHT_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const bgMat = new THREE.ShaderMaterial({
      uniforms: { ...shared, uIntro: { value: 0 } },
      vertexShader: QUAD_VERT,
      fragmentShader: BG_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const lightScene = fullscreen(lightMat);
    const bgScene = fullscreen(bgMat);

    const lightRT = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false });
    lightRT.texture.generateMipmaps = false;
    lightRT.texture.minFilter = THREE.LinearFilter;
    lightRT.texture.magFilter = THREE.LinearFilter;

    const glassMat = new THREE.ShaderMaterial({
      uniforms: {
        uLight: { value: lightRT.texture },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uIor: { value: new THREE.Vector3(1.14, 1.17, 1.21) },
        uRefract: { value: 0.55 },
        uChroma: { value: 1 },
        uFresnel: { value: 3.0 },
        uScreenMix: { value: 0.4 },
        uShine: { value: 1.1 },
        uLightDir: { value: new THREE.Vector3(-0.45, 0.75, 0.55).normalize() },
      },
      vertexShader: GLASS_VERT,
      fragmentShader: GLASS_FRAG,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 11);
    const group = new THREE.Group();
    scene.add(group);

    const geometry = new RoundedBoxGeometry(1, 1, 1, 5, 0.075);
    const cubes = CUBES.map((data, i) => {
      const mesh = new THREE.Mesh(geometry, glassMat);
      mesh.userData = { ...data, i };
      group.add(mesh);
      return mesh;
    });

    /* ---------- Dimensions ---------- */
    const buffer = new THREE.Vector2();
    const CONTACT_SCALE = 0.78;
    let fit = 1;
    let contactShift = 0;
    let contactLift = 0;

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.getDrawingBufferSize(buffer);
      glassMat.uniforms.uResolution.value.copy(buffer);
      lightRT.setSize(Math.max(2, Math.round(buffer.x * 0.5)), Math.max(2, Math.round(buffer.y * 0.5)));
      shared.uAspect.value = aspect;
      const viewW = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
      fit = Math.min(1, (viewW * 0.84) / 5.6);
      // Sur grand écran, la grappe se range en haut à droite, loin de l'e-mail et du bouton
      contactShift = aspect > 1.15 ? viewW * 0.2 : 0;
      contactLift = aspect > 1.15 ? 0.55 : 0.9;
    };

    /* ---------- Animation ---------- */
    const clamp01 = x => Math.min(1, Math.max(0, x));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOutExpo = x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
    const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    let elapsed = 0;

    const renderFrame = dt => {
      if (!reduced) elapsed += dt;
      const t = elapsed;

      if (autoPointer && !reduced) {
        state.px = Math.sin(t * 0.25) * 0.5;
        state.py = Math.cos(t * 0.2) * 0.3;
      }

      if (reduced) {
        state.scrollS = state.scroll;
        state.contactS = state.contact;
        state.pxS = state.px;
        state.pyS = state.py;
      } else {
        const damp = k => 1 - Math.exp(-k * dt);
        state.scrollS = lerp(state.scrollS, state.scroll, damp(7));
        state.contactS = lerp(state.contactS, state.contact, damp(5));
        state.pxS = lerp(state.pxS, state.px, damp(2.5));
        state.pyS = lerp(state.pyS, state.py, damp(2.5));
      }
      state.pulse = Math.max(0, state.pulse - dt * 1.3);

      const introRaw = reduced ? 1 : (state.introAt ? clamp01((performance.now() - state.introAt) / 2600) : 0);
      const inContact = state.contactS > 0.001;
      const sc = inContact ? 0 : state.scrollS;
      const ct = easeInOut(clamp01(state.contactS));

      cubes.forEach(mesh => {
        const d = mesh.userData;
        const e = reduced ? 1 : easeOutExpo(clamp01(introRaw * 1.6 - d.i * 0.09));
        const bob = Math.sin(t * 0.55 + d.i * 1.7) * 0.09;

        // Hero : la grappe s'ouvre et s'approche quand on défile
        const spread = 1 + sc * 1.5;
        let x = d.p[0] * spread * fit;
        let y = d.p[1] * spread * fit + sc * 0.6;
        let z = d.p[2] + sc * (d.i % 2 ? 2.4 : -1.2);

        // Contact : les cubes reviennent se rassembler
        if (inContact) {
          const cx = d.c[0] * fit * CONTACT_SCALE + contactShift;
          const cy = d.c[1] * fit * CONTACT_SCALE + contactLift;
          const cz = d.c[2];
          x = lerp(cx * 3.2, cx, ct);
          y = lerp(cy * 2.4 - 4.5, cy, ct);
          z = lerp(cz + 3, cz, ct);
        }

        mesh.position.set(x + state.pxS * 0.12 * (d.p[2] + 1), y + bob * e, z);
        mesh.rotation.set(
          d.r[0] + t * d.w[0] + sc * (1.4 + d.i * 0.25) + (1 - e) * 2.2 + (inContact ? (1 - ct) * 3 : 0),
          d.r[1] + t * d.w[1] + sc * 0.9 + (1 - e) * 1.4,
          d.r[2] + t * d.w[2]
        );
        mesh.scale.setScalar(Math.max(0.0001, d.s * fit * (inContact ? CONTACT_SCALE : e) * (1 - sc * 0.15)));
      });

      group.rotation.y = state.pxS * 0.32;
      group.rotation.x = -state.pyS * 0.22;
      group.rotation.z = sc * 0.2;

      const introEase = reduced ? 1 : easeOutExpo(introRaw);
      shared.uTime.value = t;
      shared.uPointer.value.set(state.pxS, state.pyS);
      lightMat.uniforms.uPulse.value = state.pulse;
      lightMat.uniforms.uScroll.value = sc;
      bgMat.uniforms.uIntro.value = reduced ? 1 : easeOutExpo(clamp01(introRaw * 1.3));
      // Mise au point : la dispersion est forte à l'apparition puis se resserre
      glassMat.uniforms.uChroma.value = 1 + (1 - introEase) * 4 + state.pulse * 2.5 + sc * 1.5;

      renderer.setRenderTarget(lightRT);
      renderer.clear();
      renderer.render(lightScene, quadCam);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(bgScene, quadCam);
      renderer.render(scene, camera);
    };

    /* ---------- Boucle (en pause hors écran) ---------- */
    const clock = new THREE.Clock(false);
    let rafId = 0;

    const loop = () => {
      rafId = 0;
      if (!state.visible || document.hidden) { clock.stop(); return; }
      renderFrame(Math.min(clock.getDelta(), 1 / 20));
      rafId = requestAnimationFrame(loop);
    };

    wake = () => {
      if (rafId || !state.visible || document.hidden) return;
      clock.start();
      rafId = requestAnimationFrame(loop);
    };

    startIntro = () => {
      if (!state.introAt) {
        state.introAt = performance.now();
        canvas.classList.add('is-on');
      }
      wake();
    };

    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        if (!rafId) renderFrame(0);
      }, 120);
    });

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      cancelAnimationFrame(rafId);
      rafId = 0;
      state.visible = false;
      canvas.classList.remove('is-on');
      fail(new Error('Contexte WebGL perdu'));
    });

    try {
      resize();
      renderFrame(0); // compile les shaders avant l'apparition
    } catch (err) {
      fail(err);
      return;
    }

    state.ready = true;
    resolveReady(true);
    if (state.wantIntro) startIntro();
  }
})();
