// Furniture with real sizes, the overlap check and the door hinge, in a real browser: the Interiør list, adding and
// resizing a bed (and that it survives a reload), red outlines and the reason in Egenskaper for a sofa through a wall
// and a chair where a door swings, «Bytt hengselside» and «Slå andre veien», and 3D with the new pieces.
// Usage: node .claude/skills/romly-browser-qa/furniture.mjs [base-url]   (default http://127.0.0.1:5174)
import {openBrowser} from './qa-harness.mjs';

const b = await openBrowser({base: process.argv[2] || 'http://127.0.0.1:5174'});
const {go, evaluate, until, shot, check} = b;
const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
const shown = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && getComputedStyle(el).display !== 'none' && !el.closest('[hidden]'); })()`);
const setValue = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', {bubbles: true})); })()`);
const select = id => evaluate(`romly.editor.selectedItem = ${JSON.stringify(id)}; romly.editor.render()`);
const problemOutlines = () => evaluate(`document.querySelectorAll('[data-item-problem]').length`);

try {
  await go('/studio/index.html');
  await until(`!!window.romly && !!document.querySelector('#first-project-btn')`, 'projects dialog', 30000);
  await evaluate(`document.querySelector('#first-project-btn').click()`);
  await until(`!!document.querySelector('#create-project-submit')`, 'create form');
  await evaluate(`document.querySelector('#create-project-submit').click()`);
  await until(`!!document.querySelector('#ground-cancel')`, 'Grunnlag', 30000);
  await evaluate(`document.querySelector('#ground-cancel').click()`);

  // The Interiør tab lists the catalogue by room, with sizes.
  await evaluate(`document.querySelector('[data-tool-tab="interior"]').click()`);
  const list = await evaluate(`({visible: getComputedStyle(document.querySelector('#interior-tools')).display !== 'none', pieces: document.querySelectorAll('#interior-tools [data-add]').length, groups: [...document.querySelectorAll('#interior-tools .furniture-group')].map(h => h.textContent), first: document.querySelector('#interior-tools [data-add]').innerText.replace(/\\s+/g, ' ').trim()})`);
  check('Interiør lists 16 pieces in 4 groups, with sizes', list.visible && list.pieces === 16 && list.groups.length === 4 && list.first === 'Sofa, 3 seter 210 × 90 cm', JSON.stringify(list));
  await shot('furniture-list');

  // Add a double bed: real size, and its size can be changed in Egenskaper.
  await evaluate(`document.querySelector('[data-add="bed"]').click()`);
  await until(`document.querySelector('#item-title').textContent === 'Dobbeltseng'`, 'bed selected');
  const fields = await evaluate(`({width: document.querySelector('#item-furniture-width').value, depth: document.querySelector('#item-furniture-depth').value})`);
  check('a new double bed is 1,6 × 2 m', fields.width === '1,6' && fields.depth === '2' && await shown('#item-furniture-fields'), JSON.stringify(fields));
  check('furniture has no hinge button', !await shown('#item-mirror'));
  await setValue('#item-furniture-width', '1,8');
  const bed = await evaluate(`romly.editor.getState().items.find(item => item.type === 'bed')`);
  check('changing the width to 1,8 m resizes the bed in the drawing', bed.width === 1.8 && await evaluate(`!!document.querySelector('[data-item-id="${bed.id}"] rect[width="98"]')`), String(bed.width));
  await setValue('#item-furniture-width', '9');
  check('a width out of range is refused and the field shows the real size', await evaluate(`document.querySelector('#item-furniture-width').value === '1,8' && document.querySelector('#toast').textContent.includes('mellom 0,2 og 4 meter')`));
  await until(`!romly.getSync().dirty`, 'autosave', 15000);
  const id = await evaluate(`romly.getActiveRecord().id`);
  await go('/studio/index.html');
  await until(`window.romly?.getActiveRecord()?.id === ${JSON.stringify(id)}`, 'reopened', 30000);
  check('the bed keeps its size after a reload', await evaluate(`romly.editor.getState().items.find(item => item.type === 'bed')?.width === 1.8`));

  // A sofa across the wall between Stue and Soverom, and a chair where the door swings.
  await evaluate(`(() => {
    const room = (id, name, x, y, w, h, type) => ({id, name, type, x, y, w, h, color: '#e8e1d1', width: w / 50, height: h / 50, area: w * h / 2500});
    romly.editor.loadState({variant: 'custom', walls: [], rooms: [room('a', 'Stue', 0, 0, 200, 200, 'living'), room('b', 'Soverom', 200, 0, 200, 200, 'bedroom')],
      items: [{id: 's', type: 'sofa', x: 200, y: 100, rotation: 90, width: 2.1, depth: 0.9}, {id: 'd', type: 'door', x: 100, y: 200, rotation: 180, width: 1}, {id: 'c', type: 'chair', x: 100, y: 180, rotation: 0, width: 0.45, depth: 0.5}]});
  })()`);
  check('the sofa, the chair and the door get red outlines', await problemOutlines() === 3, String(await problemOutlines()));
  await select('s');
  check('the sofa says it goes through a wall', await text('#item-warning') === 'Sjekk plasseringen' && await shown('#item-warning') && (await text('#item-hint')).startsWith('Går gjennom en vegg.'), await text('#item-hint'));
  await select('d');
  check('the door names the chair in its way', await text('#item-warning') === 'Noe står i veien' && (await text('#item-hint')).startsWith('«Stol» står i veien når døren åpnes.'), await text('#item-hint'));
  check('a door offers «Slå andre veien» and «Bytt hengselside»', await text('#item-rotate-label') === 'Slå andre veien' && await shown('#item-mirror'));
  await shot('furniture-overlap');

  // Door buttons: the hinge moves to the other end; then the door opens to the other side, away from the chair.
  await evaluate(`document.querySelector('#item-mirror').click()`);
  check('«Bytt hengselside» mirrors the door', await evaluate(`romly.editor.getState().items.find(item => item.id === 'd').mirrored === true && document.querySelector('[data-item-id="d"]').innerHTML.includes('scale(-1 1)')`));
  await evaluate(`document.querySelector('#item-rotate').click()`);
  const door = await evaluate(`romly.editor.getState().items.find(item => item.id === 'd')`);
  check('«Slå andre veien» turns the door and keeps its hinge end', door.rotation === 0 && !door.mirrored, JSON.stringify(door));
  check('the chair is no longer in the way; only the sofa is flagged', await problemOutlines() === 1 && await evaluate(`!!document.querySelector('[data-item-id="s"] [data-item-problem]')`), String(await problemOutlines()));
  await shot('furniture-door');

  // 3D builds the new pieces without errors.
  await evaluate(`document.querySelector('#view-3d').click()`);
  await until(`document.querySelector('.studio').dataset.view === '3d'`, '3D', 30000).then(() => check('3D opens with the furniture', true), e => check('3D opens with the furniture', false, e.message));
  await shot('furniture-3d');
  await evaluate(`document.querySelector('#view-2d').click()`);
  await until(`document.querySelector('.studio').dataset.view === '2d'`, '2D');

  check('the studio never calls the server API', !b.apiRequests.length, b.apiRequests.slice(0, 3).join(' | '));
} catch (error) {
  check('script completed', false, error.message);
}
process.exit(await b.finish() ? 0 : 1);
