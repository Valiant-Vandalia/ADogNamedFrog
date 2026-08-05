import * as THREE from './vendor/three.module.min.js';
import { SUNNY_VALLEY_MAP as MAP, validateMapContract } from './sunny-valley-map.mjs';
import { advanceGardenOvernight, gardenFrameFor, migrateGardenPhase } from './frog-quest-systems.mjs';

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
    energy: document.querySelector('[data-game-energy]'),
    seeds: document.querySelector('[data-game-seeds]'),
    berries: document.querySelector('[data-game-berries]'),
    coins: document.querySelector('[data-game-coins]'),
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
    bossPhase: document.querySelector('[data-boss-phase]'),
    audio: document.querySelector('[data-game-audio]'),
    settings: document.querySelector('[data-game-settings]'),
    compass: document.querySelector('[data-game-compass]'),
    compassNeedle: document.querySelector('[data-game-compass-needle]'),
    destination: document.querySelector('[data-game-destination]'),
    debugHud: document.querySelector('[data-game-debug]'),
    debugMode: document.querySelector('[data-game-debug-mode]'),
    debugPosition: document.querySelector('[data-game-debug-position]'),
    debugTarget: document.querySelector('[data-game-debug-target]'),
    debugContract: document.querySelector('[data-game-debug-contract]')
  };

  const SAVE_KEY = 'adnf-sunny-valley-autosave-v2';
  const LEGACY_SAVE_KEY = 'adnf-frog-farmyard-quest-3d-v1';
  const SLOT_PREFIX = 'adnf-sunny-valley-slot-';
  const mapContractErrors = validateMapContract(MAP);
  if (mapContractErrors.length) throw new Error(`Sunny Valley map contract failed: ${mapContractErrors.join(' ')}`);
  window.__SUNNY_VALLEY_MAP__ = MAP;

  // All production systems derive from this frozen contract. Rendering,
  // collision, interactions, tests, and the debug overlay no longer maintain
  // separate copies of the same landmark coordinates.
  const WORLD = MAP.world.bounds;
  const toInteriorWorld = ({ x, z }) => ({
    x: MAP.interior.instanceOrigin.x + x,
    z: MAP.interior.instanceOrigin.z + z
  });
  const HOMESTEAD = {
    house: MAP.landmarks.farmhouse.center,
    porch: MAP.landmarks.farmhouse.porchInteraction,
    field: MAP.field.center,
    fieldGate: MAP.field.gate.center,
    returnPoint: MAP.landmarks.farmhouse.returnPoint
  };
  const INTERIOR = {
    x: MAP.interior.instanceOrigin.x,
    z: MAP.interior.instanceOrigin.z,
    width: MAP.interior.shell.width,
    depth: MAP.interior.shell.depth,
    entrance: toInteriorWorld(MAP.interior.spawn),
    entryDoor: toInteriorWorld(MAP.interior.entryDoor),
    door: toInteriorWorld(MAP.interior.exitInteraction),
    bed: toInteriorWorld(MAP.interior.furniture.bed.center)
  };
  const INTERIOR_FURNITURE = Object.fromEntries(
    Object.entries(MAP.interior.furniture).map(([key, item]) => [key, {
      ...toInteriorWorld(item.center),
      interaction: toInteriorWorld(item.interaction),
      footprint: { ...item.footprint, ...toInteriorWorld(item.footprint) }
    }])
  );
  const pond = { x: MAP.landmarks.pond.center.x, z: MAP.landmarks.pond.center.z, rx: MAP.landmarks.pond.rx, rz: MAP.landmarks.pond.rz };
  const obstacles = MAP.exteriorCollisions;

  const freshGarden = () => Array(12).fill('dry');
  const freshGardenQuality = () => Array(12).fill(1);
  const freshFlags = () => ({ metDad:false, pipJoined:false, stoneRead:false, bramblesOpen:false, snackMade:false, millOpen:false, bossWon:false, chapterWon:false });
  const freshHome = () => ({ bandana:'red', washedDay:0, pantry:0, bedTier:1 });
  const state = {
    started: false,
    expanded: false,
    panelOpen: false,
    debugMap: localStorage.getItem('adnf-map-diagnostics') === 'true',
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
    coins: 0,
    stamina: 12,
    maxStamina: 12,
    fertilizer: 2,
    shippingBin: 0,
    shippedTotal: 0,
    earningsLastNight: 0,
    gardenQuality: freshGardenQuality(),
    wateringStreak: 0,
    toolTier: 1,
    requestDay: 0,
    requestDoneDay: 0,
    bedtimeWarned: false,
    flags: freshFlags(),
    home: freshHome(),
    inInterior: false,
    garden: freshGarden(),
    taken: new Set(),
    target: new THREE.Vector3(-30, 0, -15),
    path: [],
    destinationName: 'Explore',
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
    playSeconds: 0,
    discoveries: 0,
    audioEnabled: localStorage.getItem('adnf-audio-enabled') !== 'false',
    quality: localStorage.getItem('adnf-game-quality') || 'auto'
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizedSave(saved) {
    if (!saved || typeof saved !== 'object') return null;
    const savedStage = clamp(Number(saved.stage) || 0, 0, 13);
    const saveVersion = Number(saved.version) || 2;
    let migratedPosition = saved.position && Number.isFinite(saved.position.x) && Number.isFinite(saved.position.z)
      ? { x: saved.position.x, z: saved.position.z }
      : { x: -30, z: -15 };
    if (saveVersion < 3) {
      if (savedStage >= 5 && savedStage <= 6) migratedPosition = { x: 24, z: 14 };
      else if (savedStage === 7 || savedStage === 12) migratedPosition = { x: 0, z: 20 };
      else if (savedStage === 8) migratedPosition = { x: 5, z: 8 };
      else if (savedStage >= 10 && savedStage <= 11) migratedPosition = { x: 31, z: -22 };
      else migratedPosition = { x: -30, z: -15 };
    }
    // The former home and garden footprint is now a travel corridor. Keep an
    // existing player from resuming inside the relocated farmhouse geometry.
    if (saveVersion < 4 && migratedPosition.x > -52 && migratedPosition.x < -31 && migratedPosition.z > 14 && migratedPosition.z < 32) {
      migratedPosition = { x: -36, z: 24 };
    }
    const savedHome = { ...freshHome(), ...(saved.home || {}) };
    const savedInterior = Boolean(saved.inInterior) && saveVersion >= 4;
    return {
      stage: savedStage,
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
      home: {
        bandana: ['red','blue','gold'].includes(savedHome.bandana) ? savedHome.bandana : 'red',
        washedDay: clamp(Number(savedHome.washedDay) || 0, 0, 999),
        pantry: clamp(Number(savedHome.pantry) || 0, 0, 999),
        bedTier: clamp(Number(savedHome.bedTier) || 1, 1, 2)
      },
      inInterior: savedInterior,
      coins: clamp(Number(saved.coins) || 0, 0, 999999),
      stamina: clamp(saved.stamina == null ? 12 : Number(saved.stamina), 0, 20),
      maxStamina: clamp(Number(saved.maxStamina) || 12, 8, 20),
      fertilizer: clamp(Number(saved.fertilizer) || 0, 0, 99),
      shippingBin: clamp(Number(saved.shippingBin) || 0, 0, 999),
      shippedTotal: clamp(Number(saved.shippedTotal) || 0, 0, 99999),
      earningsLastNight: clamp(Number(saved.earningsLastNight) || 0, 0, 99999),
      garden: Array.from({length:12},(_,index)=>{
        const phase=Array.isArray(saved.garden)?saved.garden[index]:'dry';
        return migrateGardenPhase(phase);
      }),
      gardenQuality: Array.from({length:12},(_,index)=>clamp(Number(saved.gardenQuality?.[index])||1,1,3)),
      wateringStreak: clamp(Number(saved.wateringStreak) || 0, 0, 999),
      toolTier: clamp(Number(saved.toolTier) || 1, 1, 3),
      requestDay: clamp(Number(saved.requestDay) || 0, 0, 999),
      requestDoneDay: clamp(Number(saved.requestDoneDay) || 0, 0, 999),
      taken: Array.isArray(saved.taken) ? saved.taken : [],
      position: savedInterior
        ? { x: clamp(migratedPosition.x, INTERIOR.x - INTERIOR.width / 2 + 1, INTERIOR.x + INTERIOR.width / 2 - 1), z: clamp(migratedPosition.z, INTERIOR.z - INTERIOR.depth / 2 + 1, INTERIOR.z + INTERIOR.depth / 2 - 1) }
        : { x: clamp(migratedPosition.x, WORLD.minX + 1, WORLD.maxX - 1), z: clamp(migratedPosition.z, WORLD.minZ + 1, WORLD.maxZ - 1) },
      bossHealth: clamp(Number(saved.bossHealth) || 8, 1, 8),
      playSeconds: Math.max(0, Number(saved.playSeconds) || 0),
      discoveries: clamp(Number(saved.discoveries) || 0, 0, 99),
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
    state.gardenQuality = clean.gardenQuality;
    state.loadedPosition = clean.position;
    state.bossActive = false;
    state.bossPhase = 0;
    state.path = [];
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
    const position = typeof frog !== 'undefined' ? { x:frog.position.x, z:frog.position.z } : (state.loadedPosition || { x:-30, z:-15 });
    return {
      version: 6,
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
      coins: state.coins,
      stamina: state.stamina,
      maxStamina: state.maxStamina,
      fertilizer: state.fertilizer,
      shippingBin: state.shippingBin,
      shippedTotal: state.shippedTotal,
      earningsLastNight: state.earningsLastNight,
      gardenQuality: state.gardenQuality,
      wateringStreak: state.wateringStreak,
      toolTier: state.toolTier,
      requestDay: state.requestDay,
      requestDoneDay: state.requestDoneDay,
      flags: state.flags,
      home: state.home,
      inInterior: state.inInterior,
      garden: state.garden,
      taken: [...state.taken],
      position,
      bossHealth: state.bossActive ? state.bossHealth : 8,
      playSeconds: state.playSeconds,
      discoveries: state.discoveries,
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
      saveToIndexedDb(saveData());
      if (showBadge) flashSaved();
    } catch (error) {
      // The adventure remains playable when private browsing blocks storage.
    }
  }

  function saveToIndexedDb(data) {
    if (!('indexedDB' in window)) return;
    const request = indexedDB.open('adnf-sunny-valley', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => {
      const transaction = request.result.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put(data, 'autosave');
    };
  }

  loadProgress();

  const audioEngine={context:null,master:null,music:null,effects:null,nextNote:0,nextAmbient:0,step:0,zone:'',enabled:state.audioEnabled};

  function initAudio(){
    if(!audioEngine.enabled)return;
    if(!audioEngine.context){
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)return;
      const context=new AudioContext(),master=context.createGain(),music=context.createGain(),effectsGain=context.createGain();
      master.gain.value=.42;music.gain.value=.28;effectsGain.gain.value=.52;
      music.connect(master);effectsGain.connect(master);master.connect(context.destination);
      Object.assign(audioEngine,{context,master,music,effects:effectsGain,nextNote:context.currentTime+.05});
    }
    audioEngine.context.resume?.();
  }

  function pluck(frequency,when,duration=.65,volume=.16,type='triangle'){
    const context=audioEngine.context;if(!context||!audioEngine.enabled)return;
    const oscillator=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,when);
    filter.type='lowpass';filter.frequency.setValueAtTime(type==='sine'?1100:1900,when);
    gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(volume,when+.012);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
    oscillator.connect(filter);filter.connect(gain);gain.connect(audioEngine.music);oscillator.start(when);oscillator.stop(when+duration+.03);
  }

  function playSfx(kind){
    const context=audioEngine.context;if(!context||!audioEngine.enabled)return;
    const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
    osc.connect(gain);gain.connect(audioEngine.effects);gain.gain.setValueAtTime(.0001,now);
    if(kind==='bark'){osc.type='square';osc.frequency.setValueAtTime(185,now);osc.frequency.exponentialRampToValueAtTime(90,now+.14);gain.gain.exponentialRampToValueAtTime(.22,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);}
    else if(kind==='sniff'){osc.type='sine';osc.frequency.setValueAtTime(420,now);osc.frequency.exponentialRampToValueAtTime(760,now+.24);gain.gain.exponentialRampToValueAtTime(.11,now+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+.32);}
    else if(kind==='find'){osc.type='triangle';osc.frequency.setValueAtTime(660,now);osc.frequency.setValueAtTime(880,now+.1);gain.gain.exponentialRampToValueAtTime(.13,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.36);}
    else if(kind==='plant'){osc.type='triangle';osc.frequency.setValueAtTime(240,now);osc.frequency.exponentialRampToValueAtTime(340,now+.16);gain.gain.exponentialRampToValueAtTime(.1,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.24);}
    else if(kind==='water'){osc.type='sine';osc.frequency.setValueAtTime(540,now);osc.frequency.exponentialRampToValueAtTime(300,now+.3);gain.gain.exponentialRampToValueAtTime(.085,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.34);}
    else if(kind==='harvest'){osc.type='triangle';osc.frequency.setValueAtTime(520,now);osc.frequency.setValueAtTime(780,now+.1);osc.frequency.setValueAtTime(1040,now+.2);gain.gain.exponentialRampToValueAtTime(.13,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.38);}
    else if(kind==='step'){osc.type='sine';osc.frequency.setValueAtTime(118,now);gain.gain.exponentialRampToValueAtTime(.035,now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+.07);}
    else if(kind==='ship'){osc.type='triangle';osc.frequency.setValueAtTime(420,now);osc.frequency.setValueAtTime(630,now+.12);osc.frequency.setValueAtTime(840,now+.24);gain.gain.exponentialRampToValueAtTime(.14,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.42);}
    else if(kind==='sleep'){osc.type='sine';osc.frequency.setValueAtTime(330,now);osc.frequency.exponentialRampToValueAtTime(196,now+.35);gain.gain.exponentialRampToValueAtTime(.08,now+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+.48);}
    else{osc.type='triangle';osc.frequency.setValueAtTime(260,now);gain.gain.exponentialRampToValueAtTime(.12,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);}
    osc.start(now);osc.stop(now+.52);
  }

  function haptic(pattern=18){
    try{navigator.vibrate?.(pattern);}catch{/* Haptics are an optional mobile enhancement. */}
  }

  function playFrogAction(action,duration=900){
    frog.userData.action=action;
    frog.userData.actionStartedAt=performance.now();
    frog.userData.actionUntil=performance.now()+duration;
    frog.userData.spriteFrame=-1;
  }

  function updateMusic(){
    const context=audioEngine.context;if(!context||!audioEngine.enabled||context.currentTime<audioEngine.nextNote)return;
    const dangerous=state.bossActive||(state.stage===8&&nearestThreat()&&entityDistance(nearestThreat())<8);
    const roots={"Sunny Farm":196,"Moonberry Homestead":196,"Happy Pond":220,"Hilltop Village":246.94,"Old Mill Hollow":dangerous?146.83:174.61,"Wildflower Commons":220,"West Orchard Trail":196,"Eastwater Trail":220};
    const root=roots[zoneName()]||196;
    const peaceful=[1,1.25,1.5,2,1.5,1.25,1.125,1.5],tense=[1,1.067,1.2,1.414,1.2,1.067,1.5,1.414],pattern=dangerous?tense:peaceful;
    const beat=dangerous?.27:.43,index=audioEngine.step%pattern.length;
    pluck(root*pattern[index],context.currentTime+.01,dangerous?.24:.72,dangerous?.12:.085,index%4===0?'sawtooth':'triangle');
    if(index%4===0)pluck(root/2,context.currentTime+.01,dangerous?.55:1.45,.055,'sine');
    if(!dangerous&&index%8===4)pluck(root*2.25,context.currentTime+.06,.85,.05,'triangle');
    audioEngine.step+=1;audioEngine.nextNote=context.currentTime+beat;
  }

  function updateAmbience(){
    const context=audioEngine.context;if(!context||!audioEngine.enabled||context.currentTime<audioEngine.nextAmbient)return;
    const night=state.clock>18.5||state.clock<7,nearPond=zoneName()==='Happy Pond';
    const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.connect(gain);gain.connect(audioEngine.effects);
    const start=context.currentTime+.02,base=night?3200:nearPond?720:1500;
    osc.frequency.setValueAtTime(base,start);osc.frequency.exponentialRampToValueAtTime(night?2600:base*1.35,start+.12);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(nearPond?.035:.022,start+.018);gain.gain.exponentialRampToValueAtTime(.0001,start+.28);
    osc.start(start);osc.stop(start+.3);audioEngine.nextAmbient=context.currentTime+2.8+(audioEngine.step%5)*.7;
  }

  function toggleAudio(){
    audioEngine.enabled=!audioEngine.enabled;state.audioEnabled=audioEngine.enabled;localStorage.setItem('adnf-audio-enabled',String(audioEngine.enabled));
    if(audioEngine.enabled){initAudio();if(audioEngine.master)audioEngine.master.gain.value=.42;toast('Appalachian-inspired music and valley sounds on.');}
    else if(audioEngine.master){audioEngine.master.gain.value=0;toast('Sound muted.');}
    dom.audio.textContent=audioEngine.enabled?'Sound':'Muted';
  }

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
  scene.fog = new THREE.Fog(0xc6e7d4, 58, 142);

  const camera = new THREE.PerspectiveCamera(MAP.camera.desktopFov, 1, 0.1, 260);
  const cameraFocus = new THREE.Vector3(-30, 0, -15);
  const cameraOffset = new THREE.Vector3(MAP.camera.exteriorOffset.x, MAP.camera.exteriorOffset.y, MAP.camera.exteriorOffset.z);
  const cameraLookAhead = new THREE.Vector3();
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
  const interiorObstacles = [];
  let farmhouseDoor;
  let interiorDoor;
  function pivotLimb(parent, mat, x, y, z, length, radius = .16) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    addMesh(pivot, new THREE.CylinderGeometry(radius * .82, radius, length, 9), mat, 0, -length / 2, 0);
    addMesh(pivot, new THREE.SphereGeometry(radius * 1.18, 10, 7), mat, 0, -length + .02, .08, { scale:[1.05,.62,1.35] });
    parent.add(pivot);
    return pivot;
  }

  function eyes(parent, x, y, z, spacing = .23, scale = 1) {
    [-1, 1].forEach((side) => {
      addMesh(parent, new THREE.SphereGeometry(.13 * scale, 12, 9), palette.white, x + side * spacing, y, z);
      addMesh(parent, new THREE.SphereGeometry(.067 * scale, 10, 8), palette.black, x + side * spacing, y, z + .105 * scale);
    });
  }

  function createDogModel() {
    const group = new THREE.Group();
    const body = addMesh(group, new THREE.SphereGeometry(.82, 18, 13), palette.black, 0, 1.12, 0, { scale:[.92,.82,1.35] });
    addMesh(group, new THREE.SphereGeometry(.56, 16, 12), palette.tan, 0, 1.06, .34, { scale:[.74,.76,.84] });
    const head = new THREE.Group(); head.position.set(0,1.68,.92); group.add(head);
    addMesh(head,new THREE.SphereGeometry(.63,18,13),palette.black,0,0,0,{scale:[.92,1,1]});
    addMesh(head,new THREE.SphereGeometry(.41,16,11),palette.tan,0,-.14,.53,{scale:[1,.72,1.14]});
    addMesh(head,new THREE.SphereGeometry(.2,14,10),palette.black,0,-.06,.9,{scale:[1.15,.72,.7]});
    eyes(head,0,.14,.49,.24,1.08);
    [-1,1].forEach(side=>{
      const ear=addMesh(head,new THREE.SphereGeometry(.3,12,9),palette.black,side*.5,-.05,-.04,{scale:[.62,1.35,.52]}); ear.rotation.z=side*.42;
      addMesh(head,new THREE.SphereGeometry(.105,10,8),palette.tan,side*.3,.29,.46,{scale:[1.05,.74,.58]});
    });
    const collar=addMesh(group,new THREE.TorusGeometry(.58,.075,8,28),palette.collar,0,1.45,.46,{rotation:[Math.PI/2,0,0],scale:[1,.72,1]});
    const legs=[pivotLimb(group,palette.black,-.48,1.04,.63,.85,.17),pivotLimb(group,palette.black,.48,1.04,.63,.85,.17),pivotLimb(group,palette.black,-.48,1.02,-.64,.83,.18),pivotLimb(group,palette.black,.48,1.02,-.64,.83,.18)];
    legs.forEach(leg=>addMesh(leg,new THREE.SphereGeometry(.14,10,8),palette.tan,0,-.63,.04,{scale:[1,1.5,1]}));
    const tail=new THREE.Group(); tail.position.set(0,1.35,-1.03); tail.rotation.x=-.72; group.add(tail);
    addMesh(tail,new THREE.CylinderGeometry(.09,.15,.9,10),palette.black,0,.4,0,{rotation:[0,0,.08]});
    group.userData={kind:'dog',body,head,legs,tail,collar,arms:[],baseY:body.position.y,action:'idle',actionUntil:0};
    return group;
  }

  function createFarmerModel() {
    const group=new THREE.Group();
    const body=addMesh(group,new THREE.BoxGeometry(1.05,1.35,.62),palette.denim,0,1.72,0,{scale:[1,.96,1]});
    addMesh(group,new THREE.BoxGeometry(.86,.78,.66),material('farmerShirt',0xe3493e),0,2.25,0);
    const head=new THREE.Group(); head.position.set(0,3.05,.04); group.add(head);
    addMesh(head,new THREE.SphereGeometry(.48,16,12),palette.skin,0,0,0,{scale:[.9,1,.88]});
    addMesh(head,new THREE.SphereGeometry(.49,14,9),material('hair',0x5b3525),0,.2,-.08,{scale:[.94,.5,.9]});
    eyes(head,0,.05,.41,.17,.72);
    addMesh(head,new THREE.CylinderGeometry(.5,.55,.16,18),material('strawHat',0xd7a63e),0,.52,0);
    addMesh(head,new THREE.CylinderGeometry(.34,.37,.28,16),material('strawHatTop',0xe7bd59),0,.68,0);
    const legs=[pivotLimb(group,palette.denim,-.28,1.08,0,.92,.17),pivotLimb(group,palette.denim,.28,1.08,0,.92,.17)];
    const arms=[pivotLimb(group,material('farmerShirt',0xe3493e),-.67,2.52,0,.92,.13),pivotLimb(group,material('farmerShirt',0xe3493e),.67,2.52,0,.92,.13)];
    arms[0].rotation.z=-.18; arms[1].rotation.z=.18;
    group.userData={kind:'farmer',body,head,legs,arms,tail:new THREE.Object3D(),baseY:body.position.y,action:'idle'};
    return group;
  }

  function createPipModel() {
    const group=new THREE.Group();
    const body=addMesh(group,new THREE.SphereGeometry(.54,16,12),palette.green,0,.55,0,{scale:[1.05,.78,.9]});
    const head=new THREE.Group(); head.position.set(0,.95,.28); group.add(head);
    addMesh(head,new THREE.SphereGeometry(.5,16,12),palette.greenLight,0,0,0,{scale:[1.1,.78,.88]});
    eyes(head,0,.15,.34,.29,1);
    const legs=[pivotLimb(group,palette.green,-.42,.55,.06,.52,.13),pivotLimb(group,palette.green,.42,.55,.06,.52,.13)];
    legs[0].rotation.z=-.72;legs[1].rotation.z=.72;
    group.userData={kind:'frog',body,head,legs,arms:[],tail:new THREE.Object3D(),baseY:body.position.y,action:'idle'};
    return group;
  }

  function createBunnyModel() {
    const group=new THREE.Group();
    const body=addMesh(group,new THREE.SphereGeometry(.6,16,12),palette.white,0,.92,0,{scale:[.82,1.08,.78]});
    const head=new THREE.Group();head.position.set(0,1.58,.28);group.add(head);
    addMesh(head,new THREE.SphereGeometry(.5,16,12),palette.white,0,0,0,{scale:[.9,1,.9]});eyes(head,0,.08,.42,.2,.85);
    [-1,1].forEach(side=>addMesh(head,new THREE.SphereGeometry(.21,12,9),palette.white,side*.22,.68,-.03,{rotation:[0,0,side*.12],scale:[.64,2.05,.6]}));
    addMesh(group,new THREE.BoxGeometry(.82,.5,.67),material('blazeJersey',0xe0553e),0,1.02,.12);
    const legs=[pivotLimb(group,palette.white,-.32,.72,.15,.68,.14),pivotLimb(group,palette.white,.32,.72,.15,.68,.14)];
    group.userData={kind:'bunny',body,head,legs,arms:[],tail:new THREE.Object3D(),baseY:body.position.y,action:'idle'};return group;
  }

  function createHenModel() {
    const group=new THREE.Group();const body=addMesh(group,new THREE.SphereGeometry(.64,16,12),palette.white,0,.72,0,{scale:[.86,1,1.02]});
    const head=new THREE.Group();head.position.set(0,1.32,.35);group.add(head);addMesh(head,new THREE.SphereGeometry(.38,14,10),palette.white,0,0,0);
    eyes(head,0,.08,.33,.15,.65);addMesh(head,new THREE.ConeGeometry(.13,.38,4),palette.orange,0,-.04,.5,{rotation:[Math.PI/2,0,0]});
    [-.18,0,.18].forEach(x=>addMesh(head,new THREE.SphereGeometry(.12,9,7),palette.red,x,.42,0));
    const legs=[pivotLimb(group,palette.orange,-.22,.43,.05,.42,.07),pivotLimb(group,palette.orange,.22,.43,.05,.42,.07)];
    const arms=[addMesh(group,new THREE.SphereGeometry(.32,12,8),palette.cream,-.57,.78,0,{scale:[.42,1,.84]}),addMesh(group,new THREE.SphereGeometry(.32,12,8),palette.cream,.57,.78,0,{scale:[.42,1,.84]})];
    group.userData={kind:'hen',body,head,legs,arms,tail:new THREE.Object3D(),baseY:body.position.y,action:'idle'};return group;
  }

  function createTortoiseModel() {
    const group=new THREE.Group();const body=addMesh(group,new THREE.SphereGeometry(.72,18,12),material('shell',0x876235),0,.58,0,{scale:[1.18,.67,1]});
    addMesh(group,new THREE.SphereGeometry(.62,16,10),material('shellPattern',0xb38a46),0,.69,0,{scale:[1.06,.48,.9]});
    const head=new THREE.Group();head.position.set(0,.58,.86);group.add(head);addMesh(head,new THREE.SphereGeometry(.32,14,10),palette.greenLight,0,0,0,{scale:[.9,.86,1.15]});eyes(head,0,.07,.3,.13,.62);
    const legs=[pivotLimb(group,palette.green,-.48,.48,.42,.38,.12),pivotLimb(group,palette.green,.48,.48,.42,.38,.12),pivotLimb(group,palette.green,-.48,.48,-.4,.38,.12),pivotLimb(group,palette.green,.48,.48,-.4,.38,.12)];
    group.userData={kind:'tortoise',body,head,legs,arms:[],tail:new THREE.Object3D(),baseY:body.position.y,action:'idle'};return group;
  }

  function createGloamlingModel() {
    const group=new THREE.Group();const gloom=material('gloomBody',0x332748,{roughness:.5,emissive:0x1d1029,emissiveIntensity:.45});
    const body=addMesh(group,new THREE.SphereGeometry(.55,14,10),gloom,0,.72,0,{scale:[.86,1.2,.82]});
    const head=new THREE.Group();head.position.set(0,1.15,.22);group.add(head);addMesh(head,new THREE.SphereGeometry(.39,13,9),gloom,0,0,0);
    [-1,1].forEach(side=>addMesh(head,new THREE.SphereGeometry(.08,9,7),material('gloomEye',0xffc65a,{emissive:0xff7b27,emissiveIntensity:1.5}),side*.14,.07,.35));
    const legs=[pivotLimb(group,gloom,-.25,.45,0,.45,.1),pivotLimb(group,gloom,.25,.45,0,.45,.1)];
    group.userData={kind:'gloamling',body,head,legs,arms:[],tail:new THREE.Object3D(),baseY:body.position.y,action:'idle'};return group;
  }

  function createScarecrowModel() {
    const group=new THREE.Group();const coat=material('scareCoat',0x4a3549);const straw=material('scareStraw',0xc6903d);
    const body=addMesh(group,new THREE.BoxGeometry(1.1,1.8,.66),coat,0,2.15,0,{rotation:[0,0,.04]});
    const head=new THREE.Group();head.position.set(0,3.45,.12);group.add(head);addMesh(head,new THREE.SphereGeometry(.62,14,10),material('scareMask',0xa7774f),0,0,0,{scale:[.86,1.05,.76]});
    [-1,1].forEach(side=>addMesh(head,new THREE.ConeGeometry(.1,.25,5),material('scareEye',0xff6d31,{emissive:0xff4218,emissiveIntensity:1.8}),side*.2,.08,.5,{rotation:[Math.PI/2,0,0]}));
    addMesh(head,new THREE.CylinderGeometry(.58,.82,.35,12),material('scareHat',0x322737),0,.66,0);addMesh(head,new THREE.ConeGeometry(.5,1.05,12),material('scareHat',0x322737),0,1.12,0);
    const heart=addMesh(group,new THREE.OctahedronGeometry(.22,0),material('scareHeart',0xff8a3d,{emissive:0xff4d23,emissiveIntensity:1.6}),0,2.24,.42);
    const legs=[pivotLimb(group,straw,-.32,1.28,0,1.2,.13),pivotLimb(group,straw,.32,1.28,0,1.2,.13)];
    const arms=[pivotLimb(group,straw,-.72,2.76,0,1.45,.11),pivotLimb(group,straw,.72,2.76,0,1.45,.11)];arms[0].rotation.z=-1.2;arms[1].rotation.z=1.2;
    group.userData={kind:'scarecrow',body,head,legs,arms,tail:new THREE.Object3D(),heart,baseY:body.position.y,action:'idle'};return group;
  }

  function createRenderedCharacter(name, x, z, height, options = {}) {
    const factories={frog:createDogModel,dad:createFarmerModel,pip:createPipModel,blaze:createBunnyModel,hazel:createHenModel,tortoise:createTortoiseModel,gloamling:createGloamlingModel,scarecrow:createScarecrowModel};
    const fallback=(factories[name]||createGloamlingModel)();
    const group=new THREE.Group();
    group.position.set(x,0,z);
    const nativeHeight={frog:2.45,dad:3.9,pip:1.35,blaze:2.35,hazel:1.75,tortoise:1.25,gloamling:1.6,scarecrow:4.7}[name]||2;
    fallback.scale.setScalar(height/nativeHeight);
    fallback.visible=false;
    group.add(fallback);

    const staticAsset=name==='dad';
    const path=staticAsset
      ? './assets/game/characters/dad.png'
      : `./assets/game/characters/directional/${name}.webp`;
    const spriteMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,alphaTest:.08,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    const spriteHeight=height*(name==='scarecrow'?1.28:1.16);
    const spriteWidth=spriteHeight*(options.aspect||.8);
    const sprite=new THREE.Mesh(new THREE.PlaneGeometry(spriteWidth,spriteHeight),spriteMaterial);
    sprite.position.y=spriteHeight*.47;
    sprite.renderOrder=name==='scarecrow'?23:20;
    sprite.userData.illustratedAsset=true;
    group.add(sprite);
    const texture=illustratedTextureLoader.load(path,()=>{
      configureIllustratedTexture(texture);
      if(!staticAsset){texture.repeat.set(1/4,1/2);texture.offset.set(0,1/2);}
      spriteMaterial.map=texture;
      spriteMaterial.opacity=1;
      spriteMaterial.needsUpdate=true;
    },undefined,()=>{
      sprite.visible=false;
      fallback.visible=true;
      group.userData.renderAsset=false;
      showIllustratedAssetWarning(`${name} character`,path);
    });
    group.userData={
      ...fallback.userData,
      kind:fallback.userData.kind||name,
      modelScale:height/nativeHeight,
      renderAsset:true,
      sprite,
      spriteMaterial,
      spriteTextures:{directional:{all:texture}},
      spriteDirection:'south',
      spriteFrame:-1,
      spriteFrameCount:2,
      spriteFrameRate:name==='gloamling'?7:5,
      spriteStatic:staticAsset,
      bodyBaseScaleZ:fallback.userData.body?.scale.z||1,
      fallback,
      action:'idle',
      actionUntil:0
    };
    scene.add(group);
    return group;
  }

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
    gold: material('gold', 0xe3b34a),
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
      if (child.userData.illustratedAsset) {
        child.castShadow = false;
        child.receiveShadow = false;
        return;
      }
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

  const illustratedTextureLoader = new THREE.TextureLoader();
  const failedIllustratedAssets = new Set();

  function configureIllustratedTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function showIllustratedAssetWarning(label, path) {
    if (failedIllustratedAssets.has(path)) return;
    failedIllustratedAssets.add(path);
    console.error(`${label} illustration failed to load: ${path}`);
    toast(`${label} artwork did not load. Placeholder geometry is showing for diagnostics.`);
  }

  function createIllustratedPlane(parent, options) {
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      alphaTest: options.alphaTest ?? .08,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(options.width, options.height), material);
    mesh.position.set(options.x || 0, options.y || 0, options.z || 0);
    mesh.rotation.y = options.yaw ?? Math.atan2(MAP.camera.exteriorOffset.x, MAP.camera.exteriorOffset.z);
    mesh.renderOrder = options.renderOrder ?? 12;
    mesh.userData.illustratedAsset = true;
    parent.add(mesh);
    const fallback = options.fallback || [];
    fallback.forEach((object) => { object.visible = false; });
    const texture = illustratedTextureLoader.load(options.path, () => {
      configureIllustratedTexture(texture);
      material.map = texture;
      material.opacity = 1;
      material.needsUpdate = true;
    }, undefined, () => {
      mesh.visible = false;
      fallback.forEach((object) => { object.visible = true; });
      showIllustratedAssetWarning(options.label, options.path);
    });
    return { mesh, material, texture };
  }

  function setAtlasFrame(geometry, frame, frameCount) {
    const uv = geometry.attributes.uv;
    if (!geometry.userData.baseUv) geometry.userData.baseUv = Array.from(uv.array);
    const base = geometry.userData.baseUv;
    for (let index = 0; index < uv.count; index += 1) {
      uv.setX(index, (base[index * 2] + frame) / frameCount);
      uv.setY(index, base[index * 2 + 1]);
    }
    uv.needsUpdate = true;
  }

  function setTextureAtlasCell(texture,columns,rows,index){
    const column=index%columns;
    const row=Math.floor(index/columns);
    texture.repeat.set(1/columns,1/rows);
    texture.offset.set(column/columns,1-(row+1)/rows);
    texture.needsUpdate=true;
  }

  function directionFromDelta(dx,dz){
    return Math.abs(dx)>Math.abs(dz)?(dx>0?'east':'west'):(dz>0?'south':'north');
  }

  const hemisphere = new THREE.HemisphereLight(0xcff2ff, 0x679348, 2.5);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffe7b0, 3.7);
  sun.position.set(-14, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -66;
  sun.shadow.camera.right = 66;
  sun.shadow.camera.top = 58;
  sun.shadow.camera.bottom = -58;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0007;
  scene.add(sun);

  function createGround() {
    const ground = addMesh(scene, new THREE.PlaneGeometry(120, 96), palette.grass, 0, -0.04, 0, { rotation: [-Math.PI / 2, 0, 0], cast: false });
    ground.receiveShadow = true;
    clickableGround.push(ground);

    const meadow = addMesh(scene, new THREE.CircleGeometry(22, 64), palette.grassLight, 3, 0, 5, { rotation: [-Math.PI / 2, 0, 0], scale: [1.25, 1, .78], cast: false });
    meadow.receiveShadow = true;

    const regionPatches = [
      [-39,-24,18,12,material('farmGrass',0x75b94b)],
      [HOMESTEAD.house.x,HOMESTEAD.house.z,12,10,material('homeGrass',0x92cd5d)],
      [HOMESTEAD.field.x,HOMESTEAD.field.z,11,8,material('moonberryFieldGrass',0x78b04c)],
      [38,-28,18,13,material('hollowGrass',0x60784c)],
      [41,34,18,11,material('villageGrass',0xa0ce67)]
    ];
    regionPatches.forEach(([x,z,rx,rz,mat]) => {
      const patch = addMesh(scene,new THREE.CircleGeometry(1,56),mat,x,-.005,z,{rotation:[-Math.PI/2,0,0],scale:[rx,rz,1],cast:false});
      patch.receiveShadow=true;
    });

    Object.values(MAP.trails).forEach((trail, trailIndex) => {
      trail.points.slice(0, -1).forEach((start, index) => {
        const end = trail.points[index + 1];
        const length = Math.hypot(end.x - start.x, end.z - start.z);
        const steps = Math.max(2, Math.ceil(length / (trail.width * .55)));
        for (let step = 0; step <= steps; step += 1) {
          const t = step / steps;
          const x = start.x + (end.x - start.x) * t;
          const z = start.z + (end.z - start.z) * t;
          addMesh(scene, new THREE.CircleGeometry(trail.width / 2, 22), (trailIndex + step) % 2 ? palette.pathLight : palette.path, x, .015, z, { rotation: [-Math.PI / 2, 0, 0], cast: false });
        }
      });
    });

    const walkSurface = addMesh(scene, new THREE.PlaneGeometry(118, 94), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 0.045, 0, { rotation: [-Math.PI / 2, 0, 0], cast: false, receive: false });
    clickableGround.push(walkSurface);

    const grassBladeGeometry = new THREE.ConeGeometry(.065, .38, 3);
    const grassInstances = new THREE.InstancedMesh(grassBladeGeometry, palette.grassDark, 620);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 620; i += 1) {
      const x = -56 + ((i * 17.37) % 112);
      const z = -44 + ((i * 29.91) % 88);
      if (isInPond(x, z)) {
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
    return group;
  }

  function createFarmhouse(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const wall = material('farmhouseWall', 0xf2e4be);
    const trim = material('farmhouseTrim', 0xfff9e7);
    const roof = material('farmhouseRoof', 0xa94232);
    const warmWindow = material('farmhouseWindow', 0xffd982, { emissive:0xffa34b, emissiveIntensity:.24 });
    addMesh(group, new THREE.BoxGeometry(9.4, 4.8, 7.2), wall, 0, 2.4, 0);
    addMesh(group, new THREE.ConeGeometry(6.7, 3.7, 4), roof, 0, 6.5, 0, { rotation:[0,Math.PI/4,0], scale:[1,1,.82] });
    addMesh(group, new THREE.BoxGeometry(1.05, 4.6, 1.05), palette.redDark, 2.8, 6.35, -.5);
    // A real front porch makes the entrance legible from across the homestead.
    addMesh(group, new THREE.BoxGeometry(5.4,.42,2.2), palette.woodLight, 0,.32,4.35);
    addMesh(group, new THREE.BoxGeometry(3.2,.28,1.05), palette.wood, 0,.18,5.38);
    [-2.3,2.3].forEach((doorX)=>addMesh(group,new THREE.CylinderGeometry(.13,.16,3.25,8),trim,doorX,1.95,4.7));
    addMesh(group,new THREE.BoxGeometry(5.25,.22,.34),trim,0,3.55,4.72);
    const doorPivot = new THREE.Group(); doorPivot.position.set(0,0,3.67); group.add(doorPivot);
    addMesh(doorPivot, new THREE.BoxGeometry(1.62,2.8,.18), palette.wood, -.81,1.4,0);
    addMesh(doorPivot, new THREE.SphereGeometry(.09,8,6), palette.gold, -1.45,1.42,.13);
    addMesh(group,new THREE.BoxGeometry(2.35,.12,.72),material('welcomeMat',0x7c4352),0,.56,5.18);
    farmhouseDoor = doorPivot;
    [-3.15,3.15].forEach((windowX)=>{
      addMesh(group,new THREE.BoxGeometry(1.35,1.22,.16),warmWindow,windowX,2.55,3.68);
      addMesh(group,new THREE.BoxGeometry(.12,1.35,.2),trim,windowX,2.55,3.8);
      addMesh(group,new THREE.BoxGeometry(1.46,.12,.2),trim,windowX,2.55,3.8);
      addMesh(group,new THREE.BoxGeometry(1.68,.26,.35),material('flowerBox',0x774536),windowX,1.75,3.9);
      [-.5,0,.5].forEach((offset)=>addMesh(group,new THREE.SphereGeometry(.1,8,6),palette.pink,windowX+offset,1.98,3.97));
    });
    addMesh(group,new THREE.BoxGeometry(2.1,.12,.62),material('homeSign',0x714734),-3.2,3.95,3.9);
    const placeholderParts = [...group.children];
    createIllustratedPlane(group, {
      path: './assets/game/environment/farmhouse.webp',
      label: 'Farmhouse',
      width: 12.4,
      height: 9.92,
      y: 4.85,
      fallback: placeholderParts,
      renderOrder: 8
    });
    scene.add(applyShadow(group));
    animated.push({type:'farmhouseDoor',object:doorPivot});
    return group;
  }

  function createMoonberryField() {
    const { x, z } = HOMESTEAD.field;
    const fieldFallback=[];
    fieldFallback.push(addMesh(scene,new THREE.PlaneGeometry(MAP.field.outerSoil.w,MAP.field.outerSoil.d),material('fieldSoil',0xa86f3d),x,.01,z,{rotation:[-Math.PI/2,0,0],cast:false}));
    fieldFallback.push(addMesh(scene,new THREE.PlaneGeometry(MAP.field.cultivatedSoil.w,MAP.field.cultivatedSoil.d),material('fieldRows',0x71462c),x,.022,z,{rotation:[-Math.PI/2,0,0],cast:false}));
    // Split-rail fence with a deliberate west-facing gate toward the house path.
    fieldFallback.push(createFence(x-7,z-5.5,x+7,z-5.5,7));
    fieldFallback.push(createFence(x+7,z-5.5,x+7,z+5.5,6));
    fieldFallback.push(createFence(x+7,z+5.5,x-7,z+5.5,7));
    fieldFallback.push(createFence(x-7,z-5.5,x-7,z-1.2,3));
    fieldFallback.push(createFence(x-7,z+1.3,x-7,z+5.5,3));
    const gate = new THREE.Group(); gate.position.set(MAP.field.gate.center.x,0,MAP.field.gate.center.z);
    const gatePlaceholder = addMesh(gate,new THREE.BoxGeometry(.16,1.28,2.25),palette.woodLight,0,.68,0,{rotation:[0,0,Math.PI/2]});
    createIllustratedPlane(gate, {
      path: './assets/game/environment/field-gate.webp',
      label: 'Moonberry gate',
      width: 6.2,
      height: 4.95,
      y: 2.42,
      fallback: [gatePlaceholder],
      renderOrder: 16
    });
    scene.add(applyShadow(gate));
    fieldFallback.push(gate);
    const sign = new THREE.Group(); sign.position.set(MAP.field.sign.x,0,MAP.field.sign.z); sign.rotation.y=.28;
    addMesh(sign,new THREE.CylinderGeometry(.1,.13,1.9,8),palette.wood,0,.95,0);
    addMesh(sign,new THREE.BoxGeometry(2.5,.7,.14),palette.woodLight,.34,1.62,0,{rotation:[0,0,-.04]});
    addMesh(sign,new THREE.SphereGeometry(.12,8,6),palette.purple,-.52,1.62,.11);
    scene.add(applyShadow(sign));
    fieldFallback.push(sign);
    const trough = new THREE.Group(); trough.position.set(MAP.field.trough.x,0,MAP.field.trough.z);
    addMesh(trough,new THREE.BoxGeometry(2.25,.52,.95),palette.wood,0,.55,0);
    addMesh(trough,new THREE.BoxGeometry(1.8,.1,.56),palette.water,0,.84,0,{cast:false});
    scene.add(applyShadow(trough));
    fieldFallback.push(trough);
    const scarecrow = new THREE.Group(); scarecrow.position.set(MAP.field.scarecrow.x,0,MAP.field.scarecrow.z);
    addMesh(scarecrow,new THREE.CylinderGeometry(.09,.13,2.5,8),palette.wood,0,1.25,0);
    addMesh(scarecrow,new THREE.BoxGeometry(2.0,.13,.13),palette.wood,0,2.05,0);
    addMesh(scarecrow,new THREE.SphereGeometry(.38,12,9),material('fieldScareHead',0xf0bb65),0,2.64,0);
    addMesh(scarecrow,new THREE.ConeGeometry(.62,.4,8),palette.roof,0,3.08,0);
    scene.add(applyShadow(scarecrow));
    fieldFallback.push(scarecrow);
    const shipping = new THREE.Group(); shipping.position.set(MAP.field.shippingBasket.x,0,MAP.field.shippingBasket.z);
    addMesh(shipping,new THREE.BoxGeometry(2.15,1.05,1.45),material('shippingWood',0x9a603b),0,.55,0);
    addMesh(shipping,new THREE.BoxGeometry(2.3,.18,1.6),palette.woodLight,0,1.06,0,{rotation:[0,0,-.08]});
    addMesh(shipping,new THREE.SphereGeometry(.16,9,7),palette.purple,-.52,1.22,.25);
    addMesh(shipping,new THREE.SphereGeometry(.16,9,7),palette.purple,-.16,1.25,.25);
    scene.add(applyShadow(shipping));
    fieldFallback.push(shipping);
    createIllustratedPlane(scene, {
      path: './assets/game/environment/v2/moonberry-field.webp',
      label: 'Complete Moonberry field',
      width: 18,
      height: 12.7,
      x,
      y: 5.15,
      z,
      fallback: fieldFallback,
      renderOrder: 10
    });
    entities.push({id:'shipping-bin',type:'shipping',name:'Moonberry shipping basket',position:new THREE.Vector3(MAP.field.shippingBasket.x,0,MAP.field.shippingBasket.z),object:shipping});
  }

  function createFarmhouseInterior() {
    const group = new THREE.Group();
    const { x, z, width, depth } = INTERIOR;
    const floor = addMesh(group,new THREE.PlaneGeometry(width,depth),material('interiorFloor',0xb98252),x,0,z,{rotation:[-Math.PI/2,0,0],cast:false});
    clickableGround.push(floor);
    const rug = addMesh(group,new THREE.PlaneGeometry(7.3,4.4),material('quiltRug',0xa94450),x,.018,z-.7,{rotation:[-Math.PI/2,0,0],cast:false});
    rug.receiveShadow=true;
    const wallMat = material('interiorWall',0xf6e7c9), beamMat=material('interiorBeam',0x704833), warm=material('hearthGlow',0xffaf54,{emissive:0xff6d24,emissiveIntensity:.75});
    addMesh(group,new THREE.BoxGeometry(width,.3,.3),beamMat,x,4.8,z-depth/2+.15);
    addMesh(group,new THREE.BoxGeometry(.3,4.8,depth),beamMat,x-width/2+.15,2.4,z);
    addMesh(group,new THREE.BoxGeometry(.3,4.8,depth),beamMat,x+width/2-.15,2.4,z);
    addMesh(group,new THREE.BoxGeometry(width,4.8,.22),wallMat,x,2.4,z-depth/2+.04);
    [x-7.2,x,x+7.2].forEach((windowX)=>{
      addMesh(group,new THREE.BoxGeometry(2.25,1.55,.08),material('interiorWindow',0x9fd4e6,{emissive:0x6fa7bb,emissiveIntensity:.22}),windowX,2.75,z-depth/2+.17);
      addMesh(group,new THREE.BoxGeometry(.1,1.72,.13),beamMat,windowX,2.75,z-depth/2+.23);
      addMesh(group,new THREE.BoxGeometry(2.42,.1,.13),beamMat,windowX,2.75,z-depth/2+.23);
    });
    // Hearth and kitchen are intentionally clustered on the left wall, leaving
    // a broad central aisle for Frog's turning radius.
    const hearth = new THREE.Group(); hearth.position.set(INTERIOR_FURNITURE.fireplace.x,0,INTERIOR_FURNITURE.fireplace.z);
    addMesh(hearth,new THREE.BoxGeometry(3.2,2.25,1.05),material('stoneHearth',0x76675c),0,1.12,0);
    addMesh(hearth,new THREE.BoxGeometry(1.75,1.1,.12),material('hearthDark',0x392d2c),0,1.05,.57);
    addMesh(hearth,new THREE.SphereGeometry(.38,10,7),warm,-.38,.72,.7);
    addMesh(hearth,new THREE.SphereGeometry(.28,10,7),material('fireGold',0xffd560,{emissive:0xffa21f,emissiveIntensity:1.2}),.26,.64,.7);
    scene.add(applyShadow(hearth));
    const kitchen = new THREE.Group(); kitchen.position.set(INTERIOR_FURNITURE.kitchen.x,0,INTERIOR_FURNITURE.kitchen.z);
    addMesh(kitchen,new THREE.BoxGeometry(3.5,1.35,1.4),palette.woodLight,0,.68,0);
    addMesh(kitchen,new THREE.BoxGeometry(3.75,.18,1.65),material('counterTop',0xc99c69),0,1.42,0);
    addMesh(kitchen,new THREE.CylinderGeometry(.38,.38,.22,14),material('kitchenBowl',0x5f8ca0),-.8,1.62,.1);
    addMesh(kitchen,new THREE.CylinderGeometry(.4,.4,.42,12),material('kitchenJar',0xf6ecdc),.85,1.63,0);
    scene.add(applyShadow(kitchen));
    const pantry = new THREE.Group(); pantry.position.set(INTERIOR_FURNITURE.pantry.x,0,INTERIOR_FURNITURE.pantry.z);
    addMesh(pantry,new THREE.BoxGeometry(3.0,2.3,1.1),palette.wood,0,1.15,0);
    [-.72,0,.72].forEach((offset)=>addMesh(pantry,new THREE.CylinderGeometry(.22,.22,.48,10),material('pantryJar',0xd9d3bc),offset,1.82,.61));
    scene.add(applyShadow(pantry));
    const dogBed = new THREE.Group(); dogBed.position.set(INTERIOR.bed.x,0,INTERIOR.bed.z);
    addMesh(dogBed,new THREE.BoxGeometry(4.55,.45,3.35),material('bedWood',0x774234),0,.25,0);
    addMesh(dogBed,new THREE.BoxGeometry(4.1,.56,2.85),material('bedCushion',0xd14846),0,.58,0);
    addMesh(dogBed,new THREE.BoxGeometry(4.35,.72,.42),material('bedTrim',0xe6bd56),0,.88,-1.36);
    [-1.38,1.38].forEach((offset)=>addMesh(dogBed,new THREE.SphereGeometry(.44,12,9),material('bedPillow',0xffe7b6),offset,.94,.58,{scale:[1.1,.65,1]}));
    addMesh(dogBed,new THREE.TorusGeometry(.68,.07,8,24),material('bedMedallion',0xffd25d,{emissive:0xb8721e,emissiveIntensity:.18}),0,1.02,-1.5,{rotation:[Math.PI/2,0,0]});
    const bedPlaceholderParts = [...dogBed.children];
    createIllustratedPlane(dogBed, {
      path: './assets/game/environment/fancy-bed.webp',
      label: 'Fancy bed',
      width: 6.05,
      height: 4.84,
      y: 2.25,
      fallback: bedPlaceholderParts,
      renderOrder: 18
    });
    scene.add(applyShadow(dogBed));
    const wash = new THREE.Group(); wash.position.set(INTERIOR_FURNITURE.washbasin.x,0,INTERIOR_FURNITURE.washbasin.z);
    addMesh(wash,new THREE.CylinderGeometry(1.1,1.25,.66,16),material('washTub',0x89b5bf),0,.34,0);
    addMesh(wash,new THREE.CylinderGeometry(.9,.9,.08,16),palette.water,0,.69,0,{cast:false});
    scene.add(applyShadow(wash));
    const wardrobe = new THREE.Group(); wardrobe.position.set(INTERIOR_FURNITURE.wardrobe.x,0,INTERIOR_FURNITURE.wardrobe.z);
    addMesh(wardrobe,new THREE.BoxGeometry(2.55,3.1,1.2),material('wardrobeWood',0x7b4d35),0,1.55,0);
    addMesh(wardrobe,new THREE.BoxGeometry(.09,2.8,1.28),material('wardrobeTrim',0xe5c173),0,1.57,.65);
    scene.add(applyShadow(wardrobe));
    const desk = new THREE.Group(); desk.position.set(INTERIOR_FURNITURE.desk.x,0,INTERIOR_FURNITURE.desk.z);
    addMesh(desk,new THREE.BoxGeometry(3.6,1.15,1.6),palette.woodLight,0,.7,0);
    addMesh(desk,new THREE.BoxGeometry(2.25,.08,1.35),material('journalPaper',0xfff3c5),0,1.33,0);
    addMesh(desk,new THREE.CylinderGeometry(.09,.09,.72,8),material('inkBottle',0x354b80),.95,1.68,.1);
    scene.add(applyShadow(desk));
    const shelf = new THREE.Group(); shelf.position.set(INTERIOR_FURNITURE.shelf.x,0,INTERIOR_FURNITURE.shelf.z);
    addMesh(shelf,new THREE.BoxGeometry(2.2,2.65,.65),palette.wood,0,1.32,0);
    [-.55,0,.55].forEach((offset)=>addMesh(shelf,new THREE.DodecahedronGeometry(.2,0),material(`shelfKeepsake-${offset}`,0xffd36a,{emissive:0xff9b3f,emissiveIntensity:.22}),offset,1.9,.4));
    scene.add(applyShadow(shelf));
    // A visible door frame at the open camera-facing side, plus a mat that
    // precisely marks the return-to-valley trigger.
    const entry = new THREE.Group(); entry.position.set(INTERIOR.entryDoor.x,0,INTERIOR.entryDoor.z);
    [-1.05,1.05].forEach((doorX)=>addMesh(entry,new THREE.BoxGeometry(.22,3,.22),beamMat,doorX,1.5,0));
    addMesh(entry,new THREE.BoxGeometry(2.4,.22,.22),beamMat,0,3,0);
    addMesh(entry,new THREE.BoxGeometry(2.2,.08,1.1),material('entryMat',0x5d7f56),0,.045,.5);
    interiorDoor=entry; scene.add(applyShadow(entry));
    const roomFallback=[
      rug,
      ...group.children.filter((child)=>child!==floor&&child!==rug),
      hearth,kitchen,pantry,dogBed,wash,wardrobe,desk,shelf,entry
    ];
    createIllustratedPlane(scene, {
      path: './assets/game/environment/v2/farmhouse-interior.webp',
      label: 'Complete farmhouse interior',
      width: 29,
      height: 18.4,
      x,
      y: 8.7,
      z,
      yaw: Math.atan2(MAP.camera.interiorOffset.x, MAP.camera.interiorOffset.z),
      fallback: roomFallback,
      renderOrder: 7
    });
    interiorObstacles.push(...Object.values(INTERIOR_FURNITURE).map(({ footprint }) => footprint));
    scene.add(group);
    return group;
  }

  function createSilo(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    addMesh(group, new THREE.CylinderGeometry(2.1, 2.1, 6.2, 20), material('silo', 0xb9b9a4), 0, 3.1, 0);
    addMesh(group, new THREE.ConeGeometry(2.35, 2.2, 20), material('siloRoof', 0xd8ddd1), 0, 7.25, 0);
    scene.add(applyShadow(group));
  }

  function createPond() {
    addMesh(scene, new THREE.CylinderGeometry(10.65, 10.65, .17, 64), palette.grassDark, pond.x, .04, pond.z, { scale: [1, 1, .71], cast: false });
    const water = addMesh(scene, new THREE.CylinderGeometry(10.15, 10.15, .2, 64), palette.water, pond.x, .13, pond.z, { scale: [1, 1, .68], cast: false });
    water.userData.baseY = water.position.y;
    animated.push({ type: 'water', object: water });
    const lilyMat = material('lily', 0x4a9d4b);
    [[-6,-1,.62],[-3.2,2.2,.5],[2.8,-2.7,.58],[6,1.4,.52],[.2,3.2,.6],[-5,3.1,.48],[5,-3.3,.46]].forEach(([dx,dz,size], index) => {
      addMesh(scene, new THREE.CylinderGeometry(size, size, .08, 18), lilyMat, pond.x + dx, .31, pond.z + dz, { cast: false });
      if (index % 2 === 0) addMesh(scene, new THREE.SphereGeometry(.16, 10, 8), palette.pink, pond.x + dx, .48, pond.z + dz);
    });
    const bridge = new THREE.Group();
    bridge.position.set(pond.x, .48, pond.z);
    for (let i = -13; i <= 13; i += 1) addMesh(bridge, new THREE.BoxGeometry(.74, .22, 2.7), i % 2 ? palette.woodLight : palette.wood, i * .72, 0, 0);
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
    return group;
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
    return group;
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

  function createTrailSign(x,z,labelDirection=0) {
    const group=new THREE.Group(); group.position.set(x,0,z); group.rotation.y=labelDirection;
    addMesh(group,new THREE.CylinderGeometry(.12,.16,2.1,8),palette.wood,0,1.05,0);
    addMesh(group,new THREE.BoxGeometry(1.7,.48,.18),palette.woodLight,.38,1.75,0,{rotation:[0,0,-.05]});
    addMesh(group,new THREE.ConeGeometry(.32,.65,4),palette.woodLight,1.35,1.75,0,{rotation:[0,0,-Math.PI/2]});
    scene.add(applyShadow(group));
  }

  function createHayBale(x,z,rotation=0) {
    const hay=material('hay',0xe2ad3d);
    const bale=addMesh(scene,new THREE.CylinderGeometry(.68,.68,1.35,18),hay,x,.7,z,{rotation:[0,0,Math.PI/2],scale:[1,1,.9]});
    bale.rotation.y=rotation;
  }

  function createRock(x,z,scale=1) {
    const rock=addMesh(scene,new THREE.DodecahedronGeometry(.62,0),material('trailRock',0x8d927f),x,.36,z,{scale:[scale,scale*.72,scale*.9]});
    rock.rotation.y=(x+z)*.17;
  }

  function createFlowerPatch(x,z,color=0xf18b9c,count=7,spread=1.4) {
    const flowerMat=material(`flower-${color}`,color);
    for(let i=0;i<count;i+=1){
      const angle=i*2.399, radius=.28+(i%4)/4*spread;
      const px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
      addMesh(scene,new THREE.CylinderGeometry(.025,.035,.34,6),palette.green,px,.17,pz);
      addMesh(scene,new THREE.SphereGeometry(.09,8,6),flowerMat,px,.39,pz,{scale:[1,.45,1]});
    }
  }

  function createBerryShrub(x,z,scale=1) {
    const shrub=new THREE.Group(); shrub.position.set(x,0,z); shrub.scale.setScalar(scale);
    [-.48,0,.48].forEach((dx,index)=>addMesh(shrub,new THREE.SphereGeometry(.58,10,7),index%2?palette.greenLight:palette.green,dx,.58,(index-1)*.16,{scale:[1.15,.78,1]}));
    [[-.5,.72,.2],[0,.9,-.1],[.5,.66,.15],[-.1,.5,.48]].forEach(([bx,by,bz])=>addMesh(shrub,new THREE.SphereGeometry(.085,8,6),palette.purple,bx,by,bz));
    scene.add(applyShadow(shrub));
    return shrub;
  }

  function createApprovedWorldKit() {
    // Farmhouse garden, orchard buffer, porch warmth, and authored homestead detail.
    const orchardFallback=[];
    [[-38,24,1],[-36,27,.9],[-34,30,1.05]].forEach(([x,z,s])=>{
      orchardFallback.push(createTree(x,z,s,material(`orchard-${x}`,0x73b84f)));
      orchardFallback.push(addMesh(scene,new THREE.SphereGeometry(.11,8,6),palette.red,x-.45,3.2*s,z+.28));
      orchardFallback.push(addMesh(scene,new THREE.SphereGeometry(.11,8,6),palette.red,x+.42,3.05*s,z-.2));
    });
    [-34.8,-33.8].forEach((x)=>orchardFallback.push(createBerryShrub(x,22.4,.8)));
    createIllustratedPlane(scene, {
      path: './assets/game/environment/v2/orchard-path.webp',
      label: 'Farmhouse orchard path',
      width: 18.5,
      height: 11.2,
      x: -39.8,
      y: 5,
      z: 27.4,
      fallback: orchardFallback,
      renderOrder: 9
    });

    // Barnyard activity kit: coop, cart, barrels, feed sacks, and sunflowers.
    const coop=new THREE.Group(); coop.position.set(-49,0,-24);
    addMesh(coop,new THREE.BoxGeometry(3.2,2.15,2.5),palette.red,0,1.35,0);
    addMesh(coop,new THREE.ConeGeometry(2.35,1.5,4),palette.roof,0,3,0,{rotation:[0,Math.PI/4,0],scale:[1,1,.78]});
    addMesh(coop,new THREE.BoxGeometry(1.15,1.3,.16),palette.wood,0,.92,1.3);
    scene.add(applyShadow(coop));
    const cart=new THREE.Group(); cart.position.set(-34,0,-26.5);
    addMesh(cart,new THREE.BoxGeometry(3.2,.7,1.8),palette.woodLight,0,1,0);
    [-1,1].forEach((side)=>addMesh(cart,new THREE.TorusGeometry(.62,.12,8,18),palette.wood,side*1.15,.58,.92,{rotation:[0,Math.PI/2,0]}));
    scene.add(applyShadow(cart));
    [-50.5,-48.8,-47.1].forEach((x)=>createFlowerPatch(x,-18.2,0xf6c43f,5,.55));

    // Happy Pond gains a willow, cattail banks, a fishing dock, and dragonfly glints.
    const willow=new THREE.Group(); willow.position.set(44,0,13);
    addMesh(willow,new THREE.CylinderGeometry(.55,.78,5.2,10),palette.wood,0,2.6,0,{rotation:[0,0,.08]});
    addMesh(willow,new THREE.SphereGeometry(2.6,14,10),material('willowCanopy',0x63a95a),0,5.1,0,{scale:[1.25,.72,1]});
    for(let i=0;i<10;i+=1){const a=i/10*Math.PI*2;addMesh(willow,new THREE.CylinderGeometry(.035,.055,3.2,6),palette.grassDark,Math.cos(a)*1.8,3.45,Math.sin(a)*1.25,{rotation:[Math.sin(a)*.18,0,Math.cos(a)*.18]});}
    scene.add(applyShadow(willow));
    for(let i=0;i<18;i+=1){const a=i/18*Math.PI*2;const rx=pond.x+Math.cos(a)*10.8,rz=pond.z+Math.sin(a)*7.8;addMesh(scene,new THREE.CylinderGeometry(.035,.05,1.05,6),palette.green,rx,.53,rz);addMesh(scene,new THREE.CylinderGeometry(.1,.1,.34,8),material('cattail',0x714734),rx,.98,rz);}
    const dock=new THREE.Group();dock.position.set(pond.x-8.2,.38,pond.z-4.8);for(let i=0;i<6;i+=1)addMesh(dock,new THREE.BoxGeometry(1.25,.16,.72),i%2?palette.wood:palette.woodLight,i*.52,0,i*.34);scene.add(applyShadow(dock));

    // Story Stone clearing gets a creek edge, mushroom ring, fireflies, and Moonberry shrubs.
    addMesh(scene,new THREE.PlaneGeometry(15,2.1,12,1),material('storyCreek',0x65c5d0,{roughness:.28,emissive:0x1b8190,emissiveIntensity:.13}),0,.018,33.8,{rotation:[-Math.PI/2,0,.08],cast:false});
    [-7.2,7.1].forEach((x)=>createBerryShrub(x,28.8,.9));
    for(let i=0;i<14;i+=1){const a=i/14*Math.PI*2;const r=3.2+(i%3)*.32;const mx=Math.cos(a)*r,mz=27+Math.sin(a)*r;addMesh(scene,new THREE.CylinderGeometry(.035,.05,.24,6),palette.cream,mx,.12,mz);addMesh(scene,new THREE.SphereGeometry(.12,8,5),i%2?palette.red:palette.purple,mx,.3,mz,{scale:[1,.55,1]});}
    for(let i=0;i<9;i+=1){const glow=addMesh(scene,new THREE.SphereGeometry(.055,7,5),material(`firefly-${i}`,0xffe079,{emissive:0xffbf36,emissiveIntensity:1.4}),-4+i,1.1+(i%3)*.45,24+(i%4)*1.4,{cast:false});animated.push({type:'firefly',object:glow,baseY:glow.position.y,offset:i});}
  }

  function createDog() {
    const group = new THREE.Group();
    group.position.set(-30, 0, -15);

    const walkPaths = {
      north: './assets/game/frog/walk-north.webp',
      south: './assets/game/frog/walk-south.webp',
      east: './assets/game/frog/walk-east.webp',
      west: './assets/game/frog/walk-west.webp'
    };
    const idlePaths = {
      north: './assets/game/frog/idle/north.webp',
      south: './assets/game/frog/idle/south.webp',
      east: './assets/game/frog/idle/east.webp',
      west: './assets/game/frog/idle/west.webp'
    };
    const runPaths = {
      north: './assets/game/frog/run/north.webp',
      south: './assets/game/frog/run/south.webp',
      east: './assets/game/frog/run/east.webp',
      west: './assets/game/frog/run/west.webp'
    };
    const actionPaths = {
      sniffInteract: './assets/game/frog/actions/sniff-interact.webp',
      bedtime: './assets/game/frog/actions/bedtime.webp',
      combat: './assets/game/frog/actions/combat.webp',
      farming: './assets/game/frog/actions/farming.webp'
    };
    const textures = { walk:{}, idle:{}, run:{}, actions:{} };
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      alphaTest: .08,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(3.65, 3.65), material);
    sprite.position.y = 1.72;
    sprite.renderOrder = 25;
    group.add(sprite);

    const fallback = createDogModel();
    fallback.visible = false;
    group.add(fallback);

    let failed = false;
    const useFallback = (path) => {
      if (failed) return;
      failed = true;
      sprite.visible = false;
      fallback.visible = true;
      group.userData.renderAsset = false;
      console.error(`Frog illustration failed to load: ${path}`);
      toast('Frog\'s illustrated sprite did not load. Placeholder geometry is showing for diagnostics.');
    };
    const loader = new THREE.TextureLoader();
    Object.entries(walkPaths).forEach(([direction, path]) => {
      const texture = loader.load(path, () => {
        configureIllustratedTexture(texture);
        texture.repeat.set(1 / 6, 1);
        texture.offset.set(0, 0);
      }, undefined, () => useFallback(path));
      textures.walk[direction] = texture;
    });
    Object.entries(idlePaths).forEach(([direction, path]) => {
      const texture = loader.load(path, () => {
        configureIllustratedTexture(texture);
        if (direction === 'south' && !material.map) {
          material.map = texture;
          material.opacity = 1;
          material.needsUpdate = true;
        }
      }, undefined, () => useFallback(path));
      textures.idle[direction] = texture;
    });
    Object.entries(runPaths).forEach(([direction, path]) => {
      const texture = loader.load(path, () => configureIllustratedTexture(texture), undefined, () => useFallback(path));
      textures.run[direction] = texture;
    });
    Object.entries(actionPaths).forEach(([action, path]) => {
      const texture = loader.load(path, () => configureIllustratedTexture(texture), undefined, () => useFallback(path));
      textures.actions[action] = texture;
    });

    group.userData = {
      kind: 'dog',
      renderAsset: true,
      sprite,
      spriteMaterial: material,
      spriteTextures: textures,
      spriteDirection: 'south',
      spriteFrame: -1,
      spriteFrameCount: 6,
      spriteFrameRate: 9,
      nextFootstepAt: 0,
      fallback,
      legs: [],
      arms: [],
      body: null,
      head: null,
      tail: null,
      action: 'idle',
      actionUntil: 0
    };
    scene.add(group);
    return group;
  }

  function createFrogNpc(x, z, scale = 1) {
    return createRenderedCharacter('pip', x, z, 2.5 * scale, { aspect: .9, shadowSize: .64 });
  }

  function createFarmer(x, z) {
    return createRenderedCharacter('dad', x, z, 3.8, { aspect: .78, shadowSize: .72 });
  }

  function createBunny(x, z) {
    return createRenderedCharacter('blaze', x, z, 3.1, { aspect: .8, shadowSize: .65 });
  }

  function createHen(x, z) {
    return createRenderedCharacter('hazel', x, z, 2.8, { aspect: .82, shadowSize: .62 });
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
    let plotMaterial;
    const plotTexture = illustratedTextureLoader.load('./assets/game/environment/moonberry-plots.webp', () => {
      configureIllustratedTexture(plotTexture);
      if (plotMaterial) {
        plotMaterial.map = plotTexture;
        plotMaterial.opacity = 1;
        plotMaterial.needsUpdate = true;
      }
    }, undefined, () => {
      gardenVisuals.forEach(({ sprite, fallback }) => {
        if (sprite) sprite.visible = false;
        if (fallback) fallback.visible = true;
      });
      showIllustratedAssetWarning('Moonberry plot', './assets/game/environment/moonberry-plots.webp');
    });
    plotMaterial = new THREE.MeshBasicMaterial({
      map: plotTexture,
      transparent: true,
      opacity: 0,
      alphaTest: .08,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const plotYaw = Math.atan2(MAP.camera.exteriorOffset.x, MAP.camera.exteriorOffset.z);
    MAP.field.plots.forEach(({x,z}, index) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const fallback = new THREE.Group();
      fallback.visible = false;
      group.add(fallback);
      addMesh(fallback, new THREE.BoxGeometry(1.45,.18,1.45), palette.woodLight, 0,.1,0);
      addMesh(fallback, new THREE.BoxGeometry(1.18,.14,1.18), palette.soil, 0,.21,0);
      const plant = new THREE.Group();
      plant.position.y = .24;
      fallback.add(plant);
      const geometry = new THREE.PlaneGeometry(1.9, 1.42);
      const sprite = new THREE.Mesh(geometry, plotMaterial);
      sprite.position.y = .72;
      sprite.rotation.y = plotYaw;
      sprite.renderOrder = 14;
      sprite.userData.illustratedAsset = true;
      group.add(sprite);
      scene.add(applyShadow(group));
      gardenVisuals.push({ group, plant, sprite, fallback, geometry, index, x, z });
      entities.push({ id: `garden-${index}`, type: 'garden', name: 'Moonberry plot', position: new THREE.Vector3(x,0,z), index });
    });
    refreshGardenVisuals();
  }

  function refreshGardenVisuals() {
    gardenVisuals.forEach(({ plant, geometry, index }) => {
      while (plant.children.length) plant.remove(plant.children[0]);
      const phase = state.garden[index];
      const illustratedFrame = gardenFrameFor(phase);
      if (geometry) {
        setAtlasFrame(geometry, illustratedFrame, 6);
        return;
      }
      if (phase === 'dry' || phase === 'harvested') return;
      if (phase === 'planted') {
        addMesh(plant, new THREE.SphereGeometry(.09,8,6), palette.yellow, 0,.1,0);
        return;
      }
      addMesh(plant, new THREE.CylinderGeometry(.045,.055,.62,8), palette.green, 0,.32,0);
      addMesh(plant, new THREE.SphereGeometry(.19,9,7), palette.greenLight, -.16,.5,0, { scale:[1.2,.45,.7] });
      addMesh(plant, new THREE.SphereGeometry(.19,9,7), palette.greenLight, .16,.67,0, { scale:[1.2,.45,.7] });
      if (phase === 'mature') {
        const quality=state.gardenQuality[index]||1;
        [-.18,0,.18].forEach((x,i) => addMesh(plant, new THREE.SphereGeometry(.11+quality*.018,10,8), quality===3?material('rareMoonberry',0xc67cff,{emissive:0x7438b3,emissiveIntensity:.42}):palette.purple, x,.78 + (i%2)*.1,.03));
      }
    });
  }

  function createItems() {
    const specs = [
      ...MAP.chapterAnchors.petals.map(item=>({id:item.id,type:'petal',...item.center})),
      ...MAP.chapterAnchors.shards.map(item=>({id:item.id,type:'shard',...item.center}))
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
    return createRenderedCharacter('tortoise', x, z, 2.65, { aspect: 1.02, shadowSize: .72 });
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
    const group=createRenderedCharacter('gloamling',x,z,2.55,{aspect:.94,shadowSize:.72,shadowOpacity:.32});
    const body=group.userData.body;
    const enemy={id,type:'enemy',name:'Gloamling',object:group,position:group.position,home:new THREE.Vector3(x,0,z),health:2,maxHealth:2,alive:true,stunnedUntil:0,body,shardId:id.replace('gloam','shard')};
    enemies.push(enemy);
    entities.push(enemy);
    return enemy;
  }

  function createBoss(x,z) {
    const group=createRenderedCharacter('scarecrow',x,z,5.8,{aspect:.72,shadowSize:1.15,shadowOpacity:.38});
    group.visible=false;
    return {id:'boss',type:'boss',name:'The Hollow Scarecrow',object:group,position:group.position,home:new THREE.Vector3(x,0,z)};
  }

  function createBrambles() {
    const brambleMat=material('bramble',0x3f3139,{emissive:0x32112f,emissiveIntensity:.26});
    [[-3,25.5],[3,25.5],[34,-23],[41,-22.5]].forEach(([x,z],index)=>{
      const group=new THREE.Group(); group.position.set(x,0,z);
      for(let i=0;i<5;i+=1){const a=i*.95;addMesh(group,new THREE.TorusGeometry(.48+i*.1,.08,6,18,Math.PI*1.4),brambleMat,0,.35+i*.17,0,{rotation:[Math.PI/2,a,a*.3]});}
      group.userData.gate=index>1?'mill':'stone'; scene.add(applyShadow(group)); animated.push({type:'bramble',object:group,offset:index});
    });
  }

  function createMeadowDetails() {
    const flowerGeo=new THREE.SphereGeometry(.075,7,5);
    const stemGeo=new THREE.CylinderGeometry(.018,.024,.34,5);
    const flowerMats=[palette.yellow,palette.pink,palette.cream,palette.purple];
    for(let i=0;i<280;i+=1){
      const x=-55+((i*23.71)%110), z=-43+((i*31.37)%86);
      if(isInPond(x,z)) continue;
      const group=new THREE.Group(); group.position.set(x,0,z); group.scale.setScalar(.72+(i%5)*.08);
      addMesh(group,stemGeo,palette.green,0,.17,0,{cast:false});
      addMesh(group,flowerGeo,flowerMats[i%flowerMats.length],0,.38,0,{cast:false});
      scene.add(group);
    }
  }

  function createLivingWorldDetails() {
    const logMat=material('fallenLog',0x73503a);
    [[-20,-27,1.2],[2,35,-.4],[22,2,.7],[49,-7,-.8]].forEach(([x,z,r])=>{
      const log=addMesh(scene,new THREE.CylinderGeometry(.3,.4,2.8,10),logMat,x,.38,z,{rotation:[Math.PI/2,0,r]});
      addMesh(scene,new THREE.CylinderGeometry(.22,.22,.04,12),material('logCut',0xc18a52),x+Math.cos(r)*1.4,.38,z+Math.sin(r)*1.4,{rotation:[Math.PI/2,0,r]});
      log.castShadow=true;
    });
    for(let row=0;row<4;row+=1){
      for(let col=0;col<7;col+=1){
        const crop=new THREE.Group();crop.position.set(-49+col*1.35,-.01,-20+row*1.35);
        addMesh(crop,new THREE.CylinderGeometry(.045,.065,.7,6),palette.green,0,.35,0);
        [-.22,.22].forEach((offset,i)=>addMesh(crop,new THREE.SphereGeometry(.2,9,7),i?palette.greenLight:palette.grassDark,offset,.56,0,{scale:[1.25,.42,.65]}));
        scene.add(crop);
      }
    }
    [[-45,19],[-42,18],[-39,18],[-48,23]].forEach(([x,z],i)=>{
      const lantern=new THREE.Group();lantern.position.set(x,0,z);
      addMesh(lantern,new THREE.CylinderGeometry(.07,.09,1.5,8),palette.wood,0,.75,0);
      addMesh(lantern,new THREE.SphereGeometry(.18,10,8),material('lanternGlow',0xffc84e,{emissive:0xff8b24,emissiveIntensity:1.2}),0,1.43,0);
      scene.add(lantern);animated.push({type:'lantern',object:lantern,offset:i});
    });
    [[-9,9],[1,13],[12,19],[17,-2],[-22,4]].forEach(([x,z],i)=>{
      const arch=new THREE.Group();arch.position.set(x,0,z);arch.rotation.y=i*.6;
      addMesh(arch,new THREE.CylinderGeometry(.11,.14,2.2,8),palette.wood,-1,.95,0,{rotation:[0,0,-.13]});
      addMesh(arch,new THREE.CylinderGeometry(.11,.14,2.2,8),palette.wood,1,.95,0,{rotation:[0,0,.13]});
      addMesh(arch,new THREE.TorusGeometry(1.03,.12,7,18,Math.PI),palette.green,0,1.84,0,{rotation:[0,0,0]});
      scene.add(arch);
    });
  }

  function createDiscoveries() {
    const colors=[0xd9ae54,0x9c7045,0x55b9d0,0xf18962,0xb8b7a8,0xd85362,0xe8c36b,0xffefd0];
    MAP.chapterAnchors.keepsakes.forEach(({id,label:name,center:{x,z}},index)=>{
      const color=colors[index];
      const group=new THREE.Group();group.position.set(x,.32,z);group.visible=!state.taken.has(id);
      const glowMat=material(`find-${index}`,color,{emissive:color,emissiveIntensity:.38,roughness:.35});
      if(id.includes('feather')||id.includes('ribbon')||id.includes('page')) addMesh(group,new THREE.BoxGeometry(.28,.04,.55),glowMat,0,.1,0,{rotation:[.25,index*.8,.15]});
      else addMesh(group,new THREE.DodecahedronGeometry(.22,0),glowMat,0,.1,0);
      addMesh(group,new THREE.TorusGeometry(.35,.025,6,20),palette.yellow,0,.02,0,{rotation:[Math.PI/2,0,0],cast:false});
      scene.add(applyShadow(group));
      entities.push({id,type:'discovery',name,position:new THREE.Vector3(x,0,z),object:group});
      animated.push({type:'discovery',object:group,baseY:.32,offset:index});
    });
  }

  createGround();
  createBarn(MAP.landmarks.barn.center.x, MAP.landmarks.barn.center.z);
  createSilo(MAP.landmarks.silo.center.x, MAP.landmarks.silo.center.z);
  const farmhouse = createFarmhouse(HOMESTEAD.house.x, HOMESTEAD.house.z);
  const farmhouseInterior = createFarmhouseInterior();
  createMoonberryField();
  const windmill = createWindmill(MAP.landmarks.mill.center.x, MAP.landmarks.mill.center.z);
  createHouse(MAP.landmarks.hamletHouses[0].center.x,MAP.landmarks.hamletHouses[0].center.z,palette.cream,.82);
  createHouse(MAP.landmarks.hamletHouses[1].center.x,MAP.landmarks.hamletHouses[1].center.z,material('villageBlue',0xd6eced),.74);
  createHouse(MAP.landmarks.hamletHouses[2].center.x,MAP.landmarks.hamletHouses[2].center.z,material('villageGold',0xf4d9a1),.74);
  createPond();
  createFence(-55,-32,-24,-32,15);
  createFence(-52,15,-40,15,6);
  createFence(21,39,55,39,16);
  createFence(17,-38,49,-38,16);
  [[-24,-11,.45],[-11,-2,.2],[14,10,-.3],[22,-13,.8],[29,27,-.55]].forEach(([x,z,r])=>createTrailSign(x,z,r));
  [[-47,-28,.1],[-45,-29,-.2],[-31,-23,.5],[-33,-26,-.4]].forEach(([x,z,r])=>createHayBale(x,z,r));
  [[-18,31,.8],[-11,35,1.15],[14,32,.9],[20,27,.7],[48,12,1.1],[52,-8,.85],[28,-34,1.2],[5,-36,.75],[-52,29,1]].forEach(([x,z,s])=>createRock(x,z,s));
  [
    [-55,-42,1.25],[-48,-39,1.05],[-31,-42,1.2],[-17,-40,1],[-3,-43,1.15],[13,-41,.95],[28,-43,1.18],[52,-41,1.2],
    [-55,43,1.2],[-45,40,.95],[-27,42,1.08],[-12,39,1.15],[5,42,1],[19,40,.95],[54,42,1.18],
    [-52,-5,1.05],[-50,7,.95],[-26,9,.85],[-20,18,.9],[-16,29,.98],[-2,33,1.1],[10,29,.9],[17,20,.88],
    [48,9,1.08],[54,16,.9],[48,-2,.95],[51,-15,1.15],[47,-27,.9],[27,-16,.85],[18,-29,.92],[4,-32,1.05],
    [-12,-16,.82],[-4,-5,.82],[7,16,.78],[13,2,.82],[29,31,.78],[38,23,.78]
  ].forEach(([x,z,s],i) => createTree(x,z,s,i%3===0?palette.grassDark:palette.green));
  createCloud(-40,18,-32,1.25);
  createCloud(2,20,-28,.9);
  createCloud(42,17,-12,1.1);
  createMeadowDetails();
  createLivingWorldDetails();
  createApprovedWorldKit();
  createBrambles();
  createGarden();
  const storyStone = createStoryStone(MAP.landmarks.storyStone.center.x, MAP.landmarks.storyStone.center.z);
  const pip = createFrogNpc(MAP.npcSchedules.pip.anchors[0].x, MAP.npcSchedules.pip.anchors[0].z, 1.05);
  const dad = createFarmer(MAP.npcSchedules.dad.anchors[0].x, MAP.npcSchedules.dad.anchors[0].z);
  const bunny = createBunny(MAP.npcSchedules.blaze.anchors[0].x, MAP.npcSchedules.blaze.anchors[0].z);
  const hen = createHen(MAP.npcSchedules.hazel.anchors[0].x, MAP.npcSchedules.hazel.anchors[0].z);
  const tortoise = createTortoise(MAP.npcSchedules.tortoise.anchors[0].x, MAP.npcSchedules.tortoise.anchors[0].z);
  entities.push(
    { id:'pip', type:'npc', name:'Pip', position:pip.position, object:pip },
    { id:'dad', type:'npc', name:'Dad', position:dad.position, object:dad },
    { id:'bunny', type:'npc', name:'Blaze', position:bunny.position, object:bunny },
    { id:'hen', type:'npc', name:'Hazel Hen', position:hen.position, object:hen },
    { id:'tortoise', type:'npc', name:'Tortoise', position:tortoise.position, object:tortoise },
    { id:'stone', type:'stone', name:'Old Story Stone', position:storyStone.position, object:storyStone },
    { id:'home', type:'home', name:'Farmhouse door', position:new THREE.Vector3(HOMESTEAD.porch.x,0,HOMESTEAD.porch.z), object:farmhouse },
    { id:'interior-door', type:'interior-door', name:'Sunny Valley door', position:new THREE.Vector3(INTERIOR.door.x,0,INTERIOR.door.z), interior:true, object:interiorDoor },
    { id:'bed', type:'bed', name:'Frog\'s fancy bed', position:new THREE.Vector3(INTERIOR_FURNITURE.bed.interaction.x,0,INTERIOR_FURNITURE.bed.interaction.z), interior:true },
    { id:'kitchen', type:'kitchen', name:'Moonberry kitchen', position:new THREE.Vector3(INTERIOR_FURNITURE.kitchen.interaction.x,0,INTERIOR_FURNITURE.kitchen.interaction.z), interior:true },
    { id:'pantry', type:'pantry', name:'Pantry chest', position:new THREE.Vector3(INTERIOR_FURNITURE.pantry.interaction.x,0,INTERIOR_FURNITURE.pantry.interaction.z), interior:true },
    { id:'wash', type:'wash', name:'Wash basin', position:new THREE.Vector3(INTERIOR_FURNITURE.washbasin.interaction.x,0,INTERIOR_FURNITURE.washbasin.interaction.z), interior:true },
    { id:'wardrobe', type:'wardrobe', name:'Collar wardrobe', position:new THREE.Vector3(INTERIOR_FURNITURE.wardrobe.interaction.x,0,INTERIOR_FURNITURE.wardrobe.interaction.z), interior:true },
    { id:'journal-desk', type:'journal-desk', name:'Journal and calendar', position:new THREE.Vector3(INTERIOR_FURNITURE.desk.interaction.x,0,INTERIOR_FURNITURE.desk.interaction.z), interior:true },
    { id:'shelf', type:'shelf', name:'Keepsake shelf', position:new THREE.Vector3(INTERIOR_FURNITURE.shelf.interaction.x,0,INTERIOR_FURNITURE.shelf.interaction.z), interior:true },
    { id:'mill', type:'mill', name:'Abandoned Mill', position:new THREE.Vector3(MAP.landmarks.mill.doorApproach.x,0,MAP.landmarks.mill.doorApproach.z), object:windmill }
  );
  createItems();
  createDiscoveries();
  MAP.chapterAnchors.shards.forEach(({id,center})=>createGloamling(id.replace('shard','gloam'),center.x,center.z));
  const boss = createBoss(MAP.chapterAnchors.boss.x,MAP.chapterAnchors.boss.z);
  entities.push(boss);
  const frog = createDog();
  if(state.loadedPosition) frog.position.set(state.loadedPosition.x,0,state.loadedPosition.z);

  const marker = new THREE.Group();
  const markerRing = addMesh(marker,new THREE.TorusGeometry(.48,.075,8,28),palette.yellow,0,.08,0,{rotation:[Math.PI/2,0,0],cast:false,receive:false});
  addMesh(marker,new THREE.ConeGeometry(.14,.48,10),palette.yellow,0,.52,0,{cast:false,receive:false});
  marker.visible = false;
  scene.add(marker);

  let debugOverlay;
  let debugExterior;
  let debugInterior;

  function debugMaterial(color, opacity = .95) {
    return new THREE.LineBasicMaterial({ color, transparent:true, opacity, depthTest:false, depthWrite:false });
  }

  function addDebugLine(parent, points, color, height = .34, closed = false) {
    const vertices = points.map(({x,z}) => new THREE.Vector3(x,height,z));
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const line = closed ? new THREE.LineLoop(geometry, debugMaterial(color)) : new THREE.Line(geometry, debugMaterial(color));
    line.renderOrder = 999;
    parent.add(line);
    return line;
  }

  function addDebugRect(parent, box, color, height = .34) {
    const halfW=box.w/2,halfD=box.d/2;
    return addDebugLine(parent,[
      {x:box.x-halfW,z:box.z-halfD},{x:box.x+halfW,z:box.z-halfD},
      {x:box.x+halfW,z:box.z+halfD},{x:box.x-halfW,z:box.z+halfD}
    ],color,height,true);
  }

  function addDebugEllipse(parent, center, rx, rz, color, height = .36) {
    const points=Array.from({length:64},(_,index)=>{
      const angle=index/64*Math.PI*2;
      return {x:center.x+Math.cos(angle)*rx,z:center.z+Math.sin(angle)*rz};
    });
    return addDebugLine(parent,points,color,height,true);
  }

  function createDebugOverlay() {
    debugOverlay=new THREE.Group();
    debugOverlay.name='Sunny Valley map diagnostics';
    debugExterior=new THREE.Group();
    debugInterior=new THREE.Group();
    debugOverlay.add(debugExterior,debugInterior);

    addDebugRect(debugExterior,{x:0,z:0,w:WORLD.maxX-WORLD.minX,d:WORLD.maxZ-WORLD.minZ},0xffffff,.29);
    Object.values(MAP.zones).forEach(zone=>addDebugRect(debugExterior,zone.bounds,0x53d7ff,.27));
    Object.values(MAP.trails).forEach(trail=>addDebugLine(debugExterior,trail.points,0xffdf65,.42));
    Object.values(MAP.npcSchedules).forEach(schedule=>{
      addDebugLine(debugExterior,schedule.anchors,0xffa44d,.64);
      schedule.anchors.forEach(anchor=>addDebugEllipse(debugExterior,anchor,.3,.3,0xffa44d,.66));
    });
    MAP.exteriorCollisions.forEach(box=>addDebugRect(debugExterior,box,0xff5c5c,.48));
    addDebugEllipse(debugExterior,MAP.landmarks.pond.center,MAP.landmarks.pond.rx,MAP.landmarks.pond.rz,0x38c8ff,.5);
    addDebugRect(debugExterior,MAP.landmarks.farmhouse.entranceCorridor,0xff77d4,.54);
    MAP.field.plots.forEach(plot=>addDebugRect(debugExterior,{...plot,...MAP.field.plotSize},0xbf87ff,.58));
    Object.values(MAP.interactionAprons).forEach(apron=>addDebugEllipse(debugExterior,apron.center,apron.size/2,apron.size/2,0x64ff8a,.62));

    const origin=MAP.interior.instanceOrigin;
    const interiorBox=(box)=>({x:origin.x+box.x,z:origin.z+box.z,w:box.w,d:box.d});
    addDebugRect(debugInterior,interiorBox(MAP.interior.shell.bounds),0xffffff,.34);
    addDebugRect(debugInterior,interiorBox(MAP.interior.centralAisle),0xff77d4,.38);
    Object.values(MAP.interior.furniture).forEach(item=>{
      addDebugRect(debugInterior,interiorBox(item.footprint),0xff5c5c,.5);
      addDebugEllipse(debugInterior,toInteriorWorld(item.interaction),1.2,1.2,0x64ff8a,.58);
    });
    addDebugEllipse(debugInterior,toInteriorWorld(MAP.interior.exitInteraction),1.2,1.2,0x64ff8a,.58);

    scene.add(debugOverlay);
    updateDebugOverlay();
  }

  function updateDebugOverlay() {
    if(!debugOverlay)return;
    debugOverlay.visible=state.debugMap;
    debugExterior.visible=state.debugMap&&!state.inInterior;
    debugInterior.visible=state.debugMap&&state.inInterior;
    if(dom.debugHud)dom.debugHud.hidden=!state.debugMap;
    if(!state.debugMap)return;
    const localX=state.inInterior?frog.position.x-INTERIOR.x:frog.position.x;
    const localZ=state.inInterior?frog.position.z-INTERIOR.z:frog.position.z;
    if(dom.debugMode)dom.debugMode.textContent=state.inInterior?'Interior instance':'Exterior world';
    if(dom.debugPosition)dom.debugPosition.textContent=`Frog ${localX.toFixed(2)}, ${localZ.toFixed(2)}`;
    if(dom.debugTarget)dom.debugTarget.textContent=`Target ${(state.target.x-(state.inInterior?INTERIOR.x:0)).toFixed(2)}, ${(state.target.z-(state.inInterior?INTERIOR.z:0)).toFixed(2)}`;
    if(dom.debugContract)dom.debugContract.textContent=`PASS · map ${MAP.version}`;
  }

  function toggleMapDiagnostics() {
    state.debugMap=!state.debugMap;
    localStorage.setItem('adnf-map-diagnostics',String(state.debugMap));
    updateDebugOverlay();
    toast(state.debugMap?'Map diagnostics on: cyan zones, gold trails, red collisions, green interactions.':'Map diagnostics off.');
  }

  createDebugOverlay();

  function isInPond(x, z) {
    return ((x - pond.x) ** 2) / (pond.rx ** 2) + ((z - pond.z) ** 2) / (pond.rz ** 2) < 1;
  }

  function isBlocked(x, z) {
    if (state.inInterior) {
      if (x < INTERIOR.x - INTERIOR.width / 2 + .65 || x > INTERIOR.x + INTERIOR.width / 2 - .65 || z < INTERIOR.z - INTERIOR.depth / 2 + .65 || z > INTERIOR.z + INTERIOR.depth / 2 - .65) return true;
      return interiorObstacles.some((o) => x > o.x - o.w / 2 - .38 && x < o.x + o.w / 2 + .38 && z > o.z - o.d / 2 - .38 && z < o.z + o.d / 2 + .38);
    }
    if (x < WORLD.minX + .7 || x > WORLD.maxX - .7 || z < WORLD.minZ + .7 || z > WORLD.maxZ - .7) return true;
    if (isInPond(x, z) && !(z >= MAP.landmarks.pond.bridgeBand.minZ && z <= MAP.landmarks.pond.bridgeBand.maxZ)) return true;
    return obstacles.some((o) => x > o.x - o.w / 2 - .55 && x < o.x + o.w / 2 + .55 && z > o.z - o.d / 2 - .55 && z < o.z + o.d / 2 + .55);
  }

  function zoneName() {
    if (state.inInterior) return 'Frog\'s Farmhouse';
    const { x, z } = frog.position;
    if (x > 27 && z > 25) return 'Hilltop Village';
    if (x > 19 && z > 8) return 'Happy Pond';
    if (z < -18) return x > 18 ? 'Old Mill Hollow' : 'Sunny Farm';
    if (z > 14 && x < -20) return 'Moonberry Homestead';
    if (x < -20) return 'West Orchard Trail';
    if (x > 20) return 'Eastwater Trail';
    return 'Wildflower Commons';
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
    dom.day.textContent = `Day ${state.day} · ${hour}:${minute} · ${weatherForDay()}`;
    if(dom.energy)dom.energy.textContent=`${state.stamina}/${state.maxStamina}`;
    if(dom.seeds)dom.seeds.textContent=state.seeds;
    if(dom.berries)dom.berries.textContent=state.berries;
    if(dom.coins)dom.coins.textContent=state.coins;
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
    state.path=[];
    marker.visible = false;
    dom.panelContent.innerHTML = `<h4>${title}</h4>${body}`;
    dom.panel.hidden = false;
  }

  function closePanel() {
    state.panelOpen = false;
    dom.panel.hidden = true;
  }

  function beginAdventure(useSaved = true) {
    initAudio();
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
    openPanel('Illustrated atlas of Sunny Valley', `<p>Frog is exploring <strong>${zoneName()}</strong>. These storybook views establish the look and purpose of the five most important Chapter One destinations.</p><div class="game-atlas-grid"><figure><img src="assets/valley-atlas/01-sunny-valley-farmhouse.webp" alt="Sunny Valley farmhouse"><figcaption><strong>Farmhouse</strong><span>Sleep, cook, plan, store, and prepare.</span></figcaption></figure><figure><img src="assets/valley-atlas/02-moonberry-field.webp" alt="Separate Moonberry field"><figcaption><strong>Moonberry Field</strong><span>Twelve plots, shipping, crop quality, and upgrades.</span></figcaption></figure><figure><img src="assets/valley-atlas/03-sunny-valley-barnyard.webp" alt="Sunny Valley barnyard"><figcaption><strong>Barnyard</strong><span>Dad, Hazel, farm requests, and future gatherings.</span></figcaption></figure><figure><img src="assets/valley-atlas/04-happy-pond.webp" alt="Happy Pond"><figcaption><strong>Happy Pond</strong><span>Pip, gathering, friendship, and pond restoration.</span></figcaption></figure><figure><img src="assets/valley-atlas/05-story-stone-clearing.webp" alt="Story Stone clearing"><figcaption><strong>Story Stone</strong><span>Exploration rewards and Chapter One's long goal.</span></figcaption></figure></div>`);
  }

  function showJournal() {
    const discoveries = [state.flags.metDad?'Dad taught Frog to tend Moonberries':'Dad is waiting at the barn',state.flags.pipJoined?'Pip shared the secret of Scent Sight':'A pond friend is waiting',state.flags.stoneRead?'The first Story Stone is fading':'The meadow holds an unread story',state.flags.bossWon?'The Hollow Scarecrow released its stolen light':'Old Mill Hollow is still dangerous',`${state.harvests} Moonberry harvest${state.harvests===1?'':'s'} completed`,`${state.discoveries} of 8 hidden valley keepsakes discovered`];
    const request=dailyRequest();
    openPanel('Frog\'s adventure journal', `<p><strong>Main quest:</strong> ${currentQuest()}</p><div class="game-goal-stack"><div><strong>Today</strong><span>${state.requestDoneDay===state.day?'Neighbor request complete':`${request.label} for ${request.name}`}</span></div><div><strong>This week</strong><span>${state.shippedTotal>=18?'Shipping rhythm established':'Ship 18 Moonberries'} · ${Math.min(state.shippedTotal,18)} / 18</span></div><div><strong>Chapter goal</strong><span>${state.flags.chapterWon?'First Story Stone restored':'Restore the first Story Stone'}</span></div></div><h5>What Frog has learned</h5><ul>${discoveries.map((item)=>`<li>${item}</li>`).join('')}</ul><p>Friendship: <strong>${state.friendship}</strong> &nbsp; Coins: <strong>${state.coins}</strong> &nbsp; Play time: <strong>${Math.floor(state.playSeconds/60)} minutes</strong></p>`);
  }

  function showPack() {
    openPanel('Frog\'s adventure pack', `<p>Every resource now feeds the daily loop: grow, help, ship, improve, and begin again.</p><div class="game-pack-grid"><div><strong>${state.stamina} / ${state.maxStamina} energy</strong><span>Farm work uses energy; sleep restores it</span></div><div><strong>${state.seeds} Moonberry seeds</strong><span>Plant in twelve garden plots</span></div><div><strong>${state.berries} Moonberries</strong><span>Cook, fulfill requests, or ship</span></div><div><strong>${state.shippingBin} in shipping basket</strong><span>Paid when Frog sleeps</span></div><div><strong>${state.fertilizer} fertilizer</strong><span>Raises crop quality</span></div><div><strong>${state.coins} valley coins</strong><span>Earned from overnight shipping</span></div><div><strong>Watering can tier ${state.toolTier}</strong><span>Friendship unlocks better tools</span></div><div><strong>${state.friendship} Friendship</strong><span>Unlocks supplies and shortcuts</span></div></div>`);
  }

  function showSettings(){
    openPanel('Game setup',`<p>These choices are saved on this device. Sound is original to Sunny Valley and begins only after you tap play.</p><div class="game-save-grid"><div class="game-save-slot"><strong>Audio</strong><span>${audioEngine.enabled?'Music and effects on':'Muted'}</span><button data-setting-audio>${audioEngine.enabled?'Mute':'Turn on'}</button></div><div class="game-save-slot"><strong>Graphics</strong><span>${state.quality==='high'?'Sharper detail':state.quality==='low'?'Battery saver':'Automatic for this screen'}</span><button data-setting-quality="low">Saver</button><button data-setting-quality="auto">Auto</button><button data-setting-quality="high">High</button></div><div class="game-save-slot"><strong>Control layout</strong><span>Move the action button to your preferred thumb.</span><button data-setting-hand="right">Right handed</button><button data-setting-hand="left">Left handed</button></div><div class="game-save-slot"><strong>Motion</strong><span>Your system reduced-motion setting is respected automatically.</span></div><div class="game-save-slot"><strong>Map diagnostics</strong><span>${state.debugMap?'Visible':'Hidden'} · contract ${MAP.version} verified</span><button data-setting-debug>${state.debugMap?'Hide overlay':'Show overlay'}</button></div></div>`);
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
    state.coins = 0;
    state.stamina = 12;
    state.maxStamina = 12;
    state.fertilizer = 2;
    state.shippingBin = 0;
    state.shippedTotal = 0;
    state.earningsLastNight = 0;
    state.gardenQuality = freshGardenQuality();
    state.wateringStreak = 0;
    state.toolTier = 1;
    state.requestDay = 0;
    state.requestDoneDay = 0;
    state.bedtimeWarned = false;
    state.flags = freshFlags();
    state.home = freshHome();
    state.inInterior = false;
    state.garden = freshGarden();
    state.taken = new Set();
    state.bossActive=false;
    state.bossHealth=state.bossMaxHealth;
    state.playSeconds=0;
    state.discoveries=0;
    frog.position.set(-30,0,-15);
    state.target.copy(frog.position);
    state.path=[];
    localStorage.removeItem(SAVE_KEY);
    enemies.forEach(enemy=>{enemy.health=enemy.maxHealth;enemy.alive=true;enemy.object.visible=false;enemy.object.position.copy(enemy.home);});
    boss.object.visible=false;
    entities.filter(entity=>entity.type==='discovery').forEach(entity=>{entity.object.visible=true;});
    refreshGardenVisuals();
    refreshItems();
    applyBandana();
    closePanel();
    updateUi();
    if(confirmFirst) toast('A brand-new Chapter One begins!');
  }

  function entityDistance(entity) {
    return Math.hypot(frog.position.x - entity.position.x, frog.position.z - entity.position.z);
  }

  function entityIsAvailable(entity) {
    if (Boolean(entity.interior) !== Boolean(state.inInterior)) return false;
    if (entity.type === 'petal') return state.stage === 5 && !state.taken.has(entity.id);
    if (entity.type === 'shard') return state.stage === 8 && entity.unlocked && !state.taken.has(entity.id);
    if (entity.type === 'enemy') return state.stage === 8 && entity.alive;
    if (entity.type === 'boss') return false;
    if (entity.type === 'discovery') return !state.taken.has(entity.id);
    if (entity.type === 'mill') return state.stage === 10 && !state.flags.bossWon;
    return true;
  }

  function nearestEntity(maxDistance = window.innerWidth<700?3.05:2.45) {
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
    playSfx('find');
    if (entity.type === 'discovery') {
      state.discoveries += 1;
      entity.object.visible = false;
      burst(entity.position.x,entity.position.z,0xffdc72,18,1.3);
      toast(`Frog discovered: ${entity.name}. ${state.discoveries} valley keepsake${state.discoveries===1?'':'s'} found.`);
    } else if (entity.type === 'petal') {
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

  function weatherForDay(day=state.day) {
    const weather=['Clear','Soft rain','Mountain breeze','Golden sun'];
    return weather[(day-1)%weather.length];
  }

  function dailyRequest() {
    const requests=[
      {npc:'dad',name:'Dad',kind:'berries',amount:3,reward:3,label:'Bring 3 Moonberries'},
      {npc:'pip',name:'Pip',kind:'berries',amount:2,reward:3,label:'Bring 2 Moonberries'},
      {npc:'hen',name:'Hazel Hen',kind:'berries',amount:2,reward:2,label:'Bring 2 Moonberries'},
      {npc:'bunny',name:'Blaze',kind:'biscuit',amount:1,reward:4,label:'Bring 1 Brave Biscuit'},
      {npc:'tortoise',name:'Tortoise',kind:'berries',amount:3,reward:4,label:'Bring 3 Moonberries'}
    ];
    return requests[(state.day-1)%requests.length];
  }

  function spendStamina(amount,label='farm work') {
    if(state.clock>=21){toast('It is bedtime. Frog should return to his fancy bed.');return false;}
    if(state.stamina<amount){toast(`Frog is too tired for ${label}. A nap helps a little; a full night restores all energy.`);return false;}
    state.stamina-=amount;
    state.clock=Math.min(21,state.clock+.18*amount);
    return true;
  }

  function tryDailyRequest(entity) {
    const request=dailyRequest();
    if(request.npc!==entity.id||state.requestDoneDay===state.day||state.stage<4)return false;
    const storyMoment=(entity.id==='pip'&&(state.stage===4||state.stage===6))||(entity.id==='dad'&&state.stage===9);
    if(storyMoment)return false;
    const available=request.kind==='biscuit'?state.biscuits:state.berries;
    if(available<request.amount){
      openPanel(`${request.name}'s request`, `<div class="game-dialog-speaker">${request.name}</div><p>${request.label}. Helping neighbors builds friendship and unlocks better farm tools.</p><p><strong>${available} / ${request.amount}</strong> ready.</p>`);
      return true;
    }
    if(request.kind==='biscuit')state.biscuits-=request.amount;else state.berries-=request.amount;
    state.friendship+=request.reward;state.requestDoneDay=state.day;state.fertilizer+=1;
    const previousTier=state.toolTier;
    state.toolTier=state.friendship>=14?3:state.friendship>=7?2:1;
    if(state.toolTier>previousTier)state.maxStamina=Math.min(20,state.maxStamina+2);
    playSfx('find');saveProgress();
    openPanel('A neighbor helped', `<div class="game-dialog-speaker">${request.name}</div><p>Request complete. Frog earns <strong>${request.reward} friendship</strong> and one bag of fertilizer.</p>${state.toolTier>previousTier?`<p><strong>Farm upgrade unlocked:</strong> Watering can tier ${state.toolTier} and +2 maximum energy.</p>`:''}<p>Relationships now make tomorrow's farm work easier.</p>`);
    updateUi();return true;
  }

  function talkToNpc(entity) {
    if(tryDailyRequest(entity))return;
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
        openPanel('Morning at the red barn', '<div class="game-dialog-speaker">Dad</div><p>“Good morning, Frog. Sunny Valley takes care of us when we take care of it. Let\'s begin with the Moonberry garden.”</p><p>Follow the path to the separate fenced Moonberry field. Plant and water any two plots, then return to the farmhouse to sleep.</p>');
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
    if (phase === 'dry') {
      if (state.seeds < 1) return toast('Frog needs a Moonberry seed.');
      if(!spendStamina(1,'planting'))return;
      state.seeds -= 1;
      state.garden[entity.index] = 'planted';
      playFrogAction('plant',900);playSfx('plant');haptic(18);
      burst(entity.position.x,entity.position.z,0xb87845,10,.7);
      toast('Moonberry seed planted. Interact again to water it.');
    } else if (phase === 'planted') {
      if(!spendStamina(1,'watering'))return;
      state.garden[entity.index] = 'watered';
      const usedFertilizer=state.fertilizer>0;
      if(usedFertilizer)state.fertilizer-=1;
      const weatherBonus=weatherForDay()==='Soft rain'?1:0;
      state.gardenQuality[entity.index]=clamp(1+(usedFertilizer?1:0)+weatherBonus,1,3);
      state.wateringStreak+=1;
      playFrogAction('water',1050);playSfx('water');haptic([12,35,12]);
      burst(entity.position.x,entity.position.z,0x57bfe3,14,.85);
      toast(`${usedFertilizer?'Fertilized and watered':'Watered'}! The soil darkens as the seed wakes.`);
      window.setTimeout(()=>{
        if(state.garden[entity.index]!=='watered')return;
        state.garden[entity.index]='sprouting';
        refreshGardenVisuals();saveProgress(false);
        burst(entity.position.x,entity.position.z,0x7bc957,8,.55);
      },700);
    } else if (phase === 'watered' || phase === 'sprouting') {
      toast('This Moonberry needs one peaceful night to ripen.');
    } else if (phase === 'mature') {
      if(!spendStamina(1,'harvesting'))return;
      state.garden[entity.index] = 'harvested';
      const quality=state.gardenQuality[entity.index]||1;
      const yieldCount=2+quality;
      state.berries += yieldCount;
      state.harvests += 1;
      state.friendship += 1;
      state.seeds += 1;
      state.gardenQuality[entity.index]=1;
      playFrogAction('harvest',950);playSfx('harvest');haptic([20,30,35]);
      burst(entity.position.x,entity.position.z,0xb66be0,24,1.2);
      toast(`${yieldCount} quality-${quality} Moonberries harvested, plus one new seed!`);
      window.setTimeout(()=>{
        if(state.garden[entity.index]!=='harvested')return;
        state.garden[entity.index]='dry';
        refreshGardenVisuals();saveProgress(false);
      },650);
    } else {
      toast('This plot is settling after the harvest.');
    }
    if(state.stage===1 && state.garden.filter(phase=>phase==='watered'||phase==='sprouting').length>=2){
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
    // A full night advances farm growth, restores courage, and keeps Frog in
    // the house beside the bed. It is never attached to the exterior wall.
    const oldDay=state.day;
    const rainy=weatherForDay(oldDay)==='Soft rain';
    state.earningsLastNight=state.shippingBin*(12+Math.min(6,state.toolTier*2));
    state.coins+=state.earningsLastNight;
    state.shippedTotal+=state.shippingBin;
    const shipped=state.shippingBin;
    state.shippingBin=0;
    state.day += 1;
    state.clock = 7.5;
    state.garden = advanceGardenOvernight(state.garden,{rainy});
    state.health=state.maxHealth;
    state.stamina=state.maxStamina;
    state.bedtimeWarned=false;
    state.home.washedDay=0;
    closePanel();
    playFrogAction('bedtime',1800);playSfx('sleep');haptic([18,55,12]);
    if(state.stage===2) state.stage=3;
    refreshGardenVisuals();
    saveProgress();
    const request=dailyRequest();
    const morning=`<p>Frog circles once, curls into the cushions, sleeps, and wakes with a long stretch beneath a peach-colored sky.</p><div class="game-morning-summary"><div><strong>${state.earningsLastNight} coins</strong><span>${shipped?`${shipped} Moonberries shipped overnight`:'Nothing shipped last night'}</span></div><div><strong>${weatherForDay()}</strong><span>Today's weather</span></div><div><strong>${state.stamina} / ${state.maxStamina}</strong><span>Energy restored</span></div><div><strong>${request.name}</strong><span>${request.label}</span></div></div>${rainy?'<p>Yesterday\'s rain watered every planted plot once.</p>':''}${state.stage===3?'<p>Harvest at least six berries. They can be cooked, shared, or placed in the shipping basket.</p>':''}`;
    window.setTimeout(()=>{
      if(state.earningsLastNight){playSfx('ship');haptic([20,40,20]);flashSaved(`+${state.earningsLastNight} shipping coins`);}
      openPanel(`Good morning · Day ${state.day}`,morning);
    },1250);
    updateUi();
  }

  function weatherForTomorrow() {
    return weatherForDay(state.day+1).toLowerCase();
  }

  function showShipping() {
    const potential=state.berries*(12+Math.min(6,state.toolTier*2));
    openPanel('Moonberry shipping basket', `<p>Anything placed here is collected after Frog sleeps. Earnings arrive in the morning summary.</p><div class="game-home-summary"><strong>${state.shippingBin} waiting · ${state.berries} in pack</strong><span>Shipping all pack berries would add about ${potential} coins.</span></div><div class="game-home-actions"><button class="game-panel-action" data-ship-all ${state.berries?'':'disabled'}>${state.berries?'Ship all Moonberries':'No Moonberries to ship'}</button><button class="game-panel-action" data-ship-one ${state.berries?'':'disabled'}>Ship one</button></div>`);
  }

  function shipMoonberries(all=false) {
    if(!state.berries)return toast('Frog has no Moonberries to ship.');
    const amount=all?state.berries:1;state.berries-=amount;state.shippingBin+=amount;
    playFrogAction('interact',650);playSfx('ship');haptic([14,28,14]);
    flashSaved(`${amount} Moonberr${amount===1?'y':'ies'} placed for shipping`);
    saveProgress(false);showShipping();updateUi();
  }

  function applyBandana() {
    if(!frog?.userData?.collar) return;
    const colors={red:0xd84c42,blue:0x4b9bc1,gold:0xe3b34a};
    frog.userData.collar.material.color.setHex(colors[state.home.bandana] || colors.red);
  }

  function enterFarmhouse() {
    if(state.inInterior) return;
    farmhouseDoor.userData.openUntil=performance.now()+500;
    state.inInterior=true;
    state.path=[];
    state.target.set(INTERIOR.entrance.x,0,INTERIOR.entrance.z);
    frog.position.copy(state.target);
    cameraFocus.copy(frog.position);
    marker.visible=false;
    state.destinationName='Frog\'s Farmhouse';
    saveProgress(false);
    toast('Frog pads into his warm farmhouse. The fancy bed is ready for bedtime.');
  }

  function leaveFarmhouse() {
    if(!state.inInterior) return;
    state.inInterior=false;
    interiorDoor.userData.openUntil=performance.now()+400;
    state.path=[];
    frog.position.set(HOMESTEAD.returnPoint.x,0,HOMESTEAD.returnPoint.z);
    state.target.copy(frog.position);
    cameraFocus.copy(frog.position);
    marker.visible=false;
    state.destinationName='Moonberry Homestead';
    saveProgress(false);
    toast('Frog steps back onto the farmhouse porch.');
  }

  function showBedOptions() {
    openPanel('Frog\'s fancy bed', `<p>Carved wood, red-and-gold cushions, and a sunny nameplate make this Frog's safest place in the valley.</p><div class="game-home-actions"><button class="game-panel-action" data-home-sleep>Sleep until morning</button><button class="game-panel-action" data-home-nap>Take a short nap</button><button class="game-panel-action" data-home-bed-save>Save without sleeping</button></div><p class="game-home-note">Sleeping restores Courage, ripens watered Moonberries, processes the new day, and saves safely.</p>`);
  }

  function takeNap() {
    state.clock=Math.min(20.4,state.clock+2);
    state.health=Math.min(state.maxHealth,state.health+2);
    state.stamina=Math.min(state.maxStamina,state.stamina+4);
    playFrogAction('sleep',620);
    saveProgress();
    openPanel('A quiet rest', `<p>Frog curls up for a little while. It is now <strong>${Math.floor(state.clock)}:${Math.floor((state.clock%1)*60).toString().padStart(2,'0')}</strong>. Two Courage Hearts and four energy return.</p>`);
    updateUi();
  }

  function showKitchen() {
    const canCook=state.berries>=3;
    openPanel('Moonberry kitchen', `<p>The hearth is warm, the mixing bowl is ready, and the pantry smells like apples and honey.</p><div class="game-home-summary"><strong>${state.berries} Moonberries</strong><span>Three Moonberries become one Brave Biscuit.</span></div><button class="game-panel-action" data-home-cook ${canCook?'':'disabled'}>${canCook?'Bake a Brave Biscuit':'Need 3 Moonberries'}</button><p class="game-home-note">Brave Biscuits automatically help Frog recover Courage when the valley becomes dangerous.</p>`);
  }

  function cookBiscuit() {
    if(state.berries<3) return toast('Frog needs three Moonberries to bake a Brave Biscuit.');
    state.berries-=3; state.biscuits+=1; state.home.pantry+=1; state.friendship+=1;
    playSfx('find'); saveProgress();
    openPanel('Warm Brave Biscuit', `<p>The Moonberries bake into a warm, cinnamon-scented Brave Biscuit. Frog tucks it safely into his pack.</p><p><strong>${state.biscuits}</strong> Brave Biscuit${state.biscuits===1?'':'s'} ready.</p>`);
    updateUi();
  }

  function showPantry() {
    openPanel('Pantry chest', `<p>The pantry keeps the farmhouse loop visible and organized.</p><div class="game-pack-grid"><div><strong>${state.seeds} seeds</strong><span>Ready for the Moonberry field</span></div><div><strong>${state.berries} Moonberries</strong><span>Freshly harvested crop</span></div><div><strong>${state.biscuits} biscuits</strong><span>Adventure supplies</span></div><div><strong>${state.home.pantry} baked this chapter</strong><span>Household cooking record</span></div></div>`);
  }

  function useWashBasin() {
    if(state.home.washedDay===state.day) return toast('Frog already had a refreshing wash today.');
    state.home.washedDay=state.day;
    state.health=Math.min(state.maxHealth,state.health+1);
    playSfx('sniff'); saveProgress();
    openPanel('Fresh paws, brave heart', '<p>Cool water and a clean towel leave Frog feeling ready for the trail. One Courage Heart returns.</p>');
    updateUi();
  }

  function showWardrobe() {
    openPanel('Collar wardrobe', `<p>Choose a travel color for Frog. The selection is saved with the adventure.</p><div class="game-home-actions"><button class="game-panel-action" data-bandana="red">Red collar</button><button class="game-panel-action" data-bandana="blue">Pond-blue collar</button><button class="game-panel-action" data-bandana="gold">Story-light collar</button></div><p class="game-home-note">Current choice: <strong>${state.home.bandana}</strong>.</p>`);
  }

  function showJournalDesk() {
    openPanel('Journal, calendar, and weather radio', `<p><strong>Day ${state.day}</strong> · ${zoneName()}</p><div class="game-pack-grid"><div><strong>Today</strong><span>${currentQuest()}</span></div><div><strong>Tomorrow</strong><span>${weatherForTomorrow()}</span></div><div><strong>Next gathering</strong><span>Hilltop market day, coming in Chapter Two</span></div><div><strong>Friendship</strong><span>${state.friendship} bright moments</span></div></div><button class="game-panel-action" data-home-open-journal>Open adventure journal</button>`);
  }

  function showShelf() {
    openPanel('Keepsake shelf', `<p>Every treasure Frog finds belongs somewhere warm and safe.</p><div class="game-home-summary"><strong>${state.discoveries} / 8 keepsakes displayed</strong><span>Explore the valley to fill the shelf with stories.</span></div>`);
  }

  function interact() {
    if (!state.started) return beginAdventure();
    if (state.panelOpen) return closePanel();
    const entity = nearestEntity();
    if (!entity) return toast('Walk closer to a friend, treasure, garden plot, or farmhouse.');
    if(entity.type!=='garden'&&entity.type!=='enemy')playFrogAction('interact',650);
    if (entity.type === 'petal' || entity.type === 'shard' || entity.type === 'discovery') collectItem(entity);
    else if (entity.type === 'npc') talkToNpc(entity);
    else if (entity.type === 'garden') tendGarden(entity);
    else if (entity.type === 'home') enterFarmhouse();
    else if (entity.type === 'interior-door') leaveFarmhouse();
    else if (entity.type === 'bed') showBedOptions();
    else if (entity.type === 'kitchen') showKitchen();
    else if (entity.type === 'pantry') showPantry();
    else if (entity.type === 'wash') useWashBasin();
    else if (entity.type === 'wardrobe') showWardrobe();
    else if (entity.type === 'journal-desk') showJournalDesk();
    else if (entity.type === 'shelf') showShelf();
    else if (entity.type === 'shipping') showShipping();
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
      dom.actionLabel.textContent = phase === 'dry' ? 'Plant seed' : phase === 'planted' ? 'Water plant' : phase === 'mature' ? 'Harvest berries' : phase === 'harvested' ? 'Clear plot' : 'Check plant';
    } else if (entity.type === 'home') {
      dom.actionIcon.textContent = '⌂';
      dom.actionLabel.textContent = 'Enter farmhouse';
    } else if (entity.type === 'interior-door') {
      dom.actionIcon.textContent = '↩';
      dom.actionLabel.textContent = 'Return to valley';
    } else if (entity.type === 'bed') {
      dom.actionIcon.textContent = '☾';
      dom.actionLabel.textContent = 'Rest in fancy bed';
    } else if (entity.type === 'kitchen') {
      dom.actionIcon.textContent = '♨';
      dom.actionLabel.textContent = 'Use Moonberry kitchen';
    } else if (entity.type === 'pantry') {
      dom.actionIcon.textContent = '▣';
      dom.actionLabel.textContent = 'Open pantry chest';
    } else if (entity.type === 'wash') {
      dom.actionIcon.textContent = '◌';
      dom.actionLabel.textContent = 'Freshen up';
    } else if (entity.type === 'wardrobe') {
      dom.actionIcon.textContent = '✦';
      dom.actionLabel.textContent = 'Choose collar';
    } else if (entity.type === 'journal-desk') {
      dom.actionIcon.textContent = '▤';
      dom.actionLabel.textContent = 'Read journal';
    } else if (entity.type === 'shelf') {
      dom.actionIcon.textContent = '★';
      dom.actionLabel.textContent = 'View keepsakes';
    } else if (entity.type === 'shipping') {
      dom.actionIcon.textContent = '▱';
      dom.actionLabel.textContent = 'Use shipping basket';
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
    playFrogAction('sniff',900);playSfx('sniff');haptic(12);
    const clues=entities.filter(entity=>entityIsAvailable(entity)&&(entity.type==='petal'||entity.type==='shard'||entity.type==='discovery'||entity.type==='stone'||(entity.type==='npc'&&['dad','pip'].includes(entity.id))));
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
    state.barkReadyAt=now+1150;playFrogAction('bark',520);playSfx('bark');haptic(28);
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
    state.dodgeReadyAt=now+1400;state.dodgingUntil=now+720;playFrogAction('dodge',720);haptic([12,24,12]);
    const threat=nearestThreat();
    let dx=1,dz=0;
    if(threat){dx=frog.position.x-threat.position.x;dz=frog.position.z-threat.position.z;}
    else {dx=Math.sin(frog.rotation.y);dz=Math.cos(frog.rotation.y);}
    const d=Math.max(.01,Math.hypot(dx,dz));
    const minX=state.inInterior?INTERIOR.x-INTERIOR.width/2+1:WORLD.minX+1;
    const maxX=state.inInterior?INTERIOR.x+INTERIOR.width/2-1:WORLD.maxX-1;
    const minZ=state.inInterior?INTERIOR.z-INTERIOR.depth/2+1:WORLD.minZ+1;
    const maxZ=state.inInterior?INTERIOR.z+INTERIOR.depth/2-1:WORLD.maxZ-1;
    const nx=clamp(frog.position.x+dx/d*3.2,minX,maxX), nz=clamp(frog.position.z+dz/d*3.2,minZ,maxZ);
    if(!isBlocked(nx,nz)){frog.position.set(nx,0,nz);state.target.copy(frog.position);}
    burst(frog.position.x,frog.position.z,0xcdf2b1,9,.8);
  }

  function takeDamage(source='the gloom') {
    const now=performance.now();
    if(now<state.dodgingUntil||now-state.lastDamageAt<1300) return;
    state.lastDamageAt=now;state.health-=1;playFrogAction('hurt',650);haptic([45,40,45]);
    dom.dangerVignette.classList.add('is-hit');
    window.setTimeout(()=>dom.dangerVignette.classList.remove('is-hit'),220);
    if(state.health>0&&state.health<=2&&state.biscuits>0){
      state.biscuits-=1; state.health=Math.min(state.maxHealth,state.health+2); toast(`A Brave Biscuit restores Frog's courage. ${state.biscuits} left.`);
    }else toast(`Frog loses a Courage Heart to ${source}. Dodge clear!`);
    if(state.health<=0){
      state.health=state.maxHealth; state.bossActive=false; boss.object.visible=false; state.bossHealth=state.bossMaxHealth; state.stage=Math.min(state.stage,10);
      frog.position.set(-31,0,-15); state.target.copy(frog.position); state.clock=8;
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
    state.bossActive=false;state.flags.bossWon=true;state.stage=12;state.friendship+=6;state.clock=5.9;
    boss.object.userData.spriteSpecialFrame=7;
    animateCharacter(boss.object,clock.elapsedTime,0,false,0);
    window.setTimeout(()=>{boss.object.visible=false;},900);
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
    applyBandana();
    entities.filter(entity=>entity.type==='discovery').forEach(entity=>{entity.object.visible=!state.taken.has(entity.id);});
    refreshItems(); updateUi();
  }

  function loadSlot(number) {
    try{
      const raw=localStorage.getItem(`${SLOT_PREFIX}${number}`); if(!raw) return;
      applySave(JSON.parse(raw)); restoreWorldState(); saveProgress(); closePanel(); toast(`Manual slot ${number} loaded.`);
    }catch{toast('That save slot could not be read.');}
  }

  function findPath(startX,startZ,endX,endZ) {
    if(state.inInterior) return isBlocked(endX,endZ) ? [] : [new THREE.Vector3(endX,0,endZ)];
    const cell=1.45;
    const key=(gx,gz)=>`${gx},${gz}`;
    const point=(gx,gz)=>({x:WORLD.minX+1+gx*cell,z:WORLD.minZ+1+gz*cell});
    const grid=(x,z)=>({gx:Math.round((x-(WORLD.minX+1))/cell),gz:Math.round((z-(WORLD.minZ+1))/cell)});
    const start=grid(startX,startZ),goal=grid(endX,endZ),open=[{...start,g:0,f:0}],came=new Map(),cost=new Map([[key(start.gx,start.gz),0]]);
    const directions=[[-1,0,1],[1,0,1],[0,-1,1],[0,1,1],[-1,-1,1.42],[1,-1,1.42],[-1,1,1.42],[1,1,1.42]];
    let found=null,iterations=0;
    while(open.length&&iterations++<9000){
      open.sort((a,b)=>a.f-b.f);const current=open.shift();
      if(current.gx===goal.gx&&current.gz===goal.gz){found=current;break;}
      directions.forEach(([dx,dz,stepCost])=>{
        const gx=current.gx+dx,gz=current.gz+dz,p=point(gx,gz);
        if(isBlocked(p.x,p.z)) return;
        if(dx&&dz){const a=point(current.gx+dx,current.gz),b=point(current.gx,current.gz+dz);if(isBlocked(a.x,a.z)||isBlocked(b.x,b.z)) return;}
        const nextKey=key(gx,gz),nextCost=current.g+stepCost;
        if(nextCost>=(cost.get(nextKey)??Infinity)) return;
        cost.set(nextKey,nextCost);came.set(nextKey,current);
        open.push({gx,gz,g:nextCost,f:nextCost+Math.hypot(goal.gx-gx,goal.gz-gz)});
      });
    }
    if(!found) return [];
    const reversed=[];let cursor=found;
    while(cursor&&!(cursor.gx===start.gx&&cursor.gz===start.gz)){const p=point(cursor.gx,cursor.gz);reversed.push(new THREE.Vector3(p.x,0,p.z));cursor=came.get(key(cursor.gx,cursor.gz));}
    reversed.reverse();
    const simplified=[];
    reversed.forEach((node,index)=>{
      const prev=simplified[simplified.length-1],next=reversed[index+1];
      if(prev&&next){const ax=Math.sign(node.x-prev.x),az=Math.sign(node.z-prev.z),bx=Math.sign(next.x-node.x),bz=Math.sign(next.z-node.z);if(ax===bx&&az===bz)return;}
      simplified.push(node);
    });
    simplified.push(new THREE.Vector3(endX,0,endZ));
    return simplified;
  }

  function setTarget(x, z) {
    const minX=state.inInterior?INTERIOR.x-INTERIOR.width/2+.8:WORLD.minX+.8;
    const maxX=state.inInterior?INTERIOR.x+INTERIOR.width/2-.8:WORLD.maxX-.8;
    const minZ=state.inInterior?INTERIOR.z-INTERIOR.depth/2+.8:WORLD.minZ+.8;
    const maxZ=state.inInterior?INTERIOR.z+INTERIOR.depth/2-.8:WORLD.maxZ-.8;
    let nextX = clamp(x, minX, maxX);
    let nextZ = clamp(z, minZ, maxZ);
    const assistRadius=window.innerWidth<700?4.2:2.8;
    const assisted=entities
      .filter((entity)=>entityIsAvailable(entity)&&Math.hypot(entity.position.x-nextX,entity.position.z-nextZ)<=assistRadius)
      .sort((a,b)=>Math.hypot(a.position.x-nextX,a.position.z-nextZ)-Math.hypot(b.position.x-nextX,b.position.z-nextZ))[0];
    if(assisted&&!isBlocked(assisted.position.x,assisted.position.z)){
      nextX=assisted.position.x;
      nextZ=assisted.position.z;
    }
    if (isBlocked(nextX, nextZ)) {
      toast('That spot is blocked. Tap a nearby path or patch of grass.');
      return;
    }
    const route=findPath(frog.position.x,frog.position.z,nextX,nextZ);
    if(!route.length){toast('Frog cannot find a safe path there. Try a nearer trail.');return;}
    state.path=route;
    state.target.copy(state.path.shift());
    marker.position.set(nextX, .04, nextZ);
    marker.visible = true;
    const nearest=assisted||entities.filter(entity=>entityIsAvailable(entity)).sort((a,b)=>Math.hypot(a.position.x-nextX,a.position.z-nextZ)-Math.hypot(b.position.x-nextX,b.position.z-nextZ))[0];
    state.destinationName=nearest&&Math.hypot(nearest.position.x-nextX,nearest.position.z-nextZ)<4?nearest.name:zoneName();
  }

  function raycastGround(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(clickableGround, false);
    if (hits.length) setTarget(hits[0].point.x, hits[0].point.z);
  }

  const pointerStart = { x: 0, y: 0, id: null, moved:false, lastRouteAt:0 };
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    beginAdventure(true);
    pointerStart.x = event.clientX;
    pointerStart.y = event.clientY;
    pointerStart.id = event.pointerId;
    pointerStart.moved=false;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove',(event)=>{
    if(pointerStart.id!==event.pointerId)return;
    const distance=Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y);
    if(distance<12||performance.now()-pointerStart.lastRouteAt<90)return;
    pointerStart.moved=true;pointerStart.lastRouteAt=performance.now();raycastGround(event.clientX,event.clientY);
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
    if(key==='g'&&!event.repeat&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){event.preventDefault();toggleMapDiagnostics();}
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
  dom.audio.addEventListener('click', toggleAudio);
  dom.settings.addEventListener('click', showSettings);
  dom.audio.textContent=audioEngine.enabled?'Sound':'Muted';
  dom.panel.addEventListener('click',(event)=>{
    if(event.target.closest('[data-home-sleep]')){sleepAtHome();return;}
    if(event.target.closest('[data-home-nap]')){takeNap();return;}
    if(event.target.closest('[data-home-bed-save]')){saveProgress();closePanel();toast('Frog tucked this cozy moment safely into the save file.');return;}
    if(event.target.closest('[data-home-cook]')){cookBiscuit();return;}
    if(event.target.closest('[data-ship-all]')){shipMoonberries(true);return;}
    if(event.target.closest('[data-ship-one]')){shipMoonberries(false);return;}
    if(event.target.closest('[data-home-open-journal]')){showJournal();return;}
    const bandanaButton=event.target.closest('[data-bandana]');
    if(bandanaButton){state.home.bandana=bandanaButton.dataset.bandana;applyBandana();saveProgress();showWardrobe();return;}
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
    if(event.target.closest('[data-setting-audio]')){toggleAudio();showSettings();}
    if(event.target.closest('[data-setting-debug]')){toggleMapDiagnostics();showSettings();}
    const qualityButton=event.target.closest('[data-setting-quality]');
    if(qualityButton){state.quality=qualityButton.dataset.settingQuality;localStorage.setItem('adnf-game-quality',state.quality);resize();flashSaved('Graphics updated');showSettings();}
    const handButton=event.target.closest('[data-setting-hand]');
    if(handButton){dom.shell.classList.toggle('is-left-handed',handButton.dataset.settingHand==='left');localStorage.setItem('adnf-game-hand',handButton.dataset.settingHand);flashSaved('Controls updated');closePanel();}
  });

  function shortestAngle(from, to) {
    let difference = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
    if (difference < -Math.PI) difference += Math.PI * 2;
    return difference;
  }

  function animateCharacter(character,elapsed,delta,moving=false,speed=0) {
    const data=character.userData;
    const now=performance.now();
    if(data.actionUntil&&now>data.actionUntil){data.action='idle';data.actionUntil=0;}
    if (data.renderAsset && data.sprite) {
      const direction = data.spriteDirection || 'south';
      let texture;
      let columns=1;
      let rows=1;
      let frame=0;
      let textureKey='idle';
      const actionAtlases={
        sniff:{key:'sniffInteract',start:0,count:4,columns:6,rate:7},
        interact:{key:'sniffInteract',start:3,count:3,columns:6,rate:6},
        bark:{key:'combat',start:0,count:4,columns:8,rate:9},
        dodge:{key:'combat',start:4,count:2,columns:8,rate:8},
        hurt:{key:'combat',start:6,count:2,columns:8,rate:7},
        plant:{key:'farming',start:0,count:3,columns:9,rate:6},
        water:{key:'farming',start:3,count:3,columns:9,rate:6},
        harvest:{key:'farming',start:6,count:3,columns:9,rate:7},
        bedtime:{key:'bedtime',start:0,count:8,columns:8,rate:5},
        sleep:{key:'bedtime',start:5,count:2,columns:8,rate:2},
        wake:{key:'bedtime',start:7,count:1,columns:8,rate:1}
      };
      const requestedAction=actionAtlases[data.action];
      const actionConfig=requestedAction&&data.spriteTextures.actions?.[requestedAction.key]?requestedAction:null;
      if(actionConfig){
        texture=data.spriteTextures.actions[actionConfig.key];
        columns=actionConfig.columns;
        const actionElapsed=Math.max(0,(now-(data.actionStartedAt||now))/1000);
        const actionFrame=Math.min(actionConfig.count-1,Math.floor(actionElapsed*actionConfig.rate));
        frame=actionConfig.start+actionFrame;
        textureKey=`${data.action}-${frame}`;
      }else if(data.spriteTextures.directional){
        texture=data.spriteTextures.directional.all;
        if(!data.spriteStatic){
          columns=4;rows=2;
          const base={south:0,north:2,west:4,east:6}[direction]??0;
          frame=data.spriteSpecialFrame??(base+(moving?1:0));
        }
        textureKey=`directional-${frame}`;
      }else{
        const running=moving&&speed>7.2&&data.spriteTextures.run;
        const textureSet=running?data.spriteTextures.run:moving?data.spriteTextures.walk:data.spriteTextures.idle;
        texture=textureSet[direction]||textureSet.south;
        columns=running||moving?6:1;
        const rate=running?12:data.spriteFrameRate;
        frame=running||moving?Math.floor(elapsed*rate)%6:0;
        textureKey=`${running?'run':moving?'walk':'idle'}-${direction}-${frame}`;
      }
      if (texture?.image && data.spriteMaterial.map !== texture) {
        data.spriteMaterial.map = texture;
        data.spriteMaterial.needsUpdate = true;
        data.spriteFrame = -1;
      }
      if (texture?.image && textureKey !== data.spriteTextureKey) {
        setTextureAtlasCell(texture,columns,rows,frame);
        data.spriteFrame = frame;
        data.spriteTextureKey=textureKey;
      }
      const cameraYaw = Math.atan2(camera.position.x - character.position.x, camera.position.z - character.position.z);
      data.sprite.rotation.y = cameraYaw - character.rotation.y;
      const baseY=data.spriteBaseY??data.sprite.position.y;
      if(data.spriteBaseY==null)data.spriteBaseY=baseY;
      data.sprite.position.y=baseY+(moving?Math.abs(Math.sin(elapsed*(speed>7.2?12:9)))*.025:Math.sin(elapsed*2)*.008);
      data.sprite.rotation.z=0;
      data.sprite.scale.setScalar(1);
      if(character===frog&&moving&&now>data.nextFootstepAt){
        playSfx('step');
        data.nextFootstepAt=now+(speed>7.2?245:360);
      }
      return;
    }
    const gait=moving?(speed>6.5?12:8):2;
    const stride=moving?Math.sin(elapsed*gait)*.62:Math.sin(elapsed*2)*.025;
    data.legs.forEach((leg,index)=>{
      const phase=(index===0||index===3)?1:-1;
      leg.rotation.x+=(stride*phase-leg.rotation.x)*Math.min(1,delta*14);
    });
    if(data.body){
      const lift=moving?Math.abs(Math.sin(elapsed*gait))*.075:Math.sin(elapsed*2)*.018;
      data.body.position.y=data.baseY+lift;
    }
    if(data.head){
      data.head.rotation.z+=(Math.sin(elapsed*(moving?gait:1.7))*(moving?.035:.018)-data.head.rotation.z)*Math.min(1,delta*9);
      data.head.rotation.x+=(0-data.head.rotation.x)*Math.min(1,delta*8);
    }
    if(data.tail) data.tail.rotation.z=Math.sin(elapsed*(moving?13:7))*(moving?.62:.36);
    if(data.action==='sniff'){data.head.rotation.x=.42+Math.sin(elapsed*18)*.05;data.head.position.y=1.48;}
    else if(data.kind==='dog'&&data.head) data.head.position.y=1.68;
    if(data.action==='bark'){data.head.rotation.x=-.25;data.body.scale.z=data.bodyBaseScaleZ*(1+Math.sin(elapsed*24)*.06);}
    else if(data.body) data.body.scale.z+=(data.bodyBaseScaleZ-data.body.scale.z)*Math.min(1,delta*12);
    if(data.action==='sleep'&&data.kind==='dog'){
      data.head.rotation.x=.55;
      data.body.position.y=data.baseY-.32+Math.sin(elapsed*8)*.018;
      character.rotation.z=.12;
    }
    if(data.action==='dodge'){character.rotation.z=Math.sin((data.actionUntil-now)/720*Math.PI)*.18;data.body.position.y+=.3;}
    else if(data.action==='hurt') character.rotation.z=Math.sin(elapsed*32)*.12;
    else character.rotation.z*=.72;
  }

  const npcSchedules=[
    {object:dad,points:MAP.npcSchedules.dad.anchors,speed:MAP.npcSchedules.dad.speed},
    {object:pip,points:MAP.npcSchedules.pip.anchors,speed:MAP.npcSchedules.pip.speed},
    {object:bunny,points:MAP.npcSchedules.blaze.anchors,speed:MAP.npcSchedules.blaze.speed},
    {object:hen,points:MAP.npcSchedules.hazel.anchors,speed:MAP.npcSchedules.hazel.speed},
    {object:tortoise,points:MAP.npcSchedules.tortoise.anchors,speed:MAP.npcSchedules.tortoise.speed}
  ];

  function updateNpcSchedules(delta,elapsed){
    if(state.panelOpen||state.bossActive)return;
    const period=Math.max(0,Math.floor((state.clock-6)/4))%4;
    npcSchedules.forEach((schedule)=>{
      const {x:tx,z:tz}=schedule.points[period];
      const dx=tx-schedule.object.position.x,dz=tz-schedule.object.position.z,d=Math.hypot(dx,dz);
      const moving=d>.25;
      if(moving){const step=Math.min(d,schedule.speed*delta);schedule.object.position.x+=dx/d*step;schedule.object.position.z+=dz/d*step;schedule.object.rotation.y=Math.atan2(dx,dz);schedule.object.userData.spriteDirection=directionFromDelta(dx,dz);}
      animateCharacter(schedule.object,elapsed,delta,moving,schedule.speed);
    });
  }

  function updateMovement(delta, elapsed) {
    if (!state.started) return false;
    if(state.panelOpen){animateCharacter(frog,elapsed,delta,false,0);return false;}
    const dx = state.target.x - frog.position.x;
    const dz = state.target.z - frog.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .12) {
      if(state.path.length){state.target.copy(state.path.shift());return true;}
      marker.visible = false; state.destinationName='Explore';
      animateCharacter(frog,elapsed,delta,false,0);
      return false;
    }
    const speed = state.path.length>4||distance>6?8.4:6.2;
    const step = Math.min(distance, speed * delta);
    const nx = frog.position.x + dx / distance * step;
    const nz = frog.position.z + dz / distance * step;
    if (isBlocked(nx, nz)) {
      state.target.copy(frog.position); state.path=[];
      marker.visible = false;
      toast('Frog found an obstacle. Tap another route.');
      return false;
    }
    frog.position.x = nx;
    frog.position.z = nz;
    if (frog.userData.renderAsset) {
      frog.userData.spriteDirection = directionFromDelta(dx,dz);
    }
    const targetRotation = Math.atan2(dx, dz);
    frog.rotation.y += shortestAngle(frog.rotation.y, targetRotation) * Math.min(1, delta * 10);
    animateCharacter(frog,elapsed,delta,true,speed);
    return true;
  }

  function updatePickups() {
    entities.filter((entity) => (entity.type === 'petal' || entity.type === 'shard' || entity.type === 'discovery') && entityIsAvailable(entity)).forEach((entity) => {
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
        enemy.object.userData.spriteDirection=directionFromDelta(mx,mz);
      }
      animateCharacter(enemy.object,elapsed,delta,true,1.45);
      enemy.object.position.y=Math.sin(elapsed*4+index)*.045;
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
    boss.object.userData.spriteSpecialFrame=cycle>=4300?6:null;
    boss.object.userData.spriteDirection=directionFromDelta(dx,dz);
    if(speed){
      const nx=boss.position.x+dx/d*speed*delta,nz=boss.position.z+dz/d*speed*delta;
      if(!isBlocked(nx,nz)){boss.object.position.x=nx;boss.object.position.z=nz;}
      boss.object.rotation.y=Math.atan2(dx,dz);
    }
    boss.object.userData.arms.forEach((arm,i)=>arm.rotation.x=Math.sin(elapsed*5+i)*.22);
    boss.object.userData.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(elapsed*7+i*Math.PI)*.35);
    boss.object.userData.heart.scale.setScalar(cycle>=4300?1.15+Math.sin(elapsed*10)*.18:.72);
    animateCharacter(boss.object,elapsed,delta,Boolean(speed),speed);
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
    if (state.clock >= 21) {
      state.clock = 21;
      if(!state.bedtimeWarned){state.bedtimeWarned=true;toast('The porch lantern is glowing. Frog should head home and sleep.');}
    }
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
      } else if(entry.type==='discovery'){
        entry.object.position.y=entry.baseY+Math.sin(elapsed*2.4+entry.offset)*.09;
        entry.object.rotation.y+=.008;
      } else if(entry.type==='lantern'){
        entry.object.children[1].scale.setScalar(1+Math.sin(elapsed*4+entry.offset)*.08);
      } else if(entry.type==='firefly'){
        entry.object.position.y=entry.baseY+Math.sin(elapsed*2.2+entry.offset)*.28;
        entry.object.position.x+=Math.sin(elapsed*.7+entry.offset)*.0015;
      } else if(entry.type==='farmhouseDoor'){
        const opened=performance.now()<(entry.object.userData.openUntil||0);
        entry.object.rotation.y+=(opened?-1.25-entry.object.rotation.y:0-entry.object.rotation.y)*.12;
      }
    });
    if (marker.visible) {
      const pulse = 1 + Math.sin(elapsed * 6) * .12;
      markerRing.scale.setScalar(pulse);
      marker.rotation.y = elapsed * .9;
    }
  }

  function updateCamera() {
    const movingTarget=state.path.length?state.path[state.path.length-1]:state.target;
    const dx=movingTarget.x-frog.position.x,dz=movingTarget.z-frog.position.z,d=Math.max(1,Math.hypot(dx,dz));
    cameraLookAhead.set(frog.position.x+dx/d*MAP.camera.lookAhead,MAP.camera.targetHeight,frog.position.z+dz/d*MAP.camera.lookAhead);
    cameraFocus.lerp(cameraLookAhead,.075);
    const dynamicOffset=cameraOffset.clone();
    if(state.inInterior)dynamicOffset.set(MAP.camera.interiorOffset.x,MAP.camera.interiorOffset.y,MAP.camera.interiorOffset.z);
    if(state.bossActive){dynamicOffset.multiplyScalar(.88);dynamicOffset.y+=1.4;}
    const desired = cameraFocus.clone().add(dynamicOffset);
    camera.position.lerp(desired, .065);
    camera.lookAt(cameraFocus);
    if(dom.compassNeedle)dom.compassNeedle.style.transform=`rotate(${Math.atan2(dx,dz)}rad)`;
    if(dom.destination)dom.destination.textContent=state.destinationName;
  }

  function resize() {
    const width = Math.max(1, dom.stage.clientWidth);
    const height = Math.max(1, dom.stage.clientHeight);
    const ratio=state.quality==='low'?1:state.quality==='high'?Math.min(2,window.devicePixelRatio||1):Math.min(width<700?1.35:1.65,window.devicePixelRatio||1);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 560 ? MAP.camera.mobileFov : MAP.camera.desktopFov;
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
    updateNpcSchedules(delta,elapsed);
    updatePickups();
    updateEnemies(delta,elapsed);
    updateBoss(delta,elapsed);
    updateEffects(delta,elapsed);
    updateActiveEntity();
    updateLighting(delta);
    updateMusic();
    updateAmbience();
    animateWorld(elapsed);
    updateCamera();
    updateDebugOverlay();
    updateUi();
    if(state.started&&elapsed>state.saveTimer){state.saveTimer=elapsed+12;saveProgress(false);}
    renderer.render(scene, camera);
  }

  restoreWorldState();
  dom.shell.classList.toggle('is-left-handed',localStorage.getItem('adnf-game-hand')==='left');
  updateUi();
  updateCamera();
  resize();
  renderer.setAnimationLoop(render);
}
