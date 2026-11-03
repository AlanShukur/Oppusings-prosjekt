// Opens every studio dialog from its own button and runs its main action: Grunnlag, Planforslag, help, shortcuts,
// the wall advice, inspiration, add room, zoom and tool keys, export (SVG, brief, project file), project-file import,
// storage with backup and "Slett alle data", backup restore, deleting and opening a project, and importing a floor
// plan with its scale. Run it after moving or changing studio UI code. walls.mjs, baseline.mjs, plan-version.mjs and
// smoke.mjs cover the rest.
// Usage: node .claude/skills/romly-browser-qa/dialogs.mjs [base-url]   (default http://127.0.0.1:5174)
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openBrowser} from './qa-harness.mjs';

const b = await openBrowser({base: process.argv[2] || 'http://127.0.0.1:5174'});
const {go, evaluate, until, shot, setFiles, check, send} = b;
const q = selector => `document.querySelector(${JSON.stringify(selector)})`;
const title = `(document.querySelector('#app-dialog').open ? document.querySelector('#dialog-title')?.textContent : null)`;
const clickEl = selector => evaluate(`${q(selector)}.click()`);
// Clicks a button and checks that the dialog with this title opens.
const opens = async (selector, expected) => {
  await clickEl(selector);
  await until(`${title} === ${JSON.stringify(expected)}`, expected, 10000)
    .then(() => check(`${selector} opens «${expected}»`, true), () => evaluate(title).then(t => check(`${selector} opens «${expected}»`, false, String(t))));
};
const closeDialog = async () => { await clickEl('#app-dialog .dialog-close'); await until(`!document.querySelector('#app-dialog').open`, 'dialog closed'); };
// Clicks a button and returns the text of the file the page downloads.
const downloaded = selector => evaluate(`new Promise(resolve => { const original = URL.createObjectURL; URL.createObjectURL = blob => { URL.createObjectURL = original; blob.text().then(resolve); return original.call(URL, blob); }; ${q(selector)}.click(); })`);
// "Importer prosjektfil" builds a detached <input type=file>; put it in the page so setFiles can reach it.
const catchFileInput = () => evaluate(`(() => { const original = document.createElement.bind(document); document.createElement = (tag, ...rest) => { const el = original(tag, ...rest); if (tag === 'input') { document.createElement = original; el.id = 'qa-file-input'; el.hidden = true; el.click = () => {}; document.body.append(el); } return el; }; })()`);
const key = async (key, code, keyCode) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {type, key, code, windowsVirtualKeyCode: keyCode}); };
const mouse = async (x, y) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', {type, x, y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0}); };
const setValue = (selector, value, event = 'input') => evaluate(`(() => { const el = ${q(selector)}; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, {bubbles: true})); })()`);

try {
  await send('Page.setInterceptFileChooserDialog', {enabled: true});
  await go('/studio/index.html');
  await until(`!!window.romly && ${title} === 'Mine prosjekter' && !!document.querySelector('#first-project-btn')`, 'empty projects dialog', 30000);
  check('first visit opens «Mine prosjekter»', true);

  // Step 1 and 2: create a project, name it in Grunnlag, then pick a plan variant.
  await clickEl('#first-project-btn');
  await until(`!!document.querySelector('#create-project-submit')`, 'create form');
  await clickEl('#create-project-submit');
  await until(`${title} === 'La oss bli kjent med hjemmet ditt'`, 'Grunnlag', 30000);
  check('a new project opens «Grunnlag»', true);
  await setValue('#project-name-field', 'QA-dialoger');
  check('the project name updates the title', await evaluate(`document.querySelector('#project-title').textContent === 'QA-dialoger'`));
  await clickEl('#ground-next');
  await until(`${title} === 'Hvordan vil du bo?'`, 'Planforslag', 15000).then(() => check('«Videre» opens «Planforslag»', true), e => check('«Videre» opens «Planforslag»', false, e.message));
  await clickEl('[data-count="bedrooms"][data-delta="1"]');
  await clickEl('[data-variant="03"]');
  await clickEl('#use-suggestion');
  if (await evaluate(`!!document.querySelector('#replace-warning')`)) await clickEl('#use-suggestion');
  await until(`!document.querySelector('#app-dialog').open`, 'suggestion applied');
  const chosen = await evaluate(`({variant: romly.getProject().variant, bedrooms: romly.getProject().bedrooms, label: document.querySelector('#variant-name').textContent})`);
  check('choosing «Et rom til» switches the plan and keeps the needs', chosen.variant === '03' && chosen.bedrooms === 3 && chosen.label === '03', JSON.stringify(chosen));

  // Top bar and canvas dialogs.
  await opens('#help-btn', 'Fra plantegning til egne rom'); await closeDialog();
  await opens('#shortcuts-btn', 'Litt raskere fra tanke til tegning'); await closeDialog();
  await opens('#insight-btn', 'Mer plass til å være sammen'); await closeDialog();
  await opens('#inspiration-nav', 'Et hjem som føles som deg');
  const color = await evaluate(`(() => { const current = romly.editor.getState().rooms.find(r => r.id === romly.editor.selected)?.color; const card = [...document.querySelectorAll('[data-inspo]')].find(c => c.dataset.inspo !== current); card.click(); return card.dataset.inspo; })()`);
  check('an inspiration card colours the selected room', await evaluate(`romly.editor.getState().rooms.find(r => r.id === romly.editor.selected)?.color === ${JSON.stringify(color)} && !document.querySelector('#app-dialog').open`));
  await opens('#add-room-btn', 'Gi plass til et nytt rom');
  await setValue('#new-room-name', 'QA-rom');
  await clickEl('#confirm-room');
  check('«Legg til rom» adds the named room', await evaluate(`romly.editor.getState().rooms.some(r => r.name === 'QA-rom')`));

  // Zoom buttons and tool keys.
  await clickEl('#zoom-in');
  const zoomedIn = await evaluate(`document.querySelector('#zoom-value').textContent`);
  await clickEl('#zoom-fit');
  check('zoom in and fit update the zoom level', zoomedIn === '120 %' && await evaluate(`document.querySelector('#zoom-value').textContent === '100 %'`), zoomedIn);
  await key('r', 'KeyR', 82);
  const roomTool = await evaluate(`document.querySelector('.studio').dataset.tool`);
  await key('Escape', 'Escape', 27);
  check('R picks the room tool and Escape goes back', roomTool === 'room' && await evaluate(`document.querySelector('.studio').dataset.tool === 'select'`), roomTool);

  // Export: SVG, brief and project file; then import the project file as a new project.
  await opens('#export-btn', 'Ta med deg planene videre');
  const svg = await downloaded('#export-svg');
  check('export downloads the plan as SVG', /^<svg[\s>]/.test(svg.trim()), svg.slice(0, 40));
  const brief = await downloaded('#export-brief');
  check('export downloads the project brief', brief.startsWith('ROMLY – PROSJEKTBRIEF\nQA-dialoger\n') && brief.includes('QA-rom'), JSON.stringify(brief.slice(0, 40)));
  const projectFile = await downloaded('#export-json');
  const exported = JSON.parse(projectFile);
  check('export downloads the project file', exported.format === 'romly-v1' && exported.project.name === 'QA-dialoger' && exported.plan.rooms.some(r => r.name === 'QA-rom'));
  const projectPath = join(b.out, 'qa-project.json');
  await writeFile(projectPath, projectFile);
  await catchFileInput();
  await clickEl('#import-json');
  await setFiles('#qa-file-input', [projectPath]);
  await until(`${title} === 'Importer prosjektet'`, 'import dialog').then(() => check('a project file opens «Importer prosjektet»', true), e => check('a project file opens «Importer prosjektet»', false, e.message));
  await setValue('#import-project-name', 'QA-importert');
  await clickEl('#import-project-submit');
  await until(`romly.getActiveRecord()?.project.name === 'QA-importert'`, 'imported project open', 15000);
  check('the imported project opens with its rooms', await evaluate(`romly.editor.getState().rooms.some(r => r.name === 'QA-rom')`));

  // Storage: usage, a full backup, then delete everything.
  await opens('#profile-btn', 'Lagring på denne enheten');
  await until(`!document.querySelector('#storage-usage').textContent.startsWith('Beregner')`, 'storage usage').then(() => check('the storage dialog shows the space used', true), e => check('the storage dialog shows the space used', false, e.message));
  const backupFile = await downloaded('#storage-export');
  const backup = JSON.parse(backupFile);
  check('the backup holds both projects', backup.format === 'romly-backup-v1' && backup.projects.length === 2, `${backup.format} ${backup.projects?.length}`);
  const backupPath = join(b.out, 'qa-backup.json');
  await writeFile(backupPath, backupFile);
  await clickEl('#storage-delete');
  check('«Slett alle data» asks once more', await evaluate(`getComputedStyle(document.querySelector('#storage-delete-warning')).display !== 'none'`));
  await clickEl('#storage-delete');
  await until(`${title} === 'Mine prosjekter' && !!document.querySelector('#first-project-btn') && !romly.getActiveRecord()`, 'everything deleted', 15000)
    .then(() => check('deleting all data leaves no projects', true), e => check('deleting all data leaves no projects', false, e.message));
  check('the studio is back on the example home', await evaluate(`romly.getProject().name === 'Eksempelbolig'`));
  await closeDialog();

  // Restore the backup through «Importer prosjektfil», delete one project, open the other.
  await opens('#export-btn', 'Ta med deg planene videre');
  await catchFileInput();
  await clickEl('#import-json');
  await setFiles('#qa-file-input', [backupPath]);
  await until(`${title} === 'Mine prosjekter' && document.querySelectorAll('[data-open-project]').length === 2`, 'restored list', 15000)
    .then(() => check('the backup restores both projects', true), e => check('the backup restores both projects', false, e.message));
  await clickEl('[data-delete-project]');
  await until(`${title} === 'Slette prosjektet?'`, 'delete dialog');
  await clickEl('#delete-project-confirm');
  await until(`${title} === 'Mine prosjekter' && document.querySelectorAll('[data-open-project]').length === 1`, 'one project left', 15000)
    .then(() => check('deleting a project removes it from the list', true), e => check('deleting a project removes it from the list', false, e.message));
  await clickEl('[data-open-project]');
  await until(`!!romly.getActiveRecord() && !document.querySelector('#app-dialog').open`, 'project opened', 15000)
    .then(() => check('a project opens from the list', true), e => check('a project opens from the list', false, e.message));

  // Import a floor plan: upload, mark two points 6 m apart, use it as the drawing reference.
  const png = await evaluate(`(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 500; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 500); x.lineWidth = 6; x.strokeRect(100, 100, 600, 300); return c.toDataURL('image/png').split(',')[1]; })()`);
  const pngPath = join(b.out, 'qa-floorplan.png');
  await writeFile(pngPath, Buffer.from(png, 'base64'));
  await clickEl('#import-floorplan');
  await setFiles('#plan-file-input', [pngPath]);
  await until(`${title} === 'Bruk din egen plantegning' && !!document.querySelector('#calibration-svg')`, 'calibration dialog', 20000)
    .then(() => check('an uploaded plan opens «Bruk din egen plantegning»', true), e => check('an uploaded plan opens «Bruk din egen plantegning»', false, e.message));
  const box = await evaluate(`(() => { const svg = document.querySelector('#calibration-svg'); svg.scrollIntoView({block: 'center'}); const r = svg.getBoundingClientRect(); const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight); return {left: r.left, width: r.width, y: (top + bottom) / 2}; })()`);
  await mouse(box.left + box.width * 0.2, box.y);
  await mouse(box.left + box.width * 0.8, box.y);
  await setValue('#calibration-meters', '6');
  await until(`!document.querySelector('#calibration-apply').disabled`, 'scale accepted').then(() => check('two points and a length enable «Bruk tegningen»', true), e => check('two points and a length enable «Bruk tegningen»', false, e.message));
  await shot('dialogs-calibration');
  await clickEl('#calibration-apply');
  await until(`!document.querySelector('#app-dialog').open && !!romly.editor.getState().reference`, 'reference applied', 20000);
  const applied = await evaluate(`({tool: document.querySelector('.studio').dataset.tool, zoom: document.querySelector('#zoom-value').textContent, details: getComputedStyle(document.querySelector('#reference-details')).display !== 'none'})`);
  check('the plan becomes the drawing reference, ready to draw rooms', applied.tool === 'room' && applied.zoom === '100 %' && applied.details, JSON.stringify(applied));
  await shot('dialogs-reference');

  check('the studio never calls the server API', !b.apiRequests.length, b.apiRequests.slice(0, 3).join(' | '));
} catch (error) {
  check('script completed', false, error.message);
}
process.exit(await b.finish() ? 0 : 1);
