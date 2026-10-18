# Weekly site improvement workflow

This repository supports one evidence-backed maintenance run per week. A run may ship no change when the evidence does not justify one.

## Authority and exclusions

- `A Dog Named Frog (Final Version).pdf`, the final publication covers, and the Book One transcript are the positive story and visual authorities.
- Project Frog Jog, the rejected V3 pilot, sequel experiments, and unapproved game/environment artwork are not marketing authority.
- Preserve the retained game source, tests, and assets. Keep `game.html` as a no-index redirect unless the owner explicitly reopens the public game.
- Do not add prices, review counts, awards, sales claims, testimonials, availability claims, or child-identifying information without current evidence and permission.
- Older Drive collateral may contain stale contact details or claims. Verify every reused fact against current approved sources.
- `PUBLIC_CONTENT_PROVENANCE.md` records approved values, evidence dates, unresolved rights questions, and the line between existing use and approval for new use.

## Weekly sequence

1. Confirm a clean checkout and fetch `origin/main`. Stop rather than overwrite unrelated work.
2. Run `node scripts/check.mjs` locally. Run `node scripts/site-audit.mjs --live` for deployed-route verification.
3. Inspect the live site at narrow-phone and desktop widths, including keyboard navigation and the purchase journey.
4. Use bounded, read-only reviewers for product/CRO, accessibility/performance, SEO, and brand/provenance. Reviewers return evidence; the lead owns edits.
5. Rank findings by impact, confidence, evidence, risk, effort, and churn. Select at most one visitor-facing change and one supporting test/tooling change.
6. Work on a `codex/weekly-site-YYYY-MM-DD` branch. Keep the diff narrowly scoped.
7. Require green deterministic checks, visual review, current claim evidence, and a rollback commit before publishing. `site-files.json` is the complete production allowlist; internal game, test, prompt, and maintenance files must stay out of `_site`.
8. Merge to `main`, wait for the GitHub Pages workflow, run `npm run audit:live`, and confirm the live artifact matches the approved source. Confirm representative internal paths return 404.
9. Append the verified outcome and next target to `SITE_MAINTENANCE.md`.

## No-change and approval rules

- No change is preferable to unsupported cosmetic churn.
- Public claims, new creative direction, new assets, external outreach, paid promotion, permissions changes, deletion, and any revival of a rejected effort require owner approval.
- Mechanical corrections may be proposed autonomously, but production release still requires all validation gates.
- Do not modify the same surface in consecutive weeks unless fixing a regression or following measured evidence.

## Commands

```sh
node scripts/site-audit.mjs
node --test tests/*.test.mjs
node scripts/check.mjs
node scripts/site-audit.mjs --live
```

The CI workflow repeats `npm run check` for every pull request and push to `main`.
