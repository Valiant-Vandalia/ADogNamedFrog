# Site maintenance record

## 2026-09-15 — Tuesday sales-funnel audit

- Starting commit: `287e4b9f725b362e81c8ff8544258b8a62895067` (`Refocus homepage on book sales funnel`).
- Agent audits: sales strategy, mobile/accessibility, conversion/content, and visual/assets. The homepage had a coherent CTA hierarchy, no measured horizontal overflow, meaningful image alt text, working keyboard/menu behavior, consistent Amazon links, and no machine-local asset paths. The homepage had no public marketing link to `game.html`; the direct route remains publicly reachable and still presents Frog’s Quest.
- Changes: added the verified paperback/Kindle format reassurance beside the hero Amazon CTA; updated all author-contact links in `game.html` to `mailto:joshualanham55@gmail.com`. Game source, tests, and assets were not deleted or otherwise changed.
- Validation: local browser review at desktop width; live custom-domain review; Amazon product-page review; static search for stale email, game links from marketing pages, and machine-local paths; `git diff --check`; 15/15 Node tests; syntax checks for site scripts; live homepage CTA, email, image, and no-horizontal-overflow checks from the audit team.
- Deployment: published to `main` as `796b3f6c545fc8f002ee7e78d587f8d12108aa4e` (`Improve book purchase positioning`). GitHub Actions Pages run `35047296020` completed successfully. Live URL: https://adognamedfrog.com/
- Remaining risks: `/game.html` is still a direct public route with Frog’s Quest promotion, even though the book-only homepage no longer links to it. The homepage’s green eyebrow text is marginally below normal-text contrast, and the mobile hero crop should receive a visual focal-point review.
- Single best next target: decide how to retire or separately gate the public `/game.html` route while preserving its source and assets.
