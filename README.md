# daozetang.github.io

Personal academic homepage of **Daoze Tang**. Built with [Eleventy](https://www.11ty.dev/) and a hand-rolled SCSS design system; deployed to GitHub Pages via GitHub Actions on every push to `main` and on a daily schedule that refreshes citation counts.

## Develop

```bash
npm install
npm run serve             # dev server with live reload
npm run build             # production build into _site/
npm run citations:refresh # re-resolve publication citation counts
```

## Edit

| What | Where |
| --- | --- |
| Bio, positions, education, awards | `src/data/profile.yml` |
| Social/contact buttons | `src/data/social.yml` |
| Homepage sections on/off | `src/data/display.yml` |
| Papers | `src/content/publications/<year>/*.md` |
| Patents and software copyrights | `src/data/intellectual_property.yml` |
| Recent collaborators | `src/data/collaborators.yml` |
| News | `src/content/news/<year>/*.md` |
| Citation counts | `src/data/citations.json` |

Paper front matter: `title`, `date`, `venue`, `selected`, optional `highlight`, `semantic_scholar_id`, `cover`, `authors` (suffix `*` = equal contribution, `#` = corresponding), `links`, `abstract`. News front matter: `title`, `date`, optional `badge`.

`scripts/refresh-citations.js` resolves counts at build time into `src/data/citations.json`, so badges ship in the HTML with no browser request. Semantic Scholar is preferred and OpenAlex (by DOI) seeds uncached papers; the two disagree, so each value sticks to its source and survives it going down. `fetchedAt` records when a count last *changed*, so the cache only diffs on real change. `deploy.yml` deploys on push to `main` and daily at 06:30 UTC: build, fail if badges did not render, then commit the cache back.

---

© Daoze Tang · MIT License
