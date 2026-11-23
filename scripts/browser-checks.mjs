// `npm run test:browser`: runs every browser check in .claude/skills/romly-browser-qa against a production build.
// With a URL it tests that site instead: `npm run test:browser -- https://romly-staging.romly.workers.dev`.
// Without one it serves dist/ locally (run `npm run build` first) and stops the server when the checks are done.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, openSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHECKS = ['smoke', 'dialogs', 'roadmap', 'photo-tools', 'furniture', 'a11y', 'touch-keyboard', 'plan-version', 'walls', 'baseline'];
const port = 8791;
let base = process.argv[2], server = null;

// On GitHub Actions each failure also becomes an annotation, readable on the PR without opening the log.
function annotate(title, text) {
  if (!process.env.GITHUB_ACTIONS) return;
  console.log(`::error title=${title}::${text.slice(0, 1500).replaceAll('%', '%25').replaceAll('\r', '').replaceAll('\n', '%0A')}`);
}
const lastLines = (text, count) => text.trim().split('\n').slice(-count).join('\n');

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
  const logPath = join(tmpdir(), 'romly-browser-checks-server.log'), log = openSync(logPath, 'w');
  server = spawn('npm', ['start', '--', '--port', String(port)], { shell: true, stdio: ['ignore', log, log], detached: process.platform !== 'win32' });
  process.on('exit', stopServer);
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    try { ready = (await fetch(`${base}/studio/index.html`)).ok; } catch { /* not listening yet */ }
    if (!ready) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) {
    const tail = lastLines(readFileSync(logPath, 'utf8'), 25);
    console.error(`The local server did not answer on ${base} within two minutes.\n${tail}`);
    annotate('Local server did not start', tail || 'The server printed nothing.');
    process.exit(1);
  }
}

const failed = [];
for (const check of CHECKS) {
  console.log(`\n=== ${check} ===`);
  const result = spawnSync(process.execPath, [`.claude/skills/romly-browser-qa/${check}.mjs`, base], { encoding: 'utf8' });
  const output = (result.stdout || '') + (result.stderr || '');
  process.stdout.write(output);
  if (result.status === 0) continue;
  failed.push(check);
  const fails = output.split('\n').filter(line => line.startsWith('FAIL'));
  annotate(`Browser check ${check}`, fails.length ? fails.join('\n') : lastLines(output, 12) || `exit ${result.status}`);
}
stopServer();
console.log(failed.length ? `\nBrowser checks failed: ${failed.join(', ')}` : `\nAll ${CHECKS.length} browser checks passed against ${base}.`);
process.exit(failed.length ? 1 : 0);
