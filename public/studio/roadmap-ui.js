// The project start screen: the roadmap to "Send søknad" as a flowchart (steps and branch from roadmap.js),
// and the hand-off dialog behind its last step. Romly sends nothing; the user or their ansvarlig søker does.
import { DISCLAIMER } from './tek17-check.js';
import { buildRoadmap, ROADMAP_LINKS } from './roadmap.js';
import { icon, $, toast, download, compactWorkspace, setWorkspacePanel } from './ui.js';
import { esc } from './format.js';
import { studio, editor } from './state.js';
import { openDialog, closeDialog } from './dialog.js';
import { openGround } from './ground.js';
import { openCheck, downloadReport } from './check-ui.js';
import { openBaseline } from './baseline-ui.js';
import { persist } from './projects.js';

const currentRoadmap=()=>buildRoadmap(editor.getState(),studio.project,{example:editor.isExample(),fileCount:studio.uploads.length});
/** Sets or clears one of the project's roadmap ticks (ROADMAP_FLAGS in roadmap.js) and saves. */
export function setRoadmapFlag(key,value){
  if(!studio.activeRecord||!!studio.project.roadmap?.[key]===!!value)return;
  const flags={...(studio.project.roadmap||{})};
  if(value)flags[key]=true;else delete flags[key];
  if(Object.keys(flags).length)studio.project.roadmap=flags;else delete studio.project.roadmap;
  persist();
}
/** The header button shows the progress, so it follows every change to the project. */
export function updateRoadmapButton(){
  const button=$('#roadmap-btn');button.hidden=!studio.activeRecord||!editor;if(button.hidden)return;
  const roadmap=currentRoadmap();
  $('#roadmap-label').textContent=`Veikart · ${roadmap.done} av ${roadmap.total}`;
  button.title=roadmap.next?`Neste steg: ${roadmap.next.title}`:'Alle stegene er gjort';
}
const BRANCH_TITLES={soknad:'Krever trolig søknad',avklar:'Må avklares – kan kreve søknad',ingen:'Ser ikke ut til å kreve søknad'};
const MANUAL_LABELS={professional:'Jeg har avklart dette',neighbours:'Nabovarselet er sendt'};
function stepActions(step){
  const button=(action,label)=>`<button type="button" class="roadmap-action" data-roadmap-action="${action}">${label}</button>`;
  const parts=[];
  if(step.action==='details')parts.push(button('ground','Prosjektdetaljer'));
  if(step.action==='ground')parts.push(button('ground','Åpne grunnlaget'));
  if(step.action==='drawing')parts.push(button('drawing','Gå til tegningen'));
  if(step.action==='baseline')parts.push(button('baseline',step.done?'Se dagens planløsning':'Lagre dagens planløsning'));
  if(step.action==='facts')parts.push(button('facts','Svar på spørsmålene'));
  if(step.action==='check')parts.push(button('check','Åpne prosjektkontrollen'));
  if(step.action==='documents')parts.push(button('brief','Last ned prosjektbrief'),button('drawing-file','Last ned tegning'));
  if(step.action==='send')parts.push(button('send','Gjør klar søknaden'));
  if(step.manual)parts.push(`<label class="check-row"><input type="checkbox" data-roadmap-flag="${step.manual}" ${step.done?'checked':''}><span>${MANUAL_LABELS[step.manual]}</span></label>`);
  if(step.link)parts.push(`<a class="text-link" href="${esc(step.link)}" target="_blank" rel="noopener noreferrer">Les hos DiBK ↗</a>`);
  return parts.length?`<div class="roadmap-actions">${parts.join('')}</div>`:'';
}
const stepMarkup=(step,number)=>`<li class="roadmap-step${step.id==='send'||step.end?' roadmap-end':''}" data-step="${step.id}" data-status="${step.status}"><span class="roadmap-mark" aria-hidden="true">${step.status==='done'?icon('check'):number}</span><div class="roadmap-body"><div class="roadmap-text"><h3>${esc(step.title)}<span class="visually-hidden"> – ${step.status==='done'?'gjort':step.status==='next'?'neste steg':'ikke gjort'}</span></h3><p>${esc(step.text)}</p></div>${stepActions(step)}</div></li>`;
function roadmapMarkup(roadmap){
  const {branch,trunk,branches}=roadmap,chosen=branch==='avklar'?'soknad':branch;
  const summary=roadmap.next?`${roadmap.done} av ${roadmap.total} steg er gjort. Neste: ${roadmap.next.title}.`:`Alle ${roadmap.total} stegene er gjort.`;
  const note=branch==='uavklart'?'Prosjektkontrollen avgjør hvilken vei du skal videre.':`Prosjektkontrollen peker på veien «${BRANCH_TITLES[branch]}». Vurderingen er veiledende.`;
  const column=(key,steps)=>`<section class="roadmap-branch" data-branch="${key}" data-active="${branch==='uavklart'?'open':String(chosen===key)}"><h3 class="roadmap-branch-title">${BRANCH_TITLES[key==='soknad'&&branch==='avklar'?'avklar':key]}${chosen!==key&&branch!=='uavklart'?'<span class="status-pill">Ikke aktuelt nå</span>':''}</h3><ol>${steps.map((step,index)=>stepMarkup(step,trunk.length+index+1)).join('')}</ol></section>`;
  return `<p class="roadmap-progress" role="status">${esc(summary)}</p><ol class="roadmap-trunk">${trunk.map((step,index)=>stepMarkup(step,index+1)).join('')}</ol><p class="roadmap-split-note">${esc(note)}</p><div class="roadmap-split">${column('soknad',branches.soknad)}${column('ingen',branches.ingen)}</div>`;
}
function renderRoadmap(){const root=$('#roadmap');if(root)root.innerHTML=roadmapMarkup(currentRoadmap());}
/** Opens the roadmap. It is the first thing shown when a project opens. */
export function openRoadmap(){
  if(!studio.activeRecord)return;
  openDialog('Veien til søknad',`${studio.project.name} · fra første strek til «Send søknad».`,'<div class="roadmap" id="roadmap"></div>',`<button class="button primary" id="roadmap-close">Gå til tegningen ${icon('arrow-right')}</button>`,true);
  renderRoadmap();
  const toDrawing=()=>{closeDialog();if(compactWorkspace.matches)setWorkspacePanel('canvas');};
  $('#roadmap-close').onclick=toDrawing;
  $('#roadmap').onclick=e=>{
    const action=e.target.closest('[data-roadmap-action]')?.dataset.roadmapAction;if(!action)return;
    if(action==='ground')openGround();
    else if(action==='drawing')toDrawing();
    else if(action==='baseline'){closeDialog();openBaseline();}
    else if(action==='check')openCheck();
    else if(action==='facts'){openCheck();$('#facts-form').open=true;$('#facts-form').scrollIntoView({block:'start'});$('#facts-form [data-fact]')?.focus({preventScroll:true});}
    else if(action==='brief'){downloadReport();renderRoadmap();}
    else if(action==='drawing-file'){download('romly-plantegning.svg',editor.exportSVG(),'image/svg+xml');toast('Plantegningen er lastet ned.');}
    else if(action==='send')openSendApplication();
  };
  $('#roadmap').onchange=e=>{const flag=e.target.dataset?.roadmapFlag;if(!flag)return;setRoadmapFlag(flag,e.target.checked);renderRoadmap();$(`#roadmap [data-roadmap-flag="${flag}"]`)?.focus({preventScroll:true});};
}
/** The last step. It gathers what Romly has and points to where the application is really sent. */
function openSendApplication(){
  const municipality=studio.project.municipality?`${studio.project.municipality} kommune`:'kommunen';
  openDialog('Send søknad',`Romly sender ingenting. Du, eller din ansvarlige søker, sender søknaden til ${municipality}.`,`<h4 class="baseline-heading">Dette har du fra Romly</h4><div class="roadmap-actions handoff-files"><button type="button" class="button secondary" id="handoff-brief">${icon('document')} Prosjektbrief</button><button type="button" class="button secondary" id="handoff-drawing">${icon('image')} Plantegning (SVG)</button></div><h4 class="baseline-heading">Før du sender</h4><ul class="baseline-changes"><li>Nabovarselet er sendt, og fristen på minst to uker er ute – eller alle naboene har samtykket.</li><li>Kvitteringen for nabovarselet legges ved søknaden.</li><li>Legg ved alle dokumenter og vedlegg som er relevante. Kommunen kan be om mer.</li><li>Krever tiltaket ansvarlige foretak, er det den ansvarlige søkeren som sender søknaden for deg.</li></ul><p class="roadmap-links"><a class="text-link" href="${ROADMAP_LINKS.application}" target="_blank" rel="noopener noreferrer">Slik fyller du ut og sender søknaden (DiBK) ↗</a><a class="text-link" href="${ROADMAP_LINKS.forms}" target="_blank" rel="noopener noreferrer">Søknadsskjemaer for byggesak (DiBK) ↗</a></p><div class="info-banner">${icon('info')}<p>${esc(DISCLAIMER)}</p></div><label class="check-row handoff-sent"><input type="checkbox" id="handoff-sent" ${studio.project.roadmap?.sent?'checked':''}><span>Søknaden er sendt til ${esc(municipality)}</span></label>`,`<button class="button secondary" id="handoff-back">Tilbake til veikartet</button><button class="button primary" id="handoff-close">Lukk</button>`);
  $('#handoff-brief').onclick=downloadReport;
  $('#handoff-drawing').onclick=()=>{download('romly-plantegning.svg',editor.exportSVG(),'image/svg+xml');toast('Plantegningen er lastet ned.');};
  $('#handoff-sent').onchange=e=>{setRoadmapFlag('sent',e.target.checked);if(e.target.checked)toast('Søknaden er markert som sendt.');};
  $('#handoff-back').onclick=openRoadmap;$('#handoff-close').onclick=closeDialog;
}
export function bindRoadmap(){$('#roadmap-btn').onclick=openRoadmap;}
