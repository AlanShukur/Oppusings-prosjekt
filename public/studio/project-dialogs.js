// Mine prosjekter, creating and deleting projects, and the storage dialog (Lagring på denne enheten).
import { icon, $, toast, download } from './ui.js';
import { esc, fmt, singleLine } from './format.js';
import { api, session, studio, editor, initialPlan } from './state.js';
import { openDialog, closeDialog } from './dialog.js';
import { releaseReferenceAsset, choosePlanFile } from './plan-import.js';
import { openGround } from './ground.js';
import { miniPlan } from './suggestions.js';
import { sync, renderProject, rememberProject, ensureCanLeave, withProjectTransition, openCloudProject, createCloudProject, showSaveProblem, validateProjectImport, initializeStorage } from './projects.js';

let projectList=[],projectDialogGeneration=0;
let stored;
try{stored=JSON.parse(localStorage.getItem('romly-project-v1'));}catch{}
function legacyAvailable(){try{return !!stored?.project&&!!stored?.plan&&!localStorage.getItem('romly-legacy-imported:'+session.user?.id);}catch{return !!stored?.project&&!!stored?.plan;}}
function megabytes(bytes){const value=bytes/1024/1024;return value<0.1?'under 0,1 MB':fmt(value)+' MB';}
export function openStorage(){
  if(!studio.sessionReady){
    openDialog('Lagring er ikke tilgjengelig','Nettleseren tillater ikke at Romly lagrer data.',`<p class="account-note">Dette skjer ofte i privat nettlesing eller når lagring av nettstedsdata er slått av. Du kan utforske eksempelboligen, men prosjekter og filer kan ikke lagres.</p>`,`<button class="button secondary" id="storage-retry">Prøv igjen</button><button class="button primary" id="storage-close">Utforsk eksempelet</button>`);
    $('#storage-close').onclick=closeDialog;$('#storage-retry').onclick=initializeStorage;return;
  }
  openDialog('Lagring på denne enheten','Ingen konto. Prosjektene dine blir i denne nettleseren.',`<div class="project-empty">${icon('shield')}<h3>Dataene dine forlater ikke enheten</h3><p>Tegninger, ønsker og filer du laster opp lagres bare i denne nettleseren og sendes ikke til noen server. Bytter du enhet eller nettleser, eller sletter nettleserdata, er prosjektene ikke med. Last ned en sikkerhetskopi jevnlig.</p></div><p class="account-note" id="storage-usage">Beregner lagringsplass …</p><div class="account-actions"><button class="button secondary" id="storage-export">${icon('download')} Last ned sikkerhetskopi</button><button class="button secondary" id="storage-projects">${icon('home')} Mine prosjekter</button><button class="button secondary" id="storage-delete">${icon('trash')} Slett alle data</button></div><p class="project-message error" id="storage-delete-warning" role="alert" hidden>Alle prosjekter og opplastede filer på denne enheten slettes for godt. Last ned en sikkerhetskopi først hvis du vil beholde dem.</p>`,`<button class="button primary" id="storage-close">Tilbake til studio</button>`);
  $('#storage-close').onclick=closeDialog;$('#storage-projects').onclick=()=>openProjects();
  api.usage().then(usage=>{if(!$('#storage-usage'))return;$('#storage-usage').textContent=usage.used===null?'Nettleseren oppgir ikke hvor mye plass som er brukt.':`Brukt: ${megabytes(usage.used)}${usage.quota?` av omtrent ${megabytes(usage.quota)} tilgjengelig`:''}. ${usage.persisted?'Nettleseren har lovet å ikke slette dataene ved plassmangel.':'Nettleseren kan slette dataene hvis enheten går tom for plass.'}`;});
  $('#storage-export').onclick=async()=>{try{await sync.flush().catch(()=>{});download(`romly-sikkerhetskopi-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(await api.exportAll(),null,2),'application/json');toast('Sikkerhetskopien er lastet ned. Opplastede filer er ikke med.');}catch(error){toast(error.message);}};
  let confirmDelete=false;
  $('#storage-delete').onclick=async e=>{
    if(!confirmDelete){confirmDelete=true;$('#storage-delete-warning').hidden=false;e.currentTarget.innerHTML=`${icon('trash')} Ja, slett alt`;e.currentTarget.classList.add('danger');return;}
    const button=e.currentTarget;button.disabled=true;
    try{
      await sync.flush().catch(()=>{});
      await withProjectTransition(async()=>{
        await api.deleteAll();sync.clearRecovery();studio.activeRecord=null;sync.activate(null);studio.uploads=[];rememberProject(null);releaseReferenceAsset();
        try{for(const key of Object.keys(localStorage))if(key.startsWith('romly-recovery:'))localStorage.removeItem(key);}catch{}
        studio.loadingProject=true;try{studio.project={name:'Eksempelbolig',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'};editor.loadState(initialPlan);renderProject();}finally{studio.loadingProject=false;}
      },{flush:false});
      toast('Alle data på denne enheten er slettet.');openProjects([]);
    }catch(error){button.disabled=false;toast(error.message);}
  };
}
function openCreateProject(){
  if(!session.user){openStorage();return;}
  openDialog('Gi prosjektet ditt en start','Prosjektet lagres på denne enheten.',`<label class="field">Prosjektnavn<input id="create-project-name" class="input" maxlength="70" placeholder="For eksempel Leiligheten vår" value="Mitt oppussingsprosjekt"></label><label class="field">Kommune<input id="create-project-municipality" class="input" maxlength="70" placeholder="Skriv kommunen din"></label><div class="project-create-template">${miniPlan('01')}<div><strong>Starter med en eksempelplan</strong><p>En redigerbar bolig på 89,4 m². Opplastede tegninger tolkes ikke automatisk ennå.</p></div></div><p class="project-form-note">Du kan lagre egne bilder, tegninger og ønsker i prosjektet. Eksempelplanen er et skissegrunnlag som kan tilpasses.</p><p id="create-project-error" class="project-message error" hidden></p>`,`<button class="button secondary" id="create-project-back">Tilbake</button><button class="button primary" id="create-project-submit">${icon('plus')} Opprett prosjekt</button>`);
  $('#create-project-back').onclick=openProjects;
  $('#create-project-submit').onclick=async e=>{const button=e.currentTarget;const name=singleLine($('#create-project-name').value).trim();if(!name){$('#create-project-name').focus();return;}const municipality=singleLine($('#create-project-municipality').value).trim();if(!await ensureCanLeave())return;button.disabled=true;
    try{await createCloudProject({name,municipality,bedrooms:2,bathrooms:1,wishes:'',variant:'01'},initialPlan);toast('Prosjektet er opprettet.');openGround();}
    catch(error){button.disabled=false;if($('#create-project-error')){$('#create-project-error').hidden=false;$('#create-project-error').textContent=error.message;}else toast(error.message);}
  };
}
function projectListMarkup(){
  if(!projectList.length)return`<div class="project-empty">${icon('home')}<h3>Gi plass til ditt første prosjekt</h3><p>Samle plantegninger, bilder og ideer på ett sted. Prosjektene lagres i denne nettleseren.</p><button class="button primary" id="first-project-btn">${icon('plus')} Opprett ditt første prosjekt</button></div>`;
  return projectList.map(record=>`<article class="cloud-project-row ${record.id===studio.activeRecord?.id?'current':''}"><button class="cloud-project-open" data-open-project="${esc(record.id)}">${miniPlan(record.project.variant)}<div>${record.status==='deleting'?'<span class="status-pill">SLETTING MÅ FULLFØRES</span>':record.id===studio.activeRecord?.id?'<span class="status-pill">ÅPENT PROSJEKT</span>':''}<h3>${esc(record.project.name)}</h3><p>${esc(record.project.municipality||'Kommune ikke valgt')} · ${record.roomCount} rom · ${fmt(record.area)} m² · ${record.fileCount} filer</p><small>Sist endret ${esc(new Date(record.updatedAt).toLocaleString('nb-NO',{dateStyle:'short',timeStyle:'short'}))}</small></div></button><button class="cloud-project-delete" data-delete-project="${esc(record.id)}" aria-label="Slett ${esc(record.project.name)}" title="Slett prosjekt">${icon('trash')}</button></article>`).join('');
}
export async function openProjects(preloaded){
  if(!session.user){openStorage();return;}
  const generation=++projectDialogGeneration;
  openDialog('Mine prosjekter','Planer, bilder og muligheter – samlet på denne enheten.',`<div class="projects-heading"><p>Prosjektene lagres bare i denne nettleseren.</p><button class="button secondary" id="projects-import-plan">Importer plantegning</button><button class="button primary" id="new-cloud-project">${icon('plus')} Nytt prosjekt</button></div><div id="cloud-projects-list" class="cloud-projects-list"><p class="cloud-loading">Henter prosjektene dine …</p></div>${legacyAvailable()?`<div class="project-migration"><div><strong>Du har et lokalt prosjekt fra prototypen</strong><p>Velg selv om tegningen og ønskene skal kopieres til et nytt prosjekt. Den opprinnelige lokale kopien beholdes.</p></div><button class="button secondary" id="migrate-local-project">Gjør om til prosjekt ${icon('arrow-right')}</button></div>`:''}`,studio.activeRecord?`<button class="button secondary" id="projects-return">Tilbake til studio</button><button class="button secondary" id="projects-details">${icon('edit')} Prosjektdetaljer</button>`:'',true);
  $('#new-cloud-project').onclick=openCreateProject;
  $('#projects-import-plan').onclick=choosePlanFile;
  if($('#projects-return'))$('#projects-return').onclick=closeDialog;if($('#projects-details'))$('#projects-details').onclick=openGround;
  if($('#migrate-local-project'))$('#migrate-local-project').onclick=async e=>{const button=e.currentTarget;if(!await ensureCanLeave())return;button.disabled=true;try{const data=validateProjectImport({format:'romly-v1',...stored});await createCloudProject(data.project,data.plan);try{localStorage.setItem('romly-legacy-imported:'+session.user.id,'1');}catch{}toast('Det lokale prosjektet er kopiert til et nytt prosjekt.');}catch(error){button.disabled=false;toast(error.message||'Det lokale prosjektet kunne ikke importeres.');}};
  try{
    const result=Array.isArray(preloaded)?{projects:preloaded}:await api.list();if(generation!==projectDialogGeneration||!$('#cloud-projects-list'))return;
    projectList=result.projects||[];$('#cloud-projects-list').innerHTML=projectListMarkup();
    if($('#first-project-btn'))$('#first-project-btn').onclick=openCreateProject;
    $('#cloud-projects-list').onclick=async e=>{
      const open=e.target.closest('[data-open-project]');const remove=e.target.closest('[data-delete-project]');
      if(remove){const record=projectList.find(item=>item.id===remove.dataset.deleteProject);if(record)openDeleteProject(record);return;}
      if(!open)return;const record=projectList.find(item=>item.id===open.dataset.openProject);if(!record)return;if(record.status==='deleting'){openDeleteProject(record);return;}
      if(studio.transitioning)return;open.disabled=true;
      try{await openCloudProject(record.id);toast('Prosjektet er åpnet.');}catch(error){open.disabled=false;if(sync.error)showSaveProblem(error);else toast(error.message);}
    };
  }catch(error){if(generation!==projectDialogGeneration||!$('#cloud-projects-list'))return;$('#cloud-projects-list').innerHTML=`<p class="project-message error">${esc(error.message)}</p><div class="projects-error-actions"><button class="button secondary" id="reload-cloud-projects">Prøv igjen</button></div>`;$('#reload-cloud-projects').onclick=openProjects;}
}
export function openDeleteProject(record){
  openDialog('Slette prosjektet?',record.project.name,`<p class="account-note">Prosjektet og alle tilhørende opplastede filer slettes fra denne enheten. Dette kan ikke angres. ${record.status==='deleting'?'En tidligere sletting ble avbrutt. Prøv igjen for å fullføre.':''}</p><p id="delete-project-error" class="project-message error" hidden></p>`,`<button class="button secondary" id="delete-project-cancel">Behold prosjektet</button><button class="button danger" id="delete-project-confirm">${icon('trash')} Slett prosjekt og filer</button>`);
  $('#delete-project-cancel').onclick=openProjects;
  $('#delete-project-confirm').onclick=async e=>{
    if(studio.filesBusy){toast('Vent til opplastingen er ferdig.');return;}
    const button=e.currentTarget;button.disabled=true;
    try{
      const deletingActive=record.id===studio.activeRecord?.id;
      await withProjectTransition(async()=>{
        if(deletingActive)record=sync.record;
        await api.remove(record.id,record.revision);
        if(record.id===studio.activeRecord?.id){sync.clearRecovery();studio.activeRecord=null;sync.activate(null);studio.uploads=[];rememberProject(null);studio.loadingProject=true;try{studio.project={name:'Eksempelbolig',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'};editor.loadState(initialPlan);renderProject();}finally{studio.loadingProject=false;}}
      },{flush:deletingActive});
      toast('Prosjektet og filene er slettet.');openProjects();
    }catch(error){button.disabled=false;if($('#delete-project-error')){$('#delete-project-error').hidden=false;$('#delete-project-error').textContent=error.message+' Prosjektet beholdes i listen til slettingen er fullført. Åpne listen igjen for å prøve på nytt.';}if(error.status===409&&record.id===studio.activeRecord?.id&&sync.dirty)showSaveProblem(error);}
  };
}
