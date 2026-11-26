# daozetang.github.io

Personal academic homepage of **Daoze Tang**. Built with [Eleventy](https://www.11ty.dev/) and a hand-rolled, false-colour "aerial survey console" SCSS system shared with the [blog](https://github.com/DaozeTang/Blog); deployed to GitHub Pages via GitHub Actions on every push to `main` and on a daily schedule that refreshes citation counts.

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

## Design system — GROUND TRUTH

Both sites share one hand-rolled SCSS core: a **nocturnal low-altitude survey
console**. Daoze's research is object detection in UAV and remote-sensing
imagery of farmland, so the interface takes that world literally — false-colour
orthomosaics, detection plates, coordinate readouts — instead of a paper
console. It still renders on a 4px grid with hard edges, stepped motion,
self-hosted pixel type, no blur and no rounded corners.

The shared partials (`_tokens`, `_fonts`, `_base`, `_pixel`, `_layout`,
`_chrome`, `_ui`, `_prose`, `_animations`, `_responsive`, `_a11y`) must stay
byte-identical in both repos — `npm run build` refuses to build on drift.

**Palette.** A false-colour remote-sensing ramp on a void-blue ground: NDVI
chartreuse (`--accent`) is the primary signal, false-colour magenta
(`--coral`) marks alerts, sensor cyan (`--blue`) carries links and water, and
thermal amber (`--gold`) adds warmth. Light mode is a daylight ortho paper
(pale sand-green) with a deep olive accent. Every colour comes from a token;
body text and micro labels clear WCAG AA in both themes.

**Type.** `Silkscreen` (8px grid) for display and controls, `Cubic 11`
(12px grid) for CJK display and headings, `Noto Sans SC` for body copy,
`VT323` for oversized readouts and indices, and mono for micro labels. Sizes
stay on each face's native grid — the hero name is set at 104 / 88 / 80 / 72 /
44px rather than a fluid interpolation, so the pixel glyphs stay crisp.

**Signature art.** The hero is a live false-colour orthomosaic painted by
`src/scripts/pixel-scene.js` at 8 fps: furrowed plots, a canal, a farmstead,
greenhouses, and a tractor that a DOM tracking box follows along the track.
The plate carries a sensor bar, a scale bar, a north arrow, and a
scene-space reticle that reports `x/y` plus the class under the pointer.
`prefers-reduced-motion` freezes the canvas; the DOM boxes stay put. One
painter is booted per `[data-scene]`, so a page can carry more than one plate
(the blog's cover is the third scene).

**Chrome.** The masthead is a sensor bar (one lit edge, a hairline base, a
segmented scroll gauge). Sections are annotated with a `01/` index, a ticked
leader and a mono aside. Cards are thin plates whose corner brackets close on
hover instead of lifting on a blurred shadow. The theme toggle steps through
night survey → daylight survey → system with a dither shutter; the night
survey is the default.

Homepage-only partials: `_hero`, `_log` (news), `_cart` (publications),
`_track` (education, experience, awards), `_team`, `_pages`.

**Sub-page system.** Every interior page shares the same head: a poster-scale
title block plus a bordered *record stamp* computed from the same data as the
page (VT323 value, year cells, summary rows). Publications are annotated
records with a 4:3 figure window and a spec plate (authors / links /
citations); projects are numbered dossier rows with a working role filter and
a year ledger; registrations are framed certificates with a copyable
registration number; collaborators are ID cards grouped by institution; 404 is
an empty detection window. All counts, stamps and tallies are computed at
build time — no client-side data fetching.

**Accessibility.** Theme colours come from tokens measured at AA contrast;
controls are real `<a>`/`<button>` elements, keyboard reachable, with
`steps()` motion that respects `prefers-reduced-motion`, plus
`prefers-contrast: more` and Windows forced-colours overrides. `overflow-x:
clip` (not `hidden`) keeps `position: sticky` working in Safari. Fonts are only
sized on their pixel grids.

---

© Daoze Tang · MIT License
