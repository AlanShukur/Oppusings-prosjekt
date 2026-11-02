// Smoke test for a running Romly: public pages and links, then the studio with on-device storage.
// Usage: node .claude/skills/romly-browser-qa/smoke.mjs [base-url]   (default http://127.0.0.1:5174)
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openBrowser} from './qa-harness.mjs';

const b = await openBrowser({base: process.argv[2] || 'http://127.0.0.1:5174'});
const {go, evaluate, until, shot, setFiles, check} = b;
try {
  // Public pages. Links must navigate in production builds (vinext <Link> did not).
  await go('/');
  await until(`!!document.querySelector('h1')`, 'landing page', 30000);
  const landing = await evaluate(`({path: location.pathname, hrefs: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')), text: document.body.innerText})`);
  check('landing renders at / and links to the studio', landing.path === '/' && landing.hrefs.includes('/studio/index.html'), landing.path);
  check('landing links to personvern and vilkår', ['/personvern', '/vilkar'].every(h => landing.hrefs.includes(h)));
  check('landing never mentions sign-in', !/logg inn|chatgpt/i.test(landing.text));
  await shot('01-landing');
  await evaluate(`document.querySelector('a[href="/personvern"]').click()`);
  await until(`location.pathname === '/personvern' && document.querySelector('h1')?.textContent === 'Personvern'`, 'navigation to /personvern').then(() => check('clicking Personvern navigates', true), e => check('clicking Personvern navigates', false, e.message));
  await go('/vilkar');
  await until(`document.querySelector('h1')?.textContent === 'Vilkår for bruk'`, '/vilkar').then(() => check('/vilkar renders', true), e => check('/vilkar renders', false, e.message));
  if (await evaluate(`!!document.querySelector('[role="note"]')`)) console.log('note: the legal pages still show the draft notice (lib/company.ts legalReviewed is false)');

  // Studio, first visit: no sign-in, empty projects dialog.
  await go('/studio/index.html');
  await until(`!!window.romly && document.querySelector('#app-dialog').open && !!document.querySelector('#first-project-btn')`, 'empty projects dialog', 30000);
  check('no sign-in in the studio', !await evaluate(`/logg inn|logg ut|chatgpt/i.test(document.body.innerText)`));
  await evaluate(`document.querySelector('#first-project-btn').click()`);
  await until(`!!document.querySelector('#create-project-submit')`, 'create-project form');
  await evaluate(`document.querySelector('#create-project-name').value = 'QA-hus'; document.querySelector('#create-project-submit').click()`);
  await until(`!!window.romly.getActiveRecord() && !!document.querySelector('#file-input')`, 'project created', 30000);
  check('creating a project works', true);

  // Upload through the real file input; the file stays in IndexedDB.
  const png = join(b.out, 'plan.png');
  await writeFile(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=', 'base64'));
  await setFiles('#file-input', [png]);
  await until(`document.querySelectorAll('#upload-list .upload-item').length === 1`, 'uploaded file listed');
  check('upload is stored on the device', await evaluate(`document.querySelector('#upload-list').innerText.includes('Lagret på denne enheten')`));
  await evaluate(`document.querySelector('#ground-cancel').click()`);

  // Edit, autosave, reload.
  await evaluate(`romly.editor.updateRoom('bed1', {name: 'Kontor på loftet'})`);
  await until(`document.querySelector('#save-status').textContent.includes('Lagret på denne enheten') && !romly.getSync().dirty`, 'autosave', 15000);
  check('autosave saves on this device', true);
  await shot('02-studio');
  const id = await evaluate(`romly.getActiveRecord().id`);
  await go('/studio/index.html');
  await until(`window.romly?.getActiveRecord()?.id === ${JSON.stringify(id)}`, 'reopened project', 30000);
  const reopened = await evaluate(`({room: romly.editor.getState().rooms.find(r => r.id === 'bed1')?.name, files: romly.getUploads()})`);
  check('project and file survive a reload', reopened.room === 'Kontor på loftet' && reopened.files === 1, JSON.stringify(reopened));

  // The TEK17 check opens and lists results for the example home.
  await evaluate(`document.querySelector('#check-btn').click()`);
  await until(`document.querySelectorAll('#check-results .check-item').length > 0`, 'TEK17 results', 10000)
    .then(() => check('the TEK17 check shows results', true), e => check('the TEK17 check shows results', false, e.message));
  await shot('03-check');

  check('the studio never calls the server API', !b.apiRequests.length, b.apiRequests.slice(0, 3).join(' | '));
} catch (error) {
  check('script completed', false, error.message);
}
process.exit(await b.finish() ? 0 : 1);
