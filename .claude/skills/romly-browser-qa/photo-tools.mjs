// The photo tools in «Bruk din egen plantegning»: a floor plan photographed at an angle and sideways is rotated,
// straightened with four corners, and measured with a dimension in millimetres plus one across it. The result must be
// the plan's real size (12 × 8 m), saved as a separate «(rettet)» copy next to the original. Then the same dialog is
// checked at phone width, with a corner dragged by touch and moved with the arrow keys.
// Usage: node .claude/skills/romly-browser-qa/photo-tools.mjs [base-url]   (default http://127.0.0.1:5174)
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openBrowser} from './qa-harness.mjs';

const b = await openBrowser({base: process.argv[2] || 'http://127.0.0.1:5174'});
const {go, evaluate, until, shot, setFiles, check, send} = b;
const q = selector => `document.querySelector(${JSON.stringify(selector)})`;
const title = `(document.querySelector('#app-dialog').open ? document.querySelector('#dialog-title')?.textContent : null)`;
const clickEl = selector => evaluate(`${q(selector)}.click()`);
const setValue = (selector, value, event = 'input') => evaluate(`(() => { const el = ${q(selector)}; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, {bubbles: true})); })()`);
const key = async (key, code, keyCode) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {type, key, code, windowsVirtualKeyCode: keyCode}); };
// Screen position of a point in the picture's own pixels.
const screenAt = (x, y) => evaluate(`(() => { const svg = document.querySelector('#calibration-svg'); const p = svg.createSVGPoint(); p.x = ${x}; p.y = ${y}; const s = p.matrixTransform(svg.getScreenCTM()); return {x: s.x, y: s.y}; })()`);
const viewSize = () => evaluate(`(() => { const image = document.querySelector('#calibration-svg image'); return {width: +image.getAttribute('width'), height: +image.getAttribute('height')}; })()`);
const click = async point => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', {type, x: point.x, y: point.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0}); };
const drag = async (from, to) => {
  await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: from.x, y: from.y});
  await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1, buttons: 1});
  for (let step = 1; step <= 6; step++) await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: from.x + (to.x - from.x) * step / 6, y: from.y + (to.y - from.y) * step / 6, button: 'left', buttons: 1});
  await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1, buttons: 0});
};
const corners = () => evaluate(`[...document.querySelectorAll('.import-corner')].map(c => ({x: +c.getAttribute('cx'), y: +c.getAttribute('cy')}))`);

// Where the plan's corners sit in the photo before it was turned sideways.
const OUTLINE = [{x: 140, y: 90}, {x: 880, y: 150}, {x: 840, y: 700}, {x: 110, y: 640}];

try {
  await send('Page.setInterceptFileChooserDialog', {enabled: true});
  await go('/studio/index.html');
  await until(`!!window.romly && ${title} === 'Mine prosjekter' && !!document.querySelector('#first-project-btn')`, 'empty projects dialog', 30000);
  await clickEl('#first-project-btn');
  await until(`!!document.querySelector('#create-project-submit')`, 'create form');
  await clickEl('#create-project-submit');
  await until(`${title} === 'Veien til søknad'`, 'the roadmap', 30000);
  await clickEl('#roadmap-close');
  await until(`!document.querySelector('#app-dialog').open`, 'roadmap closed');

  // A 12 × 8 m plan (50 px per metre) with a 10 × 6 m wall outline, photographed at an angle on a grey table and
  // turned a quarter to the left, saved as a JPEG like a phone photo.
  const jpeg = await evaluate(`(async () => {
    const m = await import('/studio/photo-correct.js');
    const plan = document.createElement('canvas'); plan.width = 600; plan.height = 400;
    const p = plan.getContext('2d'); p.fillStyle = '#fff'; p.fillRect(0, 0, 600, 400); p.strokeStyle = '#000'; p.lineWidth = 8; p.strokeRect(50, 50, 500, 300);
    p.beginPath(); p.moveTo(300, 50); p.lineTo(300, 350); p.stroke();
    const flat = p.getImageData(0, 0, 600, 400);
    const toFlat = m.homography(${JSON.stringify(OUTLINE)}, m.defaultCorners(600, 400));
    const photo = {width: 1000, height: 800, data: new Uint8ClampedArray(1000 * 800 * 4)};
    for (let y = 0; y < 800; y++) for (let x = 0; x < 1000; x++) {
      const f = m.project(toFlat, x + 0.5, y + 0.5), at = (y * 1000 + x) * 4;
      const inside = f.x >= 0 && f.y >= 0 && f.x < 600 && f.y < 400, from = inside ? (Math.floor(f.y) * 600 + Math.floor(f.x)) * 4 : -1;
      for (let c = 0; c < 3; c++) photo.data[at + c] = inside ? flat.data[from + c] : 128;
      photo.data[at + 3] = 255;
    }
    const sideways = m.rotatePixels(photo, -1);
    const c = document.createElement('canvas'); c.width = sideways.width; c.height = sideways.height;
    c.getContext('2d').putImageData(new ImageData(sideways.data, sideways.width, sideways.height), 0, 0);
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  })()`);
  const photoPath = join(b.out, 'qa-photo-plan.jpg');
  await writeFile(photoPath, Buffer.from(jpeg, 'base64'));
  await clickEl('#import-floorplan');
  await setFiles('#plan-file-input', [photoPath]);
  await until(`${title} === 'Bruk din egen plantegning' && !!document.querySelector('#calibration-svg') && !document.querySelector('#import-rotate-right').disabled`, 'import dialog', 20000)
    .then(() => check('the photo opens «Bruk din egen plantegning» with the photo tools', true), e => check('the photo opens «Bruk din egen plantegning» with the photo tools', false, e.message));
  check('the sideways photo opens portrait', JSON.stringify(await viewSize()) === JSON.stringify({width: 800, height: 1000}), JSON.stringify(await viewSize()));
  check('«Tilbakestill» is hidden before any change', await evaluate(`${q('#import-reset-correction')}.hidden`));

  // Rotate.
  await clickEl('#import-rotate-right');
  await until(`(() => { const i = document.querySelector('#calibration-svg image'); return i && i.getAttribute('width') === '1000' && !document.querySelector('#import-rotate-right').disabled; })()`, 'rotated', 15000)
    .then(() => check('«Roter mot høyre» turns the photo upright', true), e => check('«Roter mot høyre» turns the photo upright', false, e.message));
  check('«Tilbakestill» appears after a change', await evaluate(`!${q('#import-reset-correction')}.hidden`));

  // Straighten: drag each corner handle onto the plan's corner.
  await clickEl('#import-straighten');
  await until(`document.querySelectorAll('.import-corner').length === 4`, 'corner handles');
  const straightenState = await evaluate(`({pressed: ${q('#import-straighten')}.getAttribute('aria-pressed'), measureHidden: ${q('#import-measure-panel')}.hidden, focused: document.activeElement?.dataset?.corner, apply: ${q('#calibration-apply')}.disabled})`);
  check('«Beskjær og rett opp» shows four handles, hides the measuring and focuses the first corner', straightenState.pressed === 'true' && straightenState.measureHidden && straightenState.focused === '0' && straightenState.apply, JSON.stringify(straightenState));
  await shot('photo-straighten-start');
  const start = await corners();
  for (let index = 0; index < 4; index++) await drag(await screenAt(start[index].x, start[index].y), await screenAt(OUTLINE[index].x, OUTLINE[index].y));
  const dragged = await corners();
  const off = Math.max(...dragged.map((point, index) => Math.hypot(point.x - OUTLINE[index].x, point.y - OUTLINE[index].y)));
  check('the corners follow the pointer', off < 4, `furthest ${off.toFixed(1)} px from target`);
  await shot('photo-straighten-corners');

  // A folded outline is refused before anything is sent to the warp.
  await evaluate(`${q('.import-corner[data-corner="1"]')}.focus()`);
  const before = (await corners())[1];
  await key('ArrowLeft', 'ArrowLeft', 37);
  const after = (await corners())[1];
  check('arrow keys move the focused corner', Math.abs(before.x - after.x - 5) < 0.01 && before.y === after.y, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  await key('ArrowRight', 'ArrowRight', 39);

  await clickEl('#straighten-apply');
  await until(`(() => { const i = document.querySelector('#calibration-svg image'); return i && +i.getAttribute('width') < 900 && !document.querySelector('#calibration-svg').classList.contains('is-straightening'); })()`, 'straightened', 20000)
    .then(() => check('«Rett opp» replaces the photo with the straightened plan', true), e => check('«Rett opp» replaces the photo with the straightened plan', false, e.message));
  const size = await viewSize();
  // Straightening alone only estimates the proportions (the average of opposite sides: 737 × 551 here, 1.34 instead of
  // the plan's 1.5). The dimension across, measured below, is what makes them right.
  check('the straightened size is the average of the outline\'s opposite sides', Math.abs(size.width - 737) <= 2 && Math.abs(size.height - 551) <= 2, JSON.stringify(size));
  // Sample the straightened picture: the grey table must be gone from all four edges.
  const edges = await evaluate(`(async () => {
    const href = document.querySelector('#calibration-svg image').getAttribute('href');
    const bitmap = await createImageBitmap(await (await fetch(href)).blob());
    const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; const x = c.getContext('2d'); x.drawImage(bitmap, 0, 0);
    const grey = (px, py) => { const d = x.getImageData(px, py, 1, 1).data; return Math.abs(d[0] - 128) < 30 && Math.abs(d[1] - 128) < 30; };
    const w = c.width, h = c.height, samples = [[w / 2, 3], [w / 2, h - 4], [3, h / 2], [w - 4, h / 2], [6, 6], [w - 7, 6], [6, h - 7], [w - 7, h - 7]];
    return samples.filter(([px, py]) => grey(Math.round(px), Math.round(py))).length;
  })()`);
  check('no grey table is left along the edges', edges === 0, `${edges} of 8 edge samples are grey`);
  await shot('photo-straightened');

  // Scale: the 10 m wall in millimetres, and the 6 m wall across it.
  await setValue('#calibration-unit', 'mm', 'change');
  const at = (fx, fy) => screenAt(size.width * fx / 600, size.height * fy / 400);
  await click(await at(50, 200)); await click(await at(550, 200));
  await setValue('#calibration-meters', '10000');
  await evaluate(`(() => { const box = ${q('#calibration-cross')}; box.checked = true; box.dispatchEvent(new Event('change', {bubbles: true})); })()`);
  check('the cross dimension asks for points 3 and 4', /punkt 3/.test(await evaluate(`${q('#calibration-measure')}.textContent`)), await evaluate(`${q('#calibration-measure')}.textContent`));
  await click(await at(300, 50)); await click(await at(300, 350));
  await setValue('#cross-meters', '6000');
  await until(`!document.querySelector('#calibration-apply').disabled`, 'scale accepted', 5000)
    .then(() => check('two dimensions enable «Bruk tegningen i studio»', true), e => check('two dimensions enable «Bruk tegningen i studio»', false, e.message));
  check('the preview shows the plan\'s size', /Tegningen blir 1[12],\d × [78],\d meter|Tegningen blir 12 × 8 meter/.test(await evaluate(`${q('#calibration-measure')}.textContent`)), await evaluate(`${q('#calibration-measure')}.textContent`));
  await shot('photo-measured');

  await clickEl('#calibration-apply');
  await until(`!document.querySelector('#app-dialog').open && !!romly.editor.getState().reference`, 'reference applied', 20000)
    .then(() => check('the straightened plan becomes the drawing reference', true), e => check('the straightened plan becomes the drawing reference', false, e.message));
  const result = await evaluate(`(() => {
    const ref = romly.editor.getState().reference;
    return {w: ref.w / 50, h: ref.h / 50, name: ref.name, mime: ref.mimeType, page: ref.page, image: !!romly.editor.referenceImage};
  })()`);
  check('the reference is the plan\'s real size, 12 × 8 m', Math.abs(result.w - 12) < 0.15 && Math.abs(result.h - 8) < 0.15, `${result.w.toFixed(2)} × ${result.h.toFixed(2)} m`);
  check('the reference is a «(rettet)» JPEG copy', result.name === 'qa-photo-plan (rettet).jpg' && result.mime === 'image/jpeg' && result.page === 1, JSON.stringify(result));
  check('the straightened picture shows under the drawing', result.image);
  await shot('photo-reference');

  // Reloading opens the copy from the device store, and the original is still there.
  await go('/studio/index.html');
  await until(`!!window.romly && !!romly.getActiveRecord() && !!romly.editor.getState().reference`, 'project reopened', 30000);
  if (await evaluate(`${title} === 'Veien til søknad'`)) { await clickEl('#roadmap-close'); await until(`!document.querySelector('#app-dialog').open`, 'roadmap closed'); }
  await until(`!!romly.editor.referenceImage`, 'reference image after reload', 20000)
    .then(() => check('after reloading, the straightened copy loads as the reference', true), e => check('after reloading, the straightened copy loads as the reference', false, e.message));
  await clickEl('#roadmap-btn');
  await until(`${title} === 'Veien til søknad'`, 'roadmap', 10000);
  await clickEl('#roadmap [data-step="ground"] [data-roadmap-action="ground"]');
  await until(`${title} === 'La oss bli kjent med hjemmet ditt' && document.querySelectorAll('[data-use-plan]').length === 2`, 'Grunnlag with two files', 15000)
    .then(() => check('Grunnlag lists both the original photo and the straightened copy', true), e => evaluate(`[...document.querySelectorAll('.upload-item strong')].map(s => s.textContent).join(', ')`).then(names => check('Grunnlag lists both the original photo and the straightened copy', false, `${e.message}: ${names}`)));

  // Phone width: the dialog fits, and a corner can be dragged with a finger.
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  const originalId = await evaluate(`[...document.querySelectorAll('[data-use-plan]')].find(button => !/rettet/.test(button.closest('div').querySelector('strong').textContent))?.dataset.usePlan`);
  await clickEl(`[data-use-plan="${originalId}"]`);
  await until(`${title} === 'Bruk din egen plantegning' && !!document.querySelector('#calibration-svg image') && !document.querySelector('#import-straighten').disabled`, 'import dialog on a phone', 20000);
  const phone = await evaluate(`(() => {
    const dialog = document.querySelector('#app-dialog'), buttons = [...document.querySelectorAll('.import-tools .button:not([hidden])')];
    const small = [...dialog.querySelectorAll('.import-tools .button, .import-cross-toggle, .import-straighten-bar p, .import-measurements label')].filter(el => parseFloat(getComputedStyle(el).fontSize) < 11).length;
    return {overflow: dialog.scrollWidth - dialog.clientWidth, page: document.documentElement.scrollWidth - innerWidth, offscreen: buttons.filter(button => { const r = button.getBoundingClientRect(); return r.right > innerWidth || r.left < 0; }).length, small};
  })()`);
  check('at phone width the dialog has no sideways scroll and the tools stay on screen', phone.overflow <= 0 && phone.page <= 0 && !phone.offscreen && !phone.small, JSON.stringify(phone));
  await shot('photo-phone');
  await clickEl('#import-straighten');
  await until(`document.querySelectorAll('.import-corner').length === 4`, 'corner handles on a phone');
  await evaluate(`${q('#calibration-svg')}.scrollIntoView({block: 'center'})`);
  const phoneStart = (await corners())[2], target = {x: phoneStart.x - 200, y: phoneStart.y - 150};
  const from = await screenAt(phoneStart.x, phoneStart.y), to = await screenAt(target.x, target.y);
  await send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: from.x, y: from.y, id: 1}]});
  for (let step = 1; step <= 6; step++) await send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: from.x + (to.x - from.x) * step / 6, y: from.y + (to.y - from.y) * step / 6, id: 1}]});
  await send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  const moved = (await corners())[2];
  check('a corner can be dragged with a finger', Math.hypot(moved.x - target.x, moved.y - target.y) < 12, `${JSON.stringify(moved)} vs ${JSON.stringify(target)}`);
  await shot('photo-phone-straighten');
  await clickEl('#straighten-cancel');
  check('«Avbryt» leaves the photo as it was', await evaluate(`!document.querySelector('.import-corner') && ${q('#import-reset-correction')}.hidden`));

  check('the studio never calls the server API', !b.apiRequests.length, b.apiRequests.slice(0, 3).join(' | '));
} catch (error) {
  check('script completed', false, error.message);
}
process.exit(await b.finish() ? 0 : 1);
