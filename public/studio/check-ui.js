// Step 4, Prosjektkontroll: the indicative TEK17 check, the facts form and the brief download.
import { evaluatePlan, STATUS_LABELS, DISCLAIMER, RULESET } from './tek17-check.js';
import { icon, $, toast, download, compactWorkspace, setWorkspacePanel } from './ui.js';
import { esc, fmt, decimal, inputNumber } from './format.js';
import { studio, editor } from './state.js';
import { openDialog, closeDialog } from './dialog.js';
import { FACT_QUESTIONS, factValue } from './facts.js';
import { projectBrief } from './brief.js';
import { persist } from './projects.js';

function factField(question){
  const value=factValue(studio.project,question),name=`${question.group}.${question.key}`,hint=question.hint?`<small>${esc(question.hint)}</small>`:'';
  if(question.type==='bool'||question.type==='select'){
    const options=question.type==='bool'?[['true','Ja'],['false','Nei']]:question.options;
    return `<label class="field">${esc(question.label)}<select class="input" data-fact="${name}"><option value="">Ikke svart</option>${options.map(([key,label])=>`<option value="${key}" ${String(value)===key?'selected':''}>${esc(label)}</option>`).join('')}</select>${hint}</label>`;
  }
  return `<label class="field">${esc(question.label)}<input class="input" data-fact="${name}" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(question.placeholder||'Ikke oppgitt')}" value="${value===undefined?'':esc(inputNumber(value))}">${hint}</label>`;
}
function setFact(question,raw){
  let value=null;
  if(question.type==='bool')value=raw===''?null:raw==='true';
  else if(question.type==='select')value=raw||null;
  else{value=decimal(raw);if(value!==null&&(!Number.isFinite(value)||value<question.min||value>question.max||(question.type==='integer'&&!Number.isInteger(value)))){toast(`Bruk et tall mellom ${fmt(question.min)} og ${fmt(question.max)}.`);return false;}}
  const group={...(studio.project[question.group]||{})};
  if(value===null)delete group[question.key];else group[question.key]=value;
  if(Object.keys(group).length)studio.project[question.group]=group;else delete studio.project[question.group];
  persist();return true;
}
const CHECK_ICONS=[[/13-[78]/,'window'],[/12-13/,'door'],[/12-9|13-15|sak-4-1/,'bath'],[/11-13/,'shield'],[/12-10/,'layers'],[/13-2/,'cloud'],[/12-7|12-2/,'home'],[/pbl|sak|bruksendring|innvendig/,'document']];
function renderCheckResults(){
  const container=$('#check-results');if(!container)return;
  const state=editor.getState(),report=evaluatePlan(state,studio.project),s=report.summary;
  const headline=s.brudd?`${s.brudd} forhold oppfyller ikke preaksepterte ytelser`:s.soknad?'Tiltaket ser ut til å kreve søknad':s.ukjent?`${s.ukjent} ${s.ukjent===1?'punkt mangler':'punkter mangler'} opplysninger`:'Ingen avvik funnet i tegningen';
  const intro=state.rooms.length?(editor.isExample()?'Kontrollen gjelder Romlys eksempelbolig. Tegn din egen bolig for en kontroll av den.':'Kontrollen bygger på tegningen og svarene dine. Den er veiledende og erstatter ikke fagfolk.'):'Tegn rommene for å få en kontroll av planen.';
  const chips=Object.entries(s).filter(([,count])=>count).map(([status,count])=>`<span class="check-chip" data-status="${status}">${count} · ${esc(STATUS_LABELS[status])}</span>`).join('');
  const item=result=>`<article class="check-item" data-status="${result.status}"><span class="check-icon">${icon(CHECK_ICONS.find(([pattern])=>pattern.test(result.ruleId))?.[1]||'edit')}</span><div><div class="check-item-heading"><h3>${esc(result.title)}${result.roomId&&state.rooms.find(r=>r.id===result.roomId)?` · ${esc(state.rooms.find(r=>r.id===result.roomId).name)}`:''}</h3><span class="check-status">${esc(STATUS_LABELS[result.status])}</span></div><p>${esc(result.message)}</p><div class="check-actions">${result.url?`<a class="check-link" href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">${esc(result.ref)} ↗</a>`:`<span class="check-link">${esc(result.ref)}</span>`}${result.wallKey?`<button type="button" data-show-wall="${esc(result.wallKey)}">Vis i tegningen</button>`:result.roomId?`<button type="button" data-show-room="${esc(result.roomId)}">Vis i tegningen</button>`:''}${result.baselineWallKey&&result.status==='ukjent'?`<span class="check-answer">Bærende? <button type="button" data-baseline-bearing="yes" data-key="${esc(result.baselineWallKey)}">Ja</button><button type="button" data-baseline-bearing="no" data-key="${esc(result.baselineWallKey)}">Nei</button></span>`:''}${result.status==='ukjent'&&!result.roomId&&!result.wallKey&&!result.baselineWallKey?'<button type="button" data-open-facts>Legg inn opplysninger</button>':''}</div></div></article>`;
  const groups=[['Må følges opp',report.results.filter(r=>['brudd','soknad','advarsel'].includes(r.status))],['Mangler opplysninger',report.results.filter(r=>r.status==='ukjent')],['Ser bra ut',report.results.filter(r=>r.status==='ok')],['Til informasjon',report.results.filter(r=>r.status==='info')]].filter(([,list])=>list.length);
  container.innerHTML=`<div class="check-overview"><span class="check-overview-icon">${icon('shield')}</span><div><span class="status-pill warning-pill">VEILEDENDE KONTROLL · TEK17</span><h3>${esc(headline)}</h3><p>${esc(intro)}</p><div class="check-summary">${chips}</div></div></div><div class="check-metrics"><span><strong>${state.rooms.length}</strong> tegnede rom</span><span><strong>${esc(studio.project.municipality||'Ikke valgt')}</strong> kommune</span><span>Regelgrunnlag kontrollert <strong>${esc(RULESET.verified)}</strong></span></div>${groups.map(([title,list])=>`<h3 class="check-group-title">${esc(title)}</h3><div class="check-list">${list.map(item).join('')}</div>`).join('')}${report.assumptions.length?`<ul class="check-assumptions">${report.assumptions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}`;
  return report;
}
export function openCheck(){
  openDialog('Et steg nærmere realisering','Veiledende kontroll av tegningen mot TEK17.',`<div id="check-results"></div><details class="facts-form" id="facts-form"><summary>Om boligen og tiltaket</summary><div class="facts-grid">${FACT_QUESTIONS.map(factField).join('')}</div></details><div class="notice">${icon('info')}<p>${esc(DISCLAIMER)} Ingen søknad sendes fra Romly.</p></div>`,`<button class="button secondary" id="check-back">Tilbake til tegningen</button><button class="button primary" id="download-review">${icon('download')} Last ned prosjektbrief</button>`,true);
  const report=renderCheckResults();$('#facts-form').open=report.summary.ukjent>=3;
  $('#check-back').onclick=closeDialog;$('#download-review').onclick=downloadReport;
  $('#facts-form').addEventListener('change',e=>{const field=e.target.closest('[data-fact]');if(!field)return;const question=FACT_QUESTIONS.find(q=>`${q.group}.${q.key}`===field.dataset.fact);if(!question)return;if(!setFact(question,field.value)){field.value=factValue(studio.project,question)===undefined?'':question.type==='number'||question.type==='integer'?inputNumber(factValue(studio.project,question)):String(factValue(studio.project,question));return;}renderCheckResults();});
  $('#check-results').onclick=e=>{
    const show=e.target.closest('[data-show-room]');if(show){closeDialog();editor.selectRoom(show.dataset.showRoom);if(compactWorkspace.matches)setWorkspacePanel('properties');return;}
    const showWall=e.target.closest('[data-show-wall]');if(showWall){closeDialog();editor.selectWall(showWall.dataset.showWall);if(compactWorkspace.matches)setWorkspacePanel('properties');return;}
    // A removed wall exists only in "Dagens planløsning", so its load-bearing answer is recorded there.
    const answer=e.target.closest('[data-baseline-bearing]');if(answer){editor.updateBaselineWall(answer.dataset.key,{loadBearing:answer.dataset.baselineBearing});renderCheckResults();return;}
    if(e.target.closest('[data-open-facts]')){$('#facts-form').open=true;$('#facts-form').scrollIntoView({block:'start',behavior:'smooth'});$('#facts-form [data-fact]')?.focus({preventScroll:true});}
  };
}
export function downloadReport(){download('romly-prosjektbrief.txt',projectBrief(editor.getState(),studio.project,{example:editor.isExample()}),'text/plain;charset=utf-8');toast('Prosjektbriefen er lastet ned.');}
