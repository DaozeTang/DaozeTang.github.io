# daozetang.github.io

Personal academic homepage of **Daoze Tang**. Built with [Eleventy](https://www.11ty.dev/) and a hand-rolled SCSS design system; deployed to GitHub Pages via GitHub Actions on every push to `main`.

## Develop

```bash
npm install
npm run serve   # dev server with live reload
npm run build   # production build into _site/
```

## Edit

| What | Where |
| --- | --- |
| Bio, positions, education, awards | `src/data/profile.yml` |
| Social/contact buttons | `src/data/social.yml` |
| Homepage sections on/off | `src/data/display.yml` |
| Papers | `src/content/publications/<year>/*.md` |
| News | `src/content/news/<year>/*.md` |

Paper front matter: `title`, `date`, `venue`, `selected`, optional `highlight`, `semantic_scholar_id`, `cover`, `authors` (suffix `*` = equal contribution, `#` = corresponding), `links`, `abstract`. News front matter: `title`, `date`, optional `badge`.

---

© Daoze Tang · MIT License
