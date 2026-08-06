# Frog's Quest grid-engine rebuild

Status: review branch, August 5, 2026

## Decision

Frog's Quest does not copy or distribute Harvest Moon 64 code, ROM data, music,
sprites, maps, dialogue, or other assets. The browser game uses original code
and A Dog Named Frog artwork.

The Harvest Moon 64 research projects establish a sound architecture to learn
from:

- The [HM64 decompilation](https://github.com/harvestwhisperer/hm64-decomp)
  documents grid metadata, terrain, interaction indices, core map objects,
  animation scripts, and separate animation metadata. It does not publish a
  reuse license and requires a legally obtained base ROM, so no source or asset
  is copied into this project.
- [Harvest Moon 64: Recompiled](https://github.com/HarvestMoon64Recomp/HarvestMoon64Recomp)
  is GPL-3.0 native-port infrastructure. It also requires the original game and
  targets a native graphics runtime rather than a browser. It is not embedded
  in Frog's Quest.
- [Harvest Moon 2.0](https://github.com/Kenny-Haworth/Harvest-Moon-2.0) is an
  MIT-licensed Godot farming project. Its engine and scene files are not copied
  because Frog's Quest is a Three.js website, but it confirms the value of
  separating farming, clock, weather, inventory, energy, and saves.

## Architecture adopted in original code

| HM64 pattern | Frog's Quest implementation |
| --- | --- |
| Grid metadata maps tile number to grid position | `GridScene` maps every world point to one X/Z cell |
| Terrain, objects, and interaction indices are separate | Frozen map contract, collision shapes, zone bounds, and interaction aprons remain distinct |
| Maps are discrete runtime scenes | Exterior Sunny Valley and farmhouse interior have separate bounds and collision sets |
| Animation scripts are separate from frame metadata | Existing action mappings remain separate from directional sprite atlases |
| Game logic advances in stable ticks | `FixedStepClock` advances gameplay at 60 steps per second |
| Core map objects belong to the map | Buildings and landmarks use contract coordinates, never illustration-relative coordinates |

## Non-negotiable rendering rules

1. All gameplay coordinates are `(x, z)` on one ground plane. `y` is visual
   height only.
2. The camera is orthographic, fixed southeast/above, and cannot rotate.
3. A full perspective painting may appear in the atlas but never masquerade as
   walkable world geometry.
4. World art must be one of: horizontal terrain, an object anchored to a map
   footprint, or a character sprite anchored at its feet.
5. Collision and interactions come from the map contract, never from image
   dimensions.
6. Paths cannot cut diagonally through obstacle corners.
7. Exterior and interior scenes never share collision coordinates, even while
   legacy saves retain the old interior offset during migration.
8. New regions must pass route tests from at least one existing region before
   they can be rendered in the playable world.

## Current migration boundary

This branch changes the engine foundation without deleting finished game
systems. Farming, story progression, NPC schedules, combat, audio, mobile
controls, and saves remain connected. The five large destination paintings are
retained in the in-game atlas but removed from the 3D world. Their eventual
replacements must be collision-aligned terrain and discrete object assets.

## Verification

- Map contract remains deeply immutable.
- Farmhouse, Moonberry field, west gate, twelve plots, trails, story anchors,
  and NPC schedules retain their coordinates.
- Farm-to-field, field-to-home, farm-to-pond, mill, and hamlet routes are tested.
- Pond water blocks movement while the bridge band stays open.
- The same simulated second produces 60 updates at 15, 30, or 60 rendered FPS.
- Source tests prevent full-zone paintings from returning as world billboards.

