import * as THREE from './vendor/three.module.min.js';

const canvas = document.querySelector('[data-frog-rpg]');

if (canvas) {
  const dom = {
    shell: document.querySelector('[data-game-shell]'),
    stage: document.querySelector('[data-game-stage]'),
    announce: document.querySelector('[data-game-announce]'),
    quest: document.querySelector('[data-quest-text]'),
    zone: document.querySelector('[data-game-zone]'),
    hearts: document.querySelector('[data-game-hearts]'),
    treats: document.querySelector('[data-game-treats]'),
    day: document.querySelector('[data-game-day]'),
    start: document.querySelector('[data-game-start]'),
    startCard: document.querySelector('[data-game-start-card]'),
    interact: document.querySelector('[data-game-interact]'),
    actionIcon: document.querySelector('[data-game-action-icon]'),
    actionLabel: document.querySelector('[data-game-action-label]'),
    hint: document.querySelector('[data-game-hint]'),
    map: document.querySelector('[data-game-map]'),
    journal: document.querySelector('[data-game-journal]'),
    reset: document.querySelector('[data-game-reset]'),
    expand: document.querySelector('[data-game-expand]'),
    panel: document.querySelector('[data-game-panel]'),
    panelContent: document.querySelector('[data-game-panel-content]'),
    panelClose: document.querySelector('[data-game-panel-close]')
  };

  const SAVE_KEY = 'adnf-frog-farmyard-quest-3d-v1';
  const WORLD = { minX: -25, maxX: 25, minZ: -19, maxZ: 19 };
  const pond = { x: 13, z: 6, rx: 6.2, rz: 4.3 };
  const obstacles = [
    { x: -13, z: -9, w: 9.6, d: 6.6 },
    { x: -15, z: 8.6, w: 7.2, d: 5.5 },
    { x: 15.5, z: -11.2, w: 7.8, d: 5.6 },
    { x: -7.1, z: -11.3, w: 4.4, d: 4.4 }
  ];

  const freshGarden = () => ['empty', 'empty', 'empty', 'empty'];
  const state = {
    started: false,
    expanded: false,
    panelOpen: false,
    stage: 0,
    petals: 0,
    treats: 0,
    friendship: 0,
    day: 1,
    clock: 8.2,
    seeds: 4,
    berries: 0,
    harvests: 0,
    companion: false,
    loreFound: false,
    garden: freshGarden(),
    taken: new Set(),
    target: new THREE.Vector3(-9, 0, 0),
    activeEntity: null,
    toastTimer: 0,
    lastTime: 0
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!saved || typeof saved !== 'object') return;
      state.stage = clamp(Number(saved.stage) || 0, 0, 6);
      state.petals = clamp(Number(saved.petals) || 0, 0, 3);
      state.treats = clamp(Number(saved.treats) || 0, 0, 3);
      state.friendship = clamp(Number(saved.friendship) || 0, 0, 99);
      state.day = clamp(Number(saved.day) || 1, 1, 999);
      state.clock = clamp(Number(saved.clock) || 8.2, 5, 22);
      state.seeds = clamp(Number(saved.seeds) || 0, 0, 99);
      state.berries = clamp(Number(saved.berries) || 0, 0, 99);
      state.harvests = clamp(Number(saved.harvests) || 0, 0, 99);
      state.companion = Boolean(saved.companion);
      state.loreFound = Boolean(saved.loreFound);
      if (Array.isArray(saved.garden) && saved.garden.length === 4) {
        state.garden = saved.garden.map((phase) => ['empty', 'seeded', 'growing', 'ready'].includes(phase) ? phase : 'empty');
      }
      if (Array.isArray(saved.taken)) state.taken = new Set(saved.taken);
    } catch (error) {
      localStorage.removeItem(SAVE_KEY);
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        stage: state.stage,
        petals: state.petals,
        treats: state.treats,
        friendship: state.friendship,
        day: state.day,
        clock: state.clock,
        seeds: state.seeds,
        berries: state.berries,
        harvests: state.harvests,
        companion: state.companion,
        loreFound: state.loreFound,
        garden: state.garden,
        taken: [...state.taken]
      }));
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

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.55 : 1.9));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8dff0);
  scene.fog = new THREE.Fog(0xc6e7d4, 32, 68);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const cameraFocus = new THREE.Vector3(-9, 0, 0);
  const cameraOffset = new THREE.Vector3(12.5, 14.5, 18.5);
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
  const mats = {};

  function material(name, color, options = {}) {
    if (!mats[name]) {
      mats[name] = new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.86,
        metalness: options.metalness ?? 0,
        flatShading: options.flatShading ?? true,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0
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
      { id:'treat-1', type:'treat', x:-1.5, z:7.8 }, { id:'treat-2', type:'treat', x:15.2, z:-4.5 }, { id:'treat-3', type:'treat', x:3.8, z:-9.2 }
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
        addMesh(group,new THREE.CylinderGeometry(.16,.16,.82,12),palette.orange,0,0,0,{rotation:[0,0,Math.PI/2]});
        [-.48,.48].forEach((x) => {
          addMesh(group,new THREE.SphereGeometry(.22,10,8),palette.orange,x,.14,0);
          addMesh(group,new THREE.SphereGeometry(.22,10,8),palette.orange,x,-.14,0);
        });
      }
      group.visible = false;
      scene.add(applyShadow(group));
      const entity = { ...spec, name: spec.type === 'petal' ? 'Lily petal' : 'Lost treat', position:new THREE.Vector3(spec.x,0,spec.z), object:group };
      entities.push(entity);
      itemMeshes.set(spec.id, group);
      animated.push({ type:'item', object:group, baseY:.65, offset:index });
    });
    refreshItems();
  }

  function refreshItems() {
    entities.filter((entity) => entity.type === 'petal' || entity.type === 'treat').forEach((entity) => {
      const active = (entity.type === 'petal' && state.stage === 1) || (entity.type === 'treat' && state.stage === 4);
      entity.object.visible = active && !state.taken.has(entity.id);
    });
  }

  createGround();
  createBarn(-13, -9);
  createSilo(-7.1, -11.3);
  createHouse(-15, 8.6, palette.cream, 1);
  createHouse(15.5, -11.2, material('villageWall', 0xf0b77e), .82);
  createPond();
  createFence(-24,-5,-8,-5,8);
  createFence(-6,-15,9,-15,8);
  createFence(5,15,23,15,9);
  [[-23,-16,1.1],[-23,15,.95],[-5,16,1],[1,-16,.9],[7,13,.85],[22,12,1.05],[23,-2,.9],[9,-6,.8],[-5,5,.78],[2,11,.85]].forEach(([x,z,s],i) => createTree(x,z,s,i%3===0?palette.grassDark:palette.green));
  createCloud(-14,15,-20,1.25);
  createCloud(8,17,-18,.9);
  createCloud(23,14,-8,1.1);
  createGarden();
  const storyStone = createStoryStone(1.8, 11.8);
  const pip = createFrogNpc(8.2, 7.5, 1.05);
  const dad = createFarmer(-7.5, -5.3);
  const bunny = createBunny(1.2, 4.2);
  const hen = createHen(10.2, -8.3);
  entities.push(
    { id:'pip', type:'npc', name:'Pip', position:pip.position, object:pip },
    { id:'dad', type:'npc', name:'Dad', position:dad.position, object:dad },
    { id:'bunny', type:'npc', name:'Benny Bunny', position:bunny.position, object:bunny },
    { id:'hen', type:'npc', name:'Hazel Hen', position:hen.position, object:hen },
    { id:'stone', type:'stone', name:'Old Story Stone', position:storyStone.position, object:storyStone },
    { id:'home', type:'home', name:'Farmhouse', position:new THREE.Vector3(-11.2,0,8.4) }
  );
  createItems();
  const frog = createDog();

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
    if (z < -5) return x > 8 ? 'Hilltop Village' : 'Red Barn';
    if (z > 6 && x < -6) return 'Moonberry Farm';
    return 'Wildflower Meadow';
  }

  function currentQuest() {
    if (state.stage === 0) return 'Find Pip beside Happy Pond.';
    if (state.stage === 1) return `Collect the glowing lily petals: ${state.petals} / 3.`;
    if (state.stage === 2) return 'Take the petals back to Pip.';
    if (state.stage === 3) return 'Visit Dad near the red barn.';
    if (state.stage === 4) return `Find Dad's lost treats: ${state.treats} / 3.`;
    if (state.stage === 5) return 'Bring the treats back to Dad.';
    return 'Quest complete! Grow Moonberries and explore the farm.';
  }

  function updateUi() {
    dom.quest.textContent = currentQuest();
    dom.zone.textContent = zoneName();
    dom.hearts.textContent = String(state.friendship);
    dom.treats.textContent = `${state.treats} / 3`;
    dom.day.textContent = `Day ${state.day}`;
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

  function beginAdventure() {
    if (state.started) {
      canvas.focus({ preventScroll: true });
      return;
    }
    state.started = true;
    dom.startCard.hidden = true;
    canvas.focus({ preventScroll: true });
    toast('Tap anywhere on the ground and Frog will walk there.');
  }

  function showMap() {
    openPanel('Sunny Farm map', `<p>Frog is exploring <strong>${zoneName()}</strong>. Tap the ground after closing this map to travel.</p><div class="game-map-grid"><div><strong>Red Barn</strong><span>Dad and the farm animals</span></div><div><strong>Happy Pond</strong><span>Pip, lily pads, and the bridge</span></div><div><strong>Moonberry Farm</strong><span>Plant, water, sleep, and harvest</span></div><div><strong>Wildflower Meadow</strong><span>Treasure and the Old Story Stone</span></div></div>`);
  }

  function showJournal() {
    const discoveries = [state.loreFound ? 'Old Story Stone discovered' : 'Old Story Stone still hidden', state.companion ? 'Pip is Frog\'s pond friend' : 'A pond friend is waiting', `${state.harvests} Moonberry harvest${state.harvests === 1 ? '' : 's'}`];
    openPanel('Frog\'s adventure journal', `<p><strong>Current quest:</strong> ${currentQuest()}</p><ul>${discoveries.map((item) => `<li>${item}</li>`).join('')}</ul><p>Moonberry seeds: <strong>${state.seeds}</strong> &nbsp; Berries: <strong>${state.berries}</strong></p>`);
  }

  function resetAdventure() {
    state.stage = 0;
    state.petals = 0;
    state.treats = 0;
    state.friendship = 0;
    state.day = 1;
    state.clock = 8.2;
    state.seeds = 4;
    state.berries = 0;
    state.harvests = 0;
    state.companion = false;
    state.loreFound = false;
    state.garden = freshGarden();
    state.taken = new Set();
    frog.position.set(-9,0,0);
    state.target.copy(frog.position);
    localStorage.removeItem(SAVE_KEY);
    refreshGardenVisuals();
    refreshItems();
    closePanel();
    updateUi();
    toast('A brand-new 3D adventure begins!');
  }

  function entityDistance(entity) {
    return Math.hypot(frog.position.x - entity.position.x, frog.position.z - entity.position.z);
  }

  function entityIsAvailable(entity) {
    if (entity.type === 'petal') return state.stage === 1 && !state.taken.has(entity.id);
    if (entity.type === 'treat') return state.stage === 4 && !state.taken.has(entity.id);
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
        state.stage = 2;
        openPanel('Frog found every petal!', '<p>The three glowing petals are safe. Take them back to Pip beside Happy Pond.</p>');
      } else toast(`Lily petal found! ${state.petals} / 3`);
    } else {
      state.treats += 1;
      if (state.treats >= 3) {
        state.stage = 5;
        openPanel('Frog found every treat!', '<p>Dad will be so relieved. Bring the three lost treats back to him near the red barn.</p>');
      } else toast(`Lost treat found! ${state.treats} / 3`);
    }
    refreshItems();
    updateUi();
    saveProgress();
  }

  function talkToNpc(entity) {
    if (entity.id === 'pip') {
      if (state.stage === 0) {
        state.stage = 1;
        state.companion = true;
        openPanel('Pip at Happy Pond', '<p>“Frog! A breeze scattered three glowing lily petals around the farm. Will you help me find them?”</p><p>The petals now shimmer near the pond and meadow.</p>');
      } else if (state.stage === 2) {
        state.stage = 3;
        state.friendship += 2;
        openPanel('Pip is delighted', '<p>“You found every one! You may be slower than some animals, Frog, but nobody explores with a bigger heart.”</p><p>Dad is waiting near the red barn.</p>');
      } else {
        openPanel('Pip at Happy Pond', '<p>“The pond is happiest when friends stop to visit. Keep following the golden path!”</p>');
      }
    } else if (entity.id === 'dad') {
      if (state.stage === 3) {
        state.stage = 4;
        openPanel('Dad by the red barn', '<p>“There you are, Frog! Three treats bounced out of my pocket while I worked. Think your good nose can find them?”</p>');
      } else if (state.stage === 5) {
        state.stage = 6;
        state.friendship += 3;
        state.seeds += 2;
        openPanel('Farmyard hero!', '<p>“Every treat! You never gave up, Frog.”</p><p>Main quest complete. Dad gives Frog two Moonberry seeds so the farm adventure can continue.</p>');
      } else {
        openPanel('Dad by the red barn', '<p>“Take your time and look closely. A determined heart always finds a path.”</p>');
      }
    } else if (entity.id === 'bunny') {
      openPanel('Benny Bunny', '<p>“I can race across the meadow, but you notice things I run right past. Try the Old Story Stone near the garden.”</p>');
    } else {
      openPanel('Hazel Hen', '<p>“Cluck! The best treasures hide just beyond the golden path.”</p>');
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
    refreshGardenVisuals();
    updateUi();
    saveProgress();
  }

  function sleepAtHome() {
    state.day += 1;
    state.clock = 7.5;
    state.garden = state.garden.map((phase) => phase === 'growing' ? 'ready' : phase);
    refreshGardenVisuals();
    saveProgress();
    openPanel(`Good morning - Day ${state.day}`, '<p>The farm wakes beneath a peach-colored sky. Any watered Moonberries have finished growing.</p>');
    updateUi();
  }

  function interact() {
    if (!state.started) return beginAdventure();
    if (state.panelOpen) return closePanel();
    const entity = nearestEntity();
    if (!entity) return toast('Walk closer to a friend, treasure, garden plot, or farmhouse.');
    if (entity.type === 'petal' || entity.type === 'treat') collectItem(entity);
    else if (entity.type === 'npc') talkToNpc(entity);
    else if (entity.type === 'garden') tendGarden(entity);
    else if (entity.type === 'home') sleepAtHome();
    else if (entity.type === 'stone') {
      const firstDiscovery = !state.loreFound;
      state.loreFound = true;
      if (firstDiscovery) state.friendship += 1;
      saveProgress();
      openPanel('The Old Story Stone', '<p>Its violet mark glows: “The quickest path is not always the richest adventure.” Frog records the words in the journal.</p>');
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
    } else {
      dom.actionIcon.textContent = '★';
      dom.actionLabel.textContent = `Pick up ${entity.name}`;
    }
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
    beginAdventure();
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
        beginAdventure();
        setTarget(frog.position.x + keyTargets[key][0], frog.position.z + keyTargets[key][1]);
      }
    }
    if (['enter',' ','e'].includes(key)) {
      event.preventDefault();
      interact();
    }
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

  dom.start.addEventListener('click', beginAdventure);
  dom.interact.addEventListener('click', interact);
  dom.map.addEventListener('click', showMap);
  dom.journal.addEventListener('click', showJournal);
  dom.panelClose.addEventListener('click', closePanel);
  dom.reset.addEventListener('click', resetAdventure);
  dom.expand.addEventListener('click', toggleExpanded);

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
    entities.filter((entity) => (entity.type === 'petal' || entity.type === 'treat') && entityIsAvailable(entity)).forEach((entity) => {
      if (entityDistance(entity) < .85) collectItem(entity);
    });
  }

  function updateLighting(delta) {
    if (state.started && !state.panelOpen) state.clock += delta * .035;
    if (state.clock > 21) state.clock = 6.5;
    const daylight = clamp(Math.sin((state.clock - 5) / 16 * Math.PI), .15, 1);
    sun.intensity = 1.15 + daylight * 2.9;
    hemisphere.intensity = 1.2 + daylight * 1.45;
    const skyDay = new THREE.Color(0xa8dff0);
    const skyEvening = new THREE.Color(0xf5b47f);
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
      }
    });
    if (marker.visible) {
      const pulse = 1 + Math.sin(elapsed * 6) * .12;
      markerRing.scale.setScalar(pulse);
      marker.rotation.y = elapsed * .9;
    }
    [pip,bunny,hen,dad].forEach((object,index) => {
      object.position.y = Math.sin(elapsed * 1.8 + index) * .035;
    });
  }

  function updateCamera() {
    cameraFocus.lerp(new THREE.Vector3(frog.position.x, .65, frog.position.z), .075);
    const desired = cameraFocus.clone().add(cameraOffset);
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
    updateMovement(delta, elapsed);
    updatePickups();
    updateActiveEntity();
    updateLighting(delta);
    animateWorld(elapsed);
    updateCamera();
    updateUi();
    renderer.render(scene, camera);
  }

  updateUi();
  updateCamera();
  resize();
  renderer.setAnimationLoop(render);
}
