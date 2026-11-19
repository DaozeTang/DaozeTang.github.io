# daozetang.github.io

Personal academic homepage of **Daoze Tang**. Built with [Eleventy](https://www.11ty.dev/) and a hand-rolled pixel-art SCSS design system shared with the [blog](https://github.com/DaozeTang/Blog); deployed to GitHub Pages via GitHub Actions on every push to `main` and on a daily schedule that refreshes citation counts.

## Develop

```bash
npm install
npm run serve             # dev server with live reload
npm run build             # production build into _site/
npm run citations:refresh # re-resolve publication citation counts
npm run theme:check       # pixel design-system guard (also runs before build)
python3 scripts/pixel-art.py   # regenerate portrait / emblems / favicon (needs Pillow)
```

## Edit

| What | Where |
| --- | --- |
| Bio, positions, education, awards | `src/data/profile.yml` |
| Social/contact buttons | `src/data/social.yml` |
| Homepage sections on/off | `src/data/display.yml` |
| Papers | `src/content/publications/<year>/*.md` |
| Software copyrights and patents | `src/data/registrations.yml` |
| Recent collaborators | `src/data/collaborators.yml` |
| News (quest log) | `src/content/news/<year>/*.md` |
| Citation counts | `src/data/citations.json` |

Paper front matter: `title`, `date`, `venue`, `selected`, optional `highlight`, `semantic_scholar_id`, `cover`, `authors` (suffix `*` = equal contribution, `#` = corresponding), `links`, `abstract`. News front matter: `title`, `date`, optional `badge`.

`scripts/refresh-citations.js` resolves counts at build time into `src/data/citations.json`, so badges ship in the HTML with no browser request. Semantic Scholar is preferred and OpenAlex (by DOI) seeds uncached papers; the two disagree, so each value sticks to its source and survives it going down. `fetchedAt` records when a count last *changed*, so the cache only diffs on real change. `deploy.yml` deploys on push to `main` and daily at 06:30 UTC: build, fail if badges did not render, then commit the cache back.

## Design system (pixel, 16 colours, no blur)

Same 4px grid, palette and components as the blog. Shared partials (`_tokens`, `_fonts`, `_base`, `_pixel`, `_layout`, `_chrome`, `_ui`, `_prose`, `_animations`, `_responsive`) must stay identical in both repos — `npm run build` refuses to build on drift.

Homepage-only partials: `_hero`, `_horizon`, `_log` (news), `_cart` (publications), `_track` (education, experience, awards), `_team`, `_pages`.

**Signature art.** The hero portrait is a 96×96 pixel study generated from the source photo and snapped to the site palette; a button swaps it for the photograph. The full-bleed horizon strip under the hero is painted by `src/scripts/pixel-scene.js` (8 fps, deterministic, frozen under `prefers-reduced-motion`), with DOM detection boxes labelled `PERSON`, `CAT`, `DRONE`, `BARN`.

**Assets.** `scripts/pixel-art.py` (Pillow) regenerates the pixel portrait, the posterised institution emblems (`*-px.png`, referenced from `src/data/*.yml`), the 16×16 prompt-mark favicon / touch icon, and `src/assets/pixel/og.png` is the 1200×630 social card.

**Type + icons.** Self-hosted `Silkscreen` (8px grid) and `Cubic 11` (12px grid, CJK) from `src/assets/fonts/` (SIL OFL 1.1), body copy in Noto Sans SC, one MIT Pixelarticons sprite in `src/partials/sprite.liquid`.

---

© Daoze Tang · MIT License
