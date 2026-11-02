import { PlanEditor, upgradeExamplePlan } from './plan.js';
import { ProjectSync, isRevisionConflict } from './cloud.js';
import { createLocalApi, LOCAL_USER } from './local-store.js';
import { openFloorplanFile, calibrateReference } from './reference-loader.js';
import { evaluatePlan, STATUS_LABELS, DISCLAIMER, RULESET } from './tek17-check.js';
import { installErrorReporting, reportProblem } from './error-reporter.js';
installErrorReporting();

const paths={
brand:'<path d="m4 10 8-7 8 7v10h-6v-7h-4v7H4z"/><path d="M9 6V3"/>',
home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',
help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2.5M12 17h.01"/>',
'chevron-right':'<path d="m9 5 7 7-7 7"/>','chevron-down':'<path d="m6 9 6 6 6-6"/>',
'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
check:'<path d="m5 12 4 4L19 6"/>',cloud:'<path d="M7 18a5 5 0 0 1-1-10 6.5 6.5 0 0 1 12.5 1A4.5 4.5 0 0 1 18 18"/><path d="m9 16 2 2 4-4"/>',
export:'<path d="M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7"/>',
sparkles:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4m-2-2h4"/>',
sliders:'<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
cursor:'<path d="m5 3 14 9-7 1-3 7z"/>',wall:'<path d="M3 5h18v14H3zM3 12h18M9 5v7m6 0v7"/>',
door:'<path d="M4 21h16M6 21V4l11-2v19M17 4h3v17M13 12h.01"/>',window:'<path d="M3 4h18v16H3zM12 4v16M3 12h18"/>',
sofa:'<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M5 18h14M4 20v-2m16 2v-2M5 11a2 2 0 0 0-3 2v5h20v-5a2 2 0 0 0-3-2v4H5z"/>',
table:'<path d="M3 8h18v5H3zM5 13v8m14-8v8M5 8V4m14 4V4"/>',
bed:'<path d="M3 18V7m18 11V7M3 14h18v6M3 20v2m18-2v2M6 14V6h12v8M8 10h3m2 0h3"/>',
plant:'<path d="M7 15h10l-2 7H9zM12 15V8M12 11C3 12 3 3 3 3s9-1 9 8ZM12 8C12 1 21 2 21 2s1 8-9 8"/>',
bath:'<path d="M3 12h18v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 12V5a3 3 0 0 1 6 0M5 22v-2m14 2v-2"/>',
hall:'<path d="M4 3h16v18H4zM9 3v18m6-10h2"/>',
plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
bulb:'<path d="M9 19h6m-6 3h6M8 14a7 7 0 1 1 8 0c-1 .7-1 1.5-1 2H9c0-.5 0-1.3-1-2Z"/>',
layers:'<path d="m12 3 10 6-10 6L2 9zM3 13l9 5 9-5M3 17l9 5 9-5"/>',
undo:'<path d="M3 9h11a7 7 0 0 1 0 14M3 9l5-5M3 9l5 5"/>',redo:'<path d="M21 9H10a7 7 0 0 0 0 14M21 9l-5-5m5 5-5 5"/>',
cube:'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10M7 5l10 6"/>',
expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10"/>',
edit:'<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z"/><path d="m8 12 3 3 5-6"/>',
close:'<path d="m6 6 12 12M6 18 18 6"/>',upload:'<path d="M12 16V3M7 8l5-5 5 5M3 15v6h18v-6"/>',
file:'<path d="M5 2h9l5 5v15H5zM14 2v6h5M8 13h8m-8 4h8"/>',
warning:'<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
document:'<path d="M5 2h14v20H5zM8 7h8m-8 5h8m-8 5h5"/>',
hand:'<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5v-6a1.5 1.5 0 0 1 3 0V12m0-5.5a1.5 1.5 0 0 1 3 0V13m0-3.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.5a7 7 0 0 1-5.6-2.8L4 16.5a1.6 1.6 0 0 1 2.5-2L8 16"/>'
};
const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.home}</svg>`;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
icons();
const $=(s)=>document.querySelector(s);
const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n)=>Number(n).toLocaleString('nb-NO',{maximumFractionDigits:1});
const clone=data=>JSON.parse(JSON.stringify(data));
// Norwegian keyboards type a decimal comma; '' means "not answered".
const decimal=value=>{const text=String(value??'').trim().replace(/\s/g,'').replace(',','.');return text===''?null:/^-?\d*\.?\d+$/.test(text)?Number(text):NaN;};
// The server rejects control characters in single-line fields, so they never reach a save.
const singleLine=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ');
const multiLine=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');
const api=createLocalApi();
const session={user:LOCAL_USER};
let activeRecord=null, projectList=[], loadingProject=false, transitioning=false, filesBusy=0, fileMutation=0, sessionReady=false, lastSaveStatus={state:'loading',message:'Åpner lagringen …'}, projectDialogGeneration=0;
let referenceFailedKey='',referenceAssetKey='',referenceObjectURL=null,referenceGeneration=0,dialogCleanup=null,importingPlan=false,viewGeneration=0;
const sync=new ProjectSync(renderSaveStatus,{client:api,where:'på denne enheten'});
const compactWorkspace=window.matchMedia('(max-width: 900px)');
function setWorkspacePanel(panel){
  if(!['canvas','tools','properties'].includes(panel))return;
  $('.studio').dataset.panel=panel;
  document.querySelectorAll('[data-workspace-panel]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workspacePanel===panel)));
  const activePanel=$('#workspace-'+panel);
  if(compactWorkspace.matches&&document.activeElement?.closest('.tools-panel,.properties-panel,.canvas-panel')&&!activePanel.contains(document.activeElement)){
    $('[data-workspace-panel="'+panel+'"]').focus({preventScroll:true});
  }
}
document.querySelectorAll('[data-workspace-panel]').forEach(button=>button.onclick=()=>setWorkspacePanel(button.dataset.workspacePanel));
compactWorkspace.addEventListener('change',()=>{
  if(!compactWorkspace.matches)return;
  const focusedPanel=document.activeElement?.closest('#workspace-tools,#workspace-properties');
  setWorkspacePanel(focusedPanel?.id.replace('workspace-','')||$('.studio').dataset.panel);
});
function safeProjectJSON(text){
  const data=JSON.parse(text);
  const types=['window','door','plant','sofa','table','bed','wall'];
  if(!data?.project||typeof data.project.name!=='string'||typeof data.project.wishes!=='string'||!['01','02','03'].includes(data.project.variant)||!Number.isInteger(data.project.bedrooms)||data.project.bedrooms<1||data.project.bedrooms>5||!Number.isInteger(data.project.bathrooms)||data.project.bathrooms<1||data.project.bathrooms>3)throw Error('Ugyldig prosjekt');
  if(!Array.isArray(data.plan?.items)||data.plan.items.length>300||!data.plan.items.every(item=>typeof item.id==='string'&&types.includes(item.type)&&['x','y','rotation'].every(k=>Number.isFinite(item[k])&&Math.abs(item[k])<10000)&&['x2','y2'].every(k=>item[k]===undefined||(Number.isFinite(item[k])&&Math.abs(item[k])<10000))))throw Error('Ugyldige elementer');
  return data;
}
let selectedId='living', zoom=100, currentView='2d', activeTool='select', uploads=[], saveTimer, toastTimer, editor;
let project={name:'Eksempelbolig',municipality:'',bedrooms:2,bathrooms:1,wishes:'En sosial stue og et ekstra soverom. Behold mest mulig av den opprinnelige planløsningen.',variant:'01'};
let stored;
try{stored=JSON.parse(localStorage.getItem('romly-project-v1'));}catch{}
const storageAvailable=(()=>{try{localStorage.setItem('romly-test','1');localStorage.removeItem('romly-test');return true;}catch{return false;}})();
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3800);}
function persist(plan){if(!loadingProject&&editor){const snapshot=plan||editor.getState();sync.mark({project:clone(project),plan:snapshot});resolveReferenceImage(snapshot);updateWorkflowProgress();}}
function roomIcon(r){return r?.type==='bedroom'?'bed':r?.type==='bath'?'bath':r?.type==='hall'?'hall':r?.type==='office'?'table':r?.type==='storage'?'layers':'sofa';}
function rooms(){return editor?.getState().rooms||[];}
function renderRooms(){
  const state=editor?.getState();const list=state?.rooms||[];
  // Rebuilding the list must not drop keyboard focus from the row the user is on.
  const focusedRoom=document.activeElement?.closest?.('#room-list [data-room]')?.dataset.room;
  $('#room-list').innerHTML=list.length?list.map(r=>`<button class="room-row ${r.id===selectedId?'active':''}" data-room="${esc(r.id)}" aria-pressed="${r.id===selectedId}"><span class="room-icon">${icon(roomIcon(r))}</span><span class="room-details"><strong>${esc(r.name)}</strong><small>${r.type==='bedroom'?'Ro og hvile':r.type==='bath'?'Bad og våtrom':r.type==='storage'?'Bod og oppbevaring':r.type==='room'?'Velg romtype i egenskaper':'Ditt rom'}</small></span><span class="room-size">${fmt(r.area??r.width*r.height)}<small> m²</small></span></button>`).join(''):`<div class="empty-rooms">Tegn rom oppå plantegningen for å bygge din egen modell.<button class="button secondary" id="trace-first-room">${icon('plus')} Tegn første rom</button></div>`;
  if(focusedRoom)$('#room-list').querySelector(`[data-room="${CSS.escape(focusedRoom)}"]`)?.focus({preventScroll:true});
  if($('#trace-first-room'))$('#trace-first-room').onclick=()=>{setTool('room');setWorkspacePanel('canvas');};
  $('#total-area').innerHTML=`${fmt(list.reduce((a,r)=>a+(r.area??r.width*r.height),0))} <small>m²</small>`;
  // Count by the room type the user chose; names are only a fallback for untyped rooms.
  $('#bedroom-count').textContent=list.filter(r=>r.type==='bedroom'||(r.type==='room'&&/soverom/i.test(r.name))).length;
  $('#bath-count').textContent=list.filter(r=>r.type==='bath'||(r.type==='room'&&/^bad/i.test(r.name))).length;
  updateWorkflowProgress();
  const ref=state?.reference;$('#reference-details').hidden=!ref;$('#reference-name').textContent=ref?ref.name:'';if(ref)$('#reference-opacity').value=ref.opacity??0.7;
}
function selectRoom(r){
  selectedId=r?.id||null;
  $('#selected-room-title').textContent=r?.name||'Ingen rom valgt';
  $('#room-name').value=r?.name||'';$('#room-width').value=r?inputNumber(r.width):'';$('#room-height').value=r?inputNumber(r.height):'';
  $('#room-type').value=r?.type||'room';$('#room-area').textContent=r?fmt(r.area??r.width*r.height)+' m²':'—';$('#selected-room-icon').innerHTML=icon(roomIcon(r));
  $('#room-ceiling').value=r&&Number.isFinite(r.ceilingHeight)?inputNumber(r.ceilingHeight):'';$('#room-ceiling').placeholder=Number.isFinite(project.building?.ceilingHeight)?'Som boligen ('+inputNumber(project.building.ceilingHeight)+')':'Ikke oppgitt';$('#room-previous-use').value=r?.previousUse||'';
  for(const el of document.querySelectorAll('#room-name,#room-width,#room-height,#room-type,[data-material],#rename-room,#room-ceiling,#room-previous-use'))el.disabled=!r;
  document.querySelectorAll('.material').forEach(b=>b.classList.toggle('active',b.dataset.material===r?.color));renderRooms();
}
editor=new PlanEditor($('#floorplan'),{onSelect:selectRoom,onChange:state=>persist(state),onViewError:error=>{reportProblem(error,{context:'3d'});setView('2d');toast(error.message||'3D ble avbrutt. Tegningen er åpnet i 2D.');},onNotice:toast,onItemSelect:showItem,onZoom:value=>{zoom=value;$('#zoom-value').textContent=value+' %';}});
const initialPlan=editor.getState();
function renderProject(){$('#project-title').textContent=project.name;$('#breadcrumb-title').textContent=project.name;$('#variant-name').textContent=editor?.getState().variant==='custom'?'Egen':project.variant;$('.prototype-label').textContent=activeRecord?'Tidlig produktversjon · Ditt prosjekt':'Eksempelvisning · Ikke lagret';}
renderProject();selectRoom(rooms().find(r=>r.id===selectedId)||rooms()[0]);
renderSaveStatus(lastSaveStatus);

$('#room-list').addEventListener('click',e=>{const row=e.target.closest('[data-room]');if(row){editor.selectRoom(row.dataset.room);if(compactWorkspace.matches){setWorkspacePanel('properties');$('[data-workspace-panel="properties"]').focus({preventScroll:true});}}});
$('#room-name').addEventListener('change',e=>{const value=singleLine(e.target.value).trim();if(value)editor.updateRoom(selectedId,{name:value});else e.target.value=rooms().find(r=>r.id===selectedId)?.name||'';});
$('#room-type').onchange=e=>editor.updateRoom(selectedId,{type:e.target.value});
// The editor clamps to what the plan allows (0,5–100 m in own plans, the outline in the example home).
for(const [id,key] of [['room-width','width'],['room-height','height']]){$('#'+id).addEventListener('change',e=>{const value=decimal(e.target.value);if(!Number.isFinite(value)||value<0.5||value>100){toast('Skriv et mål i meter, for eksempel 3,6.');selectRoom(rooms().find(r=>r.id===selectedId));return;}editor.updateRoom(selectedId,{[key]:value});});}
$('#room-ceiling').addEventListener('change',e=>{const value=decimal(e.target.value);if(value!==null&&(!Number.isFinite(value)||value<1.5||value>6)){toast('Skriv takhøyden i meter, for eksempel 2,4.');selectRoom(rooms().find(r=>r.id===selectedId));return;}editor.updateRoom(selectedId,{ceilingHeight:value});});
$('#room-previous-use').onchange=e=>editor.updateRoom(selectedId,{previousUse:e.target.value||null});
function inputNumber(value){return String(Math.round(Number(value)*100)/100).replace('.',',');}
const ITEM_NAMES={window:'Vindu',door:'Dør',sofa:'Sofa',table:'Bord',bed:'Seng',plant:'Plante',wall:'Skillevegg'};
let shownItem=null;
function showItem(item){
  shownItem=item;const panel=$('#item-properties');panel.hidden=!item;if(!item)return;
  const opening=item.type==='door'||item.type==='window';
  $('#item-title').textContent=ITEM_NAMES[item.type]||'Element';$('#item-warning').hidden=!item.detached;
  $('#item-rotate-label').textContent=opening?'Snu':'Roter 90°';
  $('#item-opening-fields').hidden=!opening;
  panel.querySelectorAll('[data-window-only]').forEach(el=>el.hidden=item.type!=='window');panel.querySelectorAll('[data-door-only]').forEach(el=>el.hidden=item.type!=='door');
  $('#item-width-label').textContent=item.type==='door'?'Fri bredde':'Glassbredde';
  for(const [id,key] of [['item-width','width'],['item-height','height'],['item-sill','sillHeight']])if(document.activeElement!==$('#'+id))$('#'+id).value=Number.isFinite(item[key])?inputNumber(item[key]):'';
  $('#item-escape').checked=!!item.escape;$('#item-entrance').checked=!!item.entrance;
  $('#item-hint').textContent=item.detached?'Dra elementet inntil en vegg. Ellers telles det ikke i 3D eller i prosjektkontrollen.':opening?'Målene brukes i prosjektkontrollen (dagslys, utsyn, dørbredde og rømning). Tomme felt regnes som ukjent.':'Q/E roterer, Ctrl+D dupliserer, piltaster flytter.';
}
$('#item-rotate').onclick=()=>editor.rotateSelected(90);
$('#item-duplicate').onclick=()=>{if(editor.duplicateSelected())toast('Elementet er duplisert.');};
$('#item-delete').onclick=()=>editor.removeSelected();
for(const [id,key] of [['item-width','width'],['item-height','height'],['item-sill','sillHeight']])$('#'+id).addEventListener('change',e=>{if(!shownItem)return;const value=decimal(e.target.value);if(value!==null&&!Number.isFinite(value)){toast('Skriv målet i meter, for eksempel 1,2.');showItem(shownItem);return;}const before=shownItem[key];editor.updateItem(shownItem.id,{[key]:value});const after=editor.selectedItemState();if(after&&value!==null&&after[key]===before)toast('Målet er utenfor det som er mulig for dette elementet.');if(after)showItem({...after,detached:shownItem.detached});});
$('#item-escape').onchange=e=>shownItem&&editor.updateItem(shownItem.id,{escape:e.target.checked});
$('#item-entrance').onchange=e=>shownItem&&editor.updateItem(shownItem.id,{entrance:e.target.checked});
$('#rename-room').onclick=()=>{$('#room-name').focus();$('#room-name').select();};
document.querySelectorAll('[data-material]').forEach(b=>b.onclick=()=>editor.updateRoom(selectedId,{color:b.dataset.material}));
function setTool(tool){if(currentView==='3d'||editor.view==='loading3d')setView('2d');activeTool=tool;$('.studio').dataset.tool=tool;editor.setTool(tool);document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('#canvas-hint').innerHTML=icon(tool==='select'?'cursor':tool==='pan'?'hand':tool)+({select:'Klikk på et rom for å tilpasse. Dra i tomt område for å panorere',pan:'Dra for å flytte tegningen. Rull for å zoome',room:'Dra fra ett hjørne til et annet for å tegne rommet',wall:'Klikk for å tegne skillevegger etter hverandre. Esc avslutter',door:'Klikk på en vegg for å plassere en dør',window:'Klikk på en yttervegg for å plassere et vindu'}[tool]||'Klikk i plantegningen');}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{setTool(b.dataset.tool);if(compactWorkspace.matches)setWorkspacePanel('canvas');});
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{editor.addItem(b.dataset.add);if(compactWorkspace.matches)setWorkspacePanel('canvas');toast('Møbelet er lagt til. Dra det til ønsket plass.');});
document.querySelectorAll('[data-tool-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tool-tab]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',x===b);});$('#build-tools').classList.toggle('hidden',b.dataset.toolTab!=='build');$('#interior-tools').classList.toggle('hidden',b.dataset.toolTab!=='interior');setTool('select');});
$('#add-window').onclick=()=>{setTool('window');if(compactWorkspace.matches)setWorkspacePanel('canvas');toast('Klikk på en yttervegg for å plassere vinduet.');};$('#add-door').onclick=()=>{setTool('door');if(compactWorkspace.matches)setWorkspacePanel('canvas');toast('Klikk på en vegg for å plassere døren.');};
$('#add-room-btn').onclick=()=>openAddRoom();
$('#delete-selection').onclick=()=>{if(!editor.removeSelected())toast('Velg en dør, et vindu eller et møbel du har lagt til først.');};
$('#undo-btn').onclick=()=>editor.undo();$('#redo-btn').onclick=()=>editor.redo();
function setZoom(value){zoom=Math.max(25,Math.min(400,value));editor.setZoom(zoom);$('#zoom-value').textContent=zoom+' %';}
$('#zoom-out').onclick=()=>setZoom(Math.round(zoom/1.2));$('#zoom-in').onclick=()=>setZoom(Math.round(zoom*1.2));$('#zoom-fit').onclick=$('#zoom-value').onclick=()=>{setZoom(100);editor.resetView();setView(currentView);};
async function setView(view){
  const generation=++viewGeneration;$('#view-3d').disabled=view==='3d';
  try{const actual=await editor.setView(view);if(generation!==viewGeneration)return;currentView=actual||view;}
  catch(error){if(generation!==viewGeneration)return;currentView='2d';toast(error.message||'3D kunne ikke åpnes på denne enheten.');}
  finally{if(generation===viewGeneration){$('#view-3d').disabled=false;$('.studio').dataset.view=currentView;for(const mode of ['2d','3d']){$('#view-'+mode).classList.toggle('active',currentView===mode);$('#view-'+mode).setAttribute('aria-pressed',String(currentView===mode));}}}
}
$('#view-2d').onclick=()=>setView('2d');$('#view-3d').onclick=()=>setView('3d');
for(const [id,key] of [['show-dimensions','dimensions'],['show-furniture','furniture']])$('#'+id).onchange=e=>editor.setLayers({[key]:e.target.checked});
$('#layer-heading').onclick=()=>{const expanded=$('#layer-heading').getAttribute('aria-expanded')==='true';$('#layer-heading').setAttribute('aria-expanded',!expanded);$('#layer-controls').classList.toggle('hidden',expanded);};

const dialog=$('#app-dialog');let lastFocus;
function cleanupDialog(){if(dialogCleanup){const cleanup=dialogCleanup;dialogCleanup=null;cleanup();}}
function openDialog(title,subtitle,body,footer='',wide=false){cleanupDialog();lastFocus=document.activeElement;dialog.setAttribute('aria-labelledby','dialog-title');$('#dialog-content').innerHTML=`<div class="dialog-header"><div><h2 id="dialog-title">${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="icon-button dialog-close" aria-label="Lukk">${icon('close')}</button></div><div class="dialog-body">${body}</div>${footer?`<div class="dialog-footer">${footer}</div>`:''}`;dialog.classList.toggle('wide-dialog',wide);icons(dialog);if(!dialog.open)dialog.showModal();dialog.querySelector('.dialog-close').onclick=closeDialog;}
function closeDialog(options={}){if(transitioning&&options?.force!==true)return;cleanupDialog();dialog.close();lastFocus?.focus();document.querySelectorAll('.workflow-step').forEach(b=>{b.classList.toggle('active',b.dataset.step==='3');if(b.dataset.step==='3')b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});}
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
function workflow(step){document.querySelectorAll('.workflow-step').forEach(b=>{b.classList.toggle('active',b.dataset.step===String(step));if(b.dataset.step===String(step))b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});if(step===1)openGround();if(step===2)openSuggestions();if(step===3)closeDialog();if(step===4)openCheck();}
document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>workflow(Number(b.dataset.step)));

function releaseReferenceAsset(){
  referenceGeneration++;referenceAssetKey='';referenceFailedKey='';
  if(referenceObjectURL)URL.revokeObjectURL(referenceObjectURL);
  referenceObjectURL=null;$('#reference-loading')?.remove();
}
async function resolveReferenceImage(plan=editor.getState()){
  const ref=plan.reference;const key=ref&&activeRecord?activeRecord.id+':'+ref.fileId+':'+ref.page:'';
  if(key===referenceAssetKey){if(editor.referenceImage!==referenceObjectURL)editor.setReferenceImage(referenceObjectURL);return;}
  if(key&&key===referenceFailedKey)return;
  releaseReferenceAsset();referenceAssetKey=key;
  if(!key){editor.setReferenceImage?.(null);return;}
  const generation=referenceGeneration;
  const file=uploads.find(item=>item.id===ref.fileId&&item.status==='ready');
  if(!file){toast('Tegnegrunnlaget mangler i prosjektet. Last opp filen på nytt.');return;}
  const label=document.createElement('div');label.id='reference-loading';label.className='reference-loading';label.textContent='Åpner plantegningen …';$('#plan-canvas').append(label);
  let sourceDocument;
  try{
    const response=await fetch(file.url,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Plantegningen kunne ikke lastes.');
    sourceDocument=await openFloorplanFile(await response.blob(),file.mimeType);
    const image=await sourceDocument.renderPage(ref.page||1);
    if(generation!==referenceGeneration)return;
    referenceObjectURL=URL.createObjectURL(image.blob);editor.setReferenceImage(referenceObjectURL);
  }catch(error){if(generation===referenceGeneration){referenceAssetKey='';referenceFailedKey=key;toast((error.message||'Plantegningen kunne ikke åpnes.')+' Åpne prosjektet på nytt for å prøve igjen.');}}
  finally{await sourceDocument?.dispose().catch(()=>{});if(generation===referenceGeneration)$('#reference-loading')?.remove();}
}

function choosePlanFile(){
  if(!session.user){openStorage();return;}
  if(filesBusy||transitioning||importingPlan){toast('Vent til den pågående filhandlingen er ferdig.');return;}
  $('#plan-file-input').click();
}
$('#import-floorplan').onclick=choosePlanFile;
$('#plan-file-input').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||!file.size||file.size>20*1024*1024){toast('Bruk JPG, PNG, WebP eller PDF, maksimalt 20 MB.');return;}
  if(!await ensureCanLeave())return;
  try{
    if(!activeRecord)await createCloudProject({name:file.name.replace(/\.[^.]+$/,'').slice(0,70)||'Min plantegning',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'},{rooms:[],items:[],variant:'custom'});
    importingPlan=true;filesBusy++;fileMutation++;
    openDialog('Importerer plantegningen','Filen lagres på denne enheten før du setter målestokk.',`<p class="cloud-loading">Laster opp ${esc(file.name)} …</p>`);
    const result=await api.upload(activeRecord.id,file);uploads.push(result.file);
    filesBusy--;importingPlan=false;
    await openPlanImport(result.file);
  }catch(error){if(importingPlan){filesBusy--;importingPlan=false;}toast(error.message||'Plantegningen kunne ikke importeres.');openGround();}
};
$('#show-reference').onchange=e=>editor.setLayers({reference:e.target.checked});
$('#reference-opacity').oninput=e=>editor.setReferenceOpacity(Number(e.target.value));
$('#remove-reference').onclick=()=>{
  const ref=editor.getState().reference;if(!ref)return;
  openDialog('Fjerne tegnegrunnlaget?',ref.name,'<p class="account-note">Rommene og elementene du har tegnet beholdes. Den opplastede filen ligger fortsatt under Grunnlag.</p>',`<button class="button secondary" id="keep-reference">Behold underlaget</button><button class="button primary" id="confirm-remove-reference">Fjern underlaget</button>`);
  $('#keep-reference').onclick=closeDialog;$('#confirm-remove-reference').onclick=()=>{editor.clearReference();renderProject();closeDialog();};
};

async function openPlanImport(file){
  if(!activeRecord||!session.user){openProjects();return;}
  if(!await ensureCanLeave())return;
  const projectId=activeRecord.id;
  let live=true,source=null,image=null,previewURL=null,points=[],page=1,renderGeneration=0;
  openDialog('Bruk din egen plantegning','Sett målestokk, og tegn rommene oppå grunnlaget.',`<div class="import-intro"><p>Klikk på to punkter i tegningen med kjent avstand, og skriv lengden i meter. Etter import kan du tegne rom, dører og vinduer i studioet.</p><label class="import-page-control" id="import-page-control" hidden>Side<input class="input" id="import-page" type="number" min="1" value="1"><span id="import-page-total"></span></label></div><div class="import-drawing" id="import-drawing"><p class="import-empty">Åpner ${esc(file.name)} …</p></div><div class="import-measurements"><label class="field">Avstand mellom punktene (meter)<input class="input" id="calibration-meters" type="text" inputmode="decimal" autocomplete="off" placeholder="For eksempel 4,20"></label><button class="button secondary" id="calibration-reset">Velg punkter på nytt</button><p class="measure-help" id="calibration-measure">Marker to punkter i plantegningen.</p></div><p class="import-error" id="calibration-error" hidden></p><p class="import-warning">Dette setter målestokken på underlaget. Rommene tegner du selv; filen tolkes ikke automatisk med AI. Tegningen i studioet erstattes, og kan hentes tilbake med Angre.</p>`,`<button class="button secondary" id="calibration-cancel">Avbryt</button><button class="button primary" id="calibration-apply" disabled>${icon('layers')} Bruk tegningen i studio</button>`,true);
  dialogCleanup=()=>{live=false;renderGeneration++;if(previewURL)URL.revokeObjectURL(previewURL);source?.dispose().catch(()=>{});};
  const refresh=()=>{
    if(!live||!image)return;
    const pointMarkup=points.map((point,index)=>`<circle cx="${point.x}" cy="${point.y}" r="${Math.max(image.width/140,4)}" fill="#7961ce" stroke="white" stroke-width="${image.width/400}"/><text x="${point.x+image.width/80}" y="${point.y-image.width/100}" font-size="${image.width/45}" fill="#6951bc" font-weight="700">${index+1}</text>`).join('');
    const line=points.length===2?`<path d="M${points[0].x} ${points[0].y}L${points[1].x} ${points[1].y}" stroke="#7961ce" stroke-width="${Math.max(image.width/450,1)}" stroke-dasharray="${image.width/120} ${image.width/180}"/>`:'';
    $('#import-drawing').innerHTML=`<svg id="calibration-svg" viewBox="0 0 ${image.width} ${image.height}" role="img" aria-label="Plantegning. Marker to punkter for å sette målestokk."><image href="${esc(previewURL)}" width="${image.width}" height="${image.height}"/>${line}${pointMarkup}</svg>`;
    $('#calibration-svg').onpointerdown=event=>{
      const svg=event.currentTarget;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const mapped=point.matrixTransform(svg.getScreenCTM().inverse());
      if(mapped.x<0||mapped.y<0||mapped.x>image.width||mapped.y>image.height)return;
      if(points.length===2)points=[];points.push({x:mapped.x,y:mapped.y});refresh();
    };
    const meters=decimal($('#calibration-meters').value);let valid=false;
    if(points.length===2&&meters>0){try{const ref=calibrateReference(file,page,image,points,meters);$('#calibration-measure').textContent=`Tegningen blir ${fmt(ref.w/50)} × ${fmt(ref.h/50)} meter.`;valid=true;$('#calibration-error').hidden=true;}catch(error){$('#calibration-error').hidden=false;$('#calibration-error').textContent=error.message;}}
    else{$('#calibration-measure').textContent=points.length===2?(Number.isNaN(meters)?'Bruk et tall, for eksempel 4,20.':'Skriv den kjente avstanden i meter.'):`Marker ${points.length?'det andre punktet':'to punkter'} i plantegningen.`;$('#calibration-error').hidden=true;}
    $('#calibration-apply').disabled=!valid;
  };
  const renderPage=async value=>{
    const generation=++renderGeneration;image=null;points=[];$('#calibration-apply').disabled=true;$('#calibration-error').hidden=true;$('#calibration-measure').textContent='Vent mens siden gjøres klar.';$('#import-drawing').innerHTML='<p class="import-empty">Gjør klar siden …</p>';
    try{const next=await source.renderPage(value);if(!live||generation!==renderGeneration)return;if(previewURL)URL.revokeObjectURL(previewURL);image=next;page=value;$('#import-page').value=String(value);previewURL=URL.createObjectURL(image.blob);refresh();}
    catch(error){if(live&&generation===renderGeneration){$('#calibration-error').hidden=false;$('#calibration-error').textContent=error.message||'Siden kunne ikke åpnes.';}}
  };
  $('#calibration-cancel').onclick=closeDialog;$('#calibration-reset').onclick=()=>{points=[];refresh();};$('#calibration-meters').oninput=refresh;
  $('#import-page').onchange=e=>{const requested=Number(e.target.value);if(source&&Number.isInteger(requested)&&requested>=1&&requested<=source.numPages)renderPage(requested);else e.target.value=page;};
  $('#calibration-apply').onclick=async event=>{
    const button=event.currentTarget;if(!live||!image||projectId!==activeRecord?.id)return;button.disabled=true;
    try{
      const reference=calibrateReference(file,page,image,points,decimal($('#calibration-meters').value));
      await withProjectTransition(async()=>{
        await setView('2d');
        releaseReferenceAsset();referenceAssetKey=activeRecord.id+':'+file.id+':'+page;referenceObjectURL=URL.createObjectURL(image.blob);
        editor.setReference(reference,{replace:true});editor.setReferenceImage(referenceObjectURL);
        selectedId=null;renderProject();zoom=100;$('#zoom-value').textContent='100 %';setTool('room');setWorkspacePanel('canvas');
        await sync.flush();closeDialog({force:true});
      });
      toast('Plantegningen er importert. Dra over hvert rom for å lage modellen.');
    }catch(error){button.disabled=false;if($('#calibration-error')){$('#calibration-error').hidden=false;$('#calibration-error').textContent=error.message;}else showSaveProblem(error);}
  };
  try{
    const response=await fetch(file.url,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Filen kunne ikke hentes fra prosjektet.');
    const loaded=await openFloorplanFile(await response.blob(),file.mimeType);if(!live){await loaded.dispose();return;}source=loaded;
    $('#import-page-control').hidden=source.numPages===1;$('#import-page').max=source.numPages;$('#import-page-total').textContent='av '+source.numPages;
    await renderPage(1);
  }catch(error){if(live){$('#import-drawing').innerHTML='<p class="import-empty">Plantegningen kunne ikke åpnes.</p>';$('#calibration-error').hidden=false;$('#calibration-error').textContent=error.message;}}
}

function openSuggestions(){
  if(editor.getState().variant!=='custom'){openExampleSuggestions();return;}
  openDialog('Hva ønsker du å endre?','Behovene dine lagres sammen med din egen plantegning.',`<div class="form-grid"><label class="field">Ønsket antall soverom<input class="input" id="custom-bedrooms" type="number" min="1" max="5" value="${project.bedrooms}"></label><label class="field">Ønsket antall bad<input class="input" id="custom-bathrooms" type="number" min="1" max="3" value="${project.bathrooms}"></label></div><label class="field">Dine ønsker<textarea class="input" id="custom-wishes" rows="4" maxlength="4000">${esc(project.wishes)}</textarea></label><p class="custom-needs-note">Du bruker din egen plantegning i studioet. Tegn og tilpass rommene der. Automatisk generering av planforslag fra dette underlaget er ikke tilkoblet ennå.</p>`,`<button class="button primary" id="custom-needs-save">Lagre og åpne studio ${icon('arrow-right')}</button>`);
  $('#custom-needs-save').onclick=async()=>{const beds=Number($('#custom-bedrooms').value),baths=Number($('#custom-bathrooms').value);if(!Number.isInteger(beds)||beds<1||beds>5||!Number.isInteger(baths)||baths<1||baths>3){toast('Velg 1–5 soverom og 1–3 bad.');return;}project.bedrooms=beds;project.bathrooms=baths;project.wishes=multiLine($('#custom-wishes').value);persist();try{await sync.flush();closeDialog();}catch(error){showSaveProblem(error);}};
}

function openAddRoom(){
  if(!rooms().length){setTool('room');setWorkspacePanel('canvas');toast('Dra fra ett hjørne til et annet for å tegne det første rommet.');return;}
  openAddRoomDialog();
}

function uploadList(){
  if(!uploads.length)return'<p class="empty-upload">Ingen filer lagt til. Last opp bilder eller plantegninger til prosjektet.</p>';
  return uploads.map(file=>{
    const ready=!file.status||file.status==='ready';
    const pending=file.status==='pending';
    const canDelete=file.canDelete!==false;
    const message=ready?`${fmt(file.size/1024)} kB · Lagret på denne enheten`:pending?(canDelete?'Opplastingen ble avbrutt. Fjern filen og prøv igjen.':'Opplasting pågår. Åpne grunnlaget igjen for oppdatert status.'):'Slettingen ble avbrutt. Prøv å fjerne filen igjen.';
    return`<div class="upload-item">${ready&&file.mimeType?.startsWith('image/')?`<img class="upload-thumb" loading="lazy" decoding="async" src="${esc(file.url)}" alt="Forhåndsvisning av ${esc(file.name)}">`:`<span class="upload-thumb">${icon('file')}</span>`}<div><strong>${esc(file.name)}</strong><small>${message}</small>${ready?`<button class="use-floorplan" data-use-plan="${esc(file.id)}">${icon('layers')} Bruk i tegningen</button><a class="text-link" href="${esc(file.url)}" target="_blank" rel="noopener noreferrer">Åpne fil ↗</a>`:''}</div><button class="icon-button" data-remove-file="${esc(file.id)}" aria-label="${ready?'Fjern':'Prøv å fjerne'} ${esc(file.name)}" ${canDelete?'':'disabled'}>${icon('close')}</button></div>`;
  }).join('');
}
function refreshUploadList(){updateWorkflowProgress();if($('#upload-list'))$('#upload-list').innerHTML=uploadList();if($('#file-upload-progress'))$('#file-upload-progress').textContent=filesBusy?'Laster opp fil. Vent til opplastingen er bekreftet …':'';}
function bindUploads(){
  const zone=$('#dropzone');zone.onclick=()=>$('#file-input').click();
  zone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file-input').click();}};
  zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-over');};zone.ondragleave=()=>zone.classList.remove('drag-over');
  zone.ondrop=e=>{e.preventDefault();zone.classList.remove('drag-over');acceptFiles(e.dataTransfer.files);};
  $('#upload-list').onclick=async e=>{
    const use=e.target.closest('[data-use-plan]');if(use){const file=uploads.find(f=>f.id===use.dataset.usePlan);if(file&&!filesBusy&&!transitioning)openPlanImport(file);return;}
    const button=e.target.closest('[data-remove-file]');if(!button||button.disabled||!activeRecord||filesBusy||transitioning)return;const id=activeRecord.id;button.disabled=true;fileMutation++;filesBusy++;try{await api.removeFile(id,button.dataset.removeFile);if(activeRecord?.id===id){uploads=uploads.filter(file=>file.id!==button.dataset.removeFile);refreshUploadList();toast('Filen er slettet fra prosjektet.');}}catch(error){button.disabled=false;toast(error.message);}finally{filesBusy--;refreshUploadList();}
  };
}
async function acceptFiles(files){
  if(transitioning){toast('Vent til prosjektet er åpnet.');return;}
  if(!activeRecord||!session.user){toast('Opprett eller åpne et prosjekt før du laster opp filer.');return;}
  if(filesBusy){toast('Vent til den pågående opplastingen er ferdig.');return;}
  const id=activeRecord.id;let added=0;
  filesBusy++;fileMutation++;refreshUploadList();
  try{for(const file of Array.from(files)){
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>20*1024*1024||file.size===0||uploads.length>=12){toast('Bruk JPG, PNG, WebP eller PDF, maks. 20 MB per fil og 12 filer per prosjekt.');continue;}
    try{const result=await api.upload(id,file);if(activeRecord?.id===id){uploads=uploads.filter(item=>item.id!==result.file.id);uploads.push(result.file);added++;refreshUploadList();}}catch(error){toast(error.message);}
  }}finally{filesBusy--;refreshUploadList();}
  if(added)toast(`${added===1?'Filen er':added+' filer er'} lastet opp og lagret på denne enheten.`);
}
$('#file-input').onchange=e=>{acceptFiles(e.target.files);e.target.value='';};
function openGround(){
  if(!activeRecord){openProjects();return;}
  openDialog('La oss bli kjent med hjemmet ditt','Prosjektdetaljer og filer lagres på denne enheten.',`<div class="form-grid"><label class="field">Prosjektnavn<input id="project-name-field" class="input" maxlength="70" value="${esc(project.name)}"></label><label class="field">Kommune<input id="municipality-field" class="input" maxlength="70" value="${esc(project.municipality)}" placeholder="Skriv kommunen din"></label></div><div id="dropzone" class="dropzone" role="button" tabindex="0">${icon('upload')}<strong>Dra inn plantegning eller bilder</strong><span>eller <u>velg filer fra enheten</u></span><small>JPG, PNG, WebP eller PDF · Maks. 20 MB per fil · 12 filer per prosjekt</small></div><div id="file-upload-progress" class="file-upload-progress" role="status"></div><div id="upload-list" class="upload-list">${uploadList()}</div><div class="info-banner">${icon('info')}<p>Filene lagres bare i denne nettleseren og sendes ikke til noen server. Velg «Bruk i tegningen» på en fil for å sette målestokk og tegne egne rom. Automatisk AI-tolkning er ikke tilkoblet.</p></div>`,`<button class="button secondary" id="ground-cancel">Tilbake til studio</button><button class="button primary" id="ground-next">Videre til dine ønsker ${icon('arrow-right')}</button>`);
  bindUploads();refreshUploadList();
  const currentId=activeRecord.id;const currentFileMutation=fileMutation;
  api.files(currentId).then(result=>{if(activeRecord?.id===currentId&&!filesBusy&&fileMutation===currentFileMutation){uploads=result.files||[];refreshUploadList();}}).catch(error=>toast(error.message));
  $('#project-name-field').oninput=e=>{project.name=singleLine(e.target.value).trim()||'Mitt oppussingsprosjekt';renderProject();persist();};
  $('#municipality-field').oninput=e=>{project.municipality=singleLine(e.target.value).trim();persist();};
  $('#ground-cancel').onclick=closeDialog;
  $('#ground-next').onclick=async()=>{if(filesBusy){toast('Vent til opplastingen er ferdig.');return;}try{await sync.flush();workflow(2);}catch(error){showSaveProblem(error);}};
}
function miniPlan(variant){return `<svg class="mini-plan" viewBox="0 0 240 140" fill="none" aria-hidden="true"><rect x="30" y="17" width="180" height="108" fill="#ece5d8" stroke="#5e6260" stroke-width="3"/><path d="M143 17v108M143 70h67" stroke="#5e6260" stroke-width="3"/><path d="M144 18h65v51h-65z" fill="#dce3d9"/><path d="M144 72h65v52h-65z" fill="#dce3d9"/><path d="M31 94h112v30H31z" fill="#e7e8e1"/>${variant==='03'?'<path d="M87 18v76" stroke="#5e6260" stroke-width="3"/><path d="M88 19h53v74H88z" fill="#dce3d9"/>':''}<path d="M31 94h112" stroke="#5e6260" stroke-width="2"/><rect x="40" y="32" width="15" height="43" rx="3" fill="#d1c2aa"/><rect x="58" y="43" width="34" height="22" rx="8" stroke="#a69983"/><rect x="155" y="27" width="30" height="31" rx="2" fill="#f6f4ee" stroke="#b6bcb0"/><rect x="155" y="81" width="30" height="31" rx="2" fill="#f6f4ee" stroke="#b6bcb0"/><path d="M54 17h33m83 0h20M210 40v17" stroke="#9eb8be" stroke-width="4"/></svg>`;}
function openExampleSuggestions(){const variants=[{id:'01',name:'Plass til hverdagen',tag:'ANBEFALT',text:'Åpen stue og to gode soverom. En balansert løsning med rom for samvær.',beds:2},{id:'02',name:'Mer plass til ro',tag:'ALTERNATIV',text:'Et større hovedsoverom og et kompakt ekstrarom til gjester eller hjemmekontor.',beds:2},{id:'03',name:'Et rom til',tag:'FAMILIE',text:'Tre soverom og en mer kompakt sosial sone. Krever nærmere faglig vurdering.',beds:3}];openDialog('Hvordan vil du bo?','Fortell om behovene dine, og utforsk mulighetene.',`<div class="needs-grid"><div class="need-control"><span>${icon('bed')} Soverom</span><div class="counter"><button data-count="bedrooms" data-delta="-1" aria-label="Færre soverom">−</button><strong id="desired-bedrooms">${project.bedrooms}</strong><button data-count="bedrooms" data-delta="1" aria-label="Flere soverom">+</button></div></div><div class="need-control"><span>${icon('bath')} Bad</span><div class="counter"><button data-count="bathrooms" data-delta="-1" aria-label="Færre bad">−</button><strong id="desired-bathrooms">${project.bathrooms}</strong><button data-count="bathrooms" data-delta="1" aria-label="Flere bad">+</button></div></div></div><label class="field">Hva er viktig for deg?<textarea id="wishes-field" class="input" rows="3" placeholder="For eksempel et ekstra soverom, mer lys eller et større bad …">${esc(project.wishes)}</textarea></label><div class="suggestion-section-heading"><h3>Tre måter å se hjemmet på</h3><span class="status-pill">Eksempelforslag</span></div><div class="suggestion-grid">${variants.map(v=>`<button class="suggestion-card ${project.variant===v.id?'selected':''}" data-variant="${v.id}"><span class="recommend-badge">${v.tag}</span>${miniPlan(v.id)}<div class="suggestion-info"><h3>${v.name}</h3><span>${v.beds} soverom · 1 bad</span><p>${v.text}</p><strong>${project.variant===v.id?'Valgt planløsning':'Utforsk denne løsningen'} ${icon(project.variant===v.id?'check':'arrow-right')}</strong></div></button>`).join('')}</div><div class="info-banner">${icon('info')}<p>Dette er redigerbare eksempelplaner, ikke AI-analyse av opplastede filer. Ønskene lagres i prosjektbriefen. Nye bad og konstruktive endringer må prosjekteres faglig.</p></div>`,`<button class="button secondary" id="suggest-back">${icon('arrow-right')} Grunnlag</button><button class="button primary" id="use-suggestion">Åpne i designstudio ${icon('arrow-right')}</button>`,true);
$('#wishes-field').maxLength=4000;$('#wishes-field').oninput=e=>{project.wishes=multiLine(e.target.value);persist();};
document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{const key=b.dataset.count;project[key]=Math.max(1,Math.min(key==='bedrooms'?5:3,project[key]+Number(b.dataset.delta)));$('#desired-'+key).textContent=project[key];persist();});
let choice=project.variant,confirmReplace=false;document.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>{choice=b.dataset.variant;confirmReplace=false;$('#use-suggestion').innerHTML=`Åpne i designstudio ${icon('arrow-right')}`;$('#replace-warning')?.remove();document.querySelectorAll('[data-variant]').forEach(c=>{c.classList.toggle('selected',c===b);c.querySelector('.suggestion-info strong').innerHTML=(c===b?'Valgt planløsning':'Utforsk denne løsningen')+icon(c===b?'check':'arrow-right');});});
$('#suggest-back').onclick=()=>{project.wishes=multiLine($('#wishes-field').value);workflow(1);};
// Switching suggestion replaces the drawing. Ask once, in the dialog, when that would discard the user's own edits.
$('#use-suggestion').onclick=()=>{project.wishes=multiLine($('#wishes-field').value);
  if(choice!==project.variant&&editor.hasCustomEdits()&&!confirmReplace){confirmReplace=true;$('#use-suggestion').innerHTML=`Erstatt tegningen ${icon('arrow-right')}`;$('.dialog-body').insertAdjacentHTML('beforeend','<p class="project-message error" id="replace-warning" role="alert">Et nytt forslag erstatter rommene, møblene, dørene og vinduene du har endret. Du kan angre etterpå med Ctrl+Z.</p>');$('#replace-warning').scrollIntoView({block:'nearest'});return;}
  if(choice!==project.variant){project.variant=choice;editor.setVariant(choice);}renderProject();persist();closeDialog();toast('Planløsningen er åpen. Gjør den til din.');};}
// Facts the indicative TEK17 check needs. Limits mirror lib/projects-api.mjs; blank means "not answered".
const FACT_QUESTIONS=[
{group:'building',key:'ceilingHeight',label:'Takhøyde i boligen (m)',type:'number',min:1.5,max:6,placeholder:'For eksempel 2,4'},
{group:'building',key:'lightTransmission',label:'Lystransmisjon i glasset (LT)',type:'number',min:.3,max:1,placeholder:'For eksempel 0,6'},
{group:'building',key:'permitBefore2011',label:'Ble boligen omsøkt før 1. juli 2011?',type:'bool'},
{group:'building',key:'accessibleUnit',label:'Krav om tilgjengelig boenhet?',type:'bool',hint:'Gjelder bygninger med heiskrav, eller der alle hovedfunksjoner ligger på inngangsplanet.'},
{group:'building',key:'multiLevelUnit',label:'Går boligen over flere plan?',type:'bool'},
{group:'building',key:'planLevel',label:'Hvilket plan viser tegningen?',type:'select',options:[['inngangsplan','Inngangsplanet'],['annen','Et annet plan']]},
{group:'building',key:'multiUnitBuilding',label:'Flere boenheter i bygningen?',type:'bool'},
{group:'building',key:'existingBathrooms',label:'Antall bad i dag',type:'integer',min:0,max:5},
{group:'building',key:'externalStorageM2',label:'Bod utenfor boligen (m²)',type:'number',min:0,max:100},
{group:'measures',key:'bearingWall',label:'Fjernes eller endres bærende vegger?',type:'select',options:[['nei','Nei'],['ja','Ja'],['vet-ikke','Vet ikke']]},
{group:'measures',key:'facade',label:'Nye eller flyttede vinduer eller dører i yttervegg?',type:'bool'},
{group:'measures',key:'useChange',label:'Tas bod, kjeller eller loft i bruk som oppholdsrom?',type:'select',options:[['nei','Nei'],['tilleggsdel-hoveddel','Ja'],['innen-hoveddel','Nei, men rom får ny bruk']]},
{group:'measures',key:'newPipesThroughFireSeparation',label:'Nye rør eller kanaler gjennom vegg eller dekke mot nabo?',type:'bool'}
];
const ROOM_TYPE_NAMES={living:'Stue',bedroom:'Soverom',bath:'Bad',hall:'Entré / gang',office:'Kontor',kitchen:'Kjøkken',dining:'Spisestue',storage:'Bod',room:'Rom'};
function factValue(question){return project[question.group]?.[question.key];}
function factText(question){const value=factValue(question);return value===undefined?'Ikke oppgitt':value===true?'Ja':value===false?'Nei':question.options?question.options.find(([key])=>key===value)?.[1]??String(value):fmt(value);}
function factField(question){
  const value=factValue(question),name=`${question.group}.${question.key}`,hint=question.hint?`<small>${esc(question.hint)}</small>`:'';
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
  const group={...(project[question.group]||{})};
  if(value===null)delete group[question.key];else group[question.key]=value;
  if(Object.keys(group).length)project[question.group]=group;else delete project[question.group];
  persist();return true;
}
const CHECK_ICONS=[[/13-[78]/,'window'],[/12-13/,'door'],[/12-9|13-15|sak-4-1/,'bath'],[/11-13/,'shield'],[/12-10/,'layers'],[/13-2/,'cloud'],[/12-7|12-2/,'home'],[/pbl|sak|bruksendring|innvendig/,'document']];
function renderCheckResults(){
  const container=$('#check-results');if(!container)return;
  const state=editor.getState(),report=evaluatePlan(state,project),s=report.summary;
  const headline=s.brudd?`${s.brudd} forhold oppfyller ikke preaksepterte ytelser`:s.soknad?'Tiltaket ser ut til å kreve søknad':s.ukjent?`${s.ukjent} ${s.ukjent===1?'punkt mangler':'punkter mangler'} opplysninger`:'Ingen avvik funnet i tegningen';
  const intro=state.rooms.length?(editor.isExample()?'Kontrollen gjelder Romlys eksempelbolig. Tegn din egen bolig for en kontroll av den.':'Kontrollen bygger på tegningen og svarene dine. Den er veiledende og erstatter ikke fagfolk.'):'Tegn rommene for å få en kontroll av planen.';
  const chips=Object.entries(s).filter(([,count])=>count).map(([status,count])=>`<span class="check-chip" data-status="${status}">${count} · ${esc(STATUS_LABELS[status])}</span>`).join('');
  const item=result=>`<article class="check-item" data-status="${result.status}"><span class="check-icon">${icon(CHECK_ICONS.find(([pattern])=>pattern.test(result.ruleId))?.[1]||'edit')}</span><div><div class="check-item-heading"><h3>${esc(result.title)}${result.roomId&&state.rooms.find(r=>r.id===result.roomId)?` · ${esc(state.rooms.find(r=>r.id===result.roomId).name)}`:''}</h3><span class="check-status">${esc(STATUS_LABELS[result.status])}</span></div><p>${esc(result.message)}</p><div class="check-actions">${result.url?`<a class="check-link" href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">${esc(result.ref)} ↗</a>`:`<span class="check-link">${esc(result.ref)}</span>`}${result.roomId?`<button type="button" data-show-room="${esc(result.roomId)}">Vis i tegningen</button>`:''}${result.status==='ukjent'&&!result.roomId?'<button type="button" data-open-facts>Legg inn opplysninger</button>':''}</div></div></article>`;
  const groups=[['Må følges opp',report.results.filter(r=>['brudd','soknad','advarsel'].includes(r.status))],['Mangler opplysninger',report.results.filter(r=>r.status==='ukjent')],['Ser bra ut',report.results.filter(r=>r.status==='ok')],['Til informasjon',report.results.filter(r=>r.status==='info')]].filter(([,list])=>list.length);
  container.innerHTML=`<div class="check-overview"><span class="check-overview-icon">${icon('shield')}</span><div><span class="status-pill warning-pill">VEILEDENDE KONTROLL · TEK17</span><h3>${esc(headline)}</h3><p>${esc(intro)}</p><div class="check-summary">${chips}</div></div></div><div class="check-metrics"><span><strong>${state.rooms.length}</strong> tegnede rom</span><span><strong>${esc(project.municipality||'Ikke valgt')}</strong> kommune</span><span>Regelgrunnlag kontrollert <strong>${esc(RULESET.verified)}</strong></span></div>${groups.map(([title,list])=>`<h3 class="check-group-title">${esc(title)}</h3><div class="check-list">${list.map(item).join('')}</div>`).join('')}${report.assumptions.length?`<ul class="check-assumptions">${report.assumptions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}`;
  return report;
}
function openCheck(){
  openDialog('Et steg nærmere realisering','Veiledende kontroll av tegningen mot TEK17.',`<div id="check-results"></div><details class="facts-form" id="facts-form"><summary>Om boligen og tiltaket</summary><div class="facts-grid">${FACT_QUESTIONS.map(factField).join('')}</div></details><div class="notice">${icon('info')}<p>${esc(DISCLAIMER)} Ingen søknad sendes fra Romly.</p></div>`,`<button class="button secondary" id="check-back">Tilbake til tegningen</button><button class="button primary" id="download-review">${icon('download')} Last ned prosjektbrief</button>`,true);
  const report=renderCheckResults();$('#facts-form').open=report.summary.ukjent>=3;
  $('#check-back').onclick=closeDialog;$('#download-review').onclick=downloadReport;
  $('#facts-form').addEventListener('change',e=>{const field=e.target.closest('[data-fact]');if(!field)return;const question=FACT_QUESTIONS.find(q=>`${q.group}.${q.key}`===field.dataset.fact);if(!question)return;if(!setFact(question,field.value)){field.value=factValue(question)===undefined?'':question.type==='number'||question.type==='integer'?inputNumber(factValue(question)):String(factValue(question));return;}renderCheckResults();});
  $('#check-results').onclick=e=>{
    const show=e.target.closest('[data-show-room]');if(show){closeDialog();editor.selectRoom(show.dataset.showRoom);if(compactWorkspace.matches)setWorkspacePanel('properties');return;}
    if(e.target.closest('[data-open-facts]')){$('#facts-form').open=true;$('#facts-form').scrollIntoView({block:'start',behavior:'smooth'});$('#facts-form [data-fact]')?.focus({preventScroll:true});}
  };
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function downloadReport(){
  const state=editor.getState(),report=evaluatePlan(state,project),openings=state.items.filter(item=>item.type==='window'||item.type==='door');
  const counts=Object.entries(report.summary).filter(([,count])=>count).map(([status,count])=>`${count} ${STATUS_LABELS[status].toLowerCase()}`).join(', ');
  const room=r=>`${r.name} (${ROOM_TYPE_NAMES[r.type]||'Rom'}): ${fmt(r.width)} × ${fmt(r.height)} m, ${fmt(r.area??r.width*r.height)} m²${Number.isFinite(r.ceilingHeight)?`, takhøyde ${fmt(r.ceilingHeight)} m`:''}${r.previousUse==='tilleggsdel'?', i dag bod/kjeller/loft':''}`;
  const opening=item=>`${item.type==='window'?'Vindu':'Dør'}${item.entrance?' (inngang)':''}${item.escape?' (rømningsvindu)':''}: ${Number.isFinite(item.width)?`bredde ${fmt(item.width)} m`:'bredde ikke oppgitt'}${item.type==='window'?`, ${Number.isFinite(item.height)?`høyde ${fmt(item.height)} m`:'høyde ikke oppgitt'}, ${Number.isFinite(item.sillHeight)?`underkant ${fmt(item.sillHeight)} m`:'underkant ikke oppgitt'}`:''}`;
  const text=`ROMLY – PROSJEKTBRIEF\n${project.name}\nKommune: ${project.municipality||'Ikke oppgitt'}\nDato: ${new Date().toLocaleDateString('nb-NO')}\nKontrollgrunnlag: ${RULESET.id} ${RULESET.version} (regelverk kontrollert ${RULESET.verified})\n${editor.isExample()?'\nTEGNINGEN ER ROMLYS EKSEMPELBOLIG, IKKE DIN BOLIG.\n':''}\nDINE ØNSKER\n${project.bedrooms} soverom, ${project.bathrooms} bad\n${project.wishes||'Ingen ønsker skrevet inn.'}\n\nTEGNEDE ROM\n${state.rooms.map(room).join('\n')||'Ingen rom tegnet.'}\n\nVINDUER OG DØRER\n${openings.map(opening).join('\n')||'Ingen tegnet.'}\n\nOPPLYSNINGER DU HAR GITT\n${FACT_QUESTIONS.map(q=>`${q.label} ${factText(q)}`).join('\n')}\n\nVEILEDENDE KONTROLL (${counts})\n${report.results.map((r,i)=>`${i+1}. [${STATUS_LABELS[r.status]}] ${r.title} – ${r.ref}\n${r.message}${r.url?`\nKilde: ${r.url}`:''}`).join('\n\n')}\n\nFORUTSETNINGER\n${report.assumptions.map(a=>`- ${a}`).join('\n')}\n\n${DISCLAIMER}\n\nMålene er skisseverdier og må kontrolleres mot oppmåling. Dette er ikke AI-analyse, teknisk kontroll eller en ferdig byggesøknad.\n`;
  download('romly-prosjektbrief.txt',text,'text/plain;charset=utf-8');toast('Prosjektbriefen er lastet ned.');
}
function openExport(){
  openDialog('Ta med deg planene videre','Eksporter skissen eller ta inn et tidligere prosjekt.',`<div class="export-options"><button class="export-option" id="export-svg">${icon('image')}<div><strong>Plantegning som SVG</strong><span>Skarp vektortegning av løsningen din</span></div>${icon('download')}</button><button class="export-option" id="export-brief">${icon('document')}<div><strong>Prosjektbrief og sjekkliste</strong><span>Ønsker, rommål og punkter for faglig gjennomgang</span></div>${icon('download')}</button><button class="export-option" id="export-json">${icon('file')}<div><strong>Lagre redigerbart prosjekt</strong><span>JSON-kopi av den synlige tegningen og ønskene</span></div>${icon('download')}</button><button class="export-option" id="import-json">${icon('upload')}<div><strong>Importer prosjektfil</strong><span>Opprett et nytt prosjekt fra en eksportert JSON-fil</span></div>${icon('arrow-right')}</button></div><div class="info-banner">${icon('info')}<p>Eksporten er et skissegrunnlag. Opplastede bilder og PDF-er er ikke inkludert i JSON-filen. Mål og tekniske forhold må kontrolleres før utførelse eller innsending.</p></div>`);
  $('#export-svg').onclick=()=>{download('romly-plantegning.svg',editor.exportSVG(),'image/svg+xml');toast('Plantegningen er lastet ned.');};
  $('#export-brief').onclick=downloadReport;$('#export-json').onclick=downloadProjectBackup;
  $('#import-json').onclick=()=>{
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    // Accepts a single project file (romly-v1) or a full backup from «Lagring på denne enheten» (romly-backup-v1).
    input.onchange=async()=>{if(!input.files[0])return;try{if(input.files[0].size>10*1024*1024)throw new Error('Filen er for stor. Maks. 10 MB.');const raw=JSON.parse(await input.files[0].text());if(raw?.format==='romly-backup-v1'&&Array.isArray(raw.projects)){await restoreBackup(raw);return;}const data=validateProjectImport(raw);if(!await ensureCanLeave())return;openImportProject(data);}catch(error){toast(error.message||'Filen er ikke et gyldig Romly-prosjekt.');}};
    input.click();
  };
}
function openImportProject(data){
  openDialog('Importer prosjektet','Tegningen opprettes som et nytt prosjekt.',`<label class="field">Prosjektnavn<input class="input" id="import-project-name" maxlength="70" value="${esc(data.project.name)}"></label><div class="info-banner">${icon('info')}<p>Eksisterende prosjekter beholdes. Prosjektfilen inneholder tegning og ønsker; eventuelle bilder og PDF-er må lastes opp separat.</p></div><p class="project-message error" id="import-project-error" hidden></p>`,`<button class="button secondary" id="import-project-cancel">Avbryt</button><button class="button primary" id="import-project-submit">${icon('upload')} Importer</button>`);
  $('#import-project-cancel').onclick=closeDialog;
  $('#import-project-submit').onclick=async e=>{const button=e.currentTarget;const name=singleLine($('#import-project-name').value).trim();if(!name){$('#import-project-name').focus();return;}button.disabled=true;try{await createCloudProject({...data.project,name},data.plan);toast('Prosjektfilen er importert.');}catch(error){button.disabled=false;if($('#import-project-error')){$('#import-project-error').hidden=false;$('#import-project-error').textContent=error.message;}}};
}
function openAddRoomDialog(){openDialog('Gi plass til et nytt rom','Legg til et rom i skissen. Plassering og tilkomst må vurderes.',`<label class="field">Romnavn<input class="input" id="new-room-name" value="Nytt soverom" maxlength="40"></label><div class="info-banner">${icon('info')}<p>Det nye rommet opprettes som en skissesone. Juster størrelse og kontroller at det passer i planløsningen.</p></div>`,`<button class="button secondary" id="cancel-room">Avbryt</button><button class="button primary" id="confirm-room">${icon('plus')} Legg til rom</button>`);$('#cancel-room').onclick=closeDialog;$('#confirm-room').onclick=()=>{const name=singleLine($('#new-room-name').value).trim()||'Nytt rom';editor.addItem('room');const last=rooms().at(-1);if(last){editor.updateRoom(last.id,{name});editor.selectRoom(last.id);}closeDialog();toast('Rommet er lagt til som en skissesone.');};}
function openHelp(){openDialog('Fra plantegning til egne rom','Slik bruker du din egen bolig som utgangspunkt.',`<div class="help-steps">${[['1','Importer plantegningen','Velg Importer plantegning fra Mine prosjekter eller verktøypanelet. Bruk JPG, PNG, WebP eller PDF, og velg riktig side i en flersidig PDF.'],['2','Sett målestokken','Marker to punkter med en kjent avstand, skriv inn avstanden i meter og bruk tegningen som underlag. Du kan også utforske en av eksempelplanene.'],['3','Tegn og utforsk i 3D','Dra fra hjørne til hjørne for å tegne rom oppå underlaget. Tilpass romtype, mål, materialer, dører og vinduer. Åpne 3D for å rotere, zoome og se veggene.'],['4','Forbered neste steg','Bruk sjekklisten og eksporter en prosjektbrief til dialog med fagfolk.']].map(([n,t,p])=>`<article class="help-step"><span class="step-number">${n}</span><div><h3>${t}</h3><p>${p}</p></div></article>`).join('')}</div><div class="notice">${icon('info')}<p>Prosjekter og opplastede filer lagres bare i denne nettleseren. Importerte plantegninger tegnes opp manuelt; AI-tolkning og kommunale oppslag er ikke koblet til ennå. Eksempelvisningen lagres ikke automatisk.</p></div>`);}
function renderSaveStatus(status){
  lastSaveStatus=status;
  const element=$('#save-status');
  element.innerHTML=icon(status.state==='error'||status.state==='conflict'?'warning':'cloud')+esc(status.message);
  element.dataset.state=status.state;element.title=status.message;element.setAttribute('role','button');element.tabIndex=0;
  element.setAttribute('aria-label',status.message+(status.error?'. Åpne lagringsvalg.':''));
  const footer=$('.canvas-footer>div>span:last-child');if(footer){footer.textContent=status.message;footer.title=status.message;}
  const banner=$('#cloud-save-banner');if(banner){banner.hidden=!['error','conflict'].includes(status.state)||!activeRecord;$('#cloud-save-message').textContent=status.message;$('#retry-save-btn').textContent=status.state==='conflict'?'Se lagringsvalg':'Prøv igjen';}
  if(activeRecord&&sync.record?.id===activeRecord.id)activeRecord=sync.record;
}
function preferenceKey(){return session.user?'romly-last-project:'+session.user.id:null;}
function rememberProject(id){try{if(preferenceKey()){if(id){localStorage.setItem(preferenceKey(),id);localStorage.setItem('romly-last-active-id',id);}else{localStorage.removeItem(preferenceKey());localStorage.removeItem('romly-last-active-id');}}}catch{}}
function previousProject(){try{return preferenceKey()?localStorage.getItem(preferenceKey()):null;}catch{return null;}}
function legacyAvailable(){try{return !!stored?.project&&!!stored?.plan&&!localStorage.getItem('romly-legacy-imported:'+session.user?.id);}catch{return !!stored?.project&&!!stored?.plan;}}
function projectSnapshot(){return{project:clone(project),plan:editor.getState()};}
function removeRecoveryKey(key){try{if(key)localStorage.removeItem(key);}catch{}}
function downloadProjectBackup(){download('romly-prosjekt.json',JSON.stringify({format:'romly-v1',...projectSnapshot()},null,2),'application/json');toast('En kopi av de synlige endringene er lastet ned.');}
async function ensureCanLeave(){
  if(transitioning){toast('Vent til den pågående prosjekthandlingen er ferdig.');return false;}
  if(filesBusy){toast('Vent til filopplastingen er ferdig før du bytter prosjekt.');return false;}
  try{await sync.flush();return true;}catch(error){showSaveProblem(error);return false;}
}
async function withProjectTransition(action,{flush=true}={}){
  if(transitioning)throw new Error('En prosjekthandling pågår allerede. Vent til den er ferdig.');
  if(filesBusy)throw new Error('Vent til filhandlingen er ferdig før du bytter prosjekt.');
  transitioning=true;
  const previousFocus=document.activeElement;
  const surfaces=[$('.app-shell'),$('.topbar'),dialog];
  const previousInert=surfaces.map(element=>element.inert);
  surfaces.forEach(element=>element.inert=true);
  dialog.setAttribute('aria-busy','true');
  try{
    if(flush)await sync.flush();
    return await action();
  }finally{
    transitioning=false;
    surfaces.forEach((element,index)=>element.inert=previousInert[index]);
    dialog.removeAttribute('aria-busy');
    const previousVisible=previousFocus?.isConnected&&previousFocus.getClientRects().length&&!previousFocus.closest('[inert]');
    const target=dialog.open?dialog.querySelector('.dialog-close'):previousVisible?previousFocus:$('#projects-nav');
    if(target&&!target.disabled)target.focus({preventScroll:true});
  }
}
async function applyCloudRecord(record,{checkRecovery=true,files}={}){
  if(record.status==='deleting'){openDeleteProject(record);return;}
  const result=files!==undefined?{files}:await api.files(record.id);
  releaseReferenceAsset();
  loadingProject=true;
  try{
    activeRecord=record;project=clone(record.project);uploads=result.files||[];
    sync.activate(record);selectedId=record.plan.rooms[0]?.id||'living';editor.loadState(upgradeExamplePlan(record.plan));
    setTool('select');zoom=100;editor.setZoom(100);$('#zoom-value').textContent='100 %';setView('2d');
    renderProject();rememberProject(record.id);
  }finally{loadingProject=false;}
  closeDialog({force:true});
  resolveReferenceImage(record.plan);
  if(checkRecovery){const recovery=sync.recovery();if(recovery?.data)openRecovery(recovery);}
}
async function openCloudProject(id){
  return withProjectTransition(async()=>{const result=await api.get(id);await applyCloudRecord(result.project,{files:result.files});});
}
async function createCloudProject(data,plan,{flush=true}={}){
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
      loadingProject=true;try{project=clone(data.project);editor.loadState(upgradeExamplePlan(data.plan));renderProject();}finally{loadingProject=false;}
      persist();await sync.flush();closeDialog({force:true});
    },{flush:false});
    toast('Endringene er hentet tilbake og lagret.');
  }catch(error){button.disabled=false;toast(error.message||'Gjenopprettingskopien kunne ikke åpnes.');}};
}
function showSaveProblem(error=sync.error){
  const conflict=isRevisionConflict(error);
  openDialog(conflict?'Prosjektet er endret i en annen fane':'Endringene er ikke lagret',conflict?'Vi overskriver ikke endringer fra en annen økt.':'Behold en kopi mens du prøver igjen.',`<p class="account-note">${esc(error?.message||'Lagringen kunne ikke fullføres.')} De synlige endringene beholdes i studioet. ${storageAvailable?'En gjenopprettingskopi beholdes også på denne enheten.':'Lokal gjenoppretting er utilgjengelig. Last ned en kopi før du lukker siden.'}</p><div class="conflict-actions"><button class="button secondary" id="problem-download">${icon('download')} Last ned de synlige endringene</button><button class="button secondary" id="problem-copy">${icon('plus')} Lagre som nytt prosjekt</button>${conflict?`<button class="button secondary" id="problem-reload">${icon('cloud')} Forkast endringene her og hent den lagrede versjonen</button>`:''}</div>`,`<button class="button secondary" id="problem-stay">Fortsett her</button>${conflict?'':`<button class="button primary" id="problem-retry">Prøv lagringen igjen</button>`}`);
  $('#problem-download').onclick=downloadProjectBackup;
  $('#problem-stay').onclick=closeDialog;
  $('#problem-copy').onclick=async e=>{const button=e.currentTarget;button.disabled=true;const oldRecoveryKey=sync.recoveryKey;try{await createCloudProject({...project,name:(project.name+' – kopi').slice(0,70)},editor.getState(),{flush:false});removeRecoveryKey(oldRecoveryKey);toast('Endringene er lagret som et nytt prosjekt.');}catch(copyError){button.disabled=false;toast(copyError.message);}};
  if($('#problem-retry'))$('#problem-retry').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{await sync.flush();closeDialog();toast('Endringene er lagret.');}catch(retryError){button.disabled=false;if(isRevisionConflict(retryError)||retryError.status===401)showSaveProblem(retryError);else toast(retryError.message);}};
  if($('#problem-reload'))$('#problem-reload').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{await withProjectTransition(async()=>{const result=await api.get(activeRecord.id);await applyCloudRecord(result.project,{checkRecovery:false});sync.clearRecovery();},{flush:false});toast('Den lagrede versjonen er åpnet.');}catch(loadError){button.disabled=false;toast(loadError.message);}};
}
function megabytes(bytes){const value=bytes/1024/1024;return value<0.1?'under 0,1 MB':fmt(value)+' MB';}
function openStorage(){
  if(!sessionReady){
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
        await api.deleteAll();sync.clearRecovery();activeRecord=null;sync.activate(null);uploads=[];rememberProject(null);releaseReferenceAsset();
        try{for(const key of Object.keys(localStorage))if(key.startsWith('romly-recovery:'))localStorage.removeItem(key);}catch{}
        loadingProject=true;try{project={name:'Eksempelbolig',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'};editor.loadState(initialPlan);renderProject();}finally{loadingProject=false;}
      },{flush:false});
      toast('Alle data på denne enheten er slettet.');openProjects([]);
    }catch(error){button.disabled=false;toast(error.message);}
  };
}
async function restoreBackup(data){
  const projects=data.projects.map(entry=>validateProjectImport({format:'romly-v1',project:entry.project,plan:entry.plan}));
  if(!await ensureCanLeave())return;
  let restored=0;for(const entry of projects){try{await api.create({project:entry.project,plan:entry.plan});restored++;}catch(error){toast(error.message);break;}}
  toast(`${restored} av ${projects.length} prosjekter er hentet inn fra sikkerhetskopien.`);openProjects();
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
  return projectList.map(record=>`<article class="cloud-project-row ${record.id===activeRecord?.id?'current':''}"><button class="cloud-project-open" data-open-project="${esc(record.id)}">${miniPlan(record.project.variant)}<div>${record.status==='deleting'?'<span class="status-pill">SLETTING MÅ FULLFØRES</span>':record.id===activeRecord?.id?'<span class="status-pill">ÅPENT PROSJEKT</span>':''}<h3>${esc(record.project.name)}</h3><p>${esc(record.project.municipality||'Kommune ikke valgt')} · ${record.roomCount} rom · ${fmt(record.area)} m² · ${record.fileCount} filer</p><small>Sist endret ${esc(new Date(record.updatedAt).toLocaleString('nb-NO',{dateStyle:'short',timeStyle:'short'}))}</small></div></button><button class="cloud-project-delete" data-delete-project="${esc(record.id)}" aria-label="Slett ${esc(record.project.name)}" title="Slett prosjekt">${icon('trash')}</button></article>`).join('');
}
async function openProjects(preloaded){
  if(!session.user){openStorage();return;}
  const generation=++projectDialogGeneration;
  openDialog('Mine prosjekter','Planer, bilder og muligheter – samlet på denne enheten.',`<div class="projects-heading"><p>Prosjektene lagres bare i denne nettleseren.</p><button class="button secondary" id="projects-import-plan">Importer plantegning</button><button class="button primary" id="new-cloud-project">${icon('plus')} Nytt prosjekt</button></div><div id="cloud-projects-list" class="cloud-projects-list"><p class="cloud-loading">Henter prosjektene dine …</p></div>${legacyAvailable()?`<div class="project-migration"><div><strong>Du har et lokalt prosjekt fra prototypen</strong><p>Velg selv om tegningen og ønskene skal kopieres til et nytt prosjekt. Den opprinnelige lokale kopien beholdes.</p></div><button class="button secondary" id="migrate-local-project">Gjør om til prosjekt ${icon('arrow-right')}</button></div>`:''}`,activeRecord?`<button class="button secondary" id="projects-return">Tilbake til studio</button><button class="button secondary" id="projects-details">${icon('edit')} Prosjektdetaljer</button>`:'',true);
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
      if(transitioning)return;open.disabled=true;
      try{await openCloudProject(record.id);toast('Prosjektet er åpnet.');}catch(error){open.disabled=false;if(sync.error)showSaveProblem(error);else toast(error.message);}
    };
  }catch(error){if(generation!==projectDialogGeneration||!$('#cloud-projects-list'))return;$('#cloud-projects-list').innerHTML=`<p class="project-message error">${esc(error.message)}</p><div class="projects-error-actions"><button class="button secondary" id="reload-cloud-projects">Prøv igjen</button></div>`;$('#reload-cloud-projects').onclick=openProjects;}
}
function openDeleteProject(record){
  openDialog('Slette prosjektet?',record.project.name,`<p class="account-note">Prosjektet og alle tilhørende opplastede filer slettes fra denne enheten. Dette kan ikke angres. ${record.status==='deleting'?'En tidligere sletting ble avbrutt. Prøv igjen for å fullføre.':''}</p><p id="delete-project-error" class="project-message error" hidden></p>`,`<button class="button secondary" id="delete-project-cancel">Behold prosjektet</button><button class="button danger" id="delete-project-confirm">${icon('trash')} Slett prosjekt og filer</button>`);
  $('#delete-project-cancel').onclick=openProjects;
  $('#delete-project-confirm').onclick=async e=>{
    if(filesBusy){toast('Vent til opplastingen er ferdig.');return;}
    const button=e.currentTarget;button.disabled=true;
    try{
      const deletingActive=record.id===activeRecord?.id;
      await withProjectTransition(async()=>{
        if(deletingActive)record=sync.record;
        await api.remove(record.id,record.revision);
        if(record.id===activeRecord?.id){sync.clearRecovery();activeRecord=null;sync.activate(null);uploads=[];rememberProject(null);loadingProject=true;try{project={name:'Eksempelbolig',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'};editor.loadState(initialPlan);renderProject();}finally{loadingProject=false;}}
      },{flush:deletingActive});
      toast('Prosjektet og filene er slettet.');openProjects();
    }catch(error){button.disabled=false;if($('#delete-project-error')){$('#delete-project-error').hidden=false;$('#delete-project-error').textContent=error.message+' Prosjektet beholdes i listen til slettingen er fullført. Åpne listen igjen for å prøve på nytt.';}if(error.status===409&&record.id===activeRecord?.id&&sync.dirty)showSaveProblem(error);}
  };
}
function validateProjectImport(data){
  const value=safeProjectJSON(JSON.stringify(data));
  if(value.format!=='romly-v1'||!Array.isArray(value.plan.rooms)||(!value.plan.rooms.length&&value.plan.variant!=='custom')||value.plan.rooms.length>30||!value.plan.rooms.every(room=>typeof room.id==='string'&&typeof room.name==='string'&&room.name.length<80&&['x','y','w','h','width','height'].every(key=>Number.isFinite(room[key])&&Math.abs(room[key])<10000)&&room.w>0&&room.h>0&&room.width>0&&room.height>0&&/^#[a-f\d]{6}$/i.test(room.color)))throw new Error('Filen er ikke et gyldig Romly-prosjekt.');
  return value;
}
// No sign-in for now: projects and files live in this browser (local-store.js). The cloud api
// in cloud.js and the server routes are kept, unused, for when accounts come back.
async function initializeStorage(){
  renderSaveStatus({state:'loading',message:'Åpner lagringen …'});
  try{
    let preferredId;try{preferredId=localStorage.getItem('romly-last-active-id');}catch{}
    const bootstrap=await api.bootstrap(preferredId);sessionReady=true;sync.user=session.user;
    if(bootstrap.project){await withProjectTransition(()=>applyCloudRecord(bootstrap.project,{files:bootstrap.files||[]}));}
    else{sync.activate(null);openProjects(bootstrap.hasProjects?undefined:[]);}
  }catch(error){reportProblem(error,{context:'storage-init'});sessionReady=false;sync.activate(null);renderSaveStatus({state:'error',message:'Nettleseren tillater ikke lagring',error});openStorage();}
}
function openInspiration(){openDialog('Et hjem som føles som deg','Tre retninger å utforske i din egen plan.',`<div class="inspiration-grid">${[{name:'Lunt og naturlig',text:'Lys eik, varme tekstiler og rolige grønntoner.',color:'#e9dfcc',cls:'natural'},{name:'Varm minimalisme',text:'Gyldent treverk, myke former og færre elementer.',color:'#d7bc98',cls:'warm-minimal'},{name:'Lyst og tidløst',text:'Lyse flater, dempede gråtoner og rene linjer.',color:'#e3e4df',cls:'timeless'}].map(x=>`<button class="inspiration-card" data-inspo="${x.color}"><span class="inspiration-visual ${x.cls}"><i></i><i></i><i></i></span><h3>${x.name}</h3><p>${x.text}</p><strong>Prøv i valgt rom ${icon('arrow-right')}</strong></button>`).join('')}</div>`, '',true);document.querySelectorAll('[data-inspo]').forEach(b=>b.onclick=()=>{editor.updateRoom(selectedId,{color:b.dataset.inspo});closeDialog();toast('Materialet er lagt til i det valgte rommet.');});}
function openShortcuts(){openDialog('Litt raskere fra tanke til tegning','Hurtigtaster i designstudioet.',`<div class="shortcut-grid">${[['Velg og flytt','V'],['Tegn rom','R'],['Tegn skillevegger','W'],['Plasser dør','D'],['Plasser vindu','F'],['Panorer','H'],['Zoom','Rullehjul'],['Roter eller snu valgt','Q / E'],['Dupliser valgt','Ctrl + D'],['Flytt valgt','Piltaster (Shift for større steg)'],['Angre','Ctrl + Z'],['Gjør om','Ctrl + Shift + Z'],['Fjern valgt element','Delete'],['Tilbake til velg','Esc']].map(([n,k])=>`<span>${n}</span><kbd>${k}</kbd>`).join('')}</div>`);}
$('#help-btn').onclick=openHelp;$('#projects-nav').onclick=$('#breadcrumb-home').onclick=openProjects;$('#profile-btn').onclick=openStorage;$('#inspiration-nav').onclick=openInspiration;$('#export-btn').onclick=openExport;$('#check-btn').onclick=$('#summary-check').onclick=()=>workflow(4);$('#new-suggestion').onclick=()=>workflow(2);$('#shortcuts-btn').onclick=openShortcuts;
$('#floor-info').onclick=()=>toast('Eksempelprosjektet inneholder én etasje. Alle rom vises i denne planen.');
$('#insight-btn').onclick=()=>{openDialog('Mer plass til å være sammen','Et åpent rom trenger også gode soner.',`<div class="help-steps"><article class="help-step"><span class="room-icon">${icon('sofa')}</span><div><h3>La møblene skape soner</h3><p>Bruk sofa, spisebord og belysning til å definere ulike områder uten å lukke rommet.</p></div></article><article class="help-step"><span class="room-icon">${icon('wall')}</span><div><h3>Avklar veggen før du åpner opp</h3><p>En tegning eller et bilde kan ikke fastslå om veggen er bærende. Få konstruksjonen vurdert av fagfolk før riving.</p><a class="text-link" href="https://www.dibk.no/bygge-eller-endre/arbeid-pa-eksisterende-bygg/innvendig-ombygging" target="_blank" rel="noopener noreferrer">Les DiBKs veiledning ↗</a></div></article></div>`);};
// Editor shortcuts never fire while a form control has focus; Delete/arrows also leave focused buttons and links alone.
document.addEventListener('keydown',e=>{
  if(transitioning||dialog.open||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
  const onControl=!!e.target.closest?.('button,a,summary,[role="button"],[tabindex]:not(body)');const key=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();e.shiftKey?editor.redo():editor.undo();return;}
  if((e.ctrlKey||e.metaKey)&&key==='d'){if(editor.selectedItemState()){e.preventDefault();if(editor.duplicateSelected())toast('Elementet er duplisert.');}return;}
  if(e.ctrlKey||e.metaKey)return;
  if(key.startsWith('arrow')){if(onControl)return;const step=e.shiftKey?25:5,delta={arrowleft:[-step,0],arrowright:[step,0],arrowup:[0,-step],arrowdown:[0,step]}[key];if(delta&&editor.nudgeSelected(...delta))e.preventDefault();return;}
  if(e.repeat)return;
  const shortcuts={r:'room',v:'select',w:'wall',d:'door',f:'window',h:'pan'};
  if(shortcuts[key]){e.preventDefault();setTool(shortcuts[key]);return;}
  if(key==='q'||key==='e'){if(editor.rotateSelected(key==='q'?-90:90))e.preventDefault();return;}
  if(key==='escape'){setTool('select');editor.clearItemSelection();return;}
  if((key==='delete'||key==='backspace')&&!onControl){e.preventDefault();editor.removeSelected();}
});
// A file dropped outside the drop zone must not navigate away from the studio.
for(const type of ['dragover','drop'])window.addEventListener(type,e=>{if(e.dataTransfer?.types?.includes('Files')&&!e.target.closest?.('#dropzone'))e.preventDefault();});
function updateWorkflowProgress(){
  const done={1:uploads.length>0||!!editor?.getState().reference,2:!!project.wishes?.trim()};
  document.querySelectorAll('.workflow-step').forEach(step=>{const number=Number(step.dataset.step);if(number>2)return;step.classList.toggle('completed',done[number]);const badge=step.querySelector('.step-number');if(badge&&badge.dataset.done!==String(done[number])){badge.dataset.done=String(done[number]);badge.innerHTML=done[number]?icon('check'):String(number);}});
}
window.addEventListener('beforeunload',event=>{if(sync.dirty||sync.saving||filesBusy||transitioning){event.preventDefault();event.returnValue='';}});
$('#save-status').onclick=()=>{if(sync.error)showSaveProblem();};
$('#save-status').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&sync.error){e.preventDefault();showSaveProblem();}};
$('#retry-save-btn').onclick=async()=>{if(isRevisionConflict(sync.error)||sync.error?.status===401){showSaveProblem();return;}try{await sync.flush();toast('Endringene er lagret.');}catch(error){showSaveProblem(error);}};
$('#save-copy-btn').onclick=()=>showSaveProblem();
$('#backup-unsaved-btn').onclick=downloadProjectBackup;
window.addEventListener('online',()=>{if(sync.dirty&&!isRevisionConflict(sync.error))sync.flush().catch(()=>{});});
window.romly={editor,getProject:()=>({...project}),getUploads:()=>uploads.length,getSession:()=>session,getActiveRecord:()=>activeRecord,getSync:()=>({dirty:sync.dirty,state:lastSaveStatus.state,revision:sync.record?.revision,transitioning,filesBusy}),flush:()=>sync.flush()};
initializeStorage();
