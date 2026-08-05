export const GARDEN_PHASES = Object.freeze([
  'dry',
  'planted',
  'watered',
  'sprouting',
  'mature',
  'harvested'
]);

const LEGACY_GARDEN_PHASES = Object.freeze({
  empty: 'dry',
  seeded: 'planted',
  growing: 'watered',
  ready: 'mature'
});

export function migrateGardenPhase(phase) {
  const migrated = LEGACY_GARDEN_PHASES[phase] || phase;
  return GARDEN_PHASES.includes(migrated) ? migrated : 'dry';
}

export function gardenFrameFor(phase) {
  return Math.max(0, GARDEN_PHASES.indexOf(migrateGardenPhase(phase)));
}

export function advanceGardenOvernight(garden, { rainy = false } = {}) {
  return garden.map((rawPhase) => {
    const phase = migrateGardenPhase(rawPhase);
    if (phase === 'planted') return rainy ? 'sprouting' : 'planted';
    if (phase === 'watered' || phase === 'sprouting') return 'mature';
    if (phase === 'harvested') return 'dry';
    return phase;
  });
}

export function simulateFarmhouseFieldLoop() {
  const simulation = {
    route: ['porch', 'west gate', 'plot 5', 'farmhouse door', 'fancy bed', 'plot 5'],
    day: 1,
    seeds: 4,
    berries: 0,
    garden: Array(12).fill('dry')
  };

  [4, 5].forEach((index) => {
    simulation.seeds -= 1;
    simulation.garden[index] = 'planted';
    simulation.garden[index] = 'watered';
  });
  simulation.day += 1;
  simulation.garden = advanceGardenOvernight(simulation.garden);
  [4, 5].forEach((index) => {
    if (simulation.garden[index] !== 'mature') throw new Error(`Plot ${index + 1} failed to mature.`);
    simulation.garden[index] = 'harvested';
    simulation.berries += 3;
    simulation.seeds += 1;
  });
  return simulation;
}
