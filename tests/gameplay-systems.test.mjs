import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import {
  GARDEN_PHASES,
  advanceGardenOvernight,
  gardenFrameFor,
  migrateGardenPhase,
  simulateFarmhouseFieldLoop
} from '../frog-quest-systems.mjs';

test('legacy saves migrate into the six-phase crop lifecycle', () => {
  assert.deepEqual(
    ['empty', 'seeded', 'growing', 'ready'].map(migrateGardenPhase),
    ['dry', 'planted', 'watered', 'mature']
  );
  assert.deepEqual(GARDEN_PHASES.map(gardenFrameFor), [0, 1, 2, 3, 4, 5]);
});

test('watered and sprouting crops mature overnight while dry plots stay dry', () => {
  assert.deepEqual(
    advanceGardenOvernight(['dry', 'planted', 'watered', 'sprouting', 'mature', 'harvested']),
    ['dry', 'planted', 'mature', 'mature', 'mature', 'dry']
  );
  assert.equal(advanceGardenOvernight(['planted'], { rainy: true })[0], 'sprouting');
});

test('the farmhouse-to-field tutorial loop is deterministic and harvestable', () => {
  const result = simulateFarmhouseFieldLoop();
  assert.deepEqual(result.route, ['porch', 'west gate', 'plot 5', 'farmhouse door', 'fancy bed', 'plot 5']);
  assert.equal(result.day, 2);
  assert.equal(result.berries, 6);
  assert.equal(result.seeds, 4);
  assert.equal(result.garden[4], 'harvested');
  assert.equal(result.garden[5], 'harvested');
});

test('every dedicated Frog action atlas is nontrivial and mapped in code', async () => {
  const source = await readFile(new URL('../frog-quest.js', import.meta.url), 'utf8');
  const atlases = ['sniff-interact', 'bedtime', 'combat', 'farming'];
  for (const name of atlases) {
    const asset = await stat(new URL(`../assets/game/frog/actions/${name}.webp`, import.meta.url));
    assert.ok(asset.size > 25_000, `${name} should be a real alpha animation atlas`);
    assert.match(source, new RegExp(`actions/${name}\\.webp`));
  }
  for (const action of ['sniff', 'interact', 'bark', 'dodge', 'hurt', 'plant', 'water', 'harvest', 'bedtime', 'sleep', 'wake']) {
    assert.match(source, new RegExp(`${action}:\\{key:`));
  }
  assert.doesNotMatch(source, /data\.sprite\.scale\.setScalar\(data\.action === 'bark'/);
});

test('mobile farm HUD and targeting assistance are present', async () => {
  const [source, html, css] = await Promise.all([
    readFile(new URL('../frog-quest.js', import.meta.url), 'utf8'),
    readFile(new URL('../game.html', import.meta.url), 'utf8'),
    readFile(new URL('../frog-quest.css', import.meta.url), 'utf8')
  ]);
  assert.match(source, /assistRadius=window\.innerWidth<700\?4\.2:2\.8/);
  assert.match(source, /navigator\.vibrate/);
  assert.match(html, /data-game-energy/);
  assert.match(html, /data-game-seeds/);
  assert.match(html, /data-game-berries/);
  assert.match(html, /data-game-coins/);
  assert.match(css, /\.game-farm-status/);
});

test('five illustrated valley destinations and their interactions are wired', async () => {
  const source = await readFile(new URL('../frog-quest.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../game.html', import.meta.url), 'utf8');
  const assets = ['barnyard', 'happy-pond', 'story-stone', 'old-mill', 'sunny-hamlet'];
  for (const name of assets) {
    const asset = await stat(new URL(`../assets/game/environment/v3/${name}.webp`, import.meta.url));
    assert.ok(asset.size > 120_000, `${name} should be a substantial alpha zone layer`);
    assert.match(source, new RegExp(`environment/v3/${name}\\.webp`));
  }
  assert.match(source, /createIllustratedWorldZone/);
  assert.match(source, /faceFixedCamera:\s*true/);
  assert.match(source, /axisContract = 'camera-facing-over-xz'/);
  assert.match(source, /depthTest:\s*true/);
  assert.doesNotMatch(
    source.match(/function createIllustratedWorldZone[\s\S]*?\n  }/)[0],
    /depthTest:\s*false/,
    'full-zone illustrations must respect world depth instead of painting over unrelated map areas'
  );
  assert.match(html, /frog-quest\.js\?v=studio-polish-1/);
  assert.match(source, /type:'market'/);
  assert.match(source, /data-market-buy/);
  assert.match(source, /visitedLandmarks/);
  assert.match(source, /WORLD_LANDMARK_IDS = \['barnyard', 'pond', 'story-stone', 'old-mill', 'hamlet'\]/);
  assert.match(source, /markLandmarkVisited\('story-stone'\)/);
  assert.match(source, /markLandmarkVisited\('old-mill'\)/);
  assert.match(source, /Valley places/);
  assert.match(source, /Visit restored mill/);
});
