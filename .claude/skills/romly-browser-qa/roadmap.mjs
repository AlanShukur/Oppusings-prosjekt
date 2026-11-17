// The roadmap to «Send søknad», start to finish: a new project opens on it with one step done; drawing a home,
// saving today's layout, removing a load-bearing wall and answering the questions tick the steps off; the chart
// takes the «søknad» branch; the manual ticks, the brief and the hand-off finish it; a reload keeps it all; and a
// non-load-bearing change switches to the «ingen søknad» branch.
// Usage: node .claude/skills/romly-browser-qa/roadmap.mjs [base-url]   (default http://127.0.0.1:5174)
import {openBrowser} from './qa-harness.mjs';

const b = await openBrowser({base: process.argv[2] || 'http://127.0.0.1:5174'});
const {go, evaluate, until, shot, check} = b;
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const title = `(document.querySelector('#app-dialog').open ? document.querySelector('#dialog-title')?.textContent : null)`;
const label = () => evaluate(`document.querySelector('#roadmap-label').textContent`);
const state = () => evaluate(`({
  done: [...document.querySelectorAll('#roadmap [data-status="done"]')].map(el => el.dataset.step),
  next: document.querySelector('#roadmap [data-status="next"]')?.dataset.step ?? null,
  soknad: document.querySelector('#roadmap [data-branch="soknad"]').dataset.active,
  ingen: document.querySelector('#roadmap [data-branch="ingen"]').dataset.active,
  progress: document.querySelector('#roadmap .roadmap-progress').textContent,
})`);
const openRoadmap = async () => { await click('#roadmap-btn'); await until(`${title} === 'Veien til søknad'`, 'the roadmap'); };
const answer = (fact, value) => evaluate(`(() => { const el = document.querySelector('[data-fact="${fact}"]'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', {bubbles: true})); })()`);

try {
  await go('/studio/index.html');
  await until(`!!window.romly && !!document.querySelector('#first-project-btn')`, 'projects dialog', 30000);
  check('no roadmap button without a project', await evaluate(`getComputedStyle(document.querySelector('#roadmap-btn')).display === 'none'`));
  await click('#first-project-btn');
  await until(`!!document.querySelector('#create-project-submit')`, 'create form');
  await click('#create-project-submit');
  await until(`${title} === 'Veien til søknad' && !!document.querySelector('#roadmap .roadmap-step')`, 'the roadmap', 30000);

  // A new project: the whole chart is there, only the first step is done.
  const fresh = await state();
  const shape = await evaluate(`({trunk: document.querySelectorAll('#roadmap .roadmap-trunk > .roadmap-step').length, soknad: [...document.querySelectorAll('#roadmap [data-branch="soknad"] h3:not(.roadmap-branch-title)')].map(h => h.firstChild.textContent), ingen: document.querySelectorAll('#roadmap [data-branch="ingen"] .roadmap-step').length})`);
  check('the chart has 7 steps, then splits into two ways', shape.trunk === 7 && shape.soknad.length === 4 && shape.ingen === 2, JSON.stringify(shape));
  check('the last step is «Send søknad»', shape.soknad.at(-1) === 'Send søknad');
  check('a new project has only the first step done, and the way ahead is open', fresh.done.join() === 'project' && fresh.next === 'ground' && fresh.soknad === 'open' && fresh.ingen === 'open', JSON.stringify(fresh));
  check('the header button shows the progress', await label() === 'Veikart · 1 av 7' && await evaluate(`getComputedStyle(document.querySelector('#roadmap-btn')).display !== 'none'`), await label());
  await shot('roadmap-new');

  // Draw a home of your own: «Tegn boligen» ticks off.
  await click('#roadmap-close');
  await evaluate(`(() => {
    const room = (id, name, x, type) => ({id, name, type, x, y: 0, w: 200, h: 200, color: '#e8e1d1', width: 4, height: 4, area: 16});
    romly.editor.loadState({variant: 'custom', walls: [], items: [{id: 'w', type: 'window', x: 100, y: 0, rotation: 0}], rooms: [room('a', 'Stue', 0, 'living'), room('b', 'Soverom', 200, 'bedroom')]});
  })()`);
  check('drawing your own home ticks off «Tegn boligen»', await label() === 'Veikart · 2 av 7', await label());

  // Save today's layout from the roadmap step.
  await openRoadmap();
  await click('#roadmap [data-step="baseline"] [data-roadmap-action="baseline"]');
  await until(`${title} === 'Dagens planløsning' && !!document.querySelector('#baseline-save')`, 'baseline dialog');
  await click('#baseline-save');
  check('the «Lagre dagens planløsning» step opens the dialog, and saving ticks it off', await label() === 'Veikart · 3 av 7', await label());

  // Remove a load-bearing wall, then answer the questions from the roadmap step.
  await evaluate(`romly.editor.updateWall('a:right|b:left', {status: 'demolish', loadBearing: 'yes'})`);
  check('marking a load-bearing wall for removal ticks off «Tegn endringene» and points to the «søknad» way at once', await label() === 'Veikart · 4 av 11', await label());
  await openRoadmap();
  await click('#roadmap [data-step="facts"] [data-roadmap-action="facts"]');
  await until(`${title} === 'Et steg nærmere realisering' && document.querySelector('#facts-form').open`, 'the facts form');
  check('«Svar på spørsmålene» opens the check with the questions unfolded', true);
  await answer('measures.bearingWall', 'ja'); await answer('measures.facade', 'false'); await answer('measures.useChange', 'nei'); await answer('measures.newPipesThroughFireSeparation', 'false');

  // The check has now been opened and is settled: the chart takes the «søknad» way.
  await openRoadmap();
  const branched = await state();
  check('the questions and the check tick off, and only «Legg inn grunnlaget» is left above the split', ['facts', 'check'].every(id => branched.done.includes(id)) && branched.next === 'ground', JSON.stringify(branched));
  check('the chart takes «Krever trolig søknad»; the other way is marked as not relevant', branched.soknad === 'true' && branched.ingen === 'false' && await evaluate(`document.querySelector('#roadmap [data-branch="ingen"] .roadmap-branch-title').textContent.includes('Ikke aktuelt nå')`), JSON.stringify(branched));
  check('progress now counts the steps down to «Send søknad»', await label() === 'Veikart · 6 av 11', await label());
  await shot('roadmap-branch');

  // The steps outside Romly are ticked by hand, and stay ticked.
  await click('#roadmap [data-roadmap-flag="professional"]');
  await click('#roadmap [data-roadmap-flag="neighbours"]');
  const ticked = await state();
  check('ticking «Avklar med fagperson» and «Send nabovarsel» marks them done', ['professional', 'neighbours'].every(id => ticked.done.includes(id)) && await evaluate(`romly.getProject().roadmap.professional === true && romly.getProject().roadmap.neighbours === true`), JSON.stringify(ticked.done));
  check('the nabovarsel step links to DiBK', await evaluate(`document.querySelector('#roadmap [data-step="neighbours"] a')?.href === 'https://www.dibk.no/nabovarsel/send-nabovarsel'`));
  await click('#roadmap [data-step="documents"] [data-roadmap-action="brief"]');
  check('downloading the brief ticks off «Samle tegninger og prosjektbrief»', (await state()).done.includes('documents'));

  // The last step is a hand-off: documents, a checklist and where to send. Romly sends nothing.
  await click('#roadmap [data-step="send"] [data-roadmap-action="send"]');
  await until(`${title} === 'Send søknad'`, 'the hand-off');
  const handoff = await evaluate(`({text: document.querySelector('#dialog-content').innerText, links: [...document.querySelectorAll('#dialog-content a')].map(a => a.href)})`);
  check('the hand-off says Romly sends nothing, and never that anything is approved', handoff.text.includes('Romly sender ingenting') && !/godkjent|klar til innsending/i.test(handoff.text));
  check('the hand-off lists the nabovarsel receipt and links to DiBK', handoff.text.includes('Kvitteringen for nabovarselet') && handoff.links.length === 2 && handoff.links.every(href => href.startsWith('https://www.dibk.no/')), handoff.links.join(' | '));
  await shot('roadmap-handoff');
  await click('#handoff-sent');
  await click('#handoff-back');
  await until(`${title} === 'Veien til søknad'`, 'back on the roadmap');
  const sent = await state();
  check('marking the application as sent finishes the last step', sent.done.includes('send') && await label() === 'Veikart · 10 av 11', await label());

  // Everything survives a reload, and the project opens on its roadmap.
  await until(`!romly.getSync().dirty`, 'autosave', 15000);
  await go('/studio/index.html');
  await until(`${title} === 'Veien til søknad' && !!document.querySelector('#roadmap .roadmap-step')`, 'the roadmap after a reload', 30000);
  const reloaded = await state();
  check('after a reload the project opens on its roadmap with the same steps done', reloaded.done.length === 10 && reloaded.next === 'ground' && reloaded.soknad === 'true', JSON.stringify(reloaded));

  // The roadmap follows the drawing: a wall that is not load-bearing switches to the other way.
  await evaluate(`romly.editor.updateWall('a:right|b:left', {loadBearing: 'no'})`);
  await click('#roadmap [data-step="facts"] [data-roadmap-action="facts"]');
  await until(`document.querySelector('#facts-form')?.open`, 'the facts form');
  await answer('measures.bearingWall', 'nei');
  await openRoadmap();
  const other = await state();
  check('a non-load-bearing wall switches the chart to «Ser ikke ut til å kreve søknad»', other.ingen === 'true' && other.soknad === 'false' && other.done.includes('ready') && await label() === 'Veikart · 8 av 9', JSON.stringify(other) + ' ' + await label());
  check('that way ends with the reminder that the assessment is indicative', await evaluate(`document.querySelector('#roadmap [data-step="ready"] p').textContent.includes('veiledende')`));
  await shot('roadmap-no-application');

  check('the studio never calls the server API', !b.apiRequests.length, b.apiRequests.slice(0, 3).join(' | '));
} catch (error) {
  check('script completed', false, error.message);
}
process.exit(await b.finish() ? 0 : 1);
