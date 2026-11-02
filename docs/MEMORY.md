# Romly working memory

Claude updates this file at the end of every task (see `CLAUDE.md`). Keep it short and current. Put the plan in `docs/SPRINTPLAN.md` and how-to knowledge in skills (`docs/SKILLS.md`), not here.

## Current state (2026-11-02)

- **Done:** Sprint 0 (editor fixes, TEK17 check) and Sprint 1 are merged. Sprint 1 covered:
  - on-device storage, with sign-in removed;
  - landing and legal pages;
  - crash reports;
  - staging and production deploys.
- **Staging:** https://romly-staging.romly.workers.dev. It deploys automatically on every merge to `main`. Last checked 2026-11-02: smoke test 13/13 on `main` at `44e77da`.
- **Production:** https://romly.romly.workers.dev has not been deployed yet.
- **Next:** Sprint 2 in `docs/SPRINTPLAN.md` (plan model v2: wall entities with demolish and load-bearing status, a "today's layout" baseline, splitting `app.js`).
- **Tests:** 125 unit tests (`npm test`) and the browser smoke test (`romly-browser-qa`).

## Decisions

- **No accounts for now (2026-11-02).** Projects and files stay in the browser's IndexedDB. The server API, D1/R2 code and ChatGPT sign-in code are kept but unused.
- **Plain `<a>` links on the public pages.** vinext 1.0.0-beta.5's `<Link>` breaks navigation in production builds.
- **Deploys:** staging deploys on merge; production deploys only when the user starts it. Never use "Re-run" on an old Deploy run; a guard step blocks it.
- **TEK17:** the check is indicative only. Ruleset `2026-11-01`, verified 01.11.2026. The tiltakshaver is responsible.
- **Language:** UI text is Norwegian bokmål; docs for the team are in English, except `README.md` and `docs/LEGAL-REVIEW.md`.

## Waiting on the user

- **Production deploy:** run *Actions → Deploy → Run workflow → production* as a new run. Optionally add a required reviewer on the `production` environment.
- **Legal:** fill in `lib/company.ts` and get the legal review (`docs/LEGAL-REVIEW.md`). The legal pages show a draft notice until `legalReviewed` is true.
- **Analytics:** decide whether to add any.
- **Old OpenAI Sites copy:** decide whether to keep or retire it.
- **Stale branches:** optionally delete `sprint-0-editor-tek17`, `sprint-1-local-first`, `docs-deploy-subdomain`, `fix-landing-links` and `deploy-guard`.
- **Open request:** fixing what /usage flagged and moving search agents to a cheaper model needs the /usage output first. Show each change before making it.
- **Merge the open PR:** branch `claude-skills-memory` holds the skills, `CLAUDE.md`, this file, the Stop hook and the ESLint ignores. After merging, open `/hooks` once or restart Claude Code so the hook loads.

## Task log (newest first)

- **2026-11-02:** Added the Claude Code skills (`romly-run`, `romly-browser-qa` with `smoke.mjs`, `romly-studio`, `romly-tek17`, `romly-ship` with `gh-runs.mjs`, `romly-skill-keeper`). Also added `docs/SKILLS.md`, this file, `CLAUDE.md`, a Stop hook that asks for a memory update, and ESLint ignores for the generated `public/studio/vendor/` and local `.qa/` folders. Smoke test against staging: 13/13. Committed on branch `claude-skills-memory` and opened a PR.
- **2026-11-02:** PR #4 merged: deploy guard against re-running old commits. Staging verified, 16/16.
- **2026-11-02:** PR #3 merged: public-page links fixed (vinext `<Link>` bug); workers.dev subdomain step added to `docs/DEPLOY.md`. The subdomain is `romly.workers.dev`.
- **2026-11-02:** PR #2 merged, Sprint 1: local-first storage, sign-in removed, landing and legal pages, crash reports, staging and production deploy workflow.
- **2026-11-02:** PR #1 merged, Sprint 0: editor fixes, TEK17 engine, regression tests, sprint plan.
