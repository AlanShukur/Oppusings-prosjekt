---
name: romly-studio
description: How Romly's code is laid out and the rules for changing it. Covers the vanilla-JS studio in public/studio (plan editor, 3D, storage, sync, crash reports), the plan data model and units, which files must change together, the Norwegian UI conventions, and the vinext public pages. Use before editing anything in public/studio, app/, components/ or lib/projects-api.mjs.
---

# Working in the Romly code

Romly is a Norwegian renovation planner. The **studio** (`public/studio/`) is a plain ES-module app served as static files, with no framework and no build step; only three.js is bundled, into `public/studio/vendor/`. The **public pages** (`app/`) are vinext (a Vite reimplementation of Next.js) on Cloudflare Workers.

## Studio files

| File | What it owns |
|---|---|
| `app.js` | UI wiring: dialogs, the room and item inspectors, keyboard shortcuts, the projects and storage dialogs, the TEK17 check UI (`FACT_QUESTIONS`, `renderCheckResults`, `downloadReport`), import and export. `window.romly` test hooks are on the last line. |
| `plan.js` | `PlanEditor`: the SVG 2D editor. It holds state, tools (select, pan, room, wall, door, window), viewport and zoom, resize, move and snap, and attaching openings to walls. Exports `exampleOpenings`, `upgradeExamplePlan`, `MAX_ROOMS` and `MAX_ITEMS`. |
| `scene-geometry.js` | Pure geometry: `deriveWalls`, `assignOpenings`, `doorSwing`, `openingOnWall`. 3D, TEK17 and the tests all share it, so fix geometry here, never in a caller. |
| `viewer3d.js` | three.js scene, loaded lazily. |
| `tek17-check.js` | Pure TEK17 engine. Read the **romly-tek17** skill before changing it. |
| `local-store.js` | On-device storage in IndexedDB. It keeps the same contract as the server API: revisions, limits, file sniffing, atomic deletes, `romly-backup-v1` export. |
| `cloud.js` | `ApiError`, the server API client (unused for now), and `ProjectSync` (autosave, revision conflicts, retries). |
| `error-reporter.js` | Sends crash reports to `/api/client-errors`. Bump `RELEASE` when shipping a new sprint. |
| `reference-loader.js` | Imports PDF and image floor plans (pdf.js). |
| CSS | `style.css`, `layout.css`, `projects.css`, `import.css` and `studio-extra.css`. New styles go in `studio-extra.css`. |

## Plan model

- **Scale:** 50 plan units = 1 m. Opening widths, sill heights and ceiling heights are stored in metres.
- **Room:**
  - Fields: `{id, name, type, x, y, w, h, color, width, height, area}`. `w` and `h` are in units; `width` and `height` are in metres; `area` is in m².
  - Optional: `ceilingHeight` and `previousUse` (`'hoveddel'` or `'tilleggsdel'`).
  - Types: `living`, `bedroom`, `bath`, `hall`, `office`, `kitchen`, `dining`, `storage`, `room`.
- **Item:** `{id, type, x, y, rotation}`. Types are `window`, `door`, `plant`, `sofa`, `table`, `bed`, `wall`; walls also have `x2` and `y2`.
  - Doors and windows may also have `width`, `height`, `sillHeight`, `entrance` and `escape`.
  - The default width is 42 units for a door and 70 for a window. An opening attaches to a wall within 24 units.
- **Project facts:** `project.building` and `project.measures` feed the TEK17 check.
- **Format version:** saved plans carry `schemaVersion` (`PLAN_VERSION` in `plan.js`; a missing version means 0, from before versioning).
  - `getState()` stamps the version.
  - `loadState()` and `migratePlan()` upgrade older plans through `MIGRATIONS`.
  - A plan from a newer Romly throws `code: 'plan_too_new'` before anything changes, so it is never opened and overwritten.
- **Wall notes (version 2):** `plan.walls` holds `{key, status, loadBearing}` only for walls that differ from the default (`existing` / `unknown`).
  - **Keys:** a key names the room sides that form the wall (`bed1:left|living:right`), or is `item:<id>` for a drawn partition wall.
  - **Annotated walls:** `deriveWalls` adds `key`, `status` and `loadBearing` to every wall, so 2D, 3D and the TEK17 check read the same values.
  - **Lifetime:** a note survives resizes and moves while the rooms still share the wall. `notify()` drops notes whose wall is gone, and undo brings them back.
  - **Shared keys:** pieces of one room side that face no other room share a key, and so share a note.
  - **Editor API:** `selectWall`, `updateWall` and `wallNote`; `onWallSelect` drives the "Vegg" panel. Room walls are never deleted; `removeSelected` refuses while a wall is selected.

## Things that must change together

- **A new room type:** `ROOM_TYPES` in `plan.js` and `ROOM_TYPES` in `lib/projects-api.mjs`, the `#room-type` `<option>` in `index.html`, and the `STAY` map in `tek17-check.js`.
- **A new room, opening, building or measure field:** add it to the allowlist in `lib/projects-api.mjs` (`ROOM_FIELDS`, `OPENING_FIELDS`, `BUILDING_FIELDS` or `MEASURE_FIELDS`), with a range check and a test in `tests/projects-api.test.mjs`. `validateProjectPayload` silently **drops** unknown fields, so a missing entry loses data once server storage returns.
- **A new wall status or load-bearing value:** update all four places:
  - `WALL_STATUSES` / `LOAD_BEARING` in `scene-geometry.js`;
  - the same sets in `lib/projects-api.mjs`;
  - the `#wall-status` / `#wall-bearing` options in `index.html`;
  - `wallStroke` in `plan.js` and the legend.
- **A new studio JS file:** add `node --check public/studio/<file>.js` to the `check` script in `package.json`.
- **A change to what a saved plan looks like:** bump `PLAN_VERSION` in `plan.js` and in `lib/projects-api.mjs` (a test keeps them equal). Add a `MIGRATIONS` entry that turns the previous version into the new one, and test it in `tests/plan-version.test.mjs`. Teach `PlanEditor.loadState` and the server validator to keep the new fields. Then run `.claude/skills/romly-browser-qa/plan-version.mjs` against the dev server.
- **A change to the project or backup format:** update `validateProjectImport` in `app.js` (JSON import and restore) and `exportAll` in `local-store.js`.
- **A change to storage behaviour:** change `local-store.js` and the server API together, or record why they differ. Their tests are `tests/local-store.test.mjs` and `tests/projects-api.test.mjs`.

## Conventions

- **Match the file you are in.**
  - `app.js` and `plan.js` use a dense one-statement-per-line style with short names.
  - `tek17-check.js`, `local-store.js`, `cloud.js` and `scene-geometry.js` are formatted conventionally.
  - Comments are sparse and explain *why*.
- **UI text is Norwegian bokmål.** Use «» around names in messages ("«Soverom 1» har …").
  - Numbers use a decimal comma. Inputs are `type="text" inputmode="decimal"` and are parsed with `decimal()` in `app.js`.
  - Escape user text with `esc()` when building HTML strings.
- **No sign-in.** Everything is stored on the device. The server code is kept but unused by the studio, so don't delete it: `lib/projects-api.mjs`, `app/api/`, `app/chatgpt-auth.ts`, `db/` and `drizzle/`. Avoid the word "konto" in UI text; say "på denne enheten".
- **Messages:** use `toast(message)`. The toast is a manual popover, so it shows above open dialogs. Don't move it back to a plain fixed element.
- **Hidden elements:** CSS `display` overrides the `hidden` attribute. Follow `.item-properties [hidden]{display:none!important}` in `studio-extra.css` when you add a hidden section.
- **Keyboard shortcuts:** they live in the `keydown` handler near the end of `app.js`. It ignores keys while a dialog is open or focus is in a text field. Single-key actions such as Delete and the arrows also skip focused buttons and links (`onControl`). Keep both guards for new shortcuts.

## Public pages (`app/`, `components/site-chrome.tsx`)

- **Links:** use plain `<a href>`, never `next/link`. vinext 1.0.0-beta.5's `<Link>` does not navigate in production builds (RSC prefetch error), so the ESLint rule is off on purpose. Re-test in a production build before reintroducing it.
- **Company details:** the legal pages read the company name, org number, hosting provider and log retention from `lib/company.ts`. `DraftNotice` shows until `legalReviewed` is true. Never write legal text that claims a review happened.
- **Shared layout:** `SiteHeader`, `SiteFooter`, `LegalPage` and `LegalSection` are in `components/site-chrome.tsx`.

## Tests

- **Running:** `npm test` runs `node --test tests/*.test.mjs`. The server tests use `node:sqlite`.
- **Editor tests without a DOM:** build an editor from a stub element: `new PlanEditor({innerHTML: '', dataset: {}, style: {}, addEventListener() {}})`.
- **Pure modules** import directly.
- **Regressions:** add a test to `tests/editor-regressions.test.mjs` for each editor bug you fix.
- **Browser behaviour:** check it with **romly-browser-qa**.
