// Browser check for the saved plan format: projects saved before versioning are migrated, and a project from a newer
// Romly is refused and left untouched. Run it after any change to the plan format (PLAN_VERSION in public/studio/plan.js).
// Usage: node .claude/skills/romly-browser-qa/plan-version.mjs [base-url]   (default http://127.0.0.1:5174)
import {openBrowser} from './qa-harness.mjs';

const b = await openBrowser({base: process.argv[2] || 'http://127.0.0.1:5174'});
const {go, evaluate, until, check, shot} = b;
const db = body => `new Promise((resolve, reject) => { const r = indexedDB.open('romly-local', 1); r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result; ${body} }; })`;
try {
  await go('/studio/index.html');
  await until(`!!window.romly && !!document.querySelector('#first-project-btn')`, 'empty studio', 60000);
  const current = await evaluate(`romly.editor.getState().schemaVersion`);

  // Plant projects the way an older and a newer Romly would have saved them.
  await evaluate(db(`const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects'), now = new Date().toISOString();
    const project = name => ({name, municipality: '', bedrooms: 2, bathrooms: 1, wishes: '', variant: '01'});
    const rooms = romly.editor.getState().rooms;
    store.put({id: 'legacy-project', project: project('Gammelt format'), plan: {rooms, items: [], variant: '01'}, revision: 1, status: 'active', createdAt: now, updatedAt: now});
    store.put({id: 'future-project', project: project('Fra fremtiden'), plan: {rooms, items: [], variant: '01', schemaVersion: 99, walls: [{id: 'w1'}]}, revision: 1, status: 'active', createdAt: now, updatedAt: now});
    tx.oncomplete = () => { db.close(); resolve(true); }; tx.onerror = () => reject(tx.error);`));
  await evaluate(`localStorage.setItem('romly-last-active-id', 'future-project')`);

  // Startup tries to reopen the newer project.
  await go('/studio/index.html');
  await until(`!!window.romly && document.querySelector('#app-dialog').open && !!document.querySelector('[data-open-project="legacy-project"]')`, 'projects dialog after startup', 30000);
  const startup = await evaluate(`({active: romly.getActiveRecord()?.id || null, toast: document.querySelector('#toast').textContent, status: document.querySelector('#save-status').textContent})`);
  check('a newer-format project is not opened on startup', startup.active === null, JSON.stringify(startup));
  check('the user is told to reload the page', /nyere versjon/.test(startup.toast), startup.toast);
  check('it is not mistaken for blocked storage', !/tillater ikke lagring/.test(startup.status), startup.status);
  await shot('v1-startup-refused');

  // The old-format project opens, gains its doors and windows, and saves as version 1.
  await evaluate(`document.querySelector('[data-open-project="legacy-project"]').click()`);
  await until(`romly.getActiveRecord()?.id === 'legacy-project'`, 'old project opened', 20000);
  const legacy = await evaluate(`(() => { const s = romly.editor.getState(); return {version: s.schemaVersion, doors: s.items.filter(i => i.type === 'door').length, windows: s.items.filter(i => i.type === 'window').length}; })()`);
  check('an old-format project opens with its doors and windows', legacy.version === current && legacy.doors === 5 && legacy.windows === 7, JSON.stringify(legacy));
  await evaluate(`romly.editor.updateRoom('bed1', {name: 'Kontor'})`);
  await until(`!romly.getSync().dirty && document.querySelector('#save-status').textContent.includes('Lagret')`, 'autosave', 15000);

  // Opening the newer project from the list is refused, and the open project stays open.
  await evaluate(`document.querySelector('#projects-nav').click()`);
  await until(`!!document.querySelector('[data-open-project="future-project"]')`, 'projects list');
  await evaluate(`document.querySelector('#toast').textContent = ''; document.querySelector('[data-open-project="future-project"]').click()`);
  await until(`/nyere versjon/.test(document.querySelector('#toast').textContent)`, 'refusal message', 10000)
    .then(() => check('opening it from the list is refused with the same message', true), e => check('opening it from the list is refused with the same message', false, e.message));
  check('the project that was open stays open', await evaluate(`romly.getActiveRecord()?.id === 'legacy-project'`));
  await shot('v1-list-refused');

  const stored = await evaluate(db(`const s = db.transaction('projects').objectStore('projects'), out = {};
    const a = s.get('legacy-project'), f = s.get('future-project');
    a.onsuccess = () => { out.legacy = a.result.plan.schemaVersion; out.legacyWalls = Array.isArray(a.result.plan.walls); };
    f.onsuccess = () => { out.future = f.result.plan.schemaVersion; out.walls = f.result.plan.walls?.length; out.revision = f.result.revision; db.close(); resolve(out); };`));
  check(`the old project is now stored as version ${current}`, stored.legacy === current, JSON.stringify(stored));
  check('the migrated project has a wall notes list (version 2)', stored.legacyWalls === true, JSON.stringify(stored));
  check('the newer project was never overwritten', stored.future === 99 && stored.walls === 1 && stored.revision === 1, JSON.stringify(stored));
} catch (error) {
  check('script completed', false, error.message);
}
process.exit(await b.finish() ? 0 : 1);
