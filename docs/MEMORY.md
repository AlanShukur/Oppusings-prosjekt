# Romly working memory

Claude updates this file at the end of every task (see `CLAUDE.md`). Keep it short and current. Put the plan in `docs/SPRINTPLAN.md` and how-to knowledge in skills (`docs/SKILLS.md`), not here.

## Current state (2026-11-02)

- **Done:** Sprint 0 (editor fixes, TEK17 check) and Sprint 1 are merged. Sprint 1 covered:
  - on-device storage, with sign-in removed;
  - landing and legal pages;
  - crash reports;
  - staging and production deploys.
- **Staging:** https://romly-staging.romly.workers.dev. It deploys automatically on every merge to `main`. Last checked 2026-11-04: smoke 13/13, dialogs 35/35, furniture 16/16, plan-version 10/10, walls 17/17 and baseline 15/15 on `main` at `029bce0` (after PR #11).
- **Production:** https://romly.romly.workers.dev has not been deployed yet.
- **Sprint 2 in progress** (`docs/SPRINTPLAN.md`).
  - Step 1 is merged (PR #6): the plan format version and migrations.
  - Step 2 is merged (PR #7): wall notes (existing/new/demolish, load-bearing yes/no/unknown), the "Vegg" panel, 2D and 3D styling and the legend. `PLAN_VERSION = 2`.
  - Step 3 is merged (PR #8). With it, the sprint's acceptance scenario works on staging: TEK17 check rules for marked walls, and a wall list in the project brief.
  - Step 4 is merged (PR #9): the "Dagens planløsning" baseline (`PLAN_VERSION = 3`) and the comparison in `plan-diff.js`.
  - The `app.js` split is merged (PR #10): an entry file plus 18 modules.
  - Step 5 is merged (PR #11): furniture with real sizes, the door hinge flag and the overlap check (`PLAN_VERSION = 4`).
  - Step 6 is split into two PRs.
    - **6a (text and contrast)** is in an open PR (branch `sprint-2-access`).
    - **6b (pinch zoom and keyboard access to the drawing)** comes next, on its own branch after 6a merges.
  - After that come the Playwright tests, which finish Sprint 2. Ask the user whether to run the existing CDP browser checks in CI instead of adding Playwright.
- **Tests:** 180 unit tests (`npm test`). Browser checks in `romly-browser-qa`: `smoke.mjs`, `dialogs.mjs`, `furniture.mjs`, `a11y.mjs`, `plan-version.mjs`, `walls.mjs` and `baseline.mjs`.

## Decisions

- **No accounts for now (2026-11-02).** Projects and files stay in the browser's IndexedDB. The server API, D1/R2 code and ChatGPT sign-in code are kept but unused.
- **Plain `<a>` links on the public pages.** vinext 1.0.0-beta.5's `<Link>` breaks navigation in production builds.
- **Deploys:** staging deploys on merge; production deploys only when the user starts it. Never use "Re-run" on an old Deploy run; a guard step blocks it.
- **TEK17:** the check is indicative only. Ruleset version `2026-11-03`; all sources were verified 01.11.2026, and the DiBK "Innvendig ombygging" page was re-checked 03.11.2026 for the wall rules. The tiltakshaver is responsible.
- **Wall rules (2026-11-03):**
  - **Load-bearing:** a demolished wall marked load-bearing → `soknad` (pbl § 20-1 b, ansvarlige foretak). Load-bearing unknown → `ukjent` on that wall.
  - **Exterior:** a demolished wall that is clearly exterior → facade `advarsel`.
  - **New load-bearing:** a new wall marked load-bearing → `advarsel` only, because DiBK doesn't say this needs an application.
  - **Merged rooms:** a demolished wall between two rooms → `info` that the rooms merge, but the check still assesses them separately.
  - **Questionnaire vs drawing:** the drawing only makes the questionnaire's `bearingWall` answer stricter.
- **Plan format (2026-11-02):** saved plans carry `schemaVersion`, and older ones are migrated on load. A plan from a newer Romly is refused with "Last inn siden på nytt", never opened and overwritten. The server keeps the version and refuses newer ones too.
- **Wall identity (2026-11-02):** a wall is identified by the room sides that form it (`bed1:left|living:right`) or by `item:<id>` for a drawn partition wall, so its note survives resizes and moves. Only non-default notes are stored. A note is dropped when its wall stops existing, and undo restores it. Room walls are never deleted, only marked.
- **Baseline (2026-11-03):** "Dagens planløsning" is a snapshot in `plan.baseline`, and the check compares the plan with it.
  - **Removed walls** keep the snapshot's load-bearing marks. When unknown, the check asks with Ja/Nei buttons, stored on the baseline.
  - **Exterior wall or window/door changes** count as facade changes.
  - **A room less than half a bathroom today** counts as a new bathroom.
  - **A storage room at least half inside a living room or bedroom** counts as a change of use (`soknad`, the existing verified wording).
  - **Stricter only:** the drawing only ever makes questionnaire answers stricter.
- **Studio modules (2026-11-03):** `app.js` is only the entry point.
  - **Shared state:** state that more than one module reassigns lives on the `studio` object in `state.js`.
  - **Startup:** modules attach handlers in `bind…()` functions that `app.js` calls in order, and nothing runs across modules at import time, so the import cycles are safe.
  - **Lint:** ESLint runs `no-undef` and unused-variable errors on `public/studio/**`.
  - **Check script:** `npm run check` checks the whole folder (`scripts/check-syntax.mjs`).
- **Furniture (2026-11-03):** a catalogue of 16 pieces in `furniture.js`, each item storing its own `width` and `depth` in metres (0,2–4 m).
  - **Migration 3→4:** older pieces keep the size they were drawn at, so nobody's drawing changes.
  - **Overlap check:** flags furniture through a standing wall, in a door's sweep, or overlapping other furniture. Touching is fine, and so are a chair under a table and a plant on anything. The result is an outline and a message, never a block.
  - **Doors:** `mirrored` moves the hinge to the other end of the opening. «Slå andre veien» keeps the hinge end, and «Bytt hengselside» moves it. Left/right labels were avoided because Norwegian conventions for which side is "left" differ.
  - **Automatic furniture:** a furnished room drops its automatic furniture, but kitchen and bathroom fittings stay.
- **Readable text (2026-11-04):**
  - **The rule:** no studio text under 11px; every text colour at WCAG AA against its real background; `a11y.mjs` checks both at three widths.
  - **How the fix was made:** a one-off script raised small sizes and darkened failing colours in HSL, keeping each colour's hue so the look stays the same. Three tinted pills were fixed by hand.
  - **Phone header:** the save status gets its own line.
- **Language:** UI text is Norwegian bokmål; docs for the team are in English, except `README.md` and `docs/LEGAL-REVIEW.md`.

## Waiting on the user

- **Merge the step 6a PR** (branch `sprint-2-access`). After merging, verify the staging deploy and run all seven browser checks against staging (`smoke`, `dialogs`, `furniture`, `a11y`, `plan-version`, `walls`, `baseline`), then start 6b.
- **Production deploy:** run *Actions → Deploy → Run workflow → production* as a new run. Optionally add a required reviewer on the `production` environment.
- **Legal:** fill in `lib/company.ts` and get the legal review (`docs/LEGAL-REVIEW.md`). The legal pages show a draft notice until `legalReviewed` is true.
- **Analytics:** decide whether to add any.
- **Old OpenAI Sites copy:** decide whether to keep or retire it.
- **Stale branches:** optionally delete `sprint-0-editor-tek17`, `sprint-1-local-first`, `docs-deploy-subdomain`, `fix-landing-links`, `deploy-guard`, `claude-skills-memory`, `sprint-2-plan-model`, `sprint-2-walls`, `sprint-2-wall-checks` and `sprint-2-baseline`, `sprint-2-split-app` and `sprint-2-furniture`.
- **Open request:** fixing what /usage flagged and moving search agents to a cheaper model needs the /usage output first. Show each change before making it.

## Task log (newest first)

- **2026-11-04:** Sprint 2, step 6a (text and contrast), on branch `sprint-2-access`. Committed and PR opened.
  - **Audit first:** 56% of desktop text (158 of 282) failed WCAG AA, and 200 texts were under 12px, down to 6px.
  - **CSS transform (one-off script):**
    - 258 `font-size` values under 11px raised to 11px;
    - 235 text colours darkened to about 5.3:1 against white, same hue;
    - `color:var(--purple)` changed to `var(--purple-dark)`;
    - three tinted pills fixed by hand.
  - **Phone fix:** the 11px save status ran into the Eksporter button, so the header row now wraps.
  - **Regression check:** new `a11y.mjs` (size, contrast, overlapping text, sideways scrolling; 71 checks over 3 widths). The overlap test was confirmed to catch the header bug with the fix removed.
  - **Results:** all other browser checks pass; 180 of 180 unit tests pass.
  - **Skills:** browser-QA (`a11y.mjs`), studio (the readable-text rule), ship.

- **2026-11-04:** PR #11 (step 5: furniture, hinge, overlap) merged. Deploy run 41736013645 succeeded. On staging: smoke 13/13, dialogs 35/35, furniture 16/16, plan-version 10/10, walls 17/17 and baseline 15/15. Local `main` is at `029bce0`. These memory edits are uncommitted on `main`; they go in with the next branch.

- **2026-11-04:** Sprint 2, step 5, on branch `sprint-2-furniture`. Committed and PR opened.
  - **Furniture:**
    - 16 pieces in `furniture.js`, grouped as Stue, Soverom, Spise og arbeid and Vaskerom, with real sizes.
    - Width and depth are editable in Egenskaper.
    - The Interiør list is built from the catalogue (two columns on phones).
    - New 2D symbols and new 3D shapes (low table, cabinet, wardrobe, round table, chair, washing machine).
  - **Format 4:** `PLAN_VERSION` is 4; migration 3→4 keeps old pieces' drawn sizes, also in the baseline. The server allows the new types (`FURNITURE_TYPES`, kept equal by a test) and the `width`/`depth`/`mirrored` fields.
  - **Doors:** «Bytt hengselside» and «Slå andre veien»; 3D's `doorSwing` honours `mirrored`.
  - **Overlap check:** `furnitureConflicts` in `scene-geometry.js`, shown as a red outline plus a message in Egenskaper.
  - **Automatic furniture:** a room you furnish drops its automatic furniture. A screenshot showed it next to the user's own pieces.
  - **Tests:** 11 new unit tests (`tests/furniture.test.mjs`); 180 of 180 pass. Browser checks: new `furniture.mjs` 16/16, dialogs 35/35, smoke 13/13, plan-version 10/10, walls 17/17, baseline 15/15, phone 4/4.
  - **Skills:** studio (the furniture model and what changes together), browser-QA (`furniture.mjs`), run (3D is bundled at dev-server start, so restart after 3D changes), ship.

- **2026-11-03:** PR #10 (the `app.js` split) merged. Deploy run 41732616837 succeeded, and staging serves the new 29-line `app.js` and the modules. On staging: smoke 13/13, dialogs 35/35, plan-version 10/10, walls 17/17 and baseline 15/15. Local `main` is at `38ed7aa`. These memory edits are uncommitted on `main`; they go in with the next branch.

- **2026-11-03:** Split `app.js` into modules, on branch `sprint-2-split-app`. Committed and PR opened.
  - **How:** the code moved without rewriting, using a one-off script in the scratchpad. The script copied exact line ranges from the committed `app.js`, checked that every line landed once, renamed only the shared state to `studio.…`, and worked out the imports and exports.
  - **Planned changes:**
    - removed three dead variables (`activeTool`, `saveTimer`, `previousProject`);
    - `projectBrief`, `factValue` and `factText` take the project as an argument;
    - `showZoom` replaces two copied zoom-label lines;
    - the insight button calls `openInsight`.
  - **Guards:**
    - ESLint `no-undef` and unused-variable errors on the studio. On its first run this caught three bugs in the split script.
    - `scripts/check-syntax.mjs` replaces the hand-written list in the `check` script.
    - New `tests/brief.test.mjs` (6 tests).
    - New browser check `dialogs.mjs` (35 checks), which passed against staging (the old code) before testing the split.
  - **Results:** 169 of 169 unit tests pass; lint has 0 errors; the build passes.
    - **Dev server:** dialogs 35/35, smoke 13/13, plan-version 10/10, walls 17/17, baseline 15/15, phone tabs 7/7.
    - **Production preview:** dialogs 35/35, smoke 13/13, baseline 15/15.
  - **Skills:** studio (module map and rules), TEK17 (`facts.js`, `brief.js`), browser-QA (`dialogs.mjs`, and test a new check on the old code first), and ship (run the checks for what changed).

- **2026-11-03:** PR #9 (Sprint 2, step 4: "Dagens planløsning") merged. Deploy run 41727121480 succeeded. On staging: smoke 13/13, plan-version 10/10, walls 17/17 and baseline 15/15. Local `main` is at `fcb287c`. These memory edits are uncommitted on `main`; they go in with the next branch.

- **2026-11-03:** Sprint 2, step 4, on branch `sprint-2-baseline`. Committed and PR opened.
  - **Comparison and format:** new `plan-diff.js` (`compareToBaseline`). `PLAN_VERSION` is now 3, with a no-op migration from 2.
  - **Editor:** `setBaseline`, `clearBaseline` and `updateBaselineWall`, plus red dashed ghosts of removed walls.
  - **Server:** the room, element and wall-note checks are refactored into reusable helpers; the baseline is validated with its own id set.
  - **TEK17:** new results "Fjernet bærende vegg", "Var veggen bærende?" (Ja/Nei), "Fjernet yttervegg", "Vinduer og dører i yttervegg", "Bod blir oppholdsrom", and a baseline-derived new bathroom.
  - **UI and brief:** the toolbar button "Lagre dagens planløsning" with its dialog (two-step remove/replace, a toggle for the ghosts). The brief gets a "DAGENS PLANLØSNING" section.
  - **Fix:** `.info-banner` ignored `hidden`; added `.info-banner[hidden]{display:none!important}`.
  - **Tests:** 13 new unit tests (`tests/baseline.test.mjs`); 163 of 163 pass. Browser checks: baseline 15/15, walls 17/17, version 10/10, smoke 13/13, phone 5/5.
  - **Skills:** new `baseline.mjs`; the studio, TEK17 and browser-QA skills are updated.

- **2026-11-03:** PR #8 (Sprint 2, step 3: wall check rules) merged. Deploy run 41724314425 succeeded. On staging: smoke 13/13, plan-version 10/10 and walls 17/17. Local `main` is at `3286854`. These memory edits are uncommitted on `main`; they go in with the next branch.

- **2026-11-03:** Sprint 2, step 3, on branch `sprint-2-wall-checks`. Committed and PR opened.
  - **TEK17 rules for marked walls:** see "Wall rules" above. Ruleset version is now `2026-11-03`.
  - **Check dialog:** "Vis i tegningen" selects the wall for wall results.
  - **Project brief:** a new "ENDRINGER I VEGGER" section.
  - **Tests:** 7 new unit tests; 150 of 150 pass. Browser checks: walls 17/17 (now covering the check dialog and the brief), smoke 13/13, version 10/10.
  - **Skills:** `romly-tek17` now separates the ruleset `version` (bump on any rule change) from `verified` (only after re-checking every source), and covers wall results.

- **2026-11-03:** PR #7 (Sprint 2, step 2: walls) merged. Deploy run 41503938172 succeeded. On staging: smoke 13/13, plan-version 10/10 and walls 14/14. Local `main` is at `93856da`.

- **2026-11-02:** Sprint 2, step 2, on branch `sprint-2-walls`. Committed and PR opened.
  - **Format and editor:** `PLAN_VERSION` is now 2, with migration 1→2 adding `walls: []`. `deriveWalls` gives keys and notes. The editor has wall selection and `updateWall`; notes are pruned in `notify`.
  - **UI:** the "Vegg" panel (Status, Bærende, practical hints only), dashed red for demolished walls, green for new, wider for load-bearing, a legend, and a faint red ghost in 3D.
  - **Server:** validates wall keys and notes.
  - **Tests:** 10 new unit tests (`tests/walls.test.mjs`); 143 of 143 pass. Browser checks: walls 14/14, version 10/10, smoke 13/13, phone layout 5/5.
  - **Skills:** added `walls.mjs` to `romly-browser-qa`; `plan-version.mjs` now checks the migrated `walls` list.

- **2026-11-02:** PR #6 (Sprint 2, step 1) merged.
  - Deploy run 41498589943 succeeded. On staging: smoke test 13/13 and plan-version check 9/9. Local `main` is at `d498876`.
  - The plan-version browser check moved into the `romly-browser-qa` skill as `plan-version.mjs`, reading the version from the page.
  - These edits are uncommitted on `main`; they go in with the step 2 branch.

- **2026-11-02:** Sprint 2, step 1, on branch `sprint-2-plan-model`. Committed and PR opened.
  - **Plan format version:** `PLAN_VERSION`, `migratePlan` and `MIGRATIONS` in `plan.js`; the old example-openings upgrade became migration 0→1. The editor stamps the version and migrates on load. Opening, startup, recovery and import all refuse plans from a newer Romly. The server keeps the version and refuses newer ones.
  - **Fix:** deleting every door and window from an example plan no longer brings them back on reload.
  - **Fix:** toasts now show above open dialogs (manual popover).
  - **Tests:** 7 new unit tests (`tests/plan-version.test.mjs`); 133 of 133 pass. Browser checks: version 9/9, toast placement on desktop and phone, smoke test 13/13.
  - **Skills:** the `romly-browser-qa` example import needed a `file:///` URL on Windows; `romly-studio` now covers plan versions and toasts.
- **2026-11-02:** Confirmed the Stop hook is active. It loads from the parent folder's `.claude/settings.local.json`, because Claude Code starts in `Oppusings-prosjekt`.

- **2026-11-02:** PR #5 merged (skills, memory, Stop hook). Deploy run 41480814783 succeeded, staging smoke test 13/13, local `main` at `2d19c08`. These memory edits are uncommitted on `main`; include them in the next branch.

- **2026-11-02:** Added the Claude Code skills (`romly-run`, `romly-browser-qa` with `smoke.mjs`, `romly-studio`, `romly-tek17`, `romly-ship` with `gh-runs.mjs`, `romly-skill-keeper`). Also added `docs/SKILLS.md`, this file, `CLAUDE.md`, a Stop hook that asks for a memory update, and ESLint ignores for the generated `public/studio/vendor/` and local `.qa/` folders. Smoke test against staging: 13/13. Committed on branch `claude-skills-memory` and opened a PR.
- **2026-11-02:** PR #4 merged: deploy guard against re-running old commits. Staging verified, 16/16.
- **2026-11-02:** PR #3 merged: public-page links fixed (vinext `<Link>` bug); workers.dev subdomain step added to `docs/DEPLOY.md`. The subdomain is `romly.workers.dev`.
- **2026-11-02:** PR #2 merged, Sprint 1: local-first storage, sign-in removed, landing and legal pages, crash reports, staging and production deploy workflow.
- **2026-11-02:** PR #1 merged, Sprint 0: editor fixes, TEK17 engine, regression tests, sprint plan.
