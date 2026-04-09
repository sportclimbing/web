# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frontend for `ifsc.stream` — a World Climbing (IFSC) events calendar with live stream integration. Built as a fully static Astro site with vanilla JS for client-side interactivity.

## Commands

```bash
npm run dev            # Start Astro dev server (also rebuilds JS + Tailwind)
npm run build          # Full production build (JS minification, Astro, Tailwind)
npm run build:js       # Rebuild JS bundle only (src/js/app/ → public/js/app.js)
npm run build:js:min   # Rebuild + minify JS bundle
npm run build:tailwind # Rebuild Tailwind CSS
npm run preview        # Preview production build
make test              # Run Playwright integration tests (auto-selects Docker or local)
make test-local        # Run tests on host machine
make test-docker       # Run tests in Playwright Docker image
make serve             # Serve dist/ via Caddy on port 8001
npm install --no-package-lock  # Install dependencies
```

After editing any file under `src/js/app/`, regenerate the bundle with `npm run build:js`.

## Architecture

### Rendering Model

- Astro prerenders all pages at build time from `events/*.json` data — no runtime data fetching for core content.
- Client-side JS (`public/js/app.js`) adds interactivity after page load: live/upcoming countdown, filters, modals, navigation.

### Routing

| URL | Source |
|-----|--------|
| `/` | `src/pages/index.astro` |
| `/season/:season/` | `src/pages/season/[season]/index.astro` |
| `/season/:season/event/:eventSlugAndId/` | `src/pages/season/[season]/event/[eventSlugAndId].astro` |
| `/start-list-modals/:season/:eventId.html` | `src/pages/start-list-modals/[season]/[eventId].html.js` |
| `/modals/filters.html`, `/modals/sync.html` | `src/pages/modals/` |

### JavaScript Bundle

Source lives in `src/js/app/`, built by `bin/build-js-bundle.mjs` (esbuild-based concatenation + minification):

- **Entry:** `bootstrap/init.js` — runs on page load, wires all handlers
- **`events/`** — filtering (`filters.js`), rendering/layout (`render-and-layout.js`), DOM state (`state.js`), navigation (`navigation-and-tooltips.js`)
- **`helpers/`** — core utilities (`core.js`), render helpers (`render.js`), modals/start-list (`modals-and-start-list.js`)

State is managed via DOM data attributes and JS closures (no state library). Desktop/mobile split at 800px (`MOBILE_VIEWPORT_MAX_WIDTH_PX` in `src/lib/config.js`).

### Key Source Locations

- `src/components/` — Astro UI components (`CalendarPage.astro`, `EventPage.astro`, `EventCard.astro`, etc.)
- `src/lib/` — Build-time utilities: `events-data.js` (load JSON), `config.js` (constants), `event-pages.js` (URL builders)
- `events/` — Season event data JSON (`seasons.json`, `events_YYYY.json`) — treat as source data
- `bin/` — Node scripts for SEO artifacts, sitemap, and media caching
- `tests/integration/` — Playwright tests
- `public/js/app.js`, `public/css/tailwind.css` — Generated; do not hand-edit
- `dist/` — Generated Astro output; do not hand-edit

## Working Rules

- Edit source in `src/`; never hand-edit `dist/`, `public/js/app.js`, or other generated files.
- Do not introduce new frameworks, build systems, or TypeScript.
- Keep changes consistent with existing style in the touched file; avoid large formatting-only diffs.
- Maintain compatibility with existing Bootstrap and jQuery-based patterns.
- After JS source changes: run `npm run build:js` to regenerate the bundle.
- After data/sitemap changes: regenerate artifacts with the corresponding `bin/` script.
- Keep Playwright tests stable — preserve selectors, modal behavior, filter behavior, and season navigation unless intentionally changing UX.
- Run `npm run build` then `make test` to validate frontend changes end-to-end.
