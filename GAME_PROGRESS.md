# Frog's Quest production ledger

Last updated: August 5, 2026

## Review milestone: HM64-informed grid-engine rebuild

- [x] Verified that the HM64 decompilation is a research reference, not licensed browser-game source
- [x] Added an original grid runtime with separate exterior and farmhouse scenes
- [x] Centralized collision, zones, interactions, and pathfinding around the frozen map contract
- [x] Replaced perspective framing with one fixed orthographic X/Z camera
- [x] Added a fixed 60-step simulation clock independent of display frame rate
- [x] Prevented diagonal corner cutting and added blocked-tap walkable snapping
- [x] Removed five full-zone perspective paintings from the playable world
- [x] Preserved those paintings in the illustrated atlas
- [x] Added critical-route, pond bridge, scene-boundary, projection, and frame-rate regression tests

### Review status

This engine rebuild is intentionally isolated on a review branch. It is not a
live-site claim or a final art pass. The purpose is to restore a coherent game
world foundation before more region art is integrated. Existing farming,
story, character, mobile, audio, and save systems remain in place.

## Completed milestone: coherent farmhouse daily loop

- [x] Locked Sunny Valley map contract and diagnostic overlay
- [x] Deterministic porch → field → house → bed → harvest system test
- [x] Frog four-direction idle, six-frame walk, and six-frame run art
- [x] Dedicated sniff, interact, bark, dodge, hurt, farming, sleep, and wake art
- [x] Painted farmhouse exterior and complete interior cutaway
- [x] Painted orchard corridor and complete Moonberry field with one west gate
- [x] Six visible crop phases across twelve contract-controlled plots
- [x] Painted directional candidates for Pip, Blaze, Hazel, Tortoise, Gloamlings, and scarecrow
- [x] Matte Dad cutout preserving the existing identity
- [x] Farming particles, sounds, haptics, resource HUD, mobile target assist, and shipping payout
- [x] Asset alpha validation, source checks, gameplay-system tests, and production contact sheet

## Acceptance status

The milestone is integrated and system-tested. Generated art remains a candidate until the user approves it. The cloud browser used for deployment inspection has WebGL disabled, so it cannot provide a rendered gameplay capture. A WebGL-capable desktop and iPhone review remain acceptance checks rather than implementation blockers.

## Next refinement queue

1. User review of the deployed visual language and character identities.
2. Full six-frame directional walks for supporting characters.
3. Separately layered interior furniture for finer depth sorting.
4. Device-captured tuning of sprite scale, camera framing, touch reach, and frame timing.

## Completed milestone: illustrated Sunny Valley destinations

- [x] Painted barnyard with open gathering yard and south approach
- [x] Painted Happy Pond with west bridge, full rim path, and three moonlilies
- [x] Painted Story Stone clearing with open southern approach
- [x] Painted Old Mill Hollow with unobstructed boss arena
- [x] Painted Sunny Valley hamlet with three cottages and open commons
- [x] Barn notice board and pond-overlook interactions
- [x] Contextual pre-boss and restored-mill interactions
- [x] Hamlet market that converts shipping coins into farm supplies and a bed upgrade
- [x] Explicit illustrated-asset fallbacks retain the prior collision world
