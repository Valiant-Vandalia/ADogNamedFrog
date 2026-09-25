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

## 2026-09-25 — Friday verification and polish

- Starting commit: `1ee302381b979faf9f6327be60a8644078a9dcd6` (`Bring hero purchase CTA above fold`). The Tuesday hero scale and game-era copy removal were confirmed live through successful Pages run `35733008377`.
- Agent audits: product/sales confirmed a coherent Amazon journey and recommended making the hero cover an optional purchase path; mobile/accessibility found the gold-only focus indicator below the 3:1 visibility threshold across key backgrounds; conversion/SEO verified consistent Amazon ASIN, Gmail routing, metadata, and WSAZ proof while finding no verified Google-review destination; visual/assets confirmed all homepage images load from repository paths and identified four inaccurate intrinsic-dimension declarations.
- Changes: replaced the gold-only focus outline with a two-color white and deep-green focus indicator that remains visible on light, dark, image, and CTA backgrounds; refreshed the stylesheet cache key. No content, imagery, Amazon destination, or game-engine file changed.
- Validation: `git show --check`; JavaScript syntax check; 15/15 Node tests; live keyboard traversal; calculated focus-component contrasts of 11.75:1 or better on light surfaces and 4.55:1 or better on dark/colored surfaces; desktop hero CTA above the fold with no horizontal overflow; mobile breakpoint review at 320–390px; all 15 internal resources returned successfully; all 12 rendered images loaded with no broken sources; WSAZ returned HTTP 200; Amazon links consistently use ASIN `B0BH33T6S3`; both author links use `mailto:joshualanham55@gmail.com`.
- Fishing-game exclusion: the homepage contains no game term, link, section, or CTA; `/game.html` remains a no-index redirect to the book homepage; game scripts, styles, tests, and assets were untouched.
- Deployment: functional commit `5e483d32363b2ee16494068b1ce4c7e0b714a266` (`Improve keyboard focus visibility`) published successfully through GitHub Pages run `36177998453`. Live URL: https://adognamedfrog.com/
- Remaining risks: the mobile sticky CTA supporting text is very small and marginally below normal-text contrast; four image dimension attributes do not match intrinsic pixel sizes, though their ratios match and cause no current shift; the early WSAZ proof is not linked; no verified Google-review destination is available; automated Amazon availability requests remain inconclusive.
- Single best next target: link the early WSAZ Bookmark Monday proof directly to the verified feature so parents can validate the trust signal before reaching the purchase decision.
