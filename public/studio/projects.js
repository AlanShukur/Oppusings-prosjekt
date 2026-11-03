// The open project: saving, switching projects safely, recovery, save problems and startup.
import { migratePlan, ITEM_TYPES } from './plan.js';
import { ProjectSync, isRevisionConflict } from './cloud.js';
import { reportProblem } from './error-reporter.js';
import { icon, $, toast, download } from './ui.js';
import { esc, clone } from './format.js';
import { api, session, studio, editor } from './state.js';
import { dialog, openDialog, closeDialog } from './dialog.js';
import { updateWorkflowProgress } from './workflow.js';
import { setTool, setZoom, setView } from './tools.js';
import { releaseReferenceAsset, resolveReferenceImage } from './plan-import.js';
import { openStorage, openProjects, openDeleteProject } from './project-dialogs.js';

export const sync=new ProjectSync(renderSaveStatus,{client:api,where:'på denne enheten'});
const storageAvailable=(()=>{try{localStorage.setItem('romly-test','1');localStorage.removeItem('romly-test');return true;}catch{return false;}})();
function safeProjectJSON(text){
  const data=JSON.parse(text);
  const types=ITEM_TYPES;
  if(!data?.project||typeof data.project.name!=='string'||typeof data.project.wishes!=='string'||!['01','02','03'].includes(data.project.variant)||!Number.isInteger(data.project.bedrooms)||data.project.bedrooms<1||data.project.bedrooms>5||!Number.isInteger(data.project.bathrooms)||data.project.bathrooms<1||data.project.bathrooms>3)throw Error('Ugyldig prosjekt');
  if(!Array.isArray(data.plan?.items)||data.plan.items.length>300||!data.plan.items.every(item=>typeof item.id==='string'&&types.includes(item.type)&&['x','y','rotation'].every(k=>Number.isFinite(item[k])&&Math.abs(item[k])<10000)&&['x2','y2'].every(k=>item[k]===undefined||(Number.isFinite(item[k])&&Math.abs(item[k])<10000))))throw Error('Ugyldige elementer');
  return data;
}
export function persist(plan){if(!studio.loadingProject&&editor){const snapshot=plan||editor.getState();sync.mark({project:clone(studio.project),plan:snapshot});resolveReferenceImage(snapshot);updateWorkflowProgress();}}
export function renderProject(){$('#project-title').textContent=studio.project.name;$('#breadcrumb-title').textContent=studio.project.name;$('#variant-name').textContent=editor?.getState().variant==='custom'?'Egen':studio.project.variant;$('.prototype-label').textContent=studio.activeRecord?'Tidlig produktversjon · Ditt prosjekt':'Eksempelvisning · Ikke lagret';}
export function renderSaveStatus(status){
  studio.lastSaveStatus=status;
  const element=$('#save-status');
  element.innerHTML=icon(status.state==='error'||status.state==='conflict'?'warning':'cloud')+esc(status.message);
  element.dataset.state=status.state;element.title=status.message;element.setAttribute('role','button');element.tabIndex=0;
  element.setAttribute('aria-label',status.message+(status.error?'. Åpne lagringsvalg.':''));
  const footer=$('.canvas-footer>div>span:last-child');if(footer){footer.textContent=status.message;footer.title=status.message;}
  const banner=$('#cloud-save-banner');if(banner){banner.hidden=!['error','conflict'].includes(status.state)||!studio.activeRecord;$('#cloud-save-message').textContent=status.message;$('#retry-save-btn').textContent=status.state==='conflict'?'Se lagringsvalg':'Prøv igjen';}
  if(studio.activeRecord&&sync.record?.id===studio.activeRecord.id)studio.activeRecord=sync.record;
}
function preferenceKey(){return session.user?'romly-last-project:'+session.user.id:null;}
export function rememberProject(id){try{if(preferenceKey()){if(id){localStorage.setItem(preferenceKey(),id);localStorage.setItem('romly-last-active-id',id);}else{localStorage.removeItem(preferenceKey());localStorage.removeItem('romly-last-active-id');}}}catch{}}
function projectSnapshot(){return{project:clone(studio.project),plan:editor.getState()};}
function removeRecoveryKey(key){try{if(key)localStorage.removeItem(key);}catch{}}
export function downloadProjectBackup(){download('romly-prosjekt.json',JSON.stringify({format:'romly-v1',...projectSnapshot()},null,2),'application/json');toast('En kopi av de synlige endringene er lastet ned.');}
export async function ensureCanLeave(){
  if(studio.transitioning){toast('Vent til den pågående prosjekthandlingen er ferdig.');return false;}
  if(studio.filesBusy){toast('Vent til filopplastingen er ferdig før du bytter prosjekt.');return false;}
  try{await sync.flush();return true;}catch(error){showSaveProblem(error);return false;}
}
export async function withProjectTransition(action,{flush=true}={}){
  if(studio.transitioning)throw new Error('En prosjekthandling pågår allerede. Vent til den er ferdig.');
  if(studio.filesBusy)throw new Error('Vent til filhandlingen er ferdig før du bytter prosjekt.');
  studio.transitioning=true;
  const previousFocus=document.activeElement;
  const surfaces=[$('.app-shell'),$('.topbar'),dialog];
  const previousInert=surfaces.map(element=>element.inert);
  surfaces.forEach(element=>element.inert=true);
  dialog.setAttribute('aria-busy','true');
  try{
    if(flush)await sync.flush();
    return await action();
  }finally{
    studio.transitioning=false;
    surfaces.forEach((element,index)=>element.inert=previousInert[index]);
    dialog.removeAttribute('aria-busy');
    const previousVisible=previousFocus?.isConnected&&previousFocus.getClientRects().length&&!previousFocus.closest('[inert]');
    const target=dialog.open?dialog.querySelector('.dialog-close'):previousVisible?previousFocus:$('#projects-nav');
    if(target&&!target.disabled)target.focus({preventScroll:true});
  }
}
async function applyCloudRecord(record,{checkRecovery=true,files}={}){
  if(record.status==='deleting'){openDeleteProject(record);return;}
  const plan=migratePlan(record.plan);// throws for a plan from a newer Romly before anything is switched
  const result=files!==undefined?{files}:await api.files(record.id);
  releaseReferenceAsset();
  studio.loadingProject=true;
  try{
    studio.activeRecord=record;studio.project=clone(record.project);studio.uploads=result.files||[];
    sync.activate(record);studio.selectedId=plan.rooms[0]?.id||'living';editor.loadState(plan);
    setTool('select');setZoom(100);setView('2d');
    renderProject();rememberProject(record.id);
  }finally{studio.loadingProject=false;}
  closeDialog({force:true});
  resolveReferenceImage(record.plan);
  if(checkRecovery){const recovery=sync.recovery();if(recovery?.data)openRecovery(recovery);}
}
export async function openCloudProject(id){
  return withProjectTransition(async()=>{const result=await api.get(id);await applyCloudRecord(result.project,{files:result.files});});
}
export async function createCloudProject(data,plan,{flush=true}={}){
  if(!session.user){openStorage();return;}
  return withProjectTransition(async()=>{
    const newPlan=clone(plan);delete newPlan.reference;
    const result=await api.create({project:clone(data),plan:newPlan});
    await applyCloudRecord(result.project,{checkRecovery:false,files:result.files||[]});
    return result.project;
  },{flush});
}
function openRecovery(recovery){
  openDialog('Endringer venter på denne enheten','Et tidligere lagringsforsøk ble ikke bekreftet.',`<p class="account-note">Det finnes en lokal gjenopprettingskopi for dette prosjektet. Den lagrede versjonen er åpnet i studioet. Du kan hente tilbake endringene eller beholde den lagrede versjonen.</p><div class="info-banner">${icon('info')}<p>${recovery.revision===sync.record.revision?'Den lagrede versjonen har samme revisjon som sist du redigerte.':'Prosjektet er endret i en annen fane i mellomtiden. Lagre de lokale endringene som et nytt prosjekt for å beholde begge versjonene.'}</p></div>`,`<button class="button secondary" id="discard-recovery">Behold lagret versjon</button><button class="button primary" id="restore-recovery">${recovery.revision===sync.record.revision?'Hent tilbake endringer':'Lagre endringer som nytt prosjekt'}</button>`);
  $('#discard-recovery').onclick=()=>{sync.clearRecovery();closeDialog();};
  $('#restore-recovery').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{
    const data=validateProjectImport({format:'romly-v1',...recovery.data});
    if(recovery.revision!==sync.record.revision){const oldRecoveryKey=sync.recoveryKey;await createCloudProject({...data.project,name:(data.project.name+' – gjenopprettet').slice(0,70)},data.plan,{flush:false});removeRecoveryKey(oldRecoveryKey);toast('Gjenopprettingskopien er lagret som et nytt prosjekt.');return;}
    await withProjectTransition(async()=>{
      studio.loadingProject=true;try{studio.project=clone(data.project);editor.loadState(data.plan);renderProject();}finally{studio.loadingProject=false;}
      persist();await sync.flush();closeDialog({force:true});
    },{flush:false});
    toast('Endringene er hentet tilbake og lagret.');
  }catch(error){button.disabled=false;toast(error.message||'Gjenopprettingskopien kunne ikke åpnes.');}};
}
export function showSaveProblem(error=sync.error){
  const conflict=isRevisionConflict(error);
  openDialog(conflict?'Prosjektet er endret i en annen fane':'Endringene er ikke lagret',conflict?'Vi overskriver ikke endringer fra en annen økt.':'Behold en kopi mens du prøver igjen.',`<p class="account-note">${esc(error?.message||'Lagringen kunne ikke fullføres.')} De synlige endringene beholdes i studioet. ${storageAvailable?'En gjenopprettingskopi beholdes også på denne enheten.':'Lokal gjenoppretting er utilgjengelig. Last ned en kopi før du lukker siden.'}</p><div class="conflict-actions"><button class="button secondary" id="problem-download">${icon('download')} Last ned de synlige endringene</button><button class="button secondary" id="problem-copy">${icon('plus')} Lagre som nytt prosjekt</button>${conflict?`<button class="button secondary" id="problem-reload">${icon('cloud')} Forkast endringene her og hent den lagrede versjonen</button>`:''}</div>`,`<button class="button secondary" id="problem-stay">Fortsett her</button>${conflict?'':`<button class="button primary" id="problem-retry">Prøv lagringen igjen</button>`}`);
  $('#problem-download').onclick=downloadProjectBackup;
  $('#problem-stay').onclick=closeDialog;
  $('#problem-copy').onclick=async e=>{const button=e.currentTarget;button.disabled=true;const oldRecoveryKey=sync.recoveryKey;try{await createCloudProject({...studio.project,name:(studio.project.name+' – kopi').slice(0,70)},editor.getState(),{flush:false});removeRecoveryKey(oldRecoveryKey);toast('Endringene er lagret som et nytt prosjekt.');}catch(copyError){button.disabled=false;toast(copyError.message);}};
  if($('#problem-retry'))$('#problem-retry').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{await sync.flush();closeDialog();toast('Endringene er lagret.');}catch(retryError){button.disabled=false;if(isRevisionConflict(retryError)||retryError.status===401)showSaveProblem(retryError);else toast(retryError.message);}};
  if($('#problem-reload'))$('#problem-reload').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{await withProjectTransition(async()=>{const result=await api.get(studio.activeRecord.id);await applyCloudRecord(result.project,{checkRecovery:false});sync.clearRecovery();},{flush:false});toast('Den lagrede versjonen er åpnet.');}catch(loadError){button.disabled=false;toast(loadError.message);}};
}
export function validateProjectImport(data){
  const value=safeProjectJSON(JSON.stringify(data));
  if(value.format!=='romly-v1'||!Array.isArray(value.plan.rooms)||(!value.plan.rooms.length&&value.plan.variant!=='custom')||value.plan.rooms.length>30||!value.plan.rooms.every(room=>typeof room.id==='string'&&typeof room.name==='string'&&room.name.length<80&&['x','y','w','h','width','height'].every(key=>Number.isFinite(room[key])&&Math.abs(room[key])<10000)&&room.w>0&&room.h>0&&room.width>0&&room.height>0&&/^#[a-f\d]{6}$/i.test(room.color)))throw new Error('Filen er ikke et gyldig Romly-prosjekt.');
  value.plan=migratePlan(value.plan);
  return value;
}
// No sign-in for now: projects and files live in this browser (local-store.js). The cloud api
// in cloud.js and the server routes are kept, unused, for when accounts come back.
export async function initializeStorage(){
  renderSaveStatus({state:'loading',message:'Åpner lagringen …'});
  try{
    let preferredId;try{preferredId=localStorage.getItem('romly-last-active-id');}catch{}
    const bootstrap=await api.bootstrap(preferredId);studio.sessionReady=true;sync.user=session.user;
    if(bootstrap.project){try{await withProjectTransition(()=>applyCloudRecord(bootstrap.project,{files:bootstrap.files||[]}));}catch(error){if(error.code!=='plan_too_new')throw error;sync.activate(null);openProjects();toast(error.message);}}
    else{sync.activate(null);openProjects(bootstrap.hasProjects?undefined:[]);}
  }catch(error){reportProblem(error,{context:'storage-init'});studio.sessionReady=false;sync.activate(null);renderSaveStatus({state:'error',message:'Nettleseren tillater ikke lagring',error});openStorage();}
}
export function bindProjects(){
  window.addEventListener('beforeunload',event=>{if(sync.dirty||sync.saving||studio.filesBusy||studio.transitioning){event.preventDefault();event.returnValue='';}});
  $('#save-status').onclick=()=>{if(sync.error)showSaveProblem();};
  $('#save-status').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&sync.error){e.preventDefault();showSaveProblem();}};
  $('#retry-save-btn').onclick=async()=>{if(isRevisionConflict(sync.error)||sync.error?.status===401){showSaveProblem();return;}try{await sync.flush();toast('Endringene er lagret.');}catch(error){showSaveProblem(error);}};
  $('#save-copy-btn').onclick=()=>showSaveProblem();
  $('#backup-unsaved-btn').onclick=downloadProjectBackup;
  window.addEventListener('online',()=>{if(sync.dirty&&!isRevisionConflict(sync.error))sync.flush().catch(()=>{});});
}
