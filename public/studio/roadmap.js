// The roadmap from a new project to "Send søknad": which steps there are, which are done, and which way the
// chart goes after the check. Pure: no DOM. The start screen (roadmap-ui.js) draws what this returns.
import { compareToBaseline } from './plan-diff.js';
import { evaluatePlan } from './tek17-check.js';
import { FACT_QUESTIONS } from './facts.js';

/** What the user ticks or does that Romly can't read from the drawing. Stored as `project.roadmap`, true only. */
export const ROADMAP_FLAGS = ['checkSeen', 'briefDownloaded', 'professional', 'neighbours', 'sent'];

// Sources checked 16.11.2026: DiBK "Send nabovarsel" and "Steg 6: Fyll ut søknaden og send inn".
export const ROADMAP_LINKS = {
  neighbours: 'https://www.dibk.no/nabovarsel/send-nabovarsel',
  application: 'https://www.dibk.no/verktoy-og-veivisere/atte-steg-fra-ide-til-ferdig-soknad/stegene-fra-ide-til-ferdig-soknad/steg-6-fyll-ut-soknaden-og-send-inn',
  forms: 'https://www.dibk.no/soknad-og-skjema/soknadsskjemaer-for-byggesak',
};

// The check's rules about whether an application is needed.
const APPLICATION_RULES = new Set(['pbl-20-1', 'pbl-20-5', 'bruksendring', 'innvendig']);

/**
 * Which way the chart goes after the check:
 * 'soknad'   the check found something that probably needs an application;
 * 'avklar'   the check warns about something that may need one (it follows the same steps as 'soknad');
 * 'ingen'    the check found the change normally exempt, with nothing open;
 * 'uavklart' nothing is drawn yet, or the check still has unanswered questions about the application.
 */
export function roadmapBranch(report, drawn) {
  if (!drawn) return 'uavklart';
  if (report.results.some(result => result.status === 'soknad')) return 'soknad';
  const about = status => report.results.some(result => APPLICATION_RULES.has(result.ruleId) && result.status === status);
  if (about('ukjent')) return 'uavklart';
  if (about('advarsel')) return 'avklar';
  return report.results.some(result => result.exempt) ? 'ingen' : 'uavklart';
}

/**
 * The roadmap for one project.
 * @param plan     the editor's state
 * @param project  the project (wishes, facts and `roadmap` flags)
 * @param context  {example: the drawing is still Romly's example home, fileCount: uploaded files, report: a check report to reuse}
 * @returns {branch, trunk, branches: {soknad, ingen}, done, total, next}
 *   Each step is {id, title, text, done, status: 'done' | 'next' | 'todo', manual?, action?, link?}.
 */
export function buildRoadmap(plan, project, {example = false, fileCount = 0, report = evaluatePlan(plan, project)} = {}) {
  const flags = project.roadmap || {};
  const drawn = !example && plan.rooms.length > 0;
  const diff = compareToBaseline(plan);
  const changed = !!diff && (diff.removedWalls.length + diff.newWalls.length + diff.newOpenings.length + diff.removedOpenings.length > 0)
    || (plan.walls || []).some(note => note.status !== 'existing');
  const measures = FACT_QUESTIONS.filter(question => question.group === 'measures');
  const answered = measures.filter(question => project.measures?.[question.key] !== undefined).length;
  const branch = roadmapBranch(report, drawn);

  const trunk = [
    {id: 'project', title: 'Opprett prosjektet', text: 'Prosjektet er opprettet og lagres på denne enheten.', done: true, action: 'details'},
    {id: 'ground', title: 'Legg inn grunnlaget', text: 'Last opp plantegningen eller bilder av boligen.', done: fileCount > 0 || !!plan.reference, action: 'ground'},
    {id: 'draw', title: 'Tegn boligen slik den er i dag', text: example ? 'Tegningen er Romlys eksempelbolig. Tegn din egen bolig.' : 'Tegn rommene, dørene og vinduene. Marker bærende vegger.', done: drawn, action: 'drawing'},
    {id: 'baseline', title: 'Lagre dagens planløsning', text: 'Da kan kontrollen se hva du endrer.', done: !!plan.baseline, action: 'baseline'},
    {id: 'changes', title: 'Tegn endringene', text: 'Flytt, fjern eller legg til vegger, dører og vinduer.', done: changed, action: 'drawing'},
    {id: 'facts', title: 'Svar på spørsmålene om tiltaket', text: `${answered} av ${measures.length} spørsmål er besvart.`, done: answered === measures.length, action: 'facts'},
    {id: 'check', title: 'Kjør prosjektkontrollen', text: branch === 'uavklart' ? 'Kontrollen viser om tiltaket trolig krever søknad. Avklar punktene den spør om.' : 'Kontrollen er veiledende. Du som tiltakshaver har ansvaret.', done: !!flags.checkSeen && branch !== 'uavklart', action: 'check'},
  ];
  const documents = {id: 'documents', title: 'Samle tegninger og prosjektbrief', text: 'Last ned prosjektbriefen og tegningen.', done: !!flags.briefDownloaded, action: 'documents'};
  const soknad = [
    {id: 'professional', title: 'Avklar med fagperson', text: 'Større tiltak, som inngrep i bærende vegg, krever ansvarlige foretak. Da sender en ansvarlig søker søknaden for deg.', done: !!flags.professional, manual: 'professional'},
    {id: 'neighbours', title: 'Send nabovarsel', text: 'Naboene varsles før du søker, med minst to ukers frist. Kvitteringen legges ved søknaden.', done: !!flags.neighbours, manual: 'neighbours', link: ROADMAP_LINKS.neighbours},
    documents,
    {id: 'send', title: 'Send søknad', text: 'Søknaden sendes til kommunen med alle vedlegg. Romly sender ingenting.', done: !!flags.sent, action: 'send'},
  ];
  const ingen = [
    {...documents},
    {id: 'ready', title: 'Ingen søknad ser ut til å kreves', text: 'Vurderingen er veiledende. Du som tiltakshaver har ansvaret for at tiltaket er lovlig og oppfyller TEK17.', done: !!flags.briefDownloaded && branch === 'ingen', end: true},
  ];

  // Progress follows the trunk and then the branch the check chose. With the branch open, only the trunk counts.
  const path = [...trunk, ...(branch === 'soknad' || branch === 'avklar' ? soknad : branch === 'ingen' ? ingen : [])];
  const next = path.find(step => !step.done) || null;
  // Steps on the way the check did not choose are never shown as done, whatever was ticked earlier.
  const off = branch === 'ingen' ? soknad : branch === 'soknad' || branch === 'avklar' ? ingen : [];
  for (const step of [...trunk, ...soknad, ...ingen]) step.status = step.done && !off.includes(step) ? 'done' : 'todo';
  if (next) next.status = 'next';
  return {branch, trunk, branches: {soknad, ingen}, done: path.filter(step => step.done).length, total: path.length, next};
}
