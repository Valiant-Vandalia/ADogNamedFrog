import * as THREE from './vendor/three.module.min.js';

const canvas = document.querySelector('[data-frog-rpg]');

if (canvas) {
  const dom = {
    shell: document.querySelector('[data-game-shell]'),
    stage: document.querySelector('[data-game-stage]'),
    announce: document.querySelector('[data-game-announce]'),
    quest: document.querySelector('[data-quest-text]'),
    zone: document.querySelector('[data-game-zone]'),
    life: document.querySelector('[data-game-life]'),
    lifeMobile: document.querySelector('[data-game-life-mobile]'),
    sparks: document.querySelector('[data-game-sparks]'),
    day: document.querySelector('[data-game-day]'),
    start: document.querySelector('[data-game-start]'),
    continue: document.querySelector('[data-game-continue]'),
    startCard: document.querySelector('[data-game-start-card]'),
    interact: document.querySelector('[data-game-interact]'),
    actionIcon: document.querySelector('[data-game-action-icon]'),
    actionLabel: document.querySelector('[data-game-action-label]'),
    hint: document.querySelector('[data-game-hint]'),
    map: document.querySelector('[data-game-map]'),
    journal: document.querySelector('[data-game-journal]'),
    pack: document.querySelector('[data-game-pack]'),
    exit: document.querySelector('[data-game-exit]'),
    saves: document.querySelector('[data-game-saves]'),
    savesQuick: document.querySelector('[data-game-saves-quick]'),
    sniff: document.querySelector('[data-game-sniff]'),
    bark: document.querySelector('[data-game-bark]'),
    dodge: document.querySelector('[data-game-dodge]'),
    reset: document.querySelector('[data-game-reset]'),
    expand: document.querySelector('[data-game-expand]'),
    panel: document.querySelector('[data-game-panel]'),
    panelContent: document.querySelector('[data-game-panel-content]'),
    panelClose: document.querySelector('[data-game-panel-close]'),
    saveBadge: document.querySelector('[data-save-badge]'),
    dangerVignette: document.querySelector('[data-danger-vignette]'),
    bossHud: document.querySelector('[data-boss-hud]'),
    bossHealth: document.querySelector('[data-boss-health]'),
    bossPhase: document.querySelector('[data-boss-phase]')
  };

  const SAVE_KEY = 'adnf-sunny-valley-autosave-v2';
  const LEGACY_SAVE_KEY = 'adnf-frog-farmyard-quest-3d-v1';
  const SLOT_PREFIX = 'adnf-sunny-valley-slot-';
  const WORLD = { minX: -25, maxX: 25, minZ: -19, maxZ: 19 };
  const pond = { x: 13, z: 6, rx: 6.2, rz: 4.3 };
  const obstacles = [
    { x: -13, z: -9, w: 9.6, d: 6.6 },
    { x: -15, z: 8.6, w: 7.2, d: 5.5 },
    { x: 15.5, z: -11.2, w: 7.8, d: 5.6 },
    { x: -7.1, z: -11.3, w: 4.4, d: 4.4 }
  ];

  const freshGarden = () => ['empty', 'empty', 'empty', 'empty'];
  const freshFlags = () => ({ metDad:false, pipJoined:false, stoneRead:false, bramblesOpen:false, snackMade:false, millOpen:false, bossWon:false, chapterWon:false });
  const state = {
    started: false,
    expanded: false,
    panelOpen: false,
    stage: 0,
    petals: 0,
    shards: 0,
    friendship: 0,
    health: 5,
    maxHealth: 5,
    day: 1,
    clock: 8.2,
    seeds: 4,
    berries: 0,
    biscuits: 0,
    harvests: 0,
    flags: freshFlags(),
    garden: freshGarden(),
    taken: new Set(),
    target: new THREE.Vector3(-9, 0, 0),
    loadedPosition: null,
    activeEntity: null,
    toastTimer: 0,
    saveTimer: 0,
    saveBadgeTimer: 0,
    lastDamageAt: -99,
    sniffUntil: 0,
    sniffReadyAt: 0,
    barkReadyAt: 0,
    dodgeReadyAt: 0,
    dodgingUntil: 0,
    bossActive: false,
    bossHealth: 8,
    bossMaxHealth: 8,
    bossPhase: 0,
    bossStartedAt: 0,
    bossAttackAt: 0,
    playSeconds: 0
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizedSave(saved) {
    if (!saved || typeof saved !== 'object') return null;
    return {
      stage: clamp(Number(saved.stage) || 0, 0, 13),
      petals: clamp(Number(saved.petals) || 0, 0, 3),
      shards: clamp(Number(saved.shards) || 0, 0, 6),
      friendship: clamp(Number(saved.friendship) || 0, 0, 999),
      health: clamp(Number(saved.health) || 5, 1, 5),
      day: clamp(Number(saved.day) || 1, 1, 999),
      clock: clamp(Number(saved.clock) || 8.2, 5, 23),
      seeds: clamp(Number(saved.seeds) || 0, 0, 99),
      berries: clamp(Number(saved.berries) || 0, 0, 99),
      biscuits: clamp(Number(saved.biscuits) || 0, 0, 12),
      harvests: clamp(Number(saved.harvests) || 0, 0, 999),
      flags: { ...freshFlags(), ...(saved.flags || {}) },
      garden: Array.isArray(saved.garden) && saved.garden.length === 4 ? saved.garden.map((phase) => ['empty','seeded','growing','ready'].includes(phase) ? phase : 'empty') : freshGarden(),
      taken: Array.isArray(saved.taken) ? saved.taken : [],
      position: saved.position && Number.isFinite(saved.position.x) && Number.isFinite(saved.position.z) ? { x: clamp(saved.position.x, WORLD.minX + 1, WORLD.maxX - 1), z: clamp(saved.position.z, WORLD.minZ + 1, WORLD.maxZ - 1) } : { x:-9, z:0 },
      bossHealth: clamp(Number(saved.bossHealth) || 8, 1, 8),
      playSeconds: Math.max(0, Number(saved.playSeconds) || 0),
      savedAt: Number(saved.savedAt) || Date.now()
    };
  }

  function applySave(saved) {
    const clean = normalizedSave(saved);
    if (!clean) return false;
    Object.assign(state, clean);
    state.taken = new Set(clean.taken);
    state.flags = clean.flags;
    state.garden = clean.garden;
    state.loadedPosition = clean.position;
    state.bossActive = false;
    state.bossPhase = 0;
    if(state.stage===11) state.stage=10;
    return true;
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) applySave(JSON.parse(raw));
      else if (localStorage.getItem(LEGACY_SAVE_KEY)) localStorage.setItem('adnf-sunny-valley-legacy-seen', '1');
    } catch (error) {
      localStorage.removeItem(SAVE_KEY);
    }
  }

  function saveData() {
    const position = typeof frog !== 'undefined' ? { x:frog.position.x, z:frog.position.z } : (state.loadedPosition || { x:-9, z:0 });
    return {
      version: 2,
      stage: state.stage,
      petals: state.petals,
      shards: state.shards,
      friendship: state.friendship,
      health: state.health,
      day: state.day,
      clock: state.clock,
      seeds: state.seeds,
      berries: state.berries,
      biscuits: state.biscuits,
      harvests: state.harvests,
      flags: state.flags,
      garden: state.garden,
      taken: [...state.taken],
      position,
      bossHealth: state.bossActive ? state.bossHealth : 8,
      playSeconds: state.playSeconds,
      savedAt: Date.now()
    };
  }

  function flashSaved(label = 'Progress saved') {
    if (!dom.saveBadge) return;
    window.clearTimeout(state.saveBadgeTimer);
    dom.saveBadge.textContent = label;
    dom.saveBadge.classList.add('is-visible');
    state.saveBadgeTimer = window.setTimeout(() => dom.saveBadge.classList.remove('is-visible'), 1500);
  }

  function saveProgress(showBadge = true) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData()));
      if (showBadge) flashSaved();
    } catch (error) {
      // The adventure remains playable when private browsing blocks storage.
    }
  }

  loadProgress();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    const message = document.createElement('div');
    message.className = 'game-error';
    message.textContent = 'This 3D adventure needs WebGL. Please open the page in the latest Safari, Chrome, or Edge.';
    dom.stage.appendChild(message);
    throw error;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8dff0);
  scene.fog = new THREE.Fog(0xc6e7d4, 34, 72);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const cameraFocus = new THREE.Vector3(-9, 0, 0);
  const cameraOffset = new THREE.Vector3(12.8, 14.2, 18.2);
  camera.position.copy(cameraFocus).add(cameraOffset);
  camera.lookAt(cameraFocus);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  const clickableGround = [];
  const animated = [];
  const entities = [];
  const itemMeshes = new Map();
  const gardenVisuals = [];
  const enemies = [];
  const effects = [];
  const mats = {};

  function material(name, color, options = {}) {
    if (!mats[name]) {
      mats[name] = new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.78,
        metalness: options.metalness ?? 0,
        flatShading: options.flatShading ?? false,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1
      });
    }
    return mats[name];
  }

  const palette = {
    grass: material('grass', 0x83c952),
    grassLight: material('grassLight', 0xa4d968),
    grassDark: material('grassDark', 0x5ea544),
    path: material('path', 0xe8bd65),
    pathLight: material('pathLight', 0xf6d888),
    red: material('red', 0xd84435),
    redDark: material('redDark', 0x9f2f2b),
    cream: material('cream', 0xfff3cd),
    white: material('white', 0xfffbeb),
    wood: material('wood', 0x8b5537),
    woodLight: material('woodLight', 0xb87945),
    roof: material('roof', 0x9d3d32),
    blue: material('blue', 0x4ca9d1),
    yellow: material('yellow', 0xf6c43f),
    black: material('black', 0x211b1a),
    tan: material('tan', 0xe58d2d),
    collar: material('collar', 0xe43f35),
    pink: material('pink', 0xf18b9c),
    green: material('green', 0x61b852),
    greenLight: material('greenLight', 0x91d66a),
    soil: material('soil', 0x8d5a39),
    stone: material('stone', 0x747d93),
    purple: material('purple', 0x8b5ab1),
    water: material('water', 0x43b9d5, { roughness: 0.28, emissive: 0x167d9c, emissiveIntensity: 0.2 }),
    glass: material('glass', 0x87d8ee, { roughness: 0.15 }),
    skin: material('skin', 0xf4b988),
    denim: material('denim', 0x315f86),
    orange: material('orange', 0xee8f32)
  };

  function applyShadow(object, cast = true, receive = true) {
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = cast;
      child.receiveShadow = receive;
    });
    return object;
  }

  function addMesh(parent, geometry, mat, x = 0, y = 0, z = 0, options = {}) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    if (options.rotation) mesh.rotation.set(...options.rotation);
    if (options.scale) mesh.scale.set(...options.scale);
    mesh.castShadow = options.cast ?? true;
    mesh.receiveShadow = options.receive ?? true;
    parent.add(mesh);
    return mesh;
  }

  const hemisphere = new THREE.HemisphereLight(0xcff2ff, 0x679348, 2.5);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffe7b0, 3.7);
  sun.position.set(-14, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -31;
  sun.shadow.camera.right = 31;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0007;
  scene.add(sun);

  function createGround() {
    const ground = addMesh(scene, new THREE.PlaneGeometry(54, 42), palette.grass, 0, -0.04, 0, { rotation: [-Math.PI / 2, 0, 0], cast: false });
    ground.receiveShadow = true;
    clickableGround.push(ground);

    const meadow = addMesh(scene, new THREE.CircleGeometry(11, 48), palette.grassLight, 5, 0, 2, { rotation: [-Math.PI / 2, 0, 0], scale: [1.25, 1, 0.75], cast: false });
    meadow.receiveShadow = true;

    const pathPoints = [
      [-23, -1, 4.6, 2.3], [-18, -1, 5.2, 2.25], [-12.5, -.3, 5.5, 2.35], [-7, .5, 5.4, 2.2], [-1.5, .4, 5.5, 2.2],
      [4, .8, 5.5, 2.15], [9, 2.3, 5.2, 2], [13, 4.1, 5, 1.9], [16, -1.5, 2.1, 7.5], [16, -7.7, 2.1, 5.4]
    ];
    pathPoints.forEach(([x, z, sx, sz], index) => {
      addMesh(scene, new THREE.CircleGeometry(1, 30), index % 2 ? palette.pathLight : palette.path, x, 0.015, z, { rotation: [-Math.PI / 2, 0, 0], scale: [sx, sz, 1], cast: false });
    });

    const walkSurface = addMesh(scene, new THREE.PlaneGeometry(52, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 0.045, 0, { rotation: [-Math.PI / 2, 0, 0], cast: false, receive: false });
    clickableGround.push(walkSurface);

    const grassBladeGeometry = new THREE.ConeGeometry(.065, .38, 3);
    const grassInstances = new THREE.InstancedMesh(grassBladeGeometry, palette.grassDark, 150);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 150; i += 1) {
      const x = -24 + ((i * 7.37) % 48);
      const z = -18 + ((i * 11.91) % 36);
      if (Math.abs(z) < 2.4 || isInPond(x, z)) {
        dummy.position.set(x, -5, z);
      } else {
        dummy.position.set(x, .18, z);
      }
      const scale = .7 + (i % 5) * .09;
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = i * .73;
      dummy.updateMatrix();
      grassInstances.setMatrixAt(i, dummy.matrix);
    }
    grassInstances.receiveShadow = true;
    scene.add(grassInstances);
  }

  function createBarn(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    addMesh(group, new THREE.BoxGeometry(9.4, 5.4, 6.4), palette.red, 0, 2.7, 0);
    addMesh(group, new THREE.BoxGeometry(5.8, .55, 6.8), palette.redDark, -2.15, 5.75, 0, { rotation: [0, 0, .52] });
    addMesh(group, new THREE.BoxGeometry(5.8, .55, 6.8), palette.redDark, 2.15, 5.75, 0, { rotation: [0, 0, -.52] });
    addMesh(group, new THREE.BoxGeometry(2.5, 3.45, .16), palette.wood, 0, 1.75, 3.27);
    addMesh(group, new THREE.BoxGeometry(.16, 3.4, .2), palette.white, 0, 1.76, 3.4, { rotation: [0, 0, .6] });
    addMesh(group, new THREE.BoxGeometry(.16, 3.4, .2), palette.white, 0, 1.76, 3.4, { rotation: [0, 0, -.6] });
    addMesh(group, new THREE.BoxGeometry(1.45, 1.2, .18), palette.white, 0, 4.35, 3.32);
    addMesh(group, new THREE.BoxGeometry(1.05, .78, .2), palette.red, 0, 4.35, 3.45);
    [-3.35, 3.35].forEach((doorX) => addMesh(group, new THREE.BoxGeometry(1.35, 1.15, .2), palette.yellow, doorX, 2.65, 3.35));
    scene.add(applyShadow(group));
  }

  function createHouse(x, z, wallMat = palette.cream, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    addMesh(group, new THREE.BoxGeometry(7, 3.7, 5.3), wallMat, 0, 1.85, 0);
    addMesh(group, new THREE.ConeGeometry(5.15, 3.2, 4), palette.roof, 0, 5.05, 0, { rotation: [0, Math.PI / 4, 0], scale: [1, 1, .82] });
    addMesh(group, new THREE.BoxGeometry(1.35, 2.4, .16), palette.wood, 0, 1.2, 2.73);
    [-2.15, 2.15].forEach((windowX) => {
      addMesh(group, new THREE.BoxGeometry(1.15, 1.05, .16), palette.glass, windowX, 2.2, 2.74);
      addMesh(group, new THREE.BoxGeometry(.1, 1.08, .18), palette.white, windowX, 2.2, 2.84);
      addMesh(group, new THREE.BoxGeometry(1.18, .1, .18), palette.white, windowX, 2.2, 2.84);
    });
    addMesh(group, new THREE.BoxGeometry(.75, 2.4, .75), palette.redDark, 2.1, 5.35, -.5);
    scene.add(applyShadow(group));
  }

  function createSilo(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    addMesh(group, new THREE.CylinderGeometry(2.1, 2.1, 6.2, 20), material('silo', 0xb9b9a4), 0, 3.1, 0);
    addMesh(group, new THREE.ConeGeometry(2.35, 2.2, 20), material('siloRoof', 0xd8ddd1), 0, 7.25, 0);
    scene.add(applyShadow(group));
  }

  function createPond() {
    addMesh(scene, new THREE.CylinderGeometry(6.65, 6.65, .17, 48), palette.grassDark, pond.x, .04, pond.z, { scale: [1, 1, .71], cast: false });
    const water = addMesh(scene, new THREE.CylinderGeometry(6.15, 6.15, .2, 48), palette.water, pond.x, .13, pond.z, { scale: [1, 1, .68], cast: false });
    water.userData.baseY = water.position.y;
    animated.push({ type: 'water', object: water });
    const lilyMat = material('lily', 0x4a9d4b);
    [[-2.5,-.6,.52],[1.7,-1.4,.48],[2.8,1.1,.42],[-.4,1.4,.5],[-3.1,1.15,.4]].forEach(([dx,dz,size], index) => {
      addMesh(scene, new THREE.CylinderGeometry(size, size, .08, 18), lilyMat, pond.x + dx, .31, pond.z + dz, { cast: false });
      if (index % 2 === 0) addMesh(scene, new THREE.SphereGeometry(.16, 10, 8), palette.pink, pond.x + dx, .48, pond.z + dz);
    });
    const bridge = new THREE.Group();
    bridge.position.set(pond.x, .48, pond.z);
    for (let i = -5; i <= 5; i += 1) addMesh(bridge, new THREE.BoxGeometry(.74, .22, 2.4), i % 2 ? palette.woodLight : palette.wood, i * .72, 0, 0);
    scene.add(applyShadow(bridge));
  }

  function createTree(x, z, scale = 1, tint = palette.green) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    addMesh(group, new THREE.CylinderGeometry(.33, .48, 2.9, 8), palette.wood, 0, 1.45, 0);
    addMesh(group, new THREE.SphereGeometry(1.55, 10, 8), tint, 0, 3.25, 0, { scale: [1.1, .9, 1] });
    addMesh(group, new THREE.SphereGeometry(1.15, 10, 8), palette.greenLight, -.85, 3.1, .2);
    addMesh(group, new THREE.SphereGeometry(1.2, 10, 8), palette.grassDark, .85, 3.05, -.15);
    scene.add(applyShadow(group));
  }

  function createFence(x1, z1, x2, z2, sections) {
    const group = new THREE.Group();
    const dx = (x2 - x1) / sections;
    const dz = (z2 - z1) / sections;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    for (let i = 0; i <= sections; i += 1) {
      addMesh(group, new THREE.BoxGeometry(.22, 1.5, .22), palette.white, x1 + dx * i, .75, z1 + dz * i);
      if (i < sections) {
        const cx = x1 + dx * (i + .5);
        const cz = z1 + dz * (i + .5);
        [0.52, 1.1].forEach((y) => addMesh(group, new THREE.BoxGeometry(.16, .16, length + .1), palette.white, cx, y, cz, { rotation: [0, angle, 0] }));
      }
    }
    scene.add(applyShadow(group));
  }

  function createCloud(x, y, z, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    const cloudMat = material('cloud', 0xfff8e7, { roughness: 1 });
    addMesh(group, new THREE.SphereGeometry(1.35, 12, 8), cloudMat, 0, 0, 0, { cast: false, receive: false });
    addMesh(group, new THREE.SphereGeometry(1.05, 12, 8), cloudMat, -1.1, -.15, 0, { cast: false, receive: false });
    addMesh(group, new THREE.SphereGeometry(1.1, 12, 8), cloudMat, 1.15, -.18, .05, { cast: false, receive: false });
    scene.add(group);
    animated.push({ type: 'cloud', object: group, startX: x, speed: .2 + scale * .05 });
  }

  function createDog() {
    const group = new THREE.Group();
    group.position.set(-9, 0, 0);
    const body = addMesh(group, new THREE.SphereGeometry(1, 16, 12), palette.black, 0, 1.05, 0, { scale: [.72, .62, 1.05] });
    const head = addMesh(group, new THREE.SphereGeometry(.74, 16, 12), palette.black, 0, 1.72, .74, { scale: [1, .95, .92] });
    addMesh(group, new THREE.SphereGeometry(.45, 14, 10), palette.tan, 0, 1.55, 1.34, { scale: [1.08, .62, .86] });
    addMesh(group, new THREE.SphereGeometry(.19, 12, 8), palette.black, 0, 1.62, 1.72, { scale: [1.2, .8, .7] });
    [-.37, .37].forEach((x) => {
      addMesh(group, new THREE.SphereGeometry(.22, 12, 8), palette.black, x, 2.13, .66, { scale: [1.2, .8, 1.7], rotation: [.35, 0, x < 0 ? -.42 : .42] });
      addMesh(group, new THREE.SphereGeometry(.105, 12, 8), palette.white, x * .58, 1.91, 1.31);
      addMesh(group, new THREE.SphereGeometry(.052, 10, 8), palette.black, x * .58, 1.91, 1.405);
      addMesh(group, new THREE.SphereGeometry(.095, 12, 8), palette.tan, x * .58, 2.08, 1.23, { scale: [1.25, .55, .55] });
    });
    addMesh(group, new THREE.TorusGeometry(.48, .075, 8, 24), palette.collar, 0, 1.46, .48, { rotation: [Math.PI / 2, 0, 0], scale: [1, 1, .8] });
    addMesh(group, new THREE.SphereGeometry(.11, 10, 8), palette.yellow, 0, 1.18, .91);
    addMesh(group, new THREE.SphereGeometry(.18, 12, 8), palette.pink, 0, 1.37, 1.62, { scale: [.55, .35, 1.1], rotation: [-.35, 0, 0] });
    const legs = [];
    [[-.42,.55], [.42,.55], [-.42,-.58], [.42,-.58]].forEach(([x,z], index) => {
      const leg = new THREE.Group();
      leg.position.set(x, .62, z);
      addMesh(leg, new THREE.CylinderGeometry(.19, .23, .78, 10), index < 2 ? palette.tan : palette.black, 0, -.25, 0);
      addMesh(leg, new THREE.SphereGeometry(.25, 10, 8), palette.tan, 0, -.64, .12, { scale: [1.05, .6, 1.35] });
      group.add(leg);
      legs.push(leg);
    });
    const tail = new THREE.Group();
    tail.position.set(0, 1.15, -1);
    addMesh(tail, new THREE.CylinderGeometry(.11, .18, 1.2, 9), palette.black, 0, .48, 0, { rotation: [.75, 0, 0] });
    group.add(tail);
    group.userData = { body, head, legs, tail };
    scene.add(applyShadow(group));
    return group;
  }

  function createFrogNpc(x, z, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    addMesh(group, new THREE.SphereGeometry(.62, 14, 10), palette.green, 0, .62, 0, { scale: [1.1, .8, 1] });
    [-.28, .28].forEach((eyeX) => {
      addMesh(group, new THREE.SphereGeometry(.24, 12, 9), palette.greenLight, eyeX, 1.05, .12);
      addMesh(group, new THREE.SphereGeometry(.13, 10, 8), palette.white, eyeX, 1.08, .28);
      addMesh(group, new THREE.SphereGeometry(.06, 8, 6), palette.black, eyeX, 1.08, .39);
    });
    addMesh(group, new THREE.SphereGeometry(.14, 10, 8), palette.pink, 0, .48, .58, { scale: [1.4, .4, .5] });
    [-.48,.48].forEach((footX) => addMesh(group, new THREE.SphereGeometry(.25, 10, 8), palette.greenLight, footX, .18, .22, { scale: [1.45,.45,.75] }));
    scene.add(applyShadow(group));
    return group;
  }

  function createFarmer(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    addMesh(group, new THREE.CylinderGeometry(.52, .64, 1.55, 10), palette.denim, 0, 1.05, 0);
    addMesh(group, new THREE.SphereGeometry(.48, 12, 10), palette.skin, 0, 2.05, 0);
    addMesh(group, new THREE.CylinderGeometry(.72, .72, .12, 18), palette.woodLight, 0, 2.48, 0);
    addMesh(group, new THREE.CylinderGeometry(.46, .58, .35, 18), palette.woodLight, 0, 2.65, 0);
    [-.28,.28].forEach((eyeX) => addMesh(group, new THREE.SphereGeometry(.045, 8, 6), palette.black, eyeX, 2.12, .43));
    scene.add(applyShadow(group));
    return group;
  }

  function createBunny(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const bunnyMat = material('bunny', 0xe2ddd2);
    addMesh(group, new THREE.SphereGeometry(.48, 12, 10), bunnyMat, 0, .62, 0, { scale: [1,.95,1.15] });
    addMesh(group, new THREE.SphereGeometry(.4, 12, 10), bunnyMat, 0, 1.25, .12);
    [-.19,.19].forEach((earX) => {
      addMesh(group, new THREE.SphereGeometry(.18, 10, 8), bunnyMat, earX, 1.89, .05, { scale: [.75,2.15,.7], rotation: [0,0,earX < 0 ? -.08 : .08] });
      addMesh(group, new THREE.SphereGeometry(.09, 10, 8), palette.pink, earX, 1.9, .16, { scale: [.65,1.8,.5] });
      addMesh(group, new THREE.SphereGeometry(.055, 8, 6), palette.black, earX, 1.36, .47);
    });
    addMesh(group, new THREE.SphereGeometry(.09, 10, 8), palette.pink, 0, 1.2, .56);
    scene.add(applyShadow(group));
    return group;
  }

  function createHen(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    addMesh(group, new THREE.SphereGeometry(.5, 12, 10), palette.white, 0, .65, 0, { scale: [1,.92,1.1] });
    addMesh(group, new THREE.SphereGeometry(.32, 12, 10), palette.cream, 0, 1.22, .28);
    addMesh(group, new THREE.ConeGeometry(.13, .38, 4), palette.yellow, 0, 1.18, .68, { rotation: [Math.PI / 2, 0, 0] });
    [-.1,.1].forEach((combX) => addMesh(group, new THREE.SphereGeometry(.1, 8, 6), palette.red, combX, 1.58, .2));
    scene.add(applyShadow(group));
    return group;
  }

  function createStoryStone(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    addMesh(group, new THREE.DodecahedronGeometry(.8, 0), palette.stone, 0, .85, 0, { scale: [.8,1.35,.6] });
    addMesh(group, new THREE.OctahedronGeometry(.22, 0), palette.purple, 0, 1.05, .49, { rotation: [0,0,Math.PI / 4] });
    scene.add(applyShadow(group));
    return group;
  }

  function createGarden() {
    const positions = [[-11.2,8.1],[-9.5,8.1],[-11.2,10],[-9.5,10]];
    positions.forEach(([x,z], index) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      addMesh(group, new THREE.BoxGeometry(1.45,.18,1.45), palette.woodLight, 0,.1,0);
      addMesh(group, new THREE.BoxGeometry(1.18,.14,1.18), palette.soil, 0,.21,0);
      const plant = new THREE.Group();
      plant.position.y = .24;
      group.add(plant);
      scene.add(applyShadow(group));
      gardenVisuals.push({ group, plant, index, x, z });
      entities.push({ id: `garden-${index}`, type: 'garden', name: 'Moonberry plot', position: new THREE.Vector3(x,0,z), index });
    });
    refreshGardenVisuals();
  }

  function refreshGardenVisuals() {
    gardenVisuals.forEach(({ plant, index }) => {
      while (plant.children.length) plant.remove(plant.children[0]);
      const phase = state.garden[index];
      if (phase === 'empty') return;
      if (phase === 'seeded') {
        addMesh(plant, new THREE.SphereGeometry(.09,8,6), palette.yellow, 0,.1,0);
        return;
      }
      addMesh(plant, new THREE.CylinderGeometry(.045,.055,.62,8), palette.green, 0,.32,0);
      addMesh(plant, new THREE.SphereGeometry(.19,9,7), palette.greenLight, -.16,.5,0, { scale:[1.2,.45,.7] });
      addMesh(plant, new THREE.SphereGeometry(.19,9,7), palette.greenLight, .16,.67,0, { scale:[1.2,.45,.7] });
      if (phase === 'ready') {
        [-.18,0,.18].forEach((x,i) => addMesh(plant, new THREE.SphereGeometry(.12,10,8), palette.purple, x,.78 + (i%2)*.1,.03));
      }
    });
  }

  function createItems() {
    const specs = [
      { id:'petal-1', type:'petal', x:8, z:3.8 }, { id:'petal-2', type:'petal', x:17.5, z:8.6 }, { id:'petal-3', type:'petal', x:10.8, z:11.4 },
      { id:'shard-1', type:'shard', x:-1.5, z:7.8 }, { id:'shard-2', type:'shard', x:12.2, z:-3.8 }, { id:'shard-3', type:'shard', x:4.2, z:-9.2 }
    ];
    specs.forEach((spec, index) => {
      const group = new THREE.Group();
      group.position.set(spec.x,.65,spec.z);
      if (spec.type === 'petal') {
        for (let p = 0; p < 5; p += 1) {
          const petal = addMesh(group, new THREE.SphereGeometry(.18,10,8), palette.cream, 0,0,0, { scale:[.7,.28,1.45] });
          petal.rotation.y = p * Math.PI * 2 / 5;
          petal.position.x = Math.sin(p * Math.PI * 2 / 5) * .22;
          petal.position.z = Math.cos(p * Math.PI * 2 / 5) * .22;
        }
        addMesh(group,new THREE.SphereGeometry(.12,9,7),palette.yellow,0,.03,0);
      } else {
        const shardMat = material('storyShard', 0xffdc73, { roughness:.2, emissive:0xff9f32, emissiveIntensity:.9 });
        addMesh(group,new THREE.OctahedronGeometry(.33,0),shardMat,0,.12,0,{scale:[.7,1.6,.7]});
        addMesh(group,new THREE.TorusGeometry(.38,.035,6,24),palette.yellow,0,.05,0,{rotation:[Math.PI/2,0,0],cast:false});
      }
      group.visible = false;
      scene.add(applyShadow(group));
      const entity = { ...spec, name: spec.type === 'petal' ? 'Lily petal' : 'Story-light shard', position:new THREE.Vector3(spec.x,0,spec.z), object:group };
      entities.push(entity);
      itemMeshes.set(spec.id, group);
      animated.push({ type:'item', object:group, baseY:.65, offset:index });
    });
    refreshItems();
  }

  function refreshItems() {
    entities.filter((entity) => entity.type === 'petal' || entity.type === 'shard').forEach((entity) => {
      const active = (entity.type === 'petal' && state.stage === 5) || (entity.type === 'shard' && state.stage === 8 && entity.unlocked);
      entity.object.visible = active && !state.taken.has(entity.id);
    });
  }

  function createTortoise(x, z) {
    const group = new THREE.Group();
    group.position.set(x,0,z);
    const shell = material('tortoiseShell',0x6c803c);
    addMesh(group,new THREE.SphereGeometry(.58,16,12),shell,0,.55,0,{scale:[1.1,.65,1.25]});
    addMesh(group,new THREE.SphereGeometry(.28,14,10),palette.greenLight,0,.48,.75,{scale:[.9,.8,1.1]});
    [[-.42,.48],[.42,.48],[-.42,-.45],[.42,-.45]].forEach(([px,pz])=>addMesh(group,new THREE.SphereGeometry(.16,10,8),palette.green,px,.2,pz,{scale:[1,.55,1.2]}));
    [-.1,.1].forEach(px=>addMesh(group,new THREE.SphereGeometry(.035,8,6),palette.black,px,.55,1));
    scene.add(applyShadow(group));
    return group;
  }

  function createWindmill(x,z) {
    const group = new THREE.Group();
    group.position.set(x,0,z);
    const faded = material('millWall',0x765b50);
    addMesh(group,new THREE.CylinderGeometry(2.5,3.15,6.5,16),faded,0,3.25,0);
    addMesh(group,new THREE.ConeGeometry(3.05,2.8,16),material('millRoof',0x3c3440),0,7.9,0);
    addMesh(group,new THREE.BoxGeometry(1.35,2.5,.18),palette.wood,0,1.35,3.05);
    const rotor = new THREE.Group();
    rotor.position.set(0,5.5,3.2);
    addMesh(rotor,new THREE.CylinderGeometry(.32,.32,.5,12),palette.woodLight,0,0,0,{rotation:[Math.PI/2,0,0]});
    for(let i=0;i<4;i+=1){
      const blade=new THREE.Group();
      blade.rotation.z=i*Math.PI/2;
      addMesh(blade,new THREE.BoxGeometry(.24,3.7,.16),palette.woodLight,0,1.85,0);
      addMesh(blade,new THREE.BoxGeometry(.92,1.7,.11),material('millSail',0xd9c7a1),0,2.45,.02,{rotation:[0,0,-.12]});
      rotor.add(blade);
    }
    group.add(rotor);
    group.userData.rotor=rotor;
    scene.add(applyShadow(group));
    animated.push({type:'rotor',object:rotor});
    return group;
  }

  function createGloamling(id,x,z) {
    const group=new THREE.Group();
    group.position.set(x,0,z);
    const gloom=material('gloom',0x34233d,{roughness:.5,emissive:0x371044,emissiveIntensity:.38});
    const eye=material('gloomEye',0xffc84b,{roughness:.2,emissive:0xff7c21,emissiveIntensity:1.4});
    const body=addMesh(group,new THREE.SphereGeometry(.55,14,10),gloom,0,.55,0,{scale:[1,.75,1.1]});
    for(let i=0;i<7;i+=1){
      const a=i/7*Math.PI*2;
      addMesh(group,new THREE.ConeGeometry(.11,.62,7),gloom,Math.sin(a)*.5,.74,Math.cos(a)*.5,{rotation:[Math.PI/2-Math.cos(a)*.55,0,-a]});
    }
    [-.19,.19].forEach(px=>addMesh(group,new THREE.SphereGeometry(.075,10,8),eye,px,.66,.5));
    scene.add(applyShadow(group));
    const enemy={id,type:'enemy',name:'Gloamling',object:group,position:group.position,home:new THREE.Vector3(x,0,z),health:2,maxHealth:2,alive:true,stunnedUntil:0,body,shardId:id.replace('gloam','shard')};
    enemies.push(enemy);
    entities.push(enemy);
    return enemy;
  }

  function createBoss(x,z) {
    const group=new THREE.Group();
    group.position.set(x,0,z);
    const straw=material('bossStraw',0x7e653a);
    const coat=material('bossCoat',0x3b263e,{emissive:0x240b31,emissiveIntensity:.3});
    const glow=material('bossGlow',0xff7b35,{roughness:.2,emissive:0xff3d24,emissiveIntensity:1.25});
    const body=addMesh(group,new THREE.CylinderGeometry(.75,1.05,2.6,10),coat,0,2,0);
    const head=addMesh(group,new THREE.SphereGeometry(.72,14,10),straw,0,3.52,0,{scale:[1,.9,.86]});
    const heart=addMesh(group,new THREE.OctahedronGeometry(.24,0),glow,0,2.2,.78,{scale:[.8,1.2,.55]});
    addMesh(group,new THREE.ConeGeometry(1.35,.65,16),coat,0,4.15,0);
    addMesh(group,new THREE.CylinderGeometry(.72,.9,.5,14),coat,0,4.45,0);
    [-.25,.25].forEach(px=>addMesh(group,new THREE.SphereGeometry(.11,10,8),glow,px,3.62,.6));
    addMesh(group,new THREE.BoxGeometry(.54,.09,.08),glow,0,3.3,.67,{rotation:[0,0,.1]});
    const arms=[];
    [-1,1].forEach(side=>{
      const arm=new THREE.Group();
      arm.position.set(side*.72,2.65,0);
      addMesh(arm,new THREE.CylinderGeometry(.12,.17,2.8,8),straw,side*.95,-.25,0,{rotation:[0,0,side*1.2]});
      group.add(arm); arms.push(arm);
    });
    const legs=[];
    [-.45,.45].forEach(px=>{const leg=new THREE.Group();leg.position.set(px,.9,0);addMesh(leg,new THREE.CylinderGeometry(.18,.24,1.8,8),straw,0,-.3,0);group.add(leg);legs.push(leg);});
    group.visible=false;
    group.userData={body,head,heart,arms,legs};
    scene.add(applyShadow(group));
    return {id:'boss',type:'boss',name:'The Hollow Scarecrow',object:group,position:group.position,home:new THREE.Vector3(x,0,z)};
  }

  function createBrambles() {
    const brambleMat=material('bramble',0x3f3139,{emissive:0x32112f,emissiveIntensity:.26});
    [[.2,10.7],[3.1,10.4],[14.5,-6.7],[17.5,-6.5]].forEach(([x,z],index)=>{
      const group=new THREE.Group(); group.position.set(x,0,z);
      for(let i=0;i<5;i+=1){const a=i*.95;addMesh(group,new THREE.TorusGeometry(.48+i*.1,.08,6,18,Math.PI*1.4),brambleMat,0,.35+i*.17,0,{rotation:[Math.PI/2,a,a*.3]});}
      group.userData.gate=index>1?'mill':'stone'; scene.add(applyShadow(group)); animated.push({type:'bramble',object:group,offset:index});
    });
  }

  function createMeadowDetails() {
    const flowerGeo=new THREE.SphereGeometry(.075,7,5);
    const stemGeo=new THREE.CylinderGeometry(.018,.024,.34,5);
    const flowerMats=[palette.yellow,palette.pink,palette.cream,palette.purple];
    for(let i=0;i<95;i+=1){
      const x=-23+((i*9.71)%46), z=-17+((i*13.37)%34);
      if(isInPond(x,z)||Math.abs(z)<1.7) continue;
      const group=new THREE.Group(); group.position.set(x,0,z); group.scale.setScalar(.72+(i%5)*.08);
      addMesh(group,stemGeo,palette.green,0,.17,0,{cast:false});
      addMesh(group,flowerGeo,flowerMats[i%flowerMats.length],0,.38,0,{cast:false});
      scene.add(group);
    }
  }

  createGround();
  createBarn(-13, -9);
  createSilo(-7.1, -11.3);
  createHouse(-15, 8.6, palette.cream, 1);
  const windmill = createWindmill(15.5, -11.2);
  createPond();
  createFence(-24,-5,-8,-5,8);
  createFence(-6,-15,9,-15,8);
  createFence(5,15,23,15,9);
  [[-23,-16,1.1],[-23,15,.95],[-5,16,1],[1,-16,.9],[7,13,.85],[22,12,1.05],[23,-2,.9],[9,-6,.8],[-5,5,.78],[2,11,.85]].forEach(([x,z,s],i) => createTree(x,z,s,i%3===0?palette.grassDark:palette.green));
  createCloud(-14,15,-20,1.25);
  createCloud(8,17,-18,.9);
  createCloud(23,14,-8,1.1);
  createMeadowDetails();
  createBrambles();
  createGarden();
  const storyStone = createStoryStone(1.8, 11.8);
  const pip = createFrogNpc(8.2, 7.5, 1.05);
  const dad = createFarmer(-7.5, -5.3);
  const bunny = createBunny(1.2, 4.2);
  const hen = createHen(10.2, -8.3);
  const tortoise = createTortoise(-1.5, 9.6);
  entities.push(
    { id:'pip', type:'npc', name:'Pip', position:pip.position, object:pip },
    { id:'dad', type:'npc', name:'Dad', position:dad.position, object:dad },
    { id:'bunny', type:'npc', name:'Blaze', position:bunny.position, object:bunny },
    { id:'hen', type:'npc', name:'Hazel Hen', position:hen.position, object:hen },
    { id:'tortoise', type:'npc', name:'Tortoise', position:tortoise.position, object:tortoise },
    { id:'stone', type:'stone', name:'Old Story Stone', position:storyStone.position, object:storyStone },
    { id:'home', type:'home', name:'Farmhouse', position:new THREE.Vector3(-11.2,0,8.4) },
    { id:'mill', type:'mill', name:'Abandoned Mill', position:new THREE.Vector3(15.2,0,-7.1), object:windmill }
  );
  createItems();
  createGloamling('gloam-1',-1.5,7.8);
  createGloamling('gloam-2',12.2,-3.8);
  createGloamling('gloam-3',4.2,-9.2);
  const boss = createBoss(19,-6.1);
  entities.push(boss);
  const frog = createDog();
  if(state.loadedPosition) frog.position.set(state.loadedPosition.x,0,state.loadedPosition.z);

  const marker = new THREE.Group();
  const markerRing = addMesh(marker,new THREE.TorusGeometry(.48,.075,8,28),palette.yellow,0,.08,0,{rotation:[Math.PI/2,0,0],cast:false,receive:false});
  addMesh(marker,new THREE.ConeGeometry(.14,.48,10),palette.yellow,0,.52,0,{cast:false,receive:false});
  marker.visible = false;
  scene.add(marker);

  function isInPond(x, z) {
    return ((x - pond.x) ** 2) / (pond.rx ** 2) + ((z - pond.z) ** 2) / (pond.rz ** 2) < 1;
  }

  function isBlocked(x, z) {
    if (x < WORLD.minX + .7 || x > WORLD.maxX - .7 || z < WORLD.minZ + .7 || z > WORLD.maxZ - .7) return true;
    if (isInPond(x, z) && !(Math.abs(z - pond.z) < 1.2)) return true;
    return obstacles.some((o) => x > o.x - o.w / 2 - .55 && x < o.x + o.w / 2 + .55 && z > o.z - o.d / 2 - .55 && z < o.z + o.d / 2 + .55);
  }

  function zoneName() {
    const { x, z } = frog.position;
    if (x > 6 && z > 1) return 'Happy Pond';
    if (z < -5) return x > 8 ? 'Old Mill Hollow' : 'Red Barn';
    if (z > 6 && x < -6) return 'Moonberry Farm';
    return 'Wildflower Meadow';
  }

  function currentQuest() {
    if (state.stage === 0) return 'Meet Dad beside the red barn.';
    if (state.stage === 1) return 'Plant and water two Moonberry plots.';
    if (state.stage === 2) return 'Sleep at the farmhouse so the Moonberries can grow.';
    if (state.stage === 3) return `Harvest six Moonberries: ${Math.min(state.berries,6)} / 6.`;
    if (state.stage === 4) return 'Find Pip beside Happy Pond.';
    if (state.stage === 5) return `Sniff out the scattered lily petals: ${state.petals} / 3.`;
    if (state.stage === 6) return 'Return the petals to Pip.';
    if (state.stage === 7) return 'Investigate the fading Story Stone in the meadow.';
    if (state.stage === 8) return `Bark back the Gloamlings and recover Story Light: ${state.shards} / 3.`;
    if (state.stage === 9) return 'Bring the recovered light to Dad at the barn.';
    if (state.stage === 10) return 'Enter Old Mill Hollow and confront the darkness.';
    if (state.stage === 11) return 'Defeat the Hollow Scarecrow. Bark when its heart is exposed.';
    if (state.stage === 12) return 'Carry the restored light back to the Story Stone.';
    return 'Chapter complete. Sunny Farm is safe, and Happy Pond is open.';
  }

  function updateUi() {
    dom.quest.textContent = currentQuest();
    dom.zone.textContent = zoneName();
    const lifeText=`${'♥ '.repeat(state.health).trim()}${state.health < state.maxHealth ? ` ${'♡ '.repeat(state.maxHealth-state.health).trim()}` : ''}`;
    dom.life.textContent = lifeText;
    dom.lifeMobile.textContent = lifeText;
    dom.sparks.textContent = `${state.shards} / 3`;
    const hour=Math.floor(state.clock), minute=Math.floor((state.clock-hour)*60).toString().padStart(2,'0');
    dom.day.textContent = `Day ${state.day} · ${hour}:${minute}`;
    dom.bossHud.hidden=!state.bossActive;
    if(state.bossActive){
      dom.bossHealth.style.width=`${Math.max(0,state.bossHealth/state.bossMaxHealth*100)}%`;
      dom.bossPhase.textContent=state.bossPhase===1?'Dodge the roots. Bark after its charge.':state.bossPhase===2?'The mask is cracking. Keep moving.':'Its Story Light is exposed. One brave bark can end this.';
    }
    const now=performance.now();
    dom.sniff?.classList.toggle('is-cooling',now<state.sniffReadyAt);
    dom.bark?.classList.toggle('is-cooling',now<state.barkReadyAt);
    dom.dodge?.classList.toggle('is-cooling',now<state.dodgeReadyAt);
  }

  function announce(message) {
    dom.announce.textContent = message;
  }

  function toast(message, duration = 2500) {
    window.clearTimeout(state.toastTimer);
    const original = dom.hint.innerHTML;
    dom.hint.textContent = message;
    dom.hint.style.opacity = '1';
    announce(message);
    state.toastTimer = window.setTimeout(() => {
      dom.hint.innerHTML = original;
    }, duration);
  }

  function openPanel(title, body) {
    state.panelOpen = true;
    state.target.copy(frog.position);
    marker.visible = false;
    dom.panelContent.innerHTML = `<h4>${title}</h4>${body}`;
    dom.panel.hidden = false;
  }

  function closePanel() {
    state.panelOpen = false;
    dom.panel.hidden = true;
  }

  function beginAdventure(useSaved = true) {
    if (state.started) {
      canvas.focus({ preventScroll: true });
      return;
    }
    if(!useSaved && localStorage.getItem(SAVE_KEY)) resetAdventure(false);
    state.started = true;
    dom.startCard.hidden = true;
    if(window.innerWidth<700&&!state.expanded) toggleExpanded();
    canvas.focus({ preventScroll: true });
    toast(state.stage ? 'Welcome back. Sunny Valley remembered your adventure.' : 'Tap the ground to walk. Meet Dad beside the red barn.');
    saveProgress(false);
  }

  function showMap() {
    openPanel('Map of Sunny Valley', `<p>Frog is exploring <strong>${zoneName()}</strong>. The dark stain around Old Mill Hollow appeared when the first Story Stone began to fade.</p><div class="game-map-grid"><div><strong>Red Barn</strong><span>Dad, the pantry, and a safe lantern</span></div><div><strong>Happy Pond</strong><span>Pip, lily petals, and water paths</span></div><div><strong>Moonberry Garden</strong><span>Food, friendship, and brave biscuits</span></div><div><strong>Wildflower Meadow</strong><span>Blaze, Tortoise, and the Story Stone</span></div><div><strong>Old Mill Hollow</strong><span>${state.flags.millOpen?'The brambles have opened':'Sealed by living brambles'}</span></div></div>`);
  }

  function showJournal() {
    const discoveries = [state.flags.metDad?'Dad taught Frog to tend Moonberries':'Dad is waiting at the barn',state.flags.pipJoined?'Pip shared the secret of Scent Sight':'A pond friend is waiting',state.flags.stoneRead?'The first Story Stone is fading':'The meadow holds an unread story',state.flags.bossWon?'The Hollow Scarecrow released its stolen light':'Old Mill Hollow is still dangerous',`${state.harvests} Moonberry harvest${state.harvests===1?'':'s'} completed`];
    openPanel('Frog\'s adventure journal', `<p><strong>Main quest:</strong> ${currentQuest()}</p><h5>What Frog has learned</h5><ul>${discoveries.map((item)=>`<li>${item}</li>`).join('')}</ul><p>Friendship: <strong>${state.friendship}</strong> &nbsp; Play time: <strong>${Math.floor(state.playSeconds/60)} minutes</strong></p>`);
  }

  function showPack() {
    openPanel('Frog\'s adventure pack', `<p>Every resource has a purpose. Moonberries become healing Brave Biscuits, while Story Light opens the path to Old Mill Hollow.</p><div class="game-pack-grid"><div><strong>${state.seeds} Moonberry seeds</strong><span>Plant in the garden</span></div><div><strong>${state.berries} Moonberries</strong><span>Three berries make one Brave Biscuit</span></div><div><strong>${state.biscuits} Brave Biscuits</strong><span>Automatically restores courage when Frog is hurt</span></div><div><strong>${state.shards} Story-light shards</strong><span>Recovered from dispelled Gloamlings</span></div><div><strong>${state.friendship} Friendship</strong><span>Earned by helping the valley</span></div></div>`);
  }

  function formatSlot(slot) {
    if(!slot) return '<span>Empty slot</span>';
    const when=new Date(slot.savedAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    return `<strong>Chapter One · Quest ${Math.min(slot.stage+1,14)}</strong><span>Day ${slot.day} · ${Math.floor(slot.playSeconds/60)} min · ${when}</span>`;
  }

  function showSaves() {
    const slots=[1,2,3].map(i=>{try{return normalizedSave(JSON.parse(localStorage.getItem(`${SLOT_PREFIX}${i}`)))}catch{return null}});
    openPanel('Save and resume', `<p>Autosave protects the newest progress on this device. Manual slots preserve separate moments. A recovery code can move the adventure to another browser.</p><div class="game-save-grid">${slots.map((slot,i)=>`<div class="game-save-slot">${formatSlot(slot)}<button data-save-slot="${i+1}">Save here</button>${slot?`<button data-load-slot="${i+1}">Load</button>`:''}</div>`).join('')}</div><div class="game-save-tools"><button class="game-panel-action" data-export-save>Make recovery code</button><button class="game-panel-action" data-import-save>Import recovery code</button></div><textarea class="game-save-code" data-save-code aria-label="Portable recovery code" placeholder="Your recovery code will appear here. Paste a code here to import it."></textarea>`);
  }

  function resetAdventure(confirmFirst = true) {
    if(confirmFirst && !window.confirm('Start Chapter One over? Manual save slots will remain available.')) return;
    state.stage = 0;
    state.petals = 0;
    state.shards = 0;
    state.friendship = 0;
    state.health = 5;
    state.day = 1;
    state.clock = 8.2;
    state.seeds = 4;
    state.berries = 0;
    state.biscuits = 0;
    state.harvests = 0;
    state.flags = freshFlags();
    state.garden = freshGarden();
    state.taken = new Set();
    state.bossActive=false;
    state.bossHealth=state.bossMaxHealth;
    state.playSeconds=0;
    frog.position.set(-9,0,0);
    state.target.copy(frog.position);
    localStorage.removeItem(SAVE_KEY);
    enemies.forEach(enemy=>{enemy.health=enemy.maxHealth;enemy.alive=true;enemy.object.visible=false;enemy.object.position.copy(enemy.home);});
    boss.object.visible=false;
    refreshGardenVisuals();
    refreshItems();
    closePanel();
    updateUi();
    if(confirmFirst) toast('A brand-new Chapter One begins!');
  }

  function entityDistance(entity) {
    return Math.hypot(frog.position.x - entity.position.x, frog.position.z - entity.position.z);
  }

  function entityIsAvailable(entity) {
    if (entity.type === 'petal') return state.stage === 5 && !state.taken.has(entity.id);
    if (entity.type === 'shard') return state.stage === 8 && entity.unlocked && !state.taken.has(entity.id);
    if (entity.type === 'enemy') return state.stage === 8 && entity.alive;
    if (entity.type === 'boss') return false;
    if (entity.type === 'mill') return state.stage === 10 && !state.flags.bossWon;
    return true;
  }

  function nearestEntity(maxDistance = 2.45) {
    let best = null;
    let bestDistance = maxDistance;
    entities.forEach((entity) => {
      if (!entityIsAvailable(entity)) return;
      const distance = entityDistance(entity);
      if (distance < bestDistance) {
        best = entity;
        bestDistance = distance;
      }
    });
    return best;
  }

  function collectItem(entity) {
    if (state.taken.has(entity.id)) return;
    state.taken.add(entity.id);
    state.friendship += 1;
    if (entity.type === 'petal') {
      state.petals += 1;
      if (state.petals >= 3) {
        state.stage = 6;
        openPanel('Frog found every petal!', '<p>The three glowing petals are safe. Take them back to Pip beside Happy Pond.</p>');
      } else toast(`Lily petal found! ${state.petals} / 3`);
    } else {
      state.shards += 1;
      if (state.shards >= 3) {
        state.stage = 9;
        enemies.forEach(enemy=>enemy.object.visible=false);
        openPanel('The scattered light is whole', '<p>The three shards hum together inside Frog\'s collar tag. The meadow brightens, but a cold wind still blows from Old Mill Hollow.</p><p>Dad will know what to do.</p>');
      } else toast(`Story-light shard recovered! ${state.shards} / 3`);
    }
    refreshItems();
    updateUi();
    saveProgress();
  }

  function talkToNpc(entity) {
    if (entity.id === 'pip') {
      if (state.stage === 4) {
        state.stage = 5;
        openPanel('Pip at Happy Pond', '<div class="game-dialog-speaker">Pip</div><p>“The pond went quiet before sunrise. Three moonlily petals vanished, and every trail ends in a smell like rain on stone.”</p><p>Pip teaches Frog <strong>Scent Sight</strong>. Tap Sniff and golden wisps will reveal nearby clues.</p>');
      } else if (state.stage === 6) {
        state.stage = 7;
        state.flags.pipJoined=true;
        state.friendship += 2;
        openPanel('Pip remembers an old warning', '<div class="game-dialog-speaker">Pip</div><p>“These petals only fall when a Story Stone is afraid. Find the violet stone beyond Tortoise. Listen before you touch it.”</p><p>Pip becomes Frog\'s first companion and will keep the pond paths open.</p>');
      } else {
        openPanel('Pip at Happy Pond', `<div class="game-dialog-speaker">Pip</div><p>${state.stage<4?'“Finish Dad\'s farm lesson, then come find me. Something strange moved beneath the lily pads.”':'“The water carries every sound. Bark bravely, but listen first.”'}</p>`);
      }
    } else if (entity.id === 'dad') {
      if (state.stage === 0) {
        state.stage = 1;
        state.flags.metDad=true;
        openPanel('Morning at the red barn', '<div class="game-dialog-speaker">Dad</div><p>“Good morning, Frog. Sunny Valley takes care of us when we take care of it. Let\'s begin with the Moonberry garden.”</p><p>Plant and water any two plots beside the farmhouse. Tap a plot, then use the large action button.</p>');
      } else if (state.stage === 9) {
        state.stage = 10;
        state.flags.snackMade=true;
        state.flags.millOpen=true;
        const made=Math.max(1,Math.floor(state.berries/3));
        state.biscuits+=made;
        state.berries-=made*3;
        state.health=state.maxHealth;
        openPanel('Dad lights the old lantern', `<div class="game-dialog-speaker">Dad</div><p>“That light belongs to the first Story Stone. Something at the abandoned mill has been feeding on it.”</p><p>Dad bakes <strong>${made} Brave Biscuit${made===1?'':'s'}</strong> from Frog\'s Moonberries. Biscuits automatically restore one Courage Heart when Frog is hurt.</p><p>The brambles to Old Mill Hollow withdraw. Dad does not pretend the road is safe.</p>`);
      } else {
        openPanel('Dad by the red barn', `<div class="game-dialog-speaker">Dad</div><p>${state.stage<4?'“A garden rewards patience. Plant, water, rest, and return.”':state.stage<9?'“The animals are frightened. Look closely, Frog, and trust what your nose tells you.”':'“You were brave, but you never stopped being kind. That is what restored the valley.”'}</p>`);
      }
    } else if (entity.id === 'bunny') {
      openPanel('Blaze', `<div class="game-dialog-speaker">Blaze the speedster</div><p>${state.stage<7?'“I crossed the meadow twice before breakfast. Still... I did not see where those golden wisps went.”':'“Whatever is in the mill wants a straight race. Do not give it one. Dodge sideways and make it turn.”'}</p>`);
    } else if(entity.id==='tortoise'){
      openPanel('Tortoise', `<div class="game-dialog-speaker">Tortoise</div><p>${state.stage<7?'“The stone has told stories longer than any of us have listened. Pip will know when it is ready for you.”':'“Darkness hurries. Light takes the time it needs. Stand your ground only when the scarecrow shows its heart.”'}</p>`);
    } else {
      openPanel('Hazel Hen', '<div class="game-dialog-speaker">Hazel Hen</div><p>“Cluck! I saw shadows crawl against the moon. Keep a Brave Biscuit in your pack and do not let the mill corner you.”</p>');
    }
    refreshItems();
    updateUi();
    saveProgress();
  }

  function tendGarden(entity) {
    const phase = state.garden[entity.index];
    if (phase === 'empty') {
      if (state.seeds < 1) return toast('Frog needs a Moonberry seed.');
      state.seeds -= 1;
      state.garden[entity.index] = 'seeded';
      toast('Moonberry seed planted. Interact again to water it.');
    } else if (phase === 'seeded') {
      state.garden[entity.index] = 'growing';
      toast('Watered! Sleep at the farmhouse to help it grow.');
    } else if (phase === 'growing') {
      toast('This Moonberry needs one peaceful night to ripen.');
    } else {
      state.garden[entity.index] = 'empty';
      state.berries += 3;
      state.harvests += 1;
      state.friendship += 1;
      state.seeds += 1;
      toast('Three Moonberries harvested, plus one new seed!');
    }
    if(state.stage===1 && state.garden.filter(phase=>phase==='growing').length>=2){
      state.stage=2;
      openPanel('The garden is ready for night', '<p>Two Moonberry plots glisten with water. Return to the farmhouse and sleep. The game will autosave as the new day begins.</p>');
    }
    if(state.stage===3 && state.berries>=6){
      state.stage=4;
      openPanel('A useful harvest', '<p>Frog has enough Moonberries to make trail food. A worried croak rises from Happy Pond. Find Pip near the bridge.</p>');
    }
    refreshGardenVisuals();
    updateUi();
    saveProgress();
  }

  function sleepAtHome() {
    state.day += 1;
    state.clock = 7.5;
    state.garden = state.garden.map((phase) => phase === 'growing' ? 'ready' : phase);
    state.health=state.maxHealth;
    if(state.stage===2) state.stage=3;
    refreshGardenVisuals();
    saveProgress();
    openPanel(`Good morning · Day ${state.day}`, `<p>The farm wakes beneath a peach-colored sky. Watered Moonberries are ripe.</p>${state.stage===3?'<p>Harvest at least six berries. They will become important when the valley grows dangerous.</p>':''}`);
    updateUi();
  }

  function interact() {
    if (!state.started) return beginAdventure();
    if (state.panelOpen) return closePanel();
    const entity = nearestEntity();
    if (!entity) return toast('Walk closer to a friend, treasure, garden plot, or farmhouse.');
    if (entity.type === 'petal' || entity.type === 'shard') collectItem(entity);
    else if (entity.type === 'npc') talkToNpc(entity);
    else if (entity.type === 'garden') tendGarden(entity);
    else if (entity.type === 'home') sleepAtHome();
    else if(entity.type==='mill') startBoss();
    else if (entity.type === 'stone') {
      if(state.stage===7){
        state.stage=8; state.flags.stoneRead=true; state.flags.bramblesOpen=true; state.friendship+=2; state.clock=17.7;
        enemies.forEach(enemy=>{enemy.alive=true;enemy.health=2;enemy.object.visible=true;});
        openPanel('The first Story Stone is fading', '<p>The violet mark opens like an eye. Three pieces of golden light tear free and streak across the meadow.</p><p>Small thorn-shadow creatures rise where they land. <strong>Gloamlings are hostile.</strong> Keep moving, tap Bark when they come close, and collect the light they release.</p>');
      }else if(state.stage===12){
        state.stage=13; state.flags.chapterWon=true; state.friendship+=8; state.clock=7.8; state.day+=1;
        openPanel('Chapter One complete · The Fading Light', '<p>Frog presses the recovered light to the stone. Dawn rolls across Sunny Valley in a golden wave. Flowers reopen, the pond sings, and even the old mill turns peacefully.</p><p>The stone speaks one final line: <strong>“Bravery is not the absence of fear. It is the friend who walks beside it.”</strong></p><p>A new path across Happy Pond opens toward Chapter Two.</p>');
      }else{
        openPanel('The Old Story Stone', `<p>${state.stage<7?'Its violet mark is dim. Pip may understand the moonlily scent around it.':'The quickest path is not always the richest adventure.'}</p>`);
      }
      saveProgress();
    }
  }

  function updateActiveEntity() {
    const entity = nearestEntity();
    state.activeEntity = entity;
    dom.interact.classList.toggle('is-ready', Boolean(entity));
    if (!entity) {
      dom.actionIcon.textContent = '!';
      dom.actionLabel.textContent = 'Look around';
      return;
    }
    if (entity.type === 'npc') {
      dom.actionIcon.textContent = '☺';
      dom.actionLabel.textContent = `Talk to ${entity.name}`;
    } else if (entity.type === 'garden') {
      dom.actionIcon.textContent = '✿';
      const phase = state.garden[entity.index];
      dom.actionLabel.textContent = phase === 'empty' ? 'Plant seed' : phase === 'seeded' ? 'Water plant' : phase === 'ready' ? 'Harvest berries' : 'Check plant';
    } else if (entity.type === 'home') {
      dom.actionIcon.textContent = '☾';
      dom.actionLabel.textContent = 'Sleep until morning';
    } else if (entity.type === 'stone') {
      dom.actionIcon.textContent = '◇';
      dom.actionLabel.textContent = 'Read story stone';
    } else if(entity.type==='enemy'){
      dom.actionIcon.textContent='◖';
      dom.actionLabel.textContent='Use Bark';
    } else if(entity.type==='mill'){
      dom.actionIcon.textContent='⚠';
      dom.actionLabel.textContent='Enter the hollow';
    } else {
      dom.actionIcon.textContent = '★';
      dom.actionLabel.textContent = `Pick up ${entity.name}`;
    }
  }

  function burst(x,z,color=0xffd65f,count=18,radius=1.6) {
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false});
    const group=new THREE.Group(); group.position.set(x,.25,z);
    for(let i=0;i<count;i+=1){
      const particle=new THREE.Mesh(new THREE.SphereGeometry(.05+(i%3)*.018,6,4),mat.clone());
      const angle=i/count*Math.PI*2;
      particle.userData.velocity=new THREE.Vector3(Math.sin(angle)*(.6+(i%5)*.15),.6+(i%4)*.13,Math.cos(angle)*(.6+(i%5)*.15));
      group.add(particle);
    }
    scene.add(group); effects.push({type:'burst',object:group,age:0,duration:1.05,radius});
  }

  function ringEffect(x,z,color=0xffdf74,maxScale=5) {
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.45,.055,8,42),mat);
    ring.rotation.x=Math.PI/2; ring.position.set(x,.1,z); scene.add(ring);
    effects.push({type:'ring',object:ring,age:0,duration:.75,maxScale});
  }

  function sniff() {
    const now=performance.now();
    if(now<state.sniffReadyAt) return toast('Frog needs one moment before sniffing again.');
    state.sniffReadyAt=now+3500; state.sniffUntil=now+4200;
    ringEffect(frog.position.x,frog.position.z,0xffdd72,7);
    const clues=entities.filter(entity=>entityIsAvailable(entity)&&(entity.type==='petal'||entity.type==='shard'||entity.type==='stone'||(entity.type==='npc'&&['dad','pip'].includes(entity.id))));
    clues.forEach((entity,index)=>{
      for(let i=0;i<7;i+=1){
        const wisp=new THREE.Mesh(new THREE.SphereGeometry(.065,7,5),new THREE.MeshBasicMaterial({color:0xffdc68,transparent:true,opacity:.9,depthWrite:false}));
        wisp.position.set(entity.position.x+Math.sin(i*2.1)*.45,.45+i*.18,entity.position.z+Math.cos(i*1.7)*.45);
        scene.add(wisp); effects.push({type:'wisp',object:wisp,age:-index*.04,duration:4,offset:i});
      }
    });
    toast(clues.length?'Scent Sight reveals golden wisps around important clues.':'Frog smells grass, pond water, and a faint trace of old magic.');
  }

  function nearestThreat() {
    const live=enemies.filter(enemy=>enemy.alive&&enemy.object.visible);
    if(state.bossActive) live.push(boss);
    return live.sort((a,b)=>entityDistance(a)-entityDistance(b))[0]||null;
  }

  function bark() {
    const now=performance.now();
    if(now<state.barkReadyAt) return toast('Frog is catching his breath.');
    state.barkReadyAt=now+1150;
    ringEffect(frog.position.x,frog.position.z,0xfff1a0,6.5);
    burst(frog.position.x,frog.position.z,0xffe480,12,1.2);
    let hit=false;
    enemies.forEach(enemy=>{
      if(!enemy.alive||!enemy.object.visible||entityDistance(enemy)>3.8) return;
      hit=true; enemy.health-=1; enemy.stunnedUntil=now+1000;
      const dx=enemy.position.x-frog.position.x,dz=enemy.position.z-frog.position.z,d=Math.max(.01,Math.hypot(dx,dz));
      enemy.object.position.x+=dx/d*1.5; enemy.object.position.z+=dz/d*1.5;
      burst(enemy.position.x,enemy.position.z,0xb97adb,10,1);
      if(enemy.health<=0){
        enemy.alive=false; enemy.object.visible=false; state.taken.add(`${enemy.id}-defeated`);
        const shard=entities.find(item=>item.id===enemy.shardId); if(shard) shard.unlocked=true;
        refreshItems(); toast('The Gloamling dissolves. It leaves stolen Story Light behind!');
      }
    });
    if(state.bossActive){
      hit=true;
      const exposed=now<(boss.vulnerableUntil||0);
      state.bossHealth-=exposed?2:1; state.bossPhase=state.bossHealth>5?1:state.bossHealth>2?2:3;
      burst(boss.position.x,boss.position.z,exposed?0xffd267:0x9f6eb5,exposed?30:16,2);
      boss.object.userData.head.rotation.z+=(Math.random()>.5?1:-1)*.16;
      toast(exposed?`A perfectly timed bark strikes the glowing heart! ${state.bossHealth} / ${state.bossMaxHealth}`:`The bark chips its shadow armor. Wait for the orange heart to deal double damage. ${state.bossHealth} / ${state.bossMaxHealth}`);
      if(state.bossHealth<=0) finishBoss();
    }
    if(!hit) toast(state.stage<8?'Frog gives a cheerful bark. The valley barks back in echoes.':'The bark ripples through the grass, but no danger is close enough.');
  }

  function dodge() {
    const now=performance.now();
    if(now<state.dodgeReadyAt) return toast('Frog needs a moment before another leap.');
    state.dodgeReadyAt=now+1400; state.dodgingUntil=now+720;
    const threat=nearestThreat();
    let dx=1,dz=0;
    if(threat){dx=frog.position.x-threat.position.x;dz=frog.position.z-threat.position.z;}
    else {dx=Math.sin(frog.rotation.y);dz=Math.cos(frog.rotation.y);}
    const d=Math.max(.01,Math.hypot(dx,dz));
    const nx=clamp(frog.position.x+dx/d*3.2,WORLD.minX+1,WORLD.maxX-1), nz=clamp(frog.position.z+dz/d*3.2,WORLD.minZ+1,WORLD.maxZ-1);
    if(!isBlocked(nx,nz)){frog.position.set(nx,0,nz);state.target.copy(frog.position);}
    burst(frog.position.x,frog.position.z,0xcdf2b1,9,.8);
  }

  function takeDamage(source='the gloom') {
    const now=performance.now();
    if(now<state.dodgingUntil||now-state.lastDamageAt<1300) return;
    state.lastDamageAt=now; state.health-=1;
    dom.dangerVignette.classList.add('is-hit');
    window.setTimeout(()=>dom.dangerVignette.classList.remove('is-hit'),220);
    if(state.health>0&&state.health<=2&&state.biscuits>0){
      state.biscuits-=1; state.health=Math.min(state.maxHealth,state.health+2); toast(`A Brave Biscuit restores Frog's courage. ${state.biscuits} left.`);
    }else toast(`Frog loses a Courage Heart to ${source}. Dodge clear!`);
    if(state.health<=0){
      state.health=state.maxHealth; state.bossActive=false; boss.object.visible=false; state.bossHealth=state.bossMaxHealth; state.stage=Math.min(state.stage,10);
      frog.position.set(-7,-0,-4.2); state.target.copy(frog.position); state.clock=8;
      openPanel('Frog wakes beside Dad\'s lantern', '<p>Frog was overwhelmed, but the valley does not give up on him. Courage is restored and no quest progress was lost.</p><p>Gather yourself, check the pack, and return when ready.</p>');
    }
    saveProgress(false);
  }

  function startBoss() {
    if(state.stage!==10) return;
    state.stage=11; state.bossActive=true; state.bossHealth=state.bossMaxHealth; state.bossPhase=1; state.bossStartedAt=performance.now(); state.bossAttackAt=state.bossStartedAt+1900; state.clock=20;
    boss.object.visible=true; boss.object.position.copy(boss.home); boss.vulnerableUntil=0;
    closePanel(); state.target.copy(frog.position);
    toast('THE HOLLOW SCARECROW AWAKENS. Tap to move. Dodge the charge. Bark at its glowing heart.',5000);
    saveProgress();
  }

  function finishBoss() {
    state.bossActive=false; state.flags.bossWon=true; state.stage=12; state.friendship+=6; boss.object.visible=false; state.clock=5.9;
    enemies.forEach(enemy=>enemy.object.visible=false);
    ringEffect(boss.position.x,boss.position.z,0xffe27b,10); burst(boss.position.x,boss.position.z,0xffd95b,42,3);
    saveProgress();
    openPanel('The Hollow Scarecrow falls silent', '<p>The darkness tears away like an old coat. Beneath it stands an ordinary farm scarecrow, protecting a warm sphere of Story Light.</p><p>Frog does not destroy his enemy. He frees it. Carry the restored light back to the meadow Story Stone.</p>');
  }

  function restoreWorldState() {
    if(state.loadedPosition){frog.position.set(state.loadedPosition.x,0,state.loadedPosition.z);state.target.copy(frog.position);}
    refreshGardenVisuals();
    enemies.forEach(enemy=>{
      const defeated=state.taken.has(`${enemy.id}-defeated`)||state.stage>8;
      enemy.alive=!defeated; enemy.health=enemy.maxHealth; enemy.object.position.copy(enemy.home);
      enemy.object.visible=state.stage===8&&!defeated;
      const shard=entities.find(item=>item.id===enemy.shardId); if(shard) shard.unlocked=defeated||state.stage>8;
    });
    boss.object.visible=false; state.bossActive=false;
    refreshItems(); updateUi();
  }

  function loadSlot(number) {
    try{
      const raw=localStorage.getItem(`${SLOT_PREFIX}${number}`); if(!raw) return;
      applySave(JSON.parse(raw)); restoreWorldState(); saveProgress(); closePanel(); toast(`Manual slot ${number} loaded.`);
    }catch{toast('That save slot could not be read.');}
  }

  function setTarget(x, z) {
    const nextX = clamp(x, WORLD.minX + .8, WORLD.maxX - .8);
    const nextZ = clamp(z, WORLD.minZ + .8, WORLD.maxZ - .8);
    if (isBlocked(nextX, nextZ)) {
      toast('That spot is blocked. Tap a nearby path or patch of grass.');
      return;
    }
    state.target.set(nextX, 0, nextZ);
    marker.position.set(nextX, .04, nextZ);
    marker.visible = true;
  }

  function raycastGround(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(clickableGround, false);
    if (hits.length) setTarget(hits[0].point.x, hits[0].point.z);
  }

  const pointerStart = { x: 0, y: 0, id: null };
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    beginAdventure(true);
    pointerStart.x = event.clientX;
    pointerStart.y = event.clientY;
    pointerStart.id = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (pointerStart.id !== event.pointerId) return;
    event.preventDefault();
    raycastGround(event.clientX, event.clientY);
    pointerStart.id = null;
  });
  canvas.addEventListener('pointercancel', () => { pointerStart.id = null; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('selectstart', (event) => event.preventDefault());
  canvas.addEventListener('dragstart', (event) => event.preventDefault());
  dom.stage.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });

  const keyTargets = {
    arrowup: [0,-2.3], w: [0,-2.3], arrowdown: [0,2.3], s: [0,2.3],
    arrowleft: [-2.3,0], a: [-2.3,0], arrowright: [2.3,0], d: [2.3,0]
  };
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (keyTargets[key]) {
      event.preventDefault();
      if (!event.repeat) {
        beginAdventure(true);
        setTarget(frog.position.x + keyTargets[key][0], frog.position.z + keyTargets[key][1]);
      }
    }
    if (['enter',' ','e'].includes(key)) {
      event.preventDefault();
      interact();
    }
    if(key==='q'){event.preventDefault();sniff();}
    if(key==='f'){event.preventDefault();bark();}
    if(key==='shift'){event.preventDefault();dodge();}
    if (key === 'escape') {
      if (state.panelOpen) closePanel();
      else if (state.expanded) toggleExpanded();
    }
  });

  function toggleExpanded() {
    state.expanded = !state.expanded;
    dom.shell.classList.toggle('is-expanded', state.expanded);
    document.body.classList.toggle('game-no-scroll', state.expanded);
    dom.expand.textContent = state.expanded ? 'Exit full screen' : 'Fill screen';
    window.setTimeout(resize, 40);
  }

  if(localStorage.getItem(SAVE_KEY)){
    dom.continue.hidden=false;
    dom.start.textContent='Start new adventure';
  }
  dom.start.addEventListener('click', ()=>beginAdventure(false));
  dom.continue.addEventListener('click', ()=>beginAdventure(true));
  dom.interact.addEventListener('click', interact);
  dom.map.addEventListener('click', showMap);
  dom.journal.addEventListener('click', showJournal);
  dom.pack.addEventListener('click', showPack);
  dom.saves.addEventListener('click', showSaves);
  dom.savesQuick.addEventListener('click', showSaves);
  dom.sniff.addEventListener('click', sniff);
  dom.bark.addEventListener('click', bark);
  dom.dodge.addEventListener('click', dodge);
  dom.panelClose.addEventListener('click', closePanel);
  dom.reset.addEventListener('click', resetAdventure);
  dom.expand.addEventListener('click', toggleExpanded);
  dom.exit.addEventListener('click', toggleExpanded);
  dom.panel.addEventListener('click',(event)=>{
    const saveButton=event.target.closest('[data-save-slot]');
    const loadButton=event.target.closest('[data-load-slot]');
    if(saveButton){const n=saveButton.dataset.saveSlot;localStorage.setItem(`${SLOT_PREFIX}${n}`,JSON.stringify(saveData()));flashSaved(`Saved in slot ${n}`);showSaves();}
    if(loadButton) loadSlot(loadButton.dataset.loadSlot);
    if(event.target.closest('[data-export-save]')){
      const area=dom.panel.querySelector('[data-save-code]');
      area.value=btoa(unescape(encodeURIComponent(JSON.stringify(saveData())))); area.select();
    }
    if(event.target.closest('[data-import-save]')){
      const area=dom.panel.querySelector('[data-save-code]');
      try{const imported=JSON.parse(decodeURIComponent(escape(atob(area.value.trim()))));if(!applySave(imported)) throw new Error();restoreWorldState();saveProgress();closePanel();toast('Recovery code imported successfully.');}catch{toast('That recovery code is not valid.');}
    }
  });

  function shortestAngle(from, to) {
    let difference = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
    if (difference < -Math.PI) difference += Math.PI * 2;
    return difference;
  }

  function updateMovement(delta, elapsed) {
    if (!state.started || state.panelOpen) return false;
    const dx = state.target.x - frog.position.x;
    const dz = state.target.z - frog.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .12) {
      marker.visible = false;
      frog.userData.legs.forEach((leg) => { leg.rotation.x *= .75; });
      frog.userData.body.position.y = 1.05 + Math.sin(elapsed * 2) * .025;
      return false;
    }
    const speed = 5.25;
    const step = Math.min(distance, speed * delta);
    const nx = frog.position.x + dx / distance * step;
    const nz = frog.position.z + dz / distance * step;
    if (isBlocked(nx, nz)) {
      state.target.copy(frog.position);
      marker.visible = false;
      toast('Frog found an obstacle. Tap another route.');
      return false;
    }
    frog.position.x = nx;
    frog.position.z = nz;
    const targetRotation = Math.atan2(dx, dz);
    frog.rotation.y += shortestAngle(frog.rotation.y, targetRotation) * Math.min(1, delta * 10);
    const stride = Math.sin(elapsed * 12) * .48;
    frog.userData.legs.forEach((leg, index) => { leg.rotation.x = stride * (index % 2 ? -1 : 1); });
    frog.userData.body.position.y = 1.05 + Math.abs(Math.sin(elapsed * 12)) * .09;
    frog.userData.head.rotation.z = Math.sin(elapsed * 12) * .035;
    frog.userData.tail.rotation.z = Math.sin(elapsed * 10) * .32;
    return true;
  }

  function updatePickups() {
    entities.filter((entity) => (entity.type === 'petal' || entity.type === 'shard') && entityIsAvailable(entity)).forEach((entity) => {
      if (entityDistance(entity) < .85) collectItem(entity);
    });
  }

  function updateEnemies(delta,elapsed) {
    enemies.forEach((enemy,index)=>{
      if(!enemy.alive||!enemy.object.visible) return;
      const now=performance.now();
      const dx=frog.position.x-enemy.position.x,dz=frog.position.z-enemy.position.z,d=Math.max(.01,Math.hypot(dx,dz));
      if(now>enemy.stunnedUntil){
        const chasing=d<8.5;
        const tx=chasing?frog.position.x:enemy.home.x,tz=chasing?frog.position.z:enemy.home.z;
        const mx=tx-enemy.position.x,mz=tz-enemy.position.z,md=Math.max(.01,Math.hypot(mx,mz));
        const speed=(chasing?1.45:.45)*delta;
        enemy.object.position.x+=mx/md*Math.min(md,speed); enemy.object.position.z+=mz/md*Math.min(md,speed);
        enemy.object.rotation.y=Math.atan2(mx,mz);
      }
      enemy.body.position.y=.55+Math.abs(Math.sin(elapsed*7+index))*.16;
      enemy.object.rotation.z=Math.sin(elapsed*4+index)*.06;
      if(d<.9) takeDamage('a Gloamling');
    });
  }

  function updateBoss(delta,elapsed) {
    if(!state.bossActive||!boss.object.visible) return;
    const now=performance.now(),cycle=(now-state.bossStartedAt)%6000;
    const dx=frog.position.x-boss.position.x,dz=frog.position.z-boss.position.z,d=Math.max(.01,Math.hypot(dx,dz));
    let speed=state.bossPhase===1?1.35:state.bossPhase===2?1.7:2.05;
    if(cycle>3000&&cycle<4300) speed*=3.1;
    if(cycle>=4300){
      speed=0; boss.vulnerableUntil=now+180;
      if(boss.lastOpenCycle!==Math.floor((now-state.bossStartedAt)/6000)){
        boss.lastOpenCycle=Math.floor((now-state.bossStartedAt)/6000); ringEffect(boss.position.x,boss.position.z,0xff703e,3.5); toast('Its orange heart is exposed. BARK NOW!');
      }
    }
    if(speed){
      const nx=boss.position.x+dx/d*speed*delta,nz=boss.position.z+dz/d*speed*delta;
      if(!isBlocked(nx,nz)){boss.object.position.x=nx;boss.object.position.z=nz;}
      boss.object.rotation.y=Math.atan2(dx,dz);
    }
    boss.object.userData.arms.forEach((arm,i)=>arm.rotation.x=Math.sin(elapsed*5+i)*.22);
    boss.object.userData.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(elapsed*7+i*Math.PI)*.35);
    boss.object.userData.heart.scale.setScalar(cycle>=4300?1.15+Math.sin(elapsed*10)*.18:.72);
    boss.object.position.y=Math.sin(elapsed*2.4)*.06;
    if(d<1.25) takeDamage('the scarecrow\'s thorny charge');
  }

  function updateEffects(delta,elapsed) {
    for(let i=effects.length-1;i>=0;i-=1){
      const effect=effects[i]; effect.age+=delta;
      if(effect.type==='ring'){
        const t=Math.max(0,effect.age/effect.duration); effect.object.scale.setScalar(1+t*effect.maxScale); effect.object.material.opacity=1-t;
      }else if(effect.type==='burst'){
        effect.object.children.forEach(p=>{p.position.addScaledVector(p.userData.velocity,delta);p.userData.velocity.y-=delta*1.2;p.material.opacity=Math.max(0,1-effect.age/effect.duration);});
      }else if(effect.type==='wisp'){
        effect.object.position.y+=Math.sin(elapsed*4+effect.offset)*delta*.16; effect.object.rotation.y+=delta*2; effect.object.material.opacity=Math.max(0,Math.min(1,(effect.duration-effect.age)*1.5));
      }
      if(effect.age>=effect.duration){scene.remove(effect.object);effect.object.traverse?.(child=>{child.geometry?.dispose?.();if(child.material&&!Array.isArray(child.material))child.material.dispose?.();});effects.splice(i,1);}
    }
  }

  function updateLighting(delta) {
    if (state.started && !state.panelOpen) state.clock += delta * .035;
    if (state.clock > 21) state.clock = 6.5;
    const daylight = clamp(Math.sin((state.clock - 5) / 16 * Math.PI), .08, 1);
    sun.intensity = 1.15 + daylight * 2.9;
    hemisphere.intensity = 1.2 + daylight * 1.45;
    const skyDay = new THREE.Color(0xa8dff0);
    const skyEvening = new THREE.Color(state.stage>=8&&state.stage<=12?0x503f63:0xf5b47f);
    scene.background.copy(skyEvening).lerp(skyDay, daylight);
    scene.fog.color.copy(scene.background).lerp(new THREE.Color(0xc8e7d1), .48);
  }

  function animateWorld(elapsed) {
    animated.forEach((entry) => {
      if (entry.type === 'item') {
        entry.object.position.y = entry.baseY + Math.sin(elapsed * 2.6 + entry.offset) * .16;
        entry.object.rotation.y = elapsed * .8 + entry.offset;
      } else if (entry.type === 'water') {
        entry.object.position.y = entry.object.userData.baseY + Math.sin(elapsed * 1.2) * .025;
      } else if (entry.type === 'cloud') {
        entry.object.position.x = entry.startX + ((elapsed * entry.speed + 35) % 70) - 35;
      } else if(entry.type==='rotor'){
        entry.object.rotation.z+=.0025;
      } else if(entry.type==='bramble'){
        const open=entry.object.userData.gate==='mill'?state.flags.millOpen:state.flags.bramblesOpen;
        entry.object.visible=!open;
        entry.object.rotation.y=Math.sin(elapsed*.8+entry.offset)*.09;
      }
    });
    if (marker.visible) {
      const pulse = 1 + Math.sin(elapsed * 6) * .12;
      markerRing.scale.setScalar(pulse);
      marker.rotation.y = elapsed * .9;
    }
    [pip,bunny,hen,dad,tortoise].forEach((object,index) => {
      object.position.y = Math.sin(elapsed * 1.8 + index) * .035;
    });
  }

  function updateCamera() {
    cameraFocus.lerp(new THREE.Vector3(frog.position.x, .65, frog.position.z), .075);
    const dynamicOffset=cameraOffset.clone();
    if(state.bossActive){dynamicOffset.multiplyScalar(.88);dynamicOffset.y+=1.4;}
    const desired = cameraFocus.clone().add(dynamicOffset);
    camera.position.lerp(desired, .065);
    camera.lookAt(cameraFocus);
  }

  function resize() {
    const width = Math.max(1, dom.stage.clientWidth);
    const height = Math.max(1, dom.stage.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 560 ? 49 : 42;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(dom.stage);
  window.addEventListener('orientationchange', () => window.setTimeout(resize, 160));

  function render() {
    const delta = Math.min(clock.getDelta(), .05);
    const elapsed = clock.elapsedTime;
    if(state.started&&!state.panelOpen) state.playSeconds+=delta;
    updateMovement(delta, elapsed);
    updatePickups();
    updateEnemies(delta,elapsed);
    updateBoss(delta,elapsed);
    updateEffects(delta,elapsed);
    updateActiveEntity();
    updateLighting(delta);
    animateWorld(elapsed);
    updateCamera();
    updateUi();
    if(state.started&&elapsed>state.saveTimer){state.saveTimer=elapsed+12;saveProgress(false);}
    renderer.render(scene, camera);
  }

  restoreWorldState();
  updateUi();
  updateCamera();
  resize();
  renderer.setAnimationLoop(render);
}
