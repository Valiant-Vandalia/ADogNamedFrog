import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SUNNY_VALLEY_MAP } from '../sunny-valley-map.mjs';
import { FixedStepClock, GridScene, createSunnyValleyRuntime } from '../hm64-grid-engine.mjs';

const runtime = createSunnyValleyRuntime(SUNNY_VALLEY_MAP);

test('world coordinates round-trip through one north-up X/Z grid', () => {
  const scene = runtime.scenes.exterior;
  for (const point of [
    SUNNY_VALLEY_MAP.landmarks.farmhouse.returnPoint,
    SUNNY_VALLEY_MAP.field.gate.center,
    SUNNY_VALLEY_MAP.landmarks.storyStone.approach,
    SUNNY_VALLEY_MAP.landmarks.mill.doorApproach
  ]) {
    const cell = scene.worldToCell(point.x, point.z);
    const center = scene.cellToWorld(cell.column, cell.row);
    assert.ok(Math.abs(center.x - point.x) <= scene.cellSize / 2);
    assert.ok(Math.abs(center.z - point.z) <= scene.cellSize / 2);
  }
  assert.equal(SUNNY_VALLEY_MAP.orientation.north, '-Z');
  assert.equal(SUNNY_VALLEY_MAP.orientation.east, '+X');
});

test('buildings block movement while the Happy Pond bridge remains passable', () => {
  const exterior = runtime.scenes.exterior;
  assert.equal(exterior.isBlocked(-39, -24), true, 'barn footprint must block movement');
  assert.equal(exterior.isBlocked(33, 13), true, 'pond water must block movement');
  assert.equal(exterior.isBlocked(33, 18), false, 'west-east bridge band must remain open');
});

test('critical story and farming routes are reachable on the same grid', () => {
  const exterior = runtime.scenes.exterior;
  const routes = [
    [{ x:-30, z:-15 }, SUNNY_VALLEY_MAP.field.gate.center],
    [SUNNY_VALLEY_MAP.field.gate.center, SUNNY_VALLEY_MAP.landmarks.farmhouse.returnPoint],
    [{ x:-30, z:-15 }, SUNNY_VALLEY_MAP.interactionAprons.pondWest.center],
    [{ x:11, z:1 }, SUNNY_VALLEY_MAP.landmarks.mill.doorApproach],
    [{ x:16, z:19 }, SUNNY_VALLEY_MAP.interactionAprons.hamletMarket.center]
  ];
  for (const [start, destination] of routes) {
    const path = exterior.findPath(start, destination);
    assert.ok(path.length > 0, `${JSON.stringify(start)} should reach ${JSON.stringify(destination)}`);
    assert.ok(path.every((point) => !exterior.isBlocked(point.x, point.z)));
  }
});

test('diagonal pathfinding cannot cut through a blocked corner', () => {
  const scene = new GridScene({
    id:'corner-test', label:'Corner test',
    bounds:{ minX:0, maxX:4, minZ:0, maxZ:4 },
    cellSize:1, playerRadius:.1,
    blockedRects:[
      { x:1.5, z:.5, w:.8, d:.8 },
      { x:.5, z:1.5, w:.8, d:.8 }
    ]
  });
  assert.deepEqual(scene.findPath({ x:.5, z:.5 }, { x:1.5, z:1.5 }), []);
});

test('the farmhouse is a separate scene with its own bounds and collisions', () => {
  const interior = runtime.scenes.interior;
  const origin = SUNNY_VALLEY_MAP.interior.instanceOrigin;
  assert.equal(interior.zoneAt(origin.x, origin.z), "Frog's Farmhouse");
  const bed = SUNNY_VALLEY_MAP.interior.furniture.bed.center;
  assert.equal(interior.isBlocked(origin.x + bed.x, origin.z + bed.z), true);
  const spawn = SUNNY_VALLEY_MAP.interior.spawn;
  assert.equal(interior.isBlocked(origin.x + spawn.x, origin.z + spawn.z), false);
});

test('fixed-step simulation produces the same sixty updates across frame rates', () => {
  const run = (frames) => {
    const clock = new FixedStepClock();
    let updates = 0;
    for (const delta of frames) clock.consume(delta, () => { updates += 1; });
    return updates;
  };
  assert.equal(run(Array(60).fill(1 / 60)), 60);
  assert.equal(run(Array(30).fill(1 / 30)), 60);
  assert.equal(run(Array(15).fill(1 / 15)), 60);
});

test('renderer uses the grid runtime and never mounts full-zone paintings as world panels', async () => {
  const source = await readFile(new URL('../frog-quest.js', import.meta.url), 'utf8');
  assert.match(source, /createSunnyValleyRuntime/);
  assert.match(source, /new THREE\.OrthographicCamera/);
  assert.match(source, /orthographic-xz-world/);
  assert.match(source, /simulationClock\.consume/);
  assert.doesNotMatch(source, /function createIllustratedWorldZone/);
  assert.doesNotMatch(source, /createIllustratedWorldZone\(/);
});
