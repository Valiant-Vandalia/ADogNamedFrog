/**
 * Original Sunny Valley runtime inspired by the data-oriented map structure
 * documented by the Harvest Moon 64 reverse-engineering community.
 *
 * This file contains no Harvest Moon 64 source code or game assets. It applies
 * the reusable architectural ideas to Frog's Quest: one ground plane, grid
 * metadata, separate collision/interaction layers, scene-local maps, A* path
 * finding, and a fixed-step simulation clock.
 */

export const FIXED_STEP_SECONDS = 1 / 60;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const keyFor = (column, row) => `${column},${row}`;

const containsRect = (rect, x, z, padding = 0) =>
  x >= rect.x - rect.w / 2 - padding &&
  x <= rect.x + rect.w / 2 + padding &&
  z >= rect.z - rect.d / 2 - padding &&
  z <= rect.z + rect.d / 2 + padding;

const containsEllipse = (ellipse, x, z, padding = 0) => {
  const rx = Math.max(0.01, ellipse.rx + padding);
  const rz = Math.max(0.01, ellipse.rz + padding);
  return ((x - ellipse.x) ** 2) / (rx ** 2) + ((z - ellipse.z) ** 2) / (rz ** 2) <= 1;
};

export class FixedStepClock {
  constructor({ step = FIXED_STEP_SECONDS, maxFrame = 0.1, maxSteps = 8 } = {}) {
    this.step = step;
    this.maxFrame = maxFrame;
    this.maxSteps = maxSteps;
    this.accumulator = 0;
    this.simulationTime = 0;
  }

  reset() {
    this.accumulator = 0;
    this.simulationTime = 0;
  }

  consume(frameDelta, update) {
    this.accumulator += clamp(Number.isFinite(frameDelta) ? frameDelta : 0, 0, this.maxFrame);
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxSteps) {
      this.simulationTime += this.step;
      update(this.step, this.simulationTime);
      this.accumulator -= this.step;
      steps += 1;
    }
    if (steps === this.maxSteps && this.accumulator >= this.step) {
      this.accumulator %= this.step;
    }
    return { steps, alpha: this.accumulator / this.step, simulationTime: this.simulationTime };
  }
}

export class GridScene {
  constructor({
    id,
    label,
    bounds,
    cellSize = 1,
    playerRadius = 0.38,
    blockedRects = [],
    blockedEllipses = [],
    zones = [],
    interactionCells = []
  }) {
    this.id = id;
    this.label = label;
    this.bounds = Object.freeze({ ...bounds });
    this.cellSize = cellSize;
    this.playerRadius = playerRadius;
    this.blockedRects = Object.freeze(blockedRects.map((rect) => Object.freeze({ ...rect })));
    this.blockedEllipses = Object.freeze(blockedEllipses.map((ellipse) => Object.freeze({ ...ellipse })));
    this.zones = Object.freeze(zones.map((zone) => Object.freeze({ ...zone, bounds: Object.freeze({ ...zone.bounds }) })));
    this.interactionCells = Object.freeze(interactionCells.map((interaction) => Object.freeze({ ...interaction })));
    this.columns = Math.ceil((bounds.maxX - bounds.minX) / cellSize);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cellSize);
  }

  containsWorld(x, z, padding = this.playerRadius) {
    return x >= this.bounds.minX + padding && x <= this.bounds.maxX - padding &&
      z >= this.bounds.minZ + padding && z <= this.bounds.maxZ - padding;
  }

  worldToCell(x, z) {
    return {
      column: clamp(Math.floor((x - this.bounds.minX) / this.cellSize), 0, this.columns - 1),
      row: clamp(Math.floor((z - this.bounds.minZ) / this.cellSize), 0, this.rows - 1)
    };
  }

  cellToWorld(column, row) {
    return {
      x: this.bounds.minX + (column + 0.5) * this.cellSize,
      z: this.bounds.minZ + (row + 0.5) * this.cellSize
    };
  }

  isBlocked(x, z, padding = this.playerRadius) {
    if (!this.containsWorld(x, z, padding)) return true;
    if (this.blockedRects.some((rect) => containsRect(rect, x, z, padding))) return true;
    return this.blockedEllipses.some((ellipse) => {
      if (!containsEllipse(ellipse, x, z, padding)) return false;
      if (!ellipse.openBand) return true;
      const axisValue = ellipse.openBand.axis === 'x' ? x : z;
      return axisValue < ellipse.openBand.min || axisValue > ellipse.openBand.max;
    });
  }

  nearestWalkable(x, z, maxRings = 8) {
    const target = this.worldToCell(x, z);
    for (let ring = 0; ring <= maxRings; ring += 1) {
      const candidates = [];
      for (let columnOffset = -ring; columnOffset <= ring; columnOffset += 1) {
        for (let rowOffset = -ring; rowOffset <= ring; rowOffset += 1) {
          if (ring && Math.max(Math.abs(columnOffset), Math.abs(rowOffset)) !== ring) continue;
          const column = target.column + columnOffset;
          const row = target.row + rowOffset;
          if (column < 0 || column >= this.columns || row < 0 || row >= this.rows) continue;
          const point = this.cellToWorld(column, row);
          if (!this.isBlocked(point.x, point.z)) {
            candidates.push({ ...point, distance: Math.hypot(point.x - x, point.z - z) });
          }
        }
      }
      if (candidates.length) {
        candidates.sort((a, b) => a.distance - b.distance);
        return { x: candidates[0].x, z: candidates[0].z };
      }
    }
    return null;
  }

  zoneAt(x, z) {
    const matching = this.zones
      .filter((zone) => containsRect(zone.bounds, x, z))
      .sort((a, b) => (a.bounds.w * a.bounds.d) - (b.bounds.w * b.bounds.d));
    return matching[0]?.label || this.label;
  }

  findPath(start, destination) {
    let safeDestination = this.isBlocked(destination.x, destination.z)
      ? this.nearestWalkable(destination.x, destination.z)
      : destination;
    if (!safeDestination || this.isBlocked(start.x, start.z)) return [];

    const firstGoalCell = this.worldToCell(safeDestination.x, safeDestination.z);
    const firstGoalCenter = this.cellToWorld(firstGoalCell.column, firstGoalCell.row);
    if (this.isBlocked(firstGoalCenter.x, firstGoalCenter.z)) {
      safeDestination = this.nearestWalkable(safeDestination.x, safeDestination.z);
      if (!safeDestination) return [];
    }

    const startCell = this.worldToCell(start.x, start.z);
    const goalCell = this.worldToCell(safeDestination.x, safeDestination.z);
    const directions = [
      [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
      [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2]
    ];
    const startKey = keyFor(startCell.column, startCell.row);
    const frontier = [{ ...startCell, cost: 0, estimate: 0 }];
    const costs = new Map([[startKey, 0]]);
    const parents = new Map();
    const closed = new Set();
    let found = null;
    let iterations = 0;
    const iterationLimit = Math.max(4000, this.columns * this.rows * 4);

    while (frontier.length && iterations < iterationLimit) {
      iterations += 1;
      frontier.sort((a, b) => a.estimate - b.estimate);
      const current = frontier.shift();
      const currentKey = keyFor(current.column, current.row);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      if (current.column === goalCell.column && current.row === goalCell.row) {
        found = current;
        break;
      }

      for (const [columnDelta, rowDelta, stepCost] of directions) {
        const column = current.column + columnDelta;
        const row = current.row + rowDelta;
        if (column < 0 || column >= this.columns || row < 0 || row >= this.rows) continue;
        const point = this.cellToWorld(column, row);
        if (this.isBlocked(point.x, point.z)) continue;

        if (columnDelta && rowDelta) {
          const horizontal = this.cellToWorld(current.column + columnDelta, current.row);
          const vertical = this.cellToWorld(current.column, current.row + rowDelta);
          if (this.isBlocked(horizontal.x, horizontal.z) || this.isBlocked(vertical.x, vertical.z)) continue;
        }

        const nextKey = keyFor(column, row);
        if (closed.has(nextKey)) continue;
        const nextCost = current.cost + stepCost;
        if (nextCost >= (costs.get(nextKey) ?? Infinity)) continue;
        costs.set(nextKey, nextCost);
        parents.set(nextKey, current);
        frontier.push({
          column,
          row,
          cost: nextCost,
          estimate: nextCost + Math.hypot(goalCell.column - column, goalCell.row - row)
        });
      }
    }

    if (!found) return [];
    const reversed = [];
    let cursor = found;
    while (cursor && keyFor(cursor.column, cursor.row) !== startKey) {
      reversed.push(this.cellToWorld(cursor.column, cursor.row));
      cursor = parents.get(keyFor(cursor.column, cursor.row));
    }
    reversed.reverse();

    const simplified = [];
    for (let index = 0; index < reversed.length; index += 1) {
      const point = reversed[index];
      const previous = simplified.at(-1);
      const next = reversed[index + 1];
      if (previous && next) {
        const firstDirection = [Math.sign(point.x - previous.x), Math.sign(point.z - previous.z)];
        const secondDirection = [Math.sign(next.x - point.x), Math.sign(next.z - point.z)];
        if (firstDirection[0] === secondDirection[0] && firstDirection[1] === secondDirection[1]) continue;
      }
      simplified.push(point);
    }
    simplified.push({ x: safeDestination.x, z: safeDestination.z });
    return simplified;
  }
}

export function createSunnyValleyRuntime(map) {
  const exterior = new GridScene({
    id: 'sunny-valley',
    label: 'Wildflower Commons',
    bounds: map.world.bounds,
    cellSize: 1,
    playerRadius: map.world.playerRadius,
    blockedRects: map.exteriorCollisions,
    blockedEllipses: [{
      x: map.landmarks.pond.center.x,
      z: map.landmarks.pond.center.z,
      rx: map.landmarks.pond.rx,
      rz: map.landmarks.pond.rz,
      openBand: {
        axis: 'z',
        min: map.landmarks.pond.bridgeBand.minZ,
        max: map.landmarks.pond.bridgeBand.maxZ
      }
    }],
    zones: Object.entries(map.zones).map(([id, zone]) => ({ id, label: zone.label, bounds: zone.bounds })),
    interactionCells: Object.entries(map.interactionAprons).map(([id, value]) => ({ id, ...value.center, radius: value.size / 2 }))
  });

  const origin = map.interior.instanceOrigin;
  const halfWidth = map.interior.shell.width / 2;
  const halfDepth = map.interior.shell.depth / 2;
  const toWorldRect = (item) => ({
    x: origin.x + item.footprint.x,
    z: origin.z + item.footprint.z,
    w: item.footprint.w,
    d: item.footprint.d
  });
  const interior = new GridScene({
    id: 'frog-farmhouse',
    label: "Frog's Farmhouse",
    bounds: {
      minX: origin.x - halfWidth,
      maxX: origin.x + halfWidth,
      minZ: origin.z - halfDepth,
      maxZ: origin.z + halfDepth
    },
    cellSize: 0.75,
    playerRadius: map.world.playerRadius,
    blockedRects: Object.values(map.interior.furniture).map(toWorldRect),
    zones: [{
      id: 'farmhouse',
      label: "Frog's Farmhouse",
      bounds: { x: origin.x, z: origin.z, w: map.interior.shell.width, d: map.interior.shell.depth }
    }]
  });

  const scenes = Object.freeze({ exterior, interior });
  return Object.freeze({
    scenes,
    scene(inInterior = false) {
      return inInterior ? scenes.interior : scenes.exterior;
    },
    isBlocked(inInterior, x, z) {
      return this.scene(inInterior).isBlocked(x, z);
    },
    zoneAt(inInterior, x, z) {
      return this.scene(inInterior).zoneAt(x, z);
    },
    findPath(inInterior, start, destination) {
      return this.scene(inInterior).findPath(start, destination);
    },
    nearestWalkable(inInterior, x, z) {
      return this.scene(inInterior).nearestWalkable(x, z);
    }
  });
}
