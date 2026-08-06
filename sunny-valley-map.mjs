export const MAP_CONTRACT_VERSION = '2026-08-05.2';

const point = (x, z) => ({ x, z });
const rect = (x, z, w, d) => ({ x, z, w, d });

const map = {
  version: MAP_CONTRACT_VERSION,
  orientation: {
    north: '-Z',
    south: '+Z',
    west: '-X',
    east: '+X',
    minimap: 'north-up'
  },
  world: {
    bounds: { minX: -58, maxX: 58, minZ: -46, maxZ: 46 },
    playerRadius: 0.38,
    minimumTurningCorridor: 1.6,
    minimumCriticalRouteWidth: 2.4
  },
  camera: {
    exteriorOffset: { x: 14.8, y: 16.2, z: 21.2 },
    interiorOffset: { x: 10.1, y: 11.6, z: 14.2 },
    targetHeight: 0.65,
    lookAhead: 2.3,
    desktopFov: 42,
    mobileFov: 49,
    projection: 'orthographic',
    desktopViewHeight: 24,
    mobileViewHeight: 29
  },
  zones: {
    barnyard: { label: 'Barnyard', center: point(-39, -24), bounds: rect(-39, -24, 34, 22) },
    farmhouseTerrace: { label: 'Farmhouse terrace', center: point(-46, 30), bounds: rect(-46.5, 32.5, 21, 19) },
    moonberryField: { label: 'Moonberry field', center: point(-27.8, 18.5), bounds: rect(-27.75, 18.65, 14.5, 11.7) },
    centralMeadow: { label: 'Central meadow', center: point(3, 5), bounds: rect(0, 4, 40, 28) },
    storyStone: { label: 'Story Stone clearing', center: point(0, 27), bounds: rect(0, 29.5, 24, 19) },
    happyPond: { label: 'Happy Pond', center: point(33, 18), bounds: rect(33.5, 18.5, 23, 17) },
    oldMill: { label: 'Old Mill Hollow', center: point(38, -29), bounds: rect(39.5, -28.5, 27, 21) },
    hamlet: { label: 'Sunny Valley hamlet', center: point(41, 34), bounds: rect(41, 35, 34, 20) }
  },
  landmarks: {
    barn: { center: point(-39, -24), visibleFootprint: rect(-39, -24, 9.4, 6.4), collision: rect(-39, -24, 13.5, 9.5), door: point(-39, -20.7) },
    silo: { center: point(-27, -29), collision: rect(-27, -29, 5.5, 5.5) },
    farmhouse: {
      center: point(-46, 30),
      body: rect(-46, 30, 9.4, 7.2),
      collision: rect(-46, 30, 9.4, 7.2),
      door: point(-46, 33.67),
      porchCenter: point(-46, 34.35),
      porchInteraction: point(-46, 35.1),
      returnPoint: point(-46, 36.3),
      entranceCorridor: rect(-46, 35.5, 2.8, 5),
      lanterns: [point(-48.15, 34.5), point(-43.85, 34.5)]
    },
    mill: { center: point(38, -29), collision: rect(38, -29, 11, 9), doorApproach: point(38, -23) },
    pond: { center: point(33, 18), rx: 10, rz: 7, bridgeBand: { minZ: 16.65, maxZ: 19.35 } },
    storyStone: { center: point(0, 27), approach: point(0, 24.5) },
    hamletHouses: [
      { center: point(43, 34), collision: rect(43, 34, 7, 5.5) },
      { center: point(33, 37), collision: rect(33, 37, 6.5, 5) },
      { center: point(51, 27), collision: rect(51, 27, 6.5, 5) }
    ]
  },
  homestead: {
    orchardTrees: [point(-37.5, 29.5), point(-35.5, 27.3), point(-34.5, 24.7)],
    shrubs: [point(-39, 28.4), point(-37, 26.2), point(-35.2, 23.4)],
    lanterns: [point(-45, 32), point(-42, 26), point(-38, 21.5), point(-35, 19)]
  },
  field: {
    center: point(-27.8, 18.5),
    outerSoil: rect(-27.8, 18.5, 15, 12),
    cultivatedSoil: rect(-27.8, 18.5, 13.7, 10.7),
    fence: { minX: -34.8, maxX: -20.8, minZ: 13, maxZ: 24 },
    gate: { center: point(-34.8, 18.5), width: 2.6, opening: { minZ: 17.2, maxZ: 19.8 } },
    sign: point(-35.45, 16.45),
    trough: point(-22.7, 15),
    shippingBasket: point(-22.65, 18.85),
    scarecrow: point(-22.6, 22.2),
    plotSize: { w: 1.45, d: 1.45 },
    tutorialPlots: [5, 6],
    plots: [
      point(-32.1, 15.25), point(-29.25, 15.25), point(-26.35, 15.25), point(-23.5, 15.25),
      point(-32.1, 18.5), point(-29.25, 18.5), point(-26.35, 18.5), point(-23.5, 18.5),
      point(-32.1, 21.75), point(-29.25, 21.75), point(-26.35, 21.75), point(-23.5, 21.75)
    ]
  },
  trails: {
    mainFarmRoad: { label: 'Main farm road', width: 3.2, points: [point(-50,-18),point(-43,-18),point(-36,-17),point(-29,-14),point(-22,-10),point(-15,-5),point(-8,0),point(-1,4),point(6,7),point(13,10),point(20,13),point(27,16),point(33,18)] },
    homeSpur: { label: 'Home spur', width: 2.8, points: [point(-39,-9),point(-40,3),point(-41,15),point(-42,22),point(-44,29),point(-46,36.3)] },
    fieldSpur: { label: 'Field spur', width: 2.6, points: [point(-42,22),point(-39,22),point(-36.4,20.3),point(-34.8,18.5)] },
    storySpur: { label: 'Story spur', width: 2.6, points: [point(6,7),point(4,13),point(2,19),point(0,24.5)] },
    millSpur: { label: 'Mill spur', width: 3, points: [point(11,1),point(17,-10),point(24,-20),point(32,-27),point(38,-23)] },
    villageSpur: { label: 'Village spur', width: 3, points: [point(16,19),point(23,25),point(31,30),point(39,34)] }
  },
  interactionAprons: {
    barnBoard: { center: point(-34.7, -20.4), size: 2.4 },
    farmhouseDoor: { center: point(-46, 35.1), size: 2.4 },
    fieldGate: { center: point(-34.8, 18.5), size: 2.6 },
    fieldTrough: { center: point(-22.7, 15), size: 2.4 },
    shippingBasket: { center: point(-22.65, 18.85), size: 2.4 },
    storyStone: { center: point(0, 24.5), size: 2.4 },
    pondWest: { center: point(27, 19), size: 2.4 },
    millDoor: { center: point(38, -23), size: 3 },
    hamletMarket: { center: point(39, 34), size: 3 }
  },
  npcSchedules: {
    dad: { label: 'Dad', speed: 0.6, anchors: [point(-31,-17),point(-35.8,20),point(-39,-19),point(-43.2,34.7)] },
    pip: { label: 'Pip', speed: 0.42, anchors: [point(27,19),point(25,14),point(28,27),point(27,19)] },
    blaze: { label: 'Blaze', speed: 1.15, anchors: [point(5,7),point(16,11),point(-4,3),point(12,-1)] },
    hazel: { label: 'Hazel', speed: 0.52, anchors: [point(-49,-22),point(-36,-18),point(-36,17),point(-49,-22)] },
    tortoise: { label: 'Tortoise', speed: 0.2, anchors: [point(-5,22),point(-8,27),point(-2,20),point(-5,22)] }
  },
  chapterAnchors: {
    petals: [
      { id:'petal-1', center:point(18,13) },
      { id:'petal-2', center:point(43,19) },
      { id:'petal-3', center:point(28,32) }
    ],
    shards: [
      { id:'shard-1', center:point(-8,25) },
      { id:'shard-2', center:point(24,-6) },
      { id:'shard-3', center:point(10,-23) }
    ],
    boss: point(44,-24),
    keepsakes: [
      { id:'keepsake-bell', label:'Old sheep bell', center:point(-53,-8) },
      { id:'keepsake-button', label:'Carved wooden button', center:point(-17,37) },
      { id:'keepsake-feather', label:'Blue mountain feather', center:point(16,36) },
      { id:'keepsake-marble', label:'Sunset glass marble', center:point(53,5) },
      { id:'keepsake-tag', label:'Faded dog tag', center:point(-21,-39) },
      { id:'keepsake-ribbon', label:'Festival ribbon', center:point(46,38) },
      { id:'keepsake-acorn', label:'Silver-capped acorn', center:point(6,-38) },
      { id:'keepsake-page', label:'Lost storybook page', center:point(30,-12) }
    ]
  },
  minimapIcons: {
    home: point(-46,30), field:point(-27.8,18.5), barn:point(-39,-24),
    storyStone:point(0,27), pond:point(33,18), mill:point(38,-29), village:point(41,34)
  },
  verticalSliceRoute: [
    point(-30,-15), point(-39,-9), point(-42,22), point(-34.8,18.5),
    point(-32.1,18.5), point(-29.25,18.5), point(-46,35.1)
  ],
  exteriorCollisions: [
    rect(-39, -24, 13.5, 9.5),
    rect(-46, 30, 9.4, 7.2),
    rect(38, -29, 11, 9),
    rect(-27, -29, 5.5, 5.5),
    rect(43, 34, 7, 5.5),
    rect(33, 37, 6.5, 5),
    rect(51, 27, 6.5, 5)
  ],
  interior: {
    instanceOrigin: point(166, 0),
    shell: { width: 25, depth: 20, bounds: rect(0, 0, 25, 20) },
    entryDoor: point(0, 9.1),
    spawn: point(0, 7.2),
    exitInteraction: point(0, 8.2),
    centralAisle: rect(0, 0.6, 6, 15.2),
    windows: [point(-6.5, -10), point(0, -10), point(6.5, -10)],
    furniture: {
      fireplace: { label: 'Stone fireplace', center: point(-8.8,-7.8), footprint: rect(-8.8,-7.8,3.4,1.3), interaction: point(-8.8,-6.2) },
      washbasin: { label: 'Washbasin', center: point(-5.2,-7.7), footprint: rect(-5.2,-7.7,2.2,1.5), interaction: point(-5.2,-6.2) },
      kitchen: { label: 'Moonberry kitchen', center: point(-10.7,-0.8), footprint: rect(-10.7,-0.8,1.5,5), interaction: point(-8.8,-0.8) },
      pantry: { label: 'Pantry cabinet', center: point(-10.7,5.5), footprint: rect(-10.7,5.5,1.4,3), interaction: point(-8.8,5.5) },
      bed: { label: 'Fancy dog bed', center: point(6.5,-6.4), footprint: rect(6.5,-6.4,5.2,3.8), interaction: point(6.5,-3.7) },
      wardrobe: { label: 'Collar wardrobe', center: point(10.7,-0.5), footprint: rect(10.7,-0.5,1.5,3.5), interaction: point(8.8,-0.5) },
      desk: { label: 'Writing desk', center: point(7.8,5.6), footprint: rect(7.8,5.6,4.2,1.8), interaction: point(7.8,3.8) },
      shelf: { label: 'Keepsake shelf', center: point(10.8,3.2), footprint: rect(10.8,3.2,1,2.4), interaction: point(9,3.2) },
      bowls: { label: 'Food and water station', center: point(-4.6,7.7), footprint: rect(-4.6,7.7,2.2,1), interaction: point(-4.6,6.6) }
    }
  }
};

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const almostEqual = (a, b, tolerance = 0.001) => Math.abs(a - b) <= tolerance;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const withinRect = (inner, outer) =>
  inner.x - inner.w / 2 >= outer.x - outer.w / 2 &&
  inner.x + inner.w / 2 <= outer.x + outer.w / 2 &&
  inner.z - inner.d / 2 >= outer.z - outer.d / 2 &&
  inner.z + inner.d / 2 <= outer.z + outer.d / 2;
const overlapsRect = (a, b) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;

export function validateMapContract(candidate = map) {
  const errors = [];
  const fail = (condition, message) => { if (!condition) errors.push(message); };
  const { farmhouse } = candidate.landmarks;
  const field = candidate.field;

  fail(distance(farmhouse.center, field.center) >= 21, 'Farmhouse and field centers must remain at least 21 units apart.');
  fail(!overlapsRect(farmhouse.body, field.outerSoil), 'Farmhouse and field footprints must not overlap.');
  fail(almostEqual(field.gate.center.x, -34.8) && almostEqual(field.gate.center.z, 18.5), 'Moonberry gate must remain at (-34.8, 18.5).');
  fail(almostEqual(field.gate.width, 2.6), 'Moonberry gate must remain 2.6 units wide.');
  fail(field.plots.length === 12, 'Moonberry field must contain exactly twelve plots.');
  fail(new Set(field.plots.map(({x,z}) => `${x}:${z}`)).size === 12, 'Moonberry plot coordinates must be unique.');
  fail(field.plots.every(({x,z}) => x > field.fence.minX && x < field.fence.maxX && z > field.fence.minZ && z < field.fence.maxZ), 'Every plot must remain inside the field fence.');
  fail(Object.values(candidate.trails).every(trail => trail.width >= candidate.world.minimumCriticalRouteWidth), 'Every trail must meet the 2.4-unit route-width minimum.');
  fail(distance(candidate.trails.homeSpur.points.at(-1), farmhouse.returnPoint) < 0.01, 'Home spur must terminate at the porch return point.');
  fail(distance(candidate.trails.fieldSpur.points.at(-1), field.gate.center) < 0.01, 'Field spur must terminate at the west gate.');
  fail(Object.values(candidate.interactionAprons).every(apron => apron.size >= 2.4), 'Every exterior interaction apron must be at least 2.4 units wide.');
  fail(Object.values(candidate.npcSchedules).every(schedule => schedule.anchors.length === 4), 'Every NPC schedule must define morning, midday, afternoon, and evening anchors.');
  fail(candidate.chapterAnchors.petals.length === 3 && candidate.chapterAnchors.shards.length === 3, 'Chapter One must retain three petals and three story-light shards.');
  fail(candidate.chapterAnchors.keepsakes.length === 8, 'Sunny Valley must retain all eight hidden keepsakes.');
  fail(Object.values(candidate.interior.furniture).every(item => withinRect(item.footprint, candidate.interior.shell.bounds)), 'Every furniture footprint must remain inside the farmhouse shell.');
  fail(Object.values(candidate.interior.furniture).every(item => !overlapsRect(item.footprint, candidate.interior.centralAisle)), 'Furniture must not enter the locked central aisle.');
  fail(almostEqual(candidate.camera.exteriorOffset.x, 14.8) && almostEqual(candidate.camera.exteriorOffset.z, 21.2), 'Exterior camera orientation must remain southeast-looking-northwest.');
  fail(candidate.camera.projection === 'orthographic', 'Sunny Valley must use one orthographic projection for stable world alignment.');

  return errors;
}

export const SUNNY_VALLEY_MAP = deepFreeze(map);
