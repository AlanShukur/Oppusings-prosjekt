// Deploy the built Worker to your own Cloudflare account as staging or production.
//
//   npm run build
//   node scripts/deploy-cloudflare.mjs --env staging [--dry-run]
//
// Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (not for --dry-run). See docs/DEPLOY.md.
// The studio keeps projects on the device, so the D1/R2 placeholders from the Sites build are
// dropped. Set ROMLY_D1_DATABASE_ID / ROMLY_D1_DATABASE_NAME and ROMLY_R2_BUCKET to keep real
// bindings once accounts and server storage return.
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ENVIRONMENTS = {
  staging: { name: "romly-staging" },
  production: { name: "romly" },
};
const PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

const args = process.argv.slice(2);
const env = args[args.indexOf("--env") + 1];
const dryRun = args.includes("--dry-run");
if (!args.includes("--env") || !ENVIRONMENTS[env]) {
  console.error("Bruk: node scripts/deploy-cloudflare.mjs --env staging|production [--dry-run]");
  process.exit(2);
}

const source = new URL("../dist/server/wrangler.json", import.meta.url);
let config;
try {
  config = JSON.parse(await readFile(source, "utf8"));
} catch {
  console.error("Fant ikke dist/server/wrangler.json. Kjør `npm run build` først.");
  process.exit(1);
}

const { name } = ENVIRONMENTS[env];
const d1Id = process.env.ROMLY_D1_DATABASE_ID;
const r2Bucket = process.env.ROMLY_R2_BUCKET;
const derived = {
  ...config,
  name,
  topLevelName: name,
  vars: { ...config.vars, ROMLY_ENV: env },
  // Workers Logs: console output, including studio crash reports, is searchable in the dashboard.
  observability: { enabled: true },
  d1_databases: d1Id && d1Id !== PLACEHOLDER_DATABASE_ID
    ? [{ binding: "DB", database_name: process.env.ROMLY_D1_DATABASE_NAME || `${name}-db`, database_id: d1Id }]
    : [],
  r2_buckets: r2Bucket ? [{ binding: "BUCKET", bucket_name: r2Bucket }] : [],
};

const target = new URL(`../dist/server/wrangler.${env}.json`, import.meta.url);
await writeFile(target, JSON.stringify(derived, null, 2) + "\n");

if (!dryRun && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
  console.error("CLOUDFLARE_API_TOKEN og CLOUDFLARE_ACCOUNT_ID må være satt. Se docs/DEPLOY.md.");
  process.exit(1);
}

console.log(`${dryRun ? "Tørrkjøring" : "Publiserer"}: ${name} (${env})${derived.d1_databases.length ? " med D1" : ""}${derived.r2_buckets.length ? " med R2" : ""}`);
// Same wrapper as `npm start`: project-local Wrangler paths, metrics off.
const sitesEnv = new URL("./sites-env.mjs", import.meta.url).href; // --import needs a URL on Windows
const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const result = spawnSync(process.execPath, ["--import", sitesEnv, wrangler, "deploy", "--config", fileURLToPath(target), ...(dryRun ? ["--dry-run"] : [])], { stdio: "inherit" });
process.exit(result.status ?? 1);
