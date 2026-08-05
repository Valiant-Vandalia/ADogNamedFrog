# Frog's Quest illustrated daily loop

Status date: August 5, 2026

Visual authority: `A Dog Named Frog (Final Version).pdf`

## Honest production status

| Asset or system | Status | Evidence | Known limitation |
|---|---|---|---|
| Frog identity, idle, walk, and run | Integrated candidates | Locked turnaround, four idle views, four six-frame walk strips, four six-frame run strips, validated alpha | Not user-approved |
| Frog actions | Integrated candidates | Dedicated sniff, interact, bark, dodge, hurt, plant, water, harvest, bedtime, breathing, and wake atlas frames | Final timing still requires a WebGL-capable device review |
| Farmhouse exterior | Integrated candidate | Flatter painted south-facing house, readable porch and door, explicit load fallback | Door is closed in the art but the porch interaction remains clear |
| Farmhouse interior | Integrated candidate | Full cutaway plate with clear center aisle and every contracted furniture station | Furniture is part of one plate rather than separate depth layers |
| Orchard path | Integrated candidate | Three-tree buffer, lanterns, plantings, and unobstructed house-to-field path | Broader world dressing remains mixed fidelity |
| Moonberry field | Integrated candidate | Complete fence with exactly one west-side gate, northeast trough, east basket, southeast scarecrow | The twelve crops remain separate overlays by design |
| Twelve Moonberry plots | Integrated candidates | Six-state atlas uses dry, planted, watered, sprouting, mature, and harvested frames | Not user-approved |
| Pip, Blaze, Hazel, Tortoise, Gloamling, scarecrow | Integrated candidates | Four-direction, two-pose painted sheets with alpha and load-failure fallback | Two poses per direction, not full six-frame walks |
| Dad | Integrated exception | Existing identity preserved and locally flattened into a matte cutout | Directional regeneration was blocked by the image service; Dad remains one billboarded pose |
| Farming feedback | Integrated | Physical action frames, particles, soil state changes, crop transition, sounds, haptics, resource HUD, shipping payout | Haptics depend on device/browser support |
| Vertical-slice loop | System-tested | Deterministic porch → west gate → plant/water → house → bed → harvest simulation and map contract tests | Cloud browser has WebGL disabled; a rendered device capture remains a user acceptance step |

## Terms used

- Candidate: generated and audited, but not accepted as final series art.
- Integrated: loaded by the game at the contract coordinate.
- System-tested: state, route, asset, and source invariants pass automated checks.
- Device-reviewed: rendered on a WebGL-capable desktop or phone and visually inspected.
- Approved: reviewed and accepted by the user.

No generated item in this package is labeled approved.

## Fail-closed behavior

Illustrated layers load as transparent WebP or PNG assets. Former geometric constructions are hidden. If an illustrated asset fails, the game reveals its old geometry only as a diagnostic fallback and displays an explicit warning instead of silently presenting the placeholder as finished art.

## Implemented interaction loop

1. Leave the farmhouse porch.
2. Follow the unobstructed orchard path.
3. Enter the Moonberry field through the sole west gate.
4. Plant and water two plots with dedicated actions and feedback.
5. Return through the farmhouse entrance.
6. Approach the fancy bed, circle, lie down, sleep, and wake.
7. Return to the field and harvest mature Moonberries.
8. Place berries in the shipping basket and receive the next-morning payout.

## Remaining acceptance work

The code and assets are ready for deployment. Cloud-browser WebGL is unavailable in the current verification environment, so final rendered desktop/iPhone footage and user art approval cannot be claimed by automation. Those are acceptance checks, not missing implementation.
