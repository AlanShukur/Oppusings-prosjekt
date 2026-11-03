---
name: romly-ship
description: Take a Romly change from working tree to verified on staging, covering branch, local checks, commit, push, the pull request (without the gh CLI), the merge, watching the GitHub Actions deploy, and confirming the live site. Also covers production deploys and deploy failures. Use when the user asks to commit, push, make a PR, deploy, or check a deploy.
---

# Shipping a Romly change

## Repo facts

- **Two repos:** the git repo is `romly/`. The folder above it (`Oppusings-prosjekt/`) is a separate, empty repo. Run every git command inside `romly/`.
- **Remote:** `origin` is `https://github.com/AlanShukur/Oppusings-prosjekt`. The default branch is `main`, and pushes over HTTPS work.
- **No `gh`:** the `gh` CLI is not installed. Don't read git credentials to call the GitHub API: that is credential access, and it has been blocked before.
- **Line endings:** `core.autocrlf=true`, so checked-out files have CRLF line endings. Make edits with the Edit tool. Shell string replacements that assume `\n` silently miss.
- **Ask first:** commit, push or open a PR only when the user asks for it.

## 1. Branch and verify locally

```bash
git switch -c <short-topic-name>            # never commit on main
npm run check && npm test && npm run lint && npm run build
```

- **`check`:** runs `node --check` on each studio and script file. When you add a studio JS file, add it to that script in `package.json`.
- **CI:** `.github/workflows/ci.yml` runs the same checks on each PR.
  - `test` job: check and test without an install.
  - `build` job: `npm ci`, then lint and build.
- **Studio or page changes:** also run the **romly-browser-qa** smoke test against the dev server. If `app/`, `components/` or the build changed, run it against a local production build too (see **romly-run**).

## 2. Commit and push

Write a plain-English commit message about what changed for the user and why. End it with the attribution trailer the harness specifies. Then push:

```bash
git push -u origin <branch>
```

## 3. Open the pull request

Build a prefilled compare URL and open it in the user's browser. They only need to click **Create pull request**.

```bash
node -e "const [b,t,body]=process.argv.slice(1);console.log('https://github.com/AlanShukur/Oppusings-prosjekt/compare/main...'+b+'?quick_pull=1&title='+encodeURIComponent(t)+'&body='+encodeURIComponent(body))" "<branch>" "<title>" "$(cat <scratchpad>/pr-body.md)" > <scratchpad>/pr-url.txt
```

Then open it in PowerShell:

```powershell
Start-Process (Get-Content -Raw "<scratchpad>\pr-url.txt").Trim()
```

- **The body:** write it to a scratchpad file first, not in the shell. Say what changed, why, and how it was verified (tests, browser QA results). End it with the PR attribution line the harness specifies.
- **Length:** keep the URL under about 8,000 characters. If it is longer, shorten the body.

## 4. After the user merges

```bash
git fetch origin --prune && git switch main && git merge --ff-only origin/main
node .claude/skills/romly-ship/gh-runs.mjs            # recent runs; find the Deploy run for the merge commit
node .claude/skills/romly-ship/gh-runs.mjs <run-id>   # its steps
```

- **Wait for the deploy:** a merge to `main` starts **Deploy** to staging (about 1.5 minutes). Use Monitor with a loop on `gh-runs.mjs`, or wait for the user, rather than sleeping.
- **Then verify the live site:**
  ```bash
  node .claude/skills/romly-browser-qa/smoke.mjs https://romly-staging.romly.workers.dev
  ```
  Then run the checks for what the PR changed (`dialogs.mjs`, `walls.mjs`, `baseline.mjs`, `plan-version.mjs`; see **romly-browser-qa**). After a large studio change, run all five.
- **Report the result:** give the run result, the browser-check results, and anything the user should look at.

## Production

- **Who deploys:** production deploys only when the user starts it: *Actions → Deploy → Run workflow → production*. You can open that page for them:
  ```powershell
  Start-Process "https://github.com/AlanShukur/Oppusings-prosjekt/actions/workflows/deploy.yml"
  ```
- **After it finishes:** run the smoke test against `https://romly.romly.workers.dev`.
- **Never "Re-run":** an old Deploy run rebuilds that run's commit and puts old code back. The workflow's "Refuse to deploy an older commit" step now blocks it. Always start a new run.

## When a deploy goes wrong

- **The site shows old code:** check `gh-runs.mjs` for a Deploy run with `attempt 2+` or an older SHA that finished after the good one. That pattern is a re-run of an old deploy.
- **The "Deploy" step failed:**
  - Step logs need a login, so ask the user to paste the end of the log.
  - Known cause: no workers.dev subdomain. The account's subdomain is `romly.workers.dev`.
  - Setup and secrets: see `docs/DEPLOY.md`.
- **Deploy logic:** the deploy script is `scripts/deploy-cloudflare.mjs`. It derives `dist/server/wrangler.<env>.json` with Worker `romly-staging` or `romly` and sets `ROMLY_ENV`. It drops the D1 and R2 bindings unless `ROMLY_D1_*` or `ROMLY_R2_BUCKET` are set. Dry run without uploading: `node scripts/deploy-cloudflare.mjs --env staging --dry-run`.
- **Runtime errors:** look in Cloudflare *Workers & Pages → romly-staging → Logs*. Search `Romly client error` (browser crashes, tagged by `env` and the `RELEASE` from `public/studio/error-reporter.js`) or `Romly API request failed`. Only the user can open that dashboard.
