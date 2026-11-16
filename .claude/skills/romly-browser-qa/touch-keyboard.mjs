// Pinch zoom with real touch events, and the drawing without a pointer: the elements list, the N, arrow, Delete,
// + and - keys with focus on the drawing, the live announcements, and marking a wall from "Vegger i rommet".
// Usage: node .claude/skills/romly-browser-qa/touch-keyboard.mjs [base-url]   (default http://127.0.0.1:5174)
import {openBrowser, pause} from './qa-harness.mjs';

const base = process.argv[2] || 'http://127.0.0.1:5174';
const open = async (b) => {
  const {go, evaluate, until} = b;
  await go('/studio/index.html');
  await until(`!!window.romly && !!document.querySelector('#first-project-btn')`, 'projects dialog', 30000);
  await evaluate(`document.querySelector('#first-project-btn').click()`);
  await until(`!!document.querySelector('#create-project-submit')`, 'create form');
  await evaluate(`document.querySelector('#create-project-submit').click()`);
  await until(`!!document.querySelector('#ground-cancel')`, 'Grunnlag', 30000);
  await evaluate(`document.querySelector('#ground-cancel').click()`);
  await until(`!document.querySelector('#app-dialog').open`, 'dialog closed');
};
let all = true;

// Phone: pinch with two real touch points.
{
  const b = await openBrowser({base, width: 390, height: 844, mobile: true});
  const {evaluate, check, send, shot} = b;
  try {
    await send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 2});
    await open(b);
    const box = await evaluate(`(() => { const r = document.querySelector('#floorplan').getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; })()`);
    const before = await evaluate(`({zoom: romly.editor.zoom, items: JSON.stringify(romly.editor.getState().items), rooms: JSON.stringify(romly.editor.getState().rooms)})`);
    const points = spread => [{x: box.x - spread, y: box.y, id: 0}, {x: box.x + spread, y: box.y, id: 1}];
    await send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(30)});
    for (const spread of [45, 60, 75, 90]) { await send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(spread)}); await pause(40); }
    await send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await pause(200);
    const zoomed = await evaluate(`({zoom: Math.round(romly.editor.zoom), label: document.querySelector('#zoom-value').textContent, items: JSON.stringify(romly.editor.getState().items), rooms: JSON.stringify(romly.editor.getState().rooms)})`);
    check('spreading two fingers zooms in', zoomed.zoom > 250 && zoomed.zoom <= 310 && zoomed.label === zoomed.zoom + ' %', JSON.stringify({zoom: zoomed.zoom, label: zoomed.label}));
    check('the pinch changed nothing in the drawing', zoomed.items === before.items && zoomed.rooms === before.rooms);
    await shot('touch-pinch');
    await send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(90)});
    for (const spread of [70, 50, 30]) { await send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(spread)}); await pause(40); }
    await send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await pause(200);
    const out = await evaluate(`Math.round(romly.editor.zoom)`);
    check('pinching zooms back out', Math.abs(out - 100) <= 10, String(out));
    check('the page did not zoom or scroll sideways', await evaluate(`visualViewport.scale === 1 && document.documentElement.scrollWidth <= innerWidth`));
  } catch (error) { check('phone: script completed', false, error.message); }
  all = await b.finish() && all;
}

// Desktop: the drawing with the keyboard only.
{
  const b = await openBrowser({base});
  const {evaluate, check, send, shot} = b;
  const key = async (key, code, keyCode, modifiers = 0) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {type, key, code, windowsVirtualKeyCode: keyCode, modifiers}); };
  const status = () => evaluate(`document.querySelector('#canvas-status').textContent`);
  const selected = () => evaluate(`romly.editor.selectedItemState()`);
  try {
    await open(b);
    const drawing = await evaluate(`(() => { const el = document.querySelector('#floorplan'); return {tabindex: el.tabIndex, label: el.getAttribute('aria-label'), help: !!document.getElementById(el.getAttribute('aria-describedby'))?.textContent}; })()`);
    check('the drawing is a keyboard stop with a name and instructions', drawing.tabindex === 0 && drawing.label === 'Tegning' && drawing.help, JSON.stringify(drawing));

    // The elements list: closed at first; choosing an element selects it and moves focus to the drawing.
    await evaluate(`romly.editor.addItem('armchair')`);
    await evaluate(`romly.editor.clearItemSelection(); document.querySelector('#item-list-heading').click()`);
    const list = await evaluate(`({title: document.querySelector('#item-list-title').textContent, rows: document.querySelectorAll('#item-list [data-item]').length, expanded: document.querySelector('#item-list-heading').getAttribute('aria-expanded'), shown: getComputedStyle(document.querySelector('#item-list')).display !== 'none'})`);
    check('«Elementer i tegningen» lists every element', list.rows === 13 && list.title === 'Elementer i tegningen (13)' && list.expanded === 'true' && list.shown, JSON.stringify(list));
    await evaluate(`[...document.querySelectorAll('#item-list [data-item]')].at(-1).click()`);
    const chosen = await evaluate(`({type: romly.editor.selectedItemState()?.type, focus: document.activeElement.id, pressed: [...document.querySelectorAll('#item-list [data-item]')].at(-1).getAttribute('aria-pressed')})`);
    check('choosing an element selects it and moves focus to the drawing', chosen.type === 'armchair' && chosen.focus === 'floorplan' && chosen.pressed === 'true', JSON.stringify(chosen));
    check('the selection is announced', (await status()).startsWith('Lenestol valgt.'), await status());

    // Arrow keys move it; the announcement follows what is in the way.
    const start = await selected();
    await key('ArrowRight', 'ArrowRight', 39);
    await key('ArrowDown', 'ArrowDown', 40, 8);
    const moved = await selected();
    check('arrows move the element, with Shift further', moved.x === start.x + 5 && moved.y === start.y + 25, JSON.stringify([start.x, start.y, moved.x, moved.y]));
    await evaluate(`(() => { const s = romly.editor.getState(), living = s.rooms.find(r => r.id === 'living'); romly.editor.loadState({...s, items: s.items.map(i => i.type === 'armchair' ? {...i, x: living.x + 60, y: living.y + 300} : i)}); romly.editor.selectItem(romly.editor.getState().items.at(-1).id); document.querySelector('#floorplan').focus(); })()`);
    for (let i = 0; i < 3; i++) await key('ArrowLeft', 'ArrowLeft', 37, 8);
    check('moving into a wall is announced', (await status()).includes('Går gjennom en vegg.'), await status());
    await shot('keyboard-drawing');
    for (let i = 0; i < 3; i++) await key('ArrowRight', 'ArrowRight', 39, 8);
    check('moving clear again is announced', await status() === 'Plasseringen er i orden.', await status());

    // N steps through the elements; Q rotates; Delete removes; + and - zoom.
    await key('n', 'KeyN', 78);
    const first = await selected();
    await key('N', 'KeyN', 78, 8);
    check('N and Shift+N step through the elements', first?.id === (await evaluate(`romly.editor.getState().items[0].id`)) && (await selected())?.type === 'armchair', first?.type);
    await key('e', 'KeyE', 69);
    check('E rotates the selected element', (await selected()).rotation === 90);
    await key('Delete', 'Delete', 46);
    check('Delete removes it, with focus still on the drawing', await evaluate(`romly.editor.getState().items.length === 12 && document.activeElement.id === 'floorplan'`));
    await key('+', 'Equal', 187);
    const zoomIn = await evaluate(`document.querySelector('#zoom-value').textContent`);
    await key('-', 'Minus', 189);
    check('+ and - zoom', zoomIn === '120 %' && await evaluate(`document.querySelector('#zoom-value').textContent === '100 %'`), zoomIn);

    // Walls without a pointer: the room's walls are buttons in Egenskaper.
    await evaluate(`romly.editor.selectRoom('bed1')`);
    const walls = await evaluate(`[...document.querySelectorAll('#room-wall-list [data-wall]')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())`);
    check('«Vegger i rommet» lists the room\'s walls by side and neighbour', walls.length >= 4 && walls.some(w => w.startsWith('Vest: mot Stue / kjøkken')) && walls.some(w => /^Nord: yttervegg/.test(w)), walls.join(' | '));
    await evaluate(`[...document.querySelectorAll('#room-wall-list [data-wall]')].find(b => b.textContent.includes('mot Stue')).click()`);
    const wall = await evaluate(`({panel: getComputedStyle(document.querySelector('#wall-properties')).display !== 'none', focus: document.activeElement.id, key: romly.editor.selectedWall})`);
    check('choosing a wall opens the wall panel with focus on Status', wall.panel && wall.focus === 'wall-status' && wall.key === 'bed1:left|living:right', JSON.stringify(wall));
    check('the wall is announced', /^Innervegg valgt, .* m\.$/.test(await status()), await status());
    await evaluate(`(() => { const s = document.querySelector('#wall-status'); s.value = 'demolish'; s.dispatchEvent(new Event('change', {bubbles: true})); })()`);
    check('the wall list shows the mark', await evaluate(`[...document.querySelectorAll('#room-wall-list [data-wall]')].some(b => b.getAttribute('aria-pressed') === 'true' && b.textContent.includes('(rives)'))`));
  } catch (error) { check('desktop: script completed', false, error.message); }
  all = await b.finish() && all;
}
process.exit(all ? 0 : 1);
