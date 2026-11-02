// Stop hook: when this turn edited files in the repo but did not touch docs/MEMORY.md, ask Claude to
// update the memory (and the skills, if the task taught something reusable) before it finishes.
// It fires at most once per turn (stop_hook_active) and fails open: any error lets Claude stop.
import {readFileSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MEMORY = 'docs/memory.md';
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

// A real prompt from the user starts the turn; tool results and injected skill text do not.
const isPrompt = entry => {
  if (entry.type !== 'user' || entry.isMeta) return false;
  const content = entry.message?.content;
  if (typeof content === 'string') return true;
  return Array.isArray(content) && content.some(b => b.type === 'text') && !content.some(b => b.type === 'tool_result');
};

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.stop_hook_active || !input.transcript_path) process.exit(0);
  const lines = readFileSync(input.transcript_path, 'utf8').split('\n');
  const edited = new Set();
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    if (entry.isSidechain) continue;
    if (isPrompt(entry)) break;
    if (entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue;
    for (const block of entry.message.content) {
      const file = block.type === 'tool_use' && EDIT_TOOLS.has(block.name) && (block.input?.file_path || block.input?.notebook_path);
      if (!file) continue;
      const rel = relative(root, resolve(file)).replace(/\\/g, '/');
      if (rel && !rel.startsWith('..') && !isAbsolute(rel)) edited.add(rel);
    }
  }
  if (!edited.size || [...edited].some(file => file.toLowerCase() === MEMORY)) process.exit(0);
  const files = [...edited].slice(0, 5).join(', ') + (edited.size > 5 ? ` and ${edited.size - 5} more` : '');
  console.log(JSON.stringify({
    decision: 'block',
    reason: `Before finishing: this task changed ${files} but docs/MEMORY.md was not updated. ` +
      'Add a dated line to its task log and adjust "Current state", "Decisions" or "Waiting on the user" if they changed. ' +
      'If the task taught a repeatable procedure or a trap the skills do not cover, create or update a skill (romly-skill-keeper). ' +
      'Then end with a short note to the user; do not repeat your previous reply.',
  }));
} catch {
  process.exit(0);
}
