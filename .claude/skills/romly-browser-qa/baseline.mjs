// Browser check for "Dagens planløsning": save it through the dialog, change the plan, and see the ghost, the check
// (with the Ja/Nei answer for a removed wall), the brief, a reload, removal and undo.
// Usage: node .claude/skills/romly-browser-qa/baseline.mjs [base-url]   (default http://127.0.0.1:5174)
import {openBrowser, pause} from './qa-harness.mjs';

const b = await openBrowser({base: process.argv[2] || 'http://127.0.0.1:5174'});
const {go, evaluate, until, check, shot, send} = b;
const label = () => evaluate(`document.querySelector('#baseline-label').textContent`);
try {
  await go('/studio/index.html');
  await until(`!!window.romly && !!document.querySelector('#first-project-btn')`, 'empty studio', 60000);
  await evaluate(`document.querySelector('#first-project-btn').click()`);
  await until(`!!document.querySelector('#create-project-submit')`, 'create form');
  await evaluate(`document.querySelector('#create-project-name').value = 'Bod til soverom'; document.querySelector('#create-project-submit').click()`);
  await until(`!!romly.getActiveRecord() && !!document.querySelector('#ground-cancel')`, 'project created', 30000);
  await evaluate(`document.querySelector('#ground-cancel').click()`);

  // Today's home: Stue and Bod side by side, one window in Stue.
  await evaluate(`(() => {
    const room = (id, name, type, x) => ({id, name, type, x, y: 0, w: 200, h: 200, color: '#ece5d8', width: 4, height: 4, area: 16});
    romly.editor.loadState({rooms: [room('stue', 'Stue', 'living', 0), room('bod', 'Bod', 'storage', 200)], items: [{id: 'win', type: 'window', x: 100, y: 0, rotation: 0}], variant: 'custom', walls: [], schemaVersion: romly.editor.getState().schemaVersion});
  })()`);
  check('without a baseline the button offers to save one', /Lagre dagens planløsning/.test(await label()), await label());

  await evaluate(`document.querySelector('#baseline-btn').click()`);
  await until(`!!document.querySelector('#baseline-save')`, 'save dialog');
  await evaluate(`document.querySelector('#baseline-save').click()`);
  await until(`!!romly.editor.getState().baseline`, 'baseline saved');
  check('saving changes the button to show the date', /Dagens planløsning · \d/.test(await label()) && await evaluate(`document.querySelector('#baseline-btn').classList.contains('saved')`), await label());

  // The change: the Bod becomes part of a bigger bedroom.
  await evaluate(`(() => { const e = romly.editor; e.selected = 'bod'; e.removeSelected(); e.checkpoint(); e.resizeRoomTo('stue', 400, 200, {quiet: true}); e.notify(); e.updateRoom('stue', {type: 'bedroom', name: 'Soverom'}); })()`);
  await pause(200);
  check('the removed wall is drawn as a ghost', await evaluate(`document.querySelectorAll('#floorplan [data-removed-wall]').length`) === 1);
  await shot('baseline-1-ghost');

  // The check asks whether the removed wall was load-bearing; answering Ja turns it into an application.
  await evaluate(`document.querySelector('#check-btn').click()`);
  await until(`document.querySelectorAll('#check-results .check-item').length > 0`, 'check results', 10000);
  const find = title => `[...document.querySelectorAll('#check-results .check-item')].find(el => el.querySelector('h3')?.textContent.startsWith(${JSON.stringify(title)}))`;
  check('the check asks whether the removed wall was load-bearing, with Ja/Nei', await evaluate(`!!${find('Var veggen bærende?')}?.querySelector('[data-baseline-bearing="yes"]')`));
  check('the Bod becoming part of the bedroom is a change of use', await evaluate(`${find('Bod blir oppholdsrom')}?.dataset.status`) === 'soknad');
  await evaluate(`${find('Var veggen bærende?')}.scrollIntoView({block: 'center'})`);
  await shot('baseline-2-question');
  await evaluate(`${find('Var veggen bærende?')}.querySelector('[data-baseline-bearing="yes"]').click()`);
  await pause(200);
  check('answering Ja reports the removed load-bearing wall as needing an application', await evaluate(`${find('Fjernet bærende vegg')}?.dataset.status`) === 'soknad' && await evaluate(`!${find('Var veggen bærende?')}`));
  check('the answer is stored on the baseline', await evaluate(`romly.editor.getState().baseline.walls.some(note => note.loadBearing === 'yes')`));
  const brief = await evaluate(`new Promise(resolve => { const original = URL.createObjectURL; URL.createObjectURL = blob => { URL.createObjectURL = original; blob.text().then(resolve); return original.call(URL, blob); }; document.querySelector('#download-review').click(); })`);
  const section = brief.match(/DAGENS PLANLØSNING\n[^\n]*\n[^\n]*/)?.[0] || '';
  check('the brief lists the removed wall with its answer', /- Fjernet: Vegg mellom (Stue og Bod|Bod og Stue) \(4 m\), bærende: ja/.test(section), section.replace(/\n/g, ' / '));
  await evaluate(`document.querySelector('#check-back').click()`);

  // Reload: the baseline, the answer and the ghost come back.
  await until(`!romly.getSync().dirty && document.querySelector('#save-status').textContent.includes('Lagret')`, 'autosave', 15000);
  const id = await evaluate(`romly.getActiveRecord().id`);
  await go('/studio/index.html');
  await until(`window.romly?.getActiveRecord()?.id === ${JSON.stringify(id)}`, 'reopened', 30000);
  check('the baseline survives a reload', await evaluate(`romly.editor.getState().baseline?.walls?.[0]?.loadBearing === 'yes' && document.querySelectorAll('#floorplan [data-removed-wall]').length === 1`) && /Dagens planløsning ·/.test(await label()));

  // Removing asks once more; undo brings it back.
  await evaluate(`document.querySelector('#baseline-btn').click()`);
  await until(`!!document.querySelector('#baseline-remove')`, 'baseline dialog');
  check('the dialog summarises the changes', /1 vegg er fjernet/.test(await evaluate(`document.querySelector('.baseline-changes')?.textContent || ''`)));
  const confirmShown = `getComputedStyle(document.querySelector('#baseline-confirm')).display !== 'none'`;
  check('no confirmation is shown before Fjern is clicked', !await evaluate(confirmShown));
  await shot('baseline-3-dialog');
  await evaluate(`document.querySelector('#baseline-remove').click()`);
  check('the first click on Fjern only asks', await evaluate(`!!romly.editor.getState().baseline && ${confirmShown}`));
  await evaluate(`document.querySelector('#baseline-remove').click()`);
  await until(`!romly.editor.getState().baseline`, 'baseline removed', 5000);
  check('confirming removes it, with the ghost and the saved label', /Lagre dagens planløsning/.test(await label()) && await evaluate(`!document.querySelector('#floorplan [data-removed-wall]')`));
  await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2});
  await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2});
  await pause(200);
  check('Ctrl+Z brings the baseline back', await evaluate(`!!romly.editor.getState().baseline`) && /Dagens planløsning ·/.test(await label()));
} catch (error) {
  check('script completed', false, error.message);
}
process.exit(await b.finish() ? 0 : 1);
