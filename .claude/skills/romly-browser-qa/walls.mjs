// Browser check for wall notes: a real click on a wall, the wall panel, drawing styles, the legend, persistence, 3D and
// Delete/Escape. Run it after changing walls, the 2D editor's click handling or the inspector.
// Usage: node .claude/skills/romly-browser-qa/walls.mjs [base-url]   (default http://127.0.0.1:5174)
import {openBrowser, pause} from './qa-harness.mjs';

const b = await openBrowser({base: process.argv[2] || 'http://127.0.0.1:5174'});
const {go, evaluate, until, check, shot, send} = b;
const click = async (x, y) => {
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', {type, x, y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0});
};
const choose = (id, value) => evaluate(`(() => { const el = document.querySelector('#${id}'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', {bubbles: true})); })()`);
const panel = () => evaluate(`({hidden: document.querySelector('#wall-properties').hidden, title: document.querySelector('#wall-title').textContent, between: document.querySelector('#wall-between').textContent, length: document.querySelector('#wall-length').textContent, status: document.querySelector('#wall-status').value, bearing: document.querySelector('#wall-bearing').value, hint: document.querySelector('#wall-hint').textContent})`);
try {
  await go('/studio/index.html');
  await until(`!!window.romly && !!document.querySelector('#first-project-btn')`, 'empty studio', 60000);
  await evaluate(`document.querySelector('#first-project-btn').click()`);
  await until(`!!document.querySelector('#create-project-submit')`, 'create form');
  await evaluate(`document.querySelector('#create-project-name').value = 'Vegger'; document.querySelector('#create-project-submit').click()`);
  await until(`!!romly.getActiveRecord() && !!document.querySelector('#ground-cancel')`, 'project created', 30000);
  await evaluate(`document.querySelector('#ground-cancel').click()`);
  await until(`!document.querySelector('#app-dialog').open`, 'dialog closed');

  // A real click on the wall between Stue and Soverom 1.
  const key = await evaluate(`[...document.querySelectorAll('[data-wall-key]')].map(el => el.dataset.wallKey).find(k => k.includes('bed1:') && k.includes('living:'))`);
  check('the wall between Stue and Soverom 1 is clickable', !!key, String(key));
  const point = await evaluate(`(() => { const path = [...document.querySelectorAll('[data-wall-key]')].find(el => el.dataset.wallKey === ${JSON.stringify(key)}); const box = path.getBoundingClientRect(); return {x: box.left + box.width / 2, y: box.top + box.height / 2}; })()`);
  await click(point.x, point.y);
  await pause(200);
  const first = await panel();
  check('clicking it opens the wall panel', !first.hidden && first.title === 'Innervegg' && /Mellom .+ og .+/.test(first.between) && first.status === 'existing' && first.bearing === 'unknown', JSON.stringify(first));
  check('the room selection frame is hidden while a wall is selected', await evaluate(`!document.querySelector('#floorplan [data-resize]')`));

  // Mark it for demolition, load-bearing unknown, then yes.
  await choose('wall-status', 'demolish');
  await pause(150);
  const dashed = await evaluate(`[...document.querySelectorAll('#floorplan path')].some(p => p.getAttribute('stroke') === '#c4553f' && p.getAttribute('stroke-dasharray'))`);
  check('a wall marked Rives is drawn dashed red', dashed);
  check('the hint asks whether it is load-bearing', /Finn ut om veggen er bærende/.test((await panel()).hint), (await panel()).hint);
  await choose('wall-bearing', 'yes');
  await pause(150);
  check('a load-bearing demolition gets the professional-assessment hint', /fagperson må vurdere/.test((await panel()).hint));
  check('the legend appears once a wall is marked', await evaluate(`!document.querySelector('#wall-legend').hidden`));
  await shot('walls-1-marked');

  // Delete must not remove a room while a wall is selected; Escape clears the selection.
  const roomsBefore = await evaluate(`romly.editor.getState().rooms.length`);
  await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46});
  await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46});
  await pause(150);
  check('Delete with a wall selected removes nothing', await evaluate(`romly.editor.getState().rooms.length`) === roomsBefore);
  await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
  await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
  await pause(150);
  check('Escape closes the wall panel', (await panel()).hidden);

  // Autosave, reload: the note and version come back.
  await until(`!romly.getSync().dirty && document.querySelector('#save-status').textContent.includes('Lagret')`, 'autosave', 15000);
  const id = await evaluate(`romly.getActiveRecord().id`);
  await go('/studio/index.html');
  await until(`window.romly?.getActiveRecord()?.id === ${JSON.stringify(id)}`, 'reopened', 30000);
  const saved = await evaluate(`romly.editor.getState()`);
  check('the wall note and plan version survive a reload', saved.schemaVersion >= 2 && saved.walls.length === 1 && saved.walls[0].key === key && saved.walls[0].status === 'demolish' && saved.walls[0].loadBearing === 'yes', JSON.stringify(saved.walls));
  check('the legend is shown after reload', await evaluate(`!document.querySelector('#wall-legend').hidden`));

  // 3D renders with a demolished wall, without errors.
  await evaluate(`document.querySelector('#view-3d').click()`);
  await until(`document.querySelector('.studio').dataset.view === '3d' && !!document.querySelector('canvas')`, '3D view', 30000)
    .then(() => check('3D opens with a wall marked for demolition', true), e => check('3D opens with a wall marked for demolition', false, e.message));
  await pause(1200);
  await shot('walls-2-3d');
  await evaluate(`document.querySelector('#view-2d').click()`);
  await until(`document.querySelector('.studio').dataset.view === '2d'`, 'back to 2D', 10000);

  // Setting it back to the default stores nothing and hides the legend.
  await evaluate(`romly.editor.selectWall(${JSON.stringify(key)})`);
  await choose('wall-status', 'existing');
  await choose('wall-bearing', 'unknown');
  await pause(150);
  check('back to the default stores no note and hides the legend', await evaluate(`romly.editor.getState().walls.length === 0 && document.querySelector('#wall-legend').hidden`));
  await shot('walls-3-default');
} catch (error) {
  check('script completed', false, error.message);
}
process.exit(await b.finish() ? 0 : 1);
