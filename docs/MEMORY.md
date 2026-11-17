# Romly working memory

Claude updates this file at the end of every task (see `CLAUDE.md`). Keep it short and current. Put the plan in `docs/SPRINTPLAN.md` and how-to knowledge in skills (`docs/SKILLS.md`), not here.

## Current state (2026-11-17)

- **Done:** Sprint 0 (editor fixes, TEK17 check) and Sprint 1 are merged. Sprint 1 covered:
  - on-device storage, with sign-in removed;
  - landing and legal pages;
  - crash reports;
  - staging and production deploys.
- **Staging:** https://romly-staging.romly.workers.dev. It deploys automatically on every merge to `main`. Last checked 2026-11-16: smoke 13/13, dialogs 35/35, furniture 16/16, a11y 71/71, touch-keyboard 21/21, plan-version 10/10, walls 17/17 and baseline 15/15 on `main` at `620a4cd` (after PR #14).
- **Production:** https://romly.romly.workers.dev has not been deployed yet.
- **Sprint 2 is complete** (`docs/SPRINTPLAN.md`):
  - Step 1 is merged (PR #6): the plan format version and migrations.
  - Step 2 is merged (PR #7): wall notes (existing/new/demolish, load-bearing yes/no/unknown), the "Vegg" panel, 2D and 3D styling and the legend. `PLAN_VERSION = 2`.
  - Step 3 is merged (PR #8). With it, the sprint's acceptance scenario works on staging: TEK17 check rules for marked walls, and a wall list in the project brief.
  - Step 4 is merged (PR #9): the "Dagens planløsning" baseline (`PLAN_VERSION = 3`) and the comparison in `plan-diff.js`.
  - The `app.js` split is merged (PR #10): an entry file plus 18 modules.
  - Step 5 is merged (PR #11): furniture with real sizes, the door hinge flag and the overlap check (`PLAN_VERSION = 4`).
  - Step 6 is split into two PRs.
    - **6a (text and contrast)** is merged (PR #12).
    - **6b (pinch zoom and keyboard access to the drawing)** is merged (PR #13).
  - Step 7 (browser tests in CI, plus Playwright) is merged (PR #14). CI now runs the browser checks and Playwright on every PR.
- **Sprint 3 is the roadmap to "Send søknad"** (added by the user 16.11.2026; AI interpretation moved to Sprint 4). All three steps (logic, start screen, hand-off) are in an open PR (branch `sprint-3-roadmap`).
- **Tests:** 194 unit tests (`npm test`); 30 Playwright tests (`npm run test:e2e`). Browser checks in `romly-browser-qa`: `smoke.mjs`, `dialogs.mjs`, `roadmap.mjs`, `furniture.mjs`, `a11y.mjs`, `touch-keyboard.mjs`, `plan-version.mjs`, `walls.mjs` and `baseline.mjs`.

## Decisions

- **Roadmap (2026-11-16):** the user's answers for Sprint 3.
  - **Placement:** the project start screen in the studio.
  - **Final step:** "Send søknad" is a hand-off (documents plus a link to where applications are submitted); Romly sends nothing.
  - **Branch:** the chart splits after the check into "krever trolig søknad" and "ser ikke ut til å kreve søknad".
  - **Completion:** automatic where Romly can see it, manual ticks for steps outside Romly.
- **Browser tests (2026-11-16):** the user chose both options.
  - **Chrome checks:** the eight CDP checks run in CI through `npm run test:browser` against the production build.
  - **Playwright:** `npm run test:e2e` covers pointer, keyboard and touch in Chromium, Firefox and WebKit. It is pinned to 1.64.1, chosen because it was more than two weeks old.
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

- **Merge the Sprint 3 PR** (branch `sprint-3-roadmap`) once CI is green. After merging, verify staging with `npm run test:browser -- https://romly-staging.romly.workers.dev`. The production deploy is still open and user-run.
- **The four-step bar** (Grunnlag → Prosjektkontroll) overlaps with the roadmap. Decide whether to keep it once you have seen the roadmap.
- **Production deploy:** run *Actions → Deploy → Run workflow → production* as a new run. Optionally add a required reviewer on the `production` environment.
- **Legal:** fill in `lib/company.ts` and get the legal review (`docs/LEGAL-REVIEW.md`). The legal pages show a draft notice until `legalReviewed` is true.
- **Analytics:** decide whether to add any.
- **Old OpenAI Sites copy:** decide whether to keep or retire it.
- **Stale branches:** optionally delete `sprint-0-editor-tek17`, `sprint-1-local-first`, `docs-deploy-subdomain`, `fix-landing-links`, `deploy-guard`, `claude-skills-memory`, `sprint-2-plan-model`, `sprint-2-walls`, `sprint-2-wall-checks` and `sprint-2-baseline`, `sprint-2-split-app` and `sprint-2-furniture`.
- **Open request:** fixing what /usage flagged and moving search agents to a cheaper model needs the /usage output first. Show each change before making it.

## Task log (newest first)

- **2026-11-17:** Sprint 3, the roadmap to "Send søknad", all three steps on branch `sprint-3-roadmap`. Committed and PR opened.
  - **Sources:** DiBK's "Send nabovarsel" and "Stegene fra idé til ferdig søknad" pages, checked 16.11.2026: neighbours are notified before applying with at least two weeks' deadline; the receipt goes with the application; larger projects need ansvarlige foretak, and then the ansvarlig søker sends the application.
  - **Logic:** `roadmap.js` (`buildRoadmap`, `roadmapBranch`), with 8 unit tests. The check marks its exemption result `{exempt: true}`; `project.roadmap` stores the ticks, and the server allows them.
  - **Start screen:** `roadmap-ui.js`. A project opens on «Veien til søknad»; the header button shows "Veikart · n av m"; each step has a button to the right place; the manual ticks are checkboxes. The branch not taken is dashed and marked «Ikke aktuelt nå».
  - **Hand-off:** «Send søknad» offers the brief and the drawing, a checklist, the DiBK links, and a «Søknaden er sendt» tick. Romly sends nothing.
  - **Changed first-run flow:** creating a project opens the roadmap, not Grunnlag. Six browser checks and the Playwright helper were updated.
  - **Bug found by the browser check:** ticks from one branch showed as done on the other branch after a switch; fixed and covered by a unit test.
  - **Tests:** 194 of 194 unit tests; browser checks all pass, with the new `roadmap.mjs` 23/23 and `a11y` 95/95 (now also auditing the roadmap and hand-off); Playwright 29 passed and 1 skipped, with the new `e2e/roadmap.spec.mjs` in three engines.

- **2026-11-16:** Planned Sprint 3, the roadmap to "Send søknad", after four questions to the user. `docs/SPRINTPLAN.md` has the new Sprint 3 with decisions, steps and acceptance; the later sprints are renumbered 4 to 7. No code yet.

- **2026-11-16:** PR #14 (step 7: browser tests in CI and Playwright) merged. **Sprint 2 is complete.**
  - **Staging:** it serves the PR's CSS fix, and all eight browser checks pass there (`npm run test:browser -- <staging URL>`). Local `main` is at `620a4cd`.
  - **Rate limit:** polling `gh-runs.mjs` every 15 seconds across three CI runs used up GitHub's 60 anonymous requests per hour, so the deploy run's status could not be read; staging was verified by its content instead. Poll every 30 to 60 seconds.
  - **Status:** these edits are uncommitted on `main`; they go in with the next branch.

- **2026-11-16:** Sprint 2, step 7, on branch `sprint-2-browser-ci`. Committed and PR opened.
  - **Runner:** `scripts/browser-checks.mjs` serves the production build, runs the eight checks and stops the server. Locally: 8 of 8 pass.
  - **Playwright:** `e2e/pointer.spec.mjs` (6 tests × 3 engines) and `e2e/touch.spec.mjs` (3 tests × 2 phones). Locally: 23 pass, 1 skipped by design (single-finger drag needs a real touch point, Chromium only), three runs in a row.
  - **CI:** new "Browser checks" job in `ci.yml`. Not yet proven on GitHub's Linux runners; the PR run is the first.
  - **Lockfile:** npm re-indented all of `package-lock.json`; the formatting was restored so the diff is 46 lines.
  - **First CI run failed** in `npm run test:browser` after about 50 seconds. The job log needs a GitHub login, so the runner now writes each failing check as an `::error` annotation, which the public API returns. The Playwright steps now run even when the Chrome checks fail.
  - **Second CI run:** Playwright passed on Linux in all engines, and 7 of 8 Chrome checks passed. `a11y` failed on phone width: Linux's wider font pushed the step label "Prosjektkontroll" into the next step. Reproduced locally by widening the labels 25 %, and fixed in CSS (each step is at least as wide as its label).
  - **Third CI run (43968133849) is green** on commit `6d6dd91`: all three jobs, including "Browser checks". The PR is ready to merge. This log line is uncommitted on the branch and goes in with the next branch.
  - **Stop hook:** it only counts Edit and Write calls, so a `MEMORY.md` update made through a shell script looks like no update. Edit this file with the Edit tool.

- **2026-11-16:** PR #13 (step 6b: pinch zoom and keyboard access) merged.
  - **CI billing lock:** the first CI run failed in 2 seconds with "account is locked due to a billing issue". The user fixed billing; the re-run passed. A job with 0 steps means GitHub did not start it, so read the check-run annotations before suspecting the code.
  - **Staging:** deploy run 43963633137 succeeded. All eight browser checks pass on staging. Local `main` is at `073de28`.
  - **Status:** these memory edits are uncommitted on `main`; they go in with the next branch.

- **2026-11-16:** Sprint 2, step 6b, on branch `sprint-2-touch-keyboard`. Committed and PR opened.
  - **Pinch zoom:** two fingers zoom and pan the 2D drawing. The pinch first undoes whatever the first finger started (a drag, a half-drawn wall or room) and keeps the redo stack.
  - **Keyboard access:**
    - the drawing is a tab stop with instructions;
    - new «Elementer i tegningen» list and «Vegger i rommet» buttons;
    - new keys: N / Shift+N (next element), + and - (zoom);
    - a live region announces selections and placement problems.
  - **Tests:** 6 new unit tests (`tests/touch.test.mjs`); 186 of 186 pass. New `touch-keyboard.mjs` 21/21 with real touch and key events. All other browser checks pass (a11y 71/71 after it learned to skip screen-reader-only text).
  - **Also in this branch:** the QA harness's download block and the ship skill's PowerShell note.

- **2026-11-04:** PR #12 (step 6a: text and contrast) merged. Deploy run 41739261958 succeeded. On staging: smoke 13/13, dialogs 35/35, furniture 16/16, a11y 71/71, plan-version 10/10, walls 17/17 and baseline 15/15, with no files written to Downloads.
  - **Git slip:** the first `git switch main` was refused because of uncommitted edits, and the `;`-chained merge then fast-forwarded `sprint-2-access` instead of `main`. It was fixed with a stash, a switch and resetting the branch pointer; nothing was pushed. The ship skill now says how to chain in PowerShell.
  - **Status:** these edits and the download fix are uncommitted on `main`; they go in with the 6b branch.

- **2026-11-04:** The user found `romly-prosjektbrief (N).txt` files in their Downloads folder.
  - **Cause:** the browser checks clicked download buttons, and headless Chrome saved real copies. There were 26 files: 19 briefs and 7 SVGs, all from QA runs since 03.11 22:38.
  - **Fix:** `qa-harness.mjs` now refuses downloads (`Browser.setDownloadBehavior: deny`). `walls.mjs` still passes 17/17, and nothing new lands in Downloads.
  - **Status:** the fix is uncommitted on `sprint-2-access` and goes in with 6b. The user asked to delete the 26 old files, and they are deleted; no `romly-*` files remain in Downloads.

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
