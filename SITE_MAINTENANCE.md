# Site maintenance record

## 2026-09-15 — Tuesday sales-funnel audit

- Starting commit: `287e4b9f725b362e81c8ff8544258b8a62895067` (`Refocus homepage on book sales funnel`).
- Agent audits: sales strategy, mobile/accessibility, conversion/content, and visual/assets. The homepage had a coherent CTA hierarchy, no measured horizontal overflow, meaningful image alt text, working keyboard/menu behavior, consistent Amazon links, and no machine-local asset paths. The homepage had no public marketing link to `game.html`; the direct route remains publicly reachable and still presents Frog’s Quest.
- Changes: added the verified paperback/Kindle format reassurance beside the hero Amazon CTA; updated all author-contact links in `game.html` to `mailto:joshualanham55@gmail.com`. Game source, tests, and assets were not deleted or otherwise changed.
- Validation: local browser review at desktop width; live custom-domain review; Amazon product-page review; static search for stale email, game links from marketing pages, and machine-local paths; `git diff --check`; 15/15 Node tests; syntax checks for site scripts; live homepage CTA, email, image, and no-horizontal-overflow checks from the audit team.
- Deployment: published to `main` as `796b3f6c545fc8f002ee7e78d587f8d12108aa4e` (`Improve book purchase positioning`). GitHub Actions Pages run `35047296020` completed successfully. Live URL: https://adognamedfrog.com/
- Remaining risks: `/game.html` is still a direct public route with Frog’s Quest promotion, even though the book-only homepage no longer links to it. The homepage’s green eyebrow text is marginally below normal-text contrast, and the mobile hero crop should receive a visual focal-point review.
- Single best next target: decide how to retire or separately gate the public `/game.html` route while preserving its source and assets.


## 2026-09-18 — Friday verification and polish

- Starting commit: `db0fdb80fdc0406f8ee562f68b8ce5cdd0a5a2fb` (`Record Tuesday site audit`).
- Agent audits: product/sales found the homepage book-first but identified the public `/game.html` route as the remaining diversion; mobile/accessibility measured white-on-coral CTA contrast at 2.69:1, found the generic mobile “Buy now” label, and confirmed the skip-link target did not receive focus; conversion/content confirmed consistent Amazon ASIN links, valid Book metadata, correct author email routing, and no Google-review destination in the inspected site; visual/assets confirmed all 12 homepage images loaded from repository-backed paths with descriptive alt text and no local-only references.
- Changes: retired the public `game.html` wrapper with a no-index redirect to the book homepage while leaving game scripts, styles, tests, and assets untouched; darkened the coral CTA token to `#aa4f3d` (white text contrast 5.39:1); changed the mobile sticky label to “Buy on Amazon”; added `tabindex="-1"` to the homepage main landmark.
- Validation: source checks confirmed no game terms or local paths in `index.html`; live custom-domain homepage served the new CTA, email, and metadata; live `/game.html` served only the redirect shell; primary Amazon destinations consistently used ASIN `B0BH33T6S3`; visible homepage image references and asset loading were checked by the visual audit; GitHub Pages workflow run `35384433269` completed successfully.
- Deployment: commit `0b6fb7b396249b1de7a70351a9e3085da13bfc57` (`Improve book CTA accessibility and retire public game route`) published successfully to `https://adognamedfrog.com/`.
- Remaining risks: no verified Google-review destination was present to preserve or add; automated Amazon availability requests were inconclusive; focus-ring contrast and secondary-link touch-area improvements remain.
- Single best next target: fix the remaining keyboard-focus contrast and mobile secondary-link hit-area issues without adding new content.
