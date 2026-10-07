# myWorkSchedule website

The project's home page and documentation, built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build). It's published to GitHub Pages at
<https://harautia.github.io/myWorkSchedule/> on every push to `master`
(`.github/workflows/website.yml`).

```bash
npm install
npm run dev      # http://localhost:4321/myWorkSchedule/
npm run build    # into dist/
```

Pages are Markdown files in `src/content/docs/`; the sidebar is in `astro.config.mjs`.
Use relative links between pages (e.g. `../configuration/`), because the site lives
under `/myWorkSchedule/`.
