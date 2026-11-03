# Romly working memory

Claude updates this file at the end of every task (see `CLAUDE.md`). Keep it short and current. Put the plan in `docs/SPRINTPLAN.md` and how-to knowledge in skills (`docs/SKILLS.md`), not here.

## Current state (2026-11-02)

- **Done:** Sprint 0 (editor fixes, TEK17 check) and Sprint 1 are merged. Sprint 1 covered:
  - on-device storage, with sign-in removed;
  - landing and legal pages;
  - crash reports;
  - staging and production deploys.
- **Staging:** https://romly-staging.romly.workers.dev. It deploys automatically on every merge to `main`. Last checked 2026-11-03: smoke 13/13, plan-version 10/10 and walls 17/17 on `main` at `3286854` (after PR #8).
- **Production:** https://romly.romly.workers.dev has not been deployed yet.
- **Sprint 2 in progress** (`docs/SPRINTPLAN.md`).
  - Step 1 is merged (PR #6): the plan format version and migrations.
  - Step 2 is merged (PR #7): wall notes (existing/new/demolish, load-bearing yes/no/unknown), the "Vegg" panel, 2D and 3D styling and the legend. `PLAN_VERSION = 2`.
  - Step 3 is merged (PR #8). With it, the sprint's acceptance scenario works on staging: TEK17 check rules for marked walls, and a wall list in the project brief.
  - Step 4 is in an open PR (branch `sprint-2-baseline`): the "Dagens planløsning" baseline (`PLAN_VERSION = 3`) and the comparison in `plan-diff.js`.
  - Next steps: split `app.js` (about 700 dense lines), then the rest of Sprint 2 in `docs/SPRINTPLAN.md`.
- **Tests:** 163 unit tests (`npm test`). Browser checks in `romly-browser-qa`: `smoke.mjs`, `plan-version.mjs`, `walls.mjs` and `baseline.mjs`.

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
- **Language:** UI text is Norwegian bokmål; docs for the team are in English, except `README.md` and `docs/LEGAL-REVIEW.md`.

## Waiting on the user

- **Merge the Sprint 2, step 4 PR** (branch `sprint-2-baseline`). After merging, verify the staging deploy and run `smoke.mjs`, `plan-version.mjs`, `walls.mjs` and `baseline.mjs` against staging.
- **Choose what's next:** splitting `app.js`, or the production deploy.



- **Production deploy:** run *Actions → Deploy → Run workflow → production* as a new run. Optionally add a required reviewer on the `production` environment.
- **Legal:** fill in `lib/company.ts` and get the legal review (`docs/LEGAL-REVIEW.md`). The legal pages show a draft notice until `legalReviewed` is true.
- **Analytics:** decide whether to add any.
- **Old OpenAI Sites copy:** decide whether to keep or retire it.
- **Stale branches:** optionally delete `sprint-0-editor-tek17`, `sprint-1-local-first`, `docs-deploy-subdomain`, `fix-landing-links` and `deploy-guard`.
- **Open request:** fixing what /usage flagged and moving search agents to a cheaper model needs the /usage output first. Show each change before making it.
- **Stale branches (continued):** `claude-skills-memory`, `sprint-2-plan-model`, `sprint-2-walls` and `sprint-2-wall-checks` can be deleted too.

## Task log (newest first)

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
