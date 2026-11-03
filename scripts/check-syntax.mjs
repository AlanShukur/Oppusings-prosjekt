// `npm run check`: node --check on every studio module and the server scripts.
// It lists public/studio itself, so a new studio file can't be left out.
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const studio = readdirSync('public/studio').filter(file => file.endsWith('.js')).map(file => `public/studio/${file}`);
const files = [...studio, 'scripts/build-studio-assets.mjs', 'scripts/deploy-cloudflare.mjs', 'lib/projects-api.mjs'];
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`Syntax OK in ${files.length} files.`);
