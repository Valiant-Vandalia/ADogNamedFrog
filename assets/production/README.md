# Frog's Quest illustrated vertical slice

Status date: August 5, 2026

Visual authority: `A Dog Named Frog (Final Version).pdf`

## Honest production status

| Asset group | Status | Evidence | Known limitation |
|---|---|---|---|
| Frog five-view model | Integrated identity anchor | Five consistent views, stable markings, four neutral idle cutouts | Not user-approved yet |
| Frog north, south, east, west walk cycles | Integrated | Six distinct gait frames per direction, RGBA validation, automated source and file tests | In-browser motion still requires final user review |
| Farmhouse exterior | Integrated candidate | Fixed southeast view, south-facing readable entrance, transparent asset and failure fallback | Still somewhat more dimensional than Book One |
| West Moonberry gate | Integrated candidate | Open passage, locked map coordinate, transparent asset and failure fallback | Adjacent perimeter fence remains placeholder geometry |
| Moonberry plots | Integrated candidate | One shared six-state texture atlas, per-plot UV selection, twelve contract positions | Current mechanics use four of the six illustrated states |
| Fancy bed | Integrated candidate | Transparent asset at the locked bed coordinate with collision preserved | Bed entry, circling, sleep, and wake still need dedicated sprite frames |
| Other farmhouse furniture | Placeholder | Existing interactions and collisions remain functional | Visible primitives remain |
| NPCs and most world objects | Placeholder | Existing mechanics remain functional | Visible primitives remain |

## Terms used

- Candidate: generated and audited, but not accepted as final series art.
- Integrated: loaded by the game at the contract coordinate.
- Playtested: exercised in the browser through the intended interaction.
- Approved: reviewed and accepted by the user.

No item in this package is labeled approved.

## Fail-closed behavior

The visible player and new environment layers load transparent WebP assets. Their former geometric constructions are hidden. If a rendered asset fails to load, the game reveals the old geometry only as a diagnostic fallback and displays an explicit warning.

## Remaining quality gates

1. Record and inspect the four-direction walk in the live build.
2. Produce sniff, bark, interact, bed entry, circling, sleep, wake, and stretch frames.
3. Replace the interior plate and remaining furniture with separate illustrated assets.
4. Replace visible field fencing, trough, basket, and scarecrow.
5. Replace NPC and broader world primitives.
6. Complete desktop and iPhone playtests of the farmhouse-to-field daily loop.
