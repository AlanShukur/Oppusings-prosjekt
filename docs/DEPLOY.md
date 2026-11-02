# Deploying Romly: staging and production

Romly can run on your own Cloudflare account as two separate Workers:

| Environment | Worker | Deploys when | Address before you add a domain |
|---|---|---|---|
| Staging | `romly-staging` | Every push or merge to `main` | `romly-staging.<your-subdomain>.workers.dev` |
| Production | `romly` | Only when you start it by hand | `romly.<your-subdomain>.workers.dev` |

Until you add the two secrets below, the Deploy workflow skips and deploys nothing. The existing Sites deployment is unaffected and keeps working.

## One-time setup (about 15 minutes)

1. **Cloudflare account.** Sign up at cloudflare.com. The free plan covers Workers and Workers Logs at this scale.
2. **workers.dev subdomain (once per account).** In the dashboard, open *Workers & Pages* and pick a subdomain when asked, for example `romly`. Your Workers are then served at `<worker>.<subdomain>.workers.dev`. Without it the deploy uploads the Worker but fails at the end with "You need to register a workers.dev subdomain". If you are not asked, go to *Workers & Pages → Account details (right column) → Subdomain → Change*.
3. **Account ID.** In the Cloudflare dashboard, open *Workers & Pages*. Copy the Account ID shown on the right.
4. **API token.** Go to *My Profile → API Tokens → Create Token*, use the **Edit Cloudflare Workers** template and limit it to your account. Copy the token; it is shown only once.
5. **GitHub secrets.** In the GitHub repo, open *Settings → Secrets and variables → Actions → New repository secret* and add:
   - `CLOUDFLARE_API_TOKEN`: the token from step 4
   - `CLOUDFLARE_ACCOUNT_ID`: the ID from step 3
6. **Protect production (recommended).** Open *Settings → Environments → production → Required reviewers* and add yourself. Then every production deploy waits for your approval. The `production` environment appears after the first production run; you can also create it here yourself.

## Deploying

- **Staging:** merge a pull request into `main`. The *Deploy* workflow runs the checks and tests, builds, and deploys to `romly-staging`.
- **Production:** open *Actions → Deploy → Run workflow*, choose `production` and run it. Do this after you have tried the change on staging.
- **Deploying again:** always start a *new* run (*Run workflow*). Don't use *Re-run* on an old Deploy run: it rebuilds that run's original commit, which would put older code back. The workflow refuses such runs and says why.

From your own machine (PowerShell):

```powershell
npm.cmd run build
node scripts/deploy-cloudflare.mjs --env staging --dry-run   # validates without uploading or logging in
$env:CLOUDFLARE_API_TOKEN="..."; $env:CLOUDFLARE_ACCOUNT_ID="..."
npm.cmd run deploy:staging
```

## Your own domain

In Cloudflare, open *Workers & Pages → romly → Settings → Domains & Routes → Add → Custom domain*, for example `romly.no` for production and `staging.romly.no` for staging. The domain must be managed by Cloudflare (or added to it).

## Seeing errors

Both Workers have Workers Logs switched on. Open *Workers & Pages → romly (or romly-staging) → Logs* and search for:

- `Romly client error`: a crash in someone's browser. Includes the error text, the code location, the page and the release, never project content.
- `Romly API request failed`: an unexpected server error.

Each entry is tagged with `env: staging` or `env: production`.

## Before production goes public

- Put the hosting provider's name ("Cloudflare, Inc.") and the log retention period into `lib/company.ts`. The privacy page reads them from there.
- Retire or keep Sites deliberately. Two public copies of the app would keep separate projects per site, because data is stored per web address in the browser.

## When accounts return

The deploy script drops the database (D1) and file storage (R2) bindings, because the studio stores everything in the browser for now. When server storage comes back:

1. Create a D1 database and an R2 bucket per environment.
2. Add their IDs as GitHub variables.
3. Pass them to the deploy step as `ROMLY_D1_DATABASE_ID`, `ROMLY_D1_DATABASE_NAME` and `ROMLY_R2_BUCKET`.
4. Apply the migrations in `drizzle/`.
