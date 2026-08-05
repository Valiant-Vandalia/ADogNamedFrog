import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
});

test('NPCs, story items, and hidden keepsakes are part of the same contract', () => {
  const map = SUNNY_VALLEY_MAP;
  assert.equal(Object.keys(map.npcSchedules).length, 5);
  assert.ok(Object.values(map.npcSchedules).every(schedule => schedule.anchors.length === 4));
  assert.equal(map.chapterAnchors.petals.length, 3);
  assert.equal(map.chapterAnchors.shards.length, 3);
  assert.equal(map.chapterAnchors.keepsakes.length, 8);
});

test('playable page loads the contract and exposes diagnostics controls', async () => {
  const [source, html, css] = await Promise.all([
    readFile(new URL('../frog-quest.js', import.meta.url), 'utf8'),
    readFile(new URL('../game.html', import.meta.url), 'utf8'),
    readFile(new URL('../frog-quest.css', import.meta.url), 'utf8')
  ]);
  assert.match(source, /from '\.\/sunny-valley-map\.mjs'/);
  assert.match(source, /createDebugOverlay\(\)/);
  assert.match(source, /data-setting-debug/);
  assert.match(html, /data-game-debug/);
  assert.match(css, /\.game-debug-hud/);
});
