import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { SUNNY_VALLEY_MAP, validateMapContract } from '../sunny-valley-map.mjs';

test('Sunny Valley map contract passes every production invariant', () => {
  assert.deepEqual(validateMapContract(SUNNY_VALLEY_MAP), []);
});

test('map data is deeply immutable', () => {
  assert.equal(Object.isFrozen(SUNNY_VALLEY_MAP), true);
  assert.equal(Object.isFrozen(SUNNY_VALLEY_MAP.field.plots), true);
  assert.equal(Object.isFrozen(SUNNY_VALLEY_MAP.interior.furniture.bed), true);
});

test('house, field, gate, plots, and camera remain locked', () => {
  const map = SUNNY_VALLEY_MAP;
  assert.deepEqual(map.landmarks.farmhouse.center, { x: -46, z: 30 });
  assert.deepEqual(map.field.center, { x: -27.8, z: 18.5 });
  assert.deepEqual(map.field.gate.center, { x: -34.8, z: 18.5 });
  assert.equal(map.field.plots.length, 12);
  assert.deepEqual(map.camera.exteriorOffset, { x: 14.8, y: 16.2, z: 21.2 });
  assert.equal(map.camera.projection, 'orthographic');
  assert.equal(map.camera.desktopViewHeight, 24);
});

test('NPCs, story items, and hidden keepsakes are part of the same contract', () => {
  const map = SUNNY_VALLEY_MAP;
  assert.equal(Object.keys(map.npcSchedules).length, 5);
  assert.ok(Object.values(map.npcSchedules).every(schedule => schedule.anchors.length === 4));
  assert.equal(map.chapterAnchors.petals.length, 3);
  assert.equal(map.chapterAnchors.shards.length, 3);
  assert.equal(map.chapterAnchors.keepsakes.length, 8);
  assert.deepEqual(map.interactionAprons.barnBoard.center, { x: -34.7, z: -20.4 });
  assert.deepEqual(map.interactionAprons.pondWest.center, { x: 27, z: 19 });
  assert.deepEqual(map.interactionAprons.hamletMarket.center, { x: 39, z: 34 });
});

test('playable page loads the contract and exposes diagnostics controls', async () => {
  const [source, html, css] = await Promise.all([
    readFile(new URL('../frog-quest.js', import.meta.url), 'utf8'),
    readFile(new URL('../game.html', import.meta.url), 'utf8'),
    readFile(new URL('../frog-quest.css', import.meta.url), 'utf8')
  ]);
  assert.match(source, /from '\.\/sunny-valley-map\.mjs'/);
  assert.match(source, /from '\.\/hm64-grid-engine\.mjs'/);
  assert.match(source, /createDebugOverlay\(\)/);
  assert.match(source, /data-setting-debug/);
  assert.match(html, /data-game-debug/);
  assert.match(css, /\.game-debug-hud/);
});

test('illustrated Frog movement sheets are wired into the playable renderer', async () => {
  const source = await readFile(new URL('../frog-quest.js', import.meta.url), 'utf8');
  for (const direction of ['north', 'south', 'east', 'west']) {
    const path = new URL(`../assets/game/frog/walk-${direction}.webp`, import.meta.url);
    const asset = await stat(path);
    assert.ok(asset.size > 30_000, `${direction} walk sheet should be a real rendered asset`);
    assert.match(source, new RegExp(`walk-${direction}\\.webp`));
    const idlePath = new URL(`../assets/game/frog/idle/${direction}.webp`, import.meta.url);
    const idleAsset = await stat(idlePath);
    assert.ok(idleAsset.size > 4_000, `${direction} idle pose should be a real rendered asset`);
    assert.match(source, new RegExp(`idle/${direction}\\.webp`));
    const runPath = new URL(`../assets/game/frog/run/${direction}.webp`, import.meta.url);
    const runAsset = await stat(runPath);
    assert.ok(runAsset.size > 25_000, `${direction} run sheet should be a real rendered asset`);
    assert.match(source, new RegExp(`run/${direction}\\.webp`));
  }
  assert.match(source, /spriteFrameCount:\s*6/);
  assert.match(source, /const textureSet=running\?data\.spriteTextures\.run:moving\?data\.spriteTextures\.walk:data\.spriteTextures\.idle/);
  assert.match(source, /const actionAtlases=/);
  assert.match(source, /group\.userData\.renderAsset\s*=\s*false/);
  assert.match(source, /Placeholder geometry is showing for diagnostics/);
});

test('vertical-slice environment assets replace visible primitives with explicit fallbacks', async () => {
  const source = await readFile(new URL('../frog-quest.js', import.meta.url), 'utf8');
  const assets = {
    'farmhouse.webp': 70_000,
    'field-gate.webp': 50_000,
    'moonberry-plots.webp': 50_000,
    'fancy-bed.webp': 50_000
  };
  for (const [name, minimumBytes] of Object.entries(assets)) {
    const asset = await stat(new URL(`../assets/game/environment/${name}`, import.meta.url));
    assert.ok(asset.size > minimumBytes, `${name} should be a rendered RGBA asset`);
    assert.match(source, new RegExp(name.replace('.', '\\.')));
  }
  assert.match(source, /setAtlasFrame\(geometry, illustratedFrame, 6\)/);
  assert.match(source, /Placeholder geometry is showing for diagnostics/);
});

test('perspective composition sheets are archived while supporting cast stays connected', async () => {
  const source = await readFile(new URL('../frog-quest.js', import.meta.url), 'utf8');
  for (const name of ['farmhouse-interior', 'moonberry-field', 'orchard-path']) {
    const asset = await stat(new URL(`../assets/game/environment/v2/${name}.webp`, import.meta.url));
    assert.ok(asset.size > 70_000, `${name} should be a substantial alpha asset`);
    assert.doesNotMatch(source, new RegExp(`environment/v2/${name}\\.webp`));
  }
  for (const name of ['pip', 'blaze', 'hazel', 'tortoise', 'gloamling', 'scarecrow']) {
    const asset = await stat(new URL(`../assets/game/characters/directional/${name}.webp`, import.meta.url));
    assert.ok(asset.size > 70_000, `${name} should be a substantial directional sheet`);
  }
  assert.match(source, /characters\/directional\/\$\{name\}\.webp/);
  assert.match(source, /fallback\.visible=true/);
  assert.match(source, /showIllustratedAssetWarning/);
});
