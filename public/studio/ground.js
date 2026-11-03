// Step 1, Grunnlag: the project details and the files uploaded to the project.
import { icon, $, toast } from './ui.js';
import { esc, fmt, singleLine } from './format.js';
import { api, session, studio } from './state.js';
import { openDialog, closeDialog } from './dialog.js';
import { workflow, updateWorkflowProgress } from './workflow.js';
import { openPlanImport } from './plan-import.js';
import { sync, persist, renderProject, showSaveProblem } from './projects.js';
import { openProjects } from './project-dialogs.js';

function uploadList(){
  if(!studio.uploads.length)return'<p class="empty-upload">Ingen filer lagt til. Last opp bilder eller plantegninger til prosjektet.</p>';
  return studio.uploads.map(file=>{
    const ready=!file.status||file.status==='ready';
    const pending=file.status==='pending';
    const canDelete=file.canDelete!==false;
    const message=ready?`${fmt(file.size/1024)} kB · Lagret på denne enheten`:pending?(canDelete?'Opplastingen ble avbrutt. Fjern filen og prøv igjen.':'Opplasting pågår. Åpne grunnlaget igjen for oppdatert status.'):'Slettingen ble avbrutt. Prøv å fjerne filen igjen.';
    return`<div class="upload-item">${ready&&file.mimeType?.startsWith('image/')?`<img class="upload-thumb" loading="lazy" decoding="async" src="${esc(file.url)}" alt="Forhåndsvisning av ${esc(file.name)}">`:`<span class="upload-thumb">${icon('file')}</span>`}<div><strong>${esc(file.name)}</strong><small>${message}</small>${ready?`<button class="use-floorplan" data-use-plan="${esc(file.id)}">${icon('layers')} Bruk i tegningen</button><a class="text-link" href="${esc(file.url)}" target="_blank" rel="noopener noreferrer">Åpne fil ↗</a>`:''}</div><button class="icon-button" data-remove-file="${esc(file.id)}" aria-label="${ready?'Fjern':'Prøv å fjerne'} ${esc(file.name)}" ${canDelete?'':'disabled'}>${icon('close')}</button></div>`;
  }).join('');
}
function refreshUploadList(){updateWorkflowProgress();if($('#upload-list'))$('#upload-list').innerHTML=uploadList();if($('#file-upload-progress'))$('#file-upload-progress').textContent=studio.filesBusy?'Laster opp fil. Vent til opplastingen er bekreftet …':'';}
function bindUploads(){
  const zone=$('#dropzone');zone.onclick=()=>$('#file-input').click();
  zone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file-input').click();}};
  zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-over');};zone.ondragleave=()=>zone.classList.remove('drag-over');
  zone.ondrop=e=>{e.preventDefault();zone.classList.remove('drag-over');acceptFiles(e.dataTransfer.files);};
  $('#upload-list').onclick=async e=>{
    const use=e.target.closest('[data-use-plan]');if(use){const file=studio.uploads.find(f=>f.id===use.dataset.usePlan);if(file&&!studio.filesBusy&&!studio.transitioning)openPlanImport(file);return;}
    const button=e.target.closest('[data-remove-file]');if(!button||button.disabled||!studio.activeRecord||studio.filesBusy||studio.transitioning)return;const id=studio.activeRecord.id;button.disabled=true;studio.fileMutation++;studio.filesBusy++;try{await api.removeFile(id,button.dataset.removeFile);if(studio.activeRecord?.id===id){studio.uploads=studio.uploads.filter(file=>file.id!==button.dataset.removeFile);refreshUploadList();toast('Filen er slettet fra prosjektet.');}}catch(error){button.disabled=false;toast(error.message);}finally{studio.filesBusy--;refreshUploadList();}
  };
}
async function acceptFiles(files){
  if(studio.transitioning){toast('Vent til prosjektet er åpnet.');return;}
  if(!studio.activeRecord||!session.user){toast('Opprett eller åpne et prosjekt før du laster opp filer.');return;}
  if(studio.filesBusy){toast('Vent til den pågående opplastingen er ferdig.');return;}
  const id=studio.activeRecord.id;let added=0;
  studio.filesBusy++;studio.fileMutation++;refreshUploadList();
  try{for(const file of Array.from(files)){
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>20*1024*1024||file.size===0||studio.uploads.length>=12){toast('Bruk JPG, PNG, WebP eller PDF, maks. 20 MB per fil og 12 filer per prosjekt.');continue;}
    try{const result=await api.upload(id,file);if(studio.activeRecord?.id===id){studio.uploads=studio.uploads.filter(item=>item.id!==result.file.id);studio.uploads.push(result.file);added++;refreshUploadList();}}catch(error){toast(error.message);}
  }}finally{studio.filesBusy--;refreshUploadList();}
  if(added)toast(`${added===1?'Filen er':added+' filer er'} lastet opp og lagret på denne enheten.`);
}
export function openGround(){
  if(!studio.activeRecord){openProjects();return;}
  openDialog('La oss bli kjent med hjemmet ditt','Prosjektdetaljer og filer lagres på denne enheten.',`<div class="form-grid"><label class="field">Prosjektnavn<input id="project-name-field" class="input" maxlength="70" value="${esc(studio.project.name)}"></label><label class="field">Kommune<input id="municipality-field" class="input" maxlength="70" value="${esc(studio.project.municipality)}" placeholder="Skriv kommunen din"></label></div><div id="dropzone" class="dropzone" role="button" tabindex="0">${icon('upload')}<strong>Dra inn plantegning eller bilder</strong><span>eller <u>velg filer fra enheten</u></span><small>JPG, PNG, WebP eller PDF · Maks. 20 MB per fil · 12 filer per prosjekt</small></div><div id="file-upload-progress" class="file-upload-progress" role="status"></div><div id="upload-list" class="upload-list">${uploadList()}</div><div class="info-banner">${icon('info')}<p>Filene lagres bare i denne nettleseren og sendes ikke til noen server. Velg «Bruk i tegningen» på en fil for å sette målestokk og tegne egne rom. Automatisk AI-tolkning er ikke tilkoblet.</p></div>`,`<button class="button secondary" id="ground-cancel">Tilbake til studio</button><button class="button primary" id="ground-next">Videre til dine ønsker ${icon('arrow-right')}</button>`);
  bindUploads();refreshUploadList();
  const currentId=studio.activeRecord.id;const currentFileMutation=studio.fileMutation;
  api.files(currentId).then(result=>{if(studio.activeRecord?.id===currentId&&!studio.filesBusy&&studio.fileMutation===currentFileMutation){studio.uploads=result.files||[];refreshUploadList();}}).catch(error=>toast(error.message));
  $('#project-name-field').oninput=e=>{studio.project.name=singleLine(e.target.value).trim()||'Mitt oppussingsprosjekt';renderProject();persist();};
  $('#municipality-field').oninput=e=>{studio.project.municipality=singleLine(e.target.value).trim();persist();};
  $('#ground-cancel').onclick=closeDialog;
  $('#ground-next').onclick=async()=>{if(studio.filesBusy){toast('Vent til opplastingen er ferdig.');return;}try{await sync.flush();workflow(2);}catch(error){showSaveProblem(error);}};
}
export function bindGround(){
  $('#file-input').onchange=e=>{acceptFiles(e.target.files);e.target.value='';};
  // A file dropped outside the drop zone must not navigate away from the studio.
  for(const type of ['dragover','drop'])window.addEventListener(type,e=>{if(e.dataTransfer?.types?.includes('Files')&&!e.target.closest?.('#dropzone'))e.preventDefault();});
}
