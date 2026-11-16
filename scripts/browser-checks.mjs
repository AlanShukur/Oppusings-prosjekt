// `npm run test:browser`: runs every browser check in .claude/skills/romly-browser-qa against a production build.
// With a URL it tests that site instead: `npm run test:browser -- https://romly-staging.romly.workers.dev`.
// Without one it serves dist/ locally (run `npm run build` first) and stops the server when the checks are done.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CHECKS = ['smoke', 'dialogs', 'furniture', 'a11y', 'touch-keyboard', 'plan-version', 'walls', 'baseline'];
const port = 8791;
let base = process.argv[2], server = null;

function stopServer() {
  if (!server) return;
  // The server is npm → node → wrangler → workerd, so stop the whole tree.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ } }
  server = null;
}

if (!base) {
  if (!existsSync('dist/server/wrangler.json')) { console.error('No production build found. Run `npm run build` first.'); process.exit(1); }
  base = `http://127.0.0.1:${port}`;
  server = spawn('npm', ['start', '--', '--port', String(port)], { shell: true, stdio: 'ignore', detached: process.platform !== 'win32' });
  process.on('exit', stopServer);
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    try { ready = (await fetch(`${base}/studio/index.html`)).ok; } catch { /* not listening yet */ }
    if (!ready) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) { console.error(`The local server did not answer on ${base} within two minutes.`); process.exit(1); }
}

const failed = [];
for (const check of CHECKS) {
  console.log(`\n=== ${check} ===`);
  const result = spawnSync(process.execPath, [`.claude/skills/romly-browser-qa/${check}.mjs`, base], { stdio: 'inherit' });
  if (result.status !== 0) failed.push(check);
}
stopServer();
console.log(failed.length ? `\nBrowser checks failed: ${failed.join(', ')}` : `\nAll ${CHECKS.length} browser checks passed against ${base}.`);
process.exit(failed.length ? 1 : 0);
