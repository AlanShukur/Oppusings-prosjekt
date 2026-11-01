import { PlanEditor } from './plan.js';
import { api, ProjectSync } from './cloud.js';

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
document:'<path d="M5 2h14v20H5zM8 7h8m-8 5h8m-8 5h5"/>'
};
const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.home}</svg>`;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
icons();
const $=(s)=>document.querySelector(s);
const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n)=>Number(n).toLocaleString('nb-NO',{maximumFractionDigits:1});
const clone=data=>JSON.parse(JSON.stringify(data));
let session={user:null,signInUrl:'/signin-with-chatgpt?return_to=%2F',signOutUrl:'/signout-with-chatgpt?return_to=%2F'};
let activeRecord=null, projectList=[], loadingProject=false, transitioning=false, filesBusy=0, fileMutation=0, sessionReady=false, lastSaveStatus={state:'loading',message:'Kobler til kontoen …'}, projectDialogGeneration=0;
const sync=new ProjectSync(renderSaveStatus);
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
function persist(){if(!loadingProject&&editor)sync.mark({project:clone(project),plan:editor.getState()});}
function roomIcon(r){return r?.id?.startsWith('bed')||r?.type==='bedroom'?'bed':r?.id==='bath'||r?.type==='bath'?'bath':r?.id==='hall'?'hall':'sofa';}
function rooms(){return editor?.getState().rooms||[];}
function renderRooms(){const list=rooms();$('#room-list').innerHTML=list.map(r=>`<button class="room-row ${r.id===selectedId?'active':''}" data-room="${esc(r.id)}"><span class="room-icon">${icon(roomIcon(r))}</span><span class="room-details"><strong>${esc(r.name)}</strong><small>${r.id==='living'?'Et sted å samles':r.id.startsWith('bed')?'Ro og hvile':r.id==='bath'?'En god start på dagen':'Velkommen hjem'}</small></span><span class="room-size">${fmt(r.area??r.width*r.height)}<small> m²</small></span></button>`).join('');$('#total-area').innerHTML=`${fmt(list.reduce((a,r)=>a+(r.area??r.width*r.height),0))} <small>m²</small>`;$('#bedroom-count').textContent=list.filter(r=>r.type==='bedroom'||r.id.startsWith('bed')||/soverom/i.test(r.name)).length;$('#bath-count').textContent=list.filter(r=>r.type==='bath'||r.id==='bath'||/^bad/i.test(r.name)).length;}
function selectRoom(r){if(!r)return;selectedId=r.id;$('#selected-room-title').textContent=r.name;$('#room-name').value=r.name;$('#room-width').value=Number(r.width).toFixed(1);$('#room-height').value=Number(r.height).toFixed(1);$('#room-area').textContent=fmt(r.area??r.width*r.height)+' m²';$('#selected-room-icon').innerHTML=icon(roomIcon(r));document.querySelectorAll('.material').forEach(b=>b.classList.toggle('active',b.dataset.material===r.color));renderRooms();}
editor=new PlanEditor($('#floorplan'),{onSelect:selectRoom,onChange:()=>{renderRooms();const r=rooms().find(x=>x.id===selectedId);if(r)selectRoom(r);persist();}});
const initialPlan=editor.getState();
function renderProject(){$('#project-title').textContent=project.name;$('#breadcrumb-title').textContent=project.name;$('#variant-name').textContent=project.variant;$('.prototype-label').textContent=activeRecord?'Tidlig produktversjon · Ditt prosjekt':'Eksempelvisning · Ikke lagret';}
renderProject();renderRooms();selectRoom(rooms().find(r=>r.id===selectedId)||rooms()[0]);
renderSaveStatus(lastSaveStatus);

$('#room-list').addEventListener('click',e=>{const row=e.target.closest('[data-room]');if(row){editor.selectRoom(row.dataset.room);if(compactWorkspace.matches){setWorkspacePanel('properties');$('[data-workspace-panel="properties"]').focus({preventScroll:true});}}});
$('#room-name').addEventListener('change',e=>{const value=e.target.value.trim();if(value)editor.updateRoom(selectedId,{name:value});else e.target.value=rooms().find(r=>r.id===selectedId)?.name||'';});
for(const [id,key] of [['room-width','width'],['room-height','height']]){$('#'+id).addEventListener('change',e=>{const value=Number(e.target.value);if(!Number.isFinite(value)||value<1||value>12){toast('Bruk et mål mellom 1 og 12 meter.');selectRoom(rooms().find(r=>r.id===selectedId));return;}editor.updateRoom(selectedId,{[key]:value});});}
$('#rename-room').onclick=()=>{$('#room-name').focus();$('#room-name').select();};
document.querySelectorAll('[data-material]').forEach(b=>b.onclick=()=>editor.updateRoom(selectedId,{color:b.dataset.material}));
function setTool(tool){activeTool=tool;editor.setTool(tool);document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('#canvas-hint').innerHTML=icon(tool==='select'?'cursor':tool)+({select:'Klikk på et rom for å tilpasse',wall:'Klikk to steder for å tegne en skillevegg',door:'Klikk på en vegg for å plassere en dør',window:'Klikk på en yttervegg for å plassere et vindu'}[tool]||'Klikk i plantegningen');}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{setTool(b.dataset.tool);if(compactWorkspace.matches)setWorkspacePanel('canvas');});
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{editor.addItem(b.dataset.add);if(compactWorkspace.matches)setWorkspacePanel('canvas');toast('Møbelet er lagt til. Dra det til ønsket plass.');});
document.querySelectorAll('[data-tool-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tool-tab]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',x===b);});$('#build-tools').classList.toggle('hidden',b.dataset.toolTab!=='build');$('#interior-tools').classList.toggle('hidden',b.dataset.toolTab!=='interior');setTool('select');});
$('#add-window').onclick=()=>{setTool('window');if(compactWorkspace.matches)setWorkspacePanel('canvas');toast('Klikk på en yttervegg for å plassere vinduet.');};$('#add-door').onclick=()=>{setTool('door');if(compactWorkspace.matches)setWorkspacePanel('canvas');toast('Klikk på en vegg for å plassere døren.');};
$('#add-room-btn').onclick=()=>openAddRoom();
$('#delete-selection').onclick=()=>{if(!editor.removeSelected())toast('Velg en dør, et vindu eller et møbel du har lagt til først.');renderRooms();};
$('#undo-btn').onclick=()=>editor.undo();$('#redo-btn').onclick=()=>editor.redo();
function setZoom(value){zoom=Math.max(50,Math.min(180,value));editor.setZoom(zoom);$('#zoom-value').textContent=zoom+' %';}
$('#zoom-out').onclick=()=>setZoom(zoom-10);$('#zoom-in').onclick=()=>setZoom(zoom+10);$('#zoom-fit').onclick=$('#zoom-value').onclick=()=>{setZoom(100);editor.resetView();setView(currentView);};
function setView(view){currentView=view;editor.setView(view);$('#view-2d').classList.toggle('active',view==='2d');$('#view-3d').classList.toggle('active',view==='3d');$('#view-2d').setAttribute('aria-pressed',view==='2d');$('#view-3d').setAttribute('aria-pressed',view==='3d');if(view==='3d')toast('Romlig skisse. Bytt til 2D for nøyaktig redigering.');}
$('#view-2d').onclick=()=>setView('2d');$('#view-3d').onclick=()=>setView('3d');
for(const [id,key] of [['show-dimensions','dimensions'],['show-furniture','furniture']])$('#'+id).onchange=e=>editor.setLayers({[key]:e.target.checked});
$('#layer-heading').onclick=()=>{const expanded=$('#layer-heading').getAttribute('aria-expanded')==='true';$('#layer-heading').setAttribute('aria-expanded',!expanded);$('#layer-controls').classList.toggle('hidden',expanded);};

const dialog=$('#app-dialog');let lastFocus;
function openDialog(title,subtitle,body,footer='',wide=false){lastFocus=document.activeElement;$('#dialog-content').innerHTML=`<div class="dialog-header"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="icon-button dialog-close" aria-label="Lukk">${icon('close')}</button></div><div class="dialog-body">${body}</div>${footer?`<div class="dialog-footer">${footer}</div>`:''}`;dialog.classList.toggle('wide-dialog',wide);icons(dialog);if(!dialog.open)dialog.showModal();dialog.querySelector('.dialog-close').onclick=closeDialog;}
function closeDialog(options={}){if(transitioning&&options?.force!==true)return;dialog.close();lastFocus?.focus();document.querySelectorAll('.workflow-step').forEach(b=>{b.classList.toggle('active',b.dataset.step==='3');if(b.dataset.step==='3')b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});}
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
function workflow(step){document.querySelectorAll('.workflow-step').forEach(b=>{b.classList.toggle('active',b.dataset.step===String(step));if(b.dataset.step===String(step))b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});if(step===1)openGround();if(step===2)openSuggestions();if(step===3)closeDialog();if(step===4)openCheck();}
document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>workflow(Number(b.dataset.step)));

function uploadList(){
  if(!uploads.length)return'<p class="empty-upload">Ingen filer lagt til. Last opp bilder eller plantegninger til prosjektet.</p>';
  return uploads.map(file=>{
    const ready=!file.status||file.status==='ready';
    const pending=file.status==='pending';
    const canDelete=file.canDelete!==false;
    const message=ready?`${fmt(file.size/1024)} kB · Lagret på kontoen`:pending?(canDelete?'Opplastingen ble avbrutt. Fjern filen og prøv igjen.':'Opplasting pågår. Åpne grunnlaget igjen for oppdatert status.'):'Slettingen ble avbrutt. Prøv å fjerne filen igjen.';
    return`<div class="upload-item">${ready&&file.mimeType?.startsWith('image/')?`<img class="upload-thumb" src="${esc(file.url)}" alt="Forhåndsvisning av ${esc(file.name)}">`:`<span class="upload-thumb">${icon('file')}</span>`}<div><strong>${esc(file.name)}</strong><small>${message}</small>${ready?`<a class="text-link" href="${esc(file.url)}" target="_blank" rel="noopener noreferrer">Åpne fil ↗</a>`:''}</div><button class="icon-button" data-remove-file="${esc(file.id)}" aria-label="${ready?'Fjern':'Prøv å fjerne'} ${esc(file.name)}" ${canDelete?'':'disabled'}>${icon('close')}</button></div>`;
  }).join('');
}
function refreshUploadList(){if($('#upload-list'))$('#upload-list').innerHTML=uploadList();if($('#file-upload-progress'))$('#file-upload-progress').textContent=filesBusy?'Laster opp fil. Vent til opplastingen er bekreftet …':'';}
function bindUploads(){
  const zone=$('#dropzone');zone.onclick=()=>$('#file-input').click();
  zone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file-input').click();}};
  zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-over');};zone.ondragleave=()=>zone.classList.remove('drag-over');
  zone.ondrop=e=>{e.preventDefault();zone.classList.remove('drag-over');acceptFiles(e.dataTransfer.files);};
  $('#upload-list').onclick=async e=>{const button=e.target.closest('[data-remove-file]');if(!button||button.disabled||!activeRecord||filesBusy||transitioning)return;const id=activeRecord.id;button.disabled=true;fileMutation++;filesBusy++;try{await api.removeFile(id,button.dataset.removeFile);if(activeRecord?.id===id){uploads=uploads.filter(file=>file.id!==button.dataset.removeFile);refreshUploadList();toast('Filen er slettet fra prosjektet.');}}catch(error){button.disabled=false;toast(error.message);}finally{filesBusy--;refreshUploadList();}};
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
  if(added)toast(`${added===1?'Filen er':added+' filer er'} lastet opp og lagret på kontoen.`);
}
$('#file-input').onchange=e=>{acceptFiles(e.target.files);e.target.value='';};
function openGround(){
  if(!activeRecord){openProjects();return;}
  openDialog('La oss bli kjent med hjemmet ditt','Prosjektdetaljer og filer følger kontoen din.',`<div class="form-grid"><label class="field">Prosjektnavn<input id="project-name-field" class="input" maxlength="70" value="${esc(project.name)}"></label><label class="field">Kommune<input id="municipality-field" class="input" maxlength="70" value="${esc(project.municipality)}" placeholder="Skriv kommunen din"></label></div><div id="dropzone" class="dropzone" role="button" tabindex="0">${icon('upload')}<strong>Dra inn plantegning eller bilder</strong><span>eller <u>velg filer fra enheten</u></span><small>JPG, PNG, WebP eller PDF · Maks. 20 MB per fil · 12 filer per prosjekt</small></div><div id="file-upload-progress" class="file-upload-progress" role="status"></div><div id="upload-list" class="upload-list">${uploadList()}</div><div class="info-banner">${icon('info')}<p>Filene lagres privat på kontoen din og kan åpnes på andre enheter. AI-tolkning av opplastede tegninger er ikke tilkoblet ennå. Tegningen i studioet er foreløpig en redigerbar eksempelplan.</p></div>`,`<button class="button secondary" id="ground-cancel">Tilbake til studio</button><button class="button primary" id="ground-next">Videre til dine ønsker ${icon('arrow-right')}</button>`);
  bindUploads();refreshUploadList();
  const currentId=activeRecord.id;const currentFileMutation=fileMutation;
  api.files(currentId).then(result=>{if(activeRecord?.id===currentId&&!filesBusy&&fileMutation===currentFileMutation){uploads=result.files||[];refreshUploadList();}}).catch(error=>toast(error.message));
  $('#project-name-field').oninput=e=>{project.name=e.target.value.trim()||'Mitt oppussingsprosjekt';renderProject();persist();};
  $('#municipality-field').oninput=e=>{project.municipality=e.target.value.trim();persist();};
  $('#ground-cancel').onclick=closeDialog;
  $('#ground-next').onclick=async()=>{if(filesBusy){toast('Vent til opplastingen er ferdig.');return;}try{await sync.flush();workflow(2);}catch(error){showSaveProblem(error);}};
}
function miniPlan(variant){return `<svg class="mini-plan" viewBox="0 0 240 140" fill="none" aria-hidden="true"><rect x="30" y="17" width="180" height="108" fill="#ece5d8" stroke="#5e6260" stroke-width="3"/><path d="M143 17v108M143 70h67" stroke="#5e6260" stroke-width="3"/><path d="M144 18h65v51h-65z" fill="#dce3d9"/><path d="M144 72h65v52h-65z" fill="#dce3d9"/><path d="M31 94h112v30H31z" fill="#e7e8e1"/>${variant==='03'?'<path d="M87 18v76" stroke="#5e6260" stroke-width="3"/><path d="M88 19h53v74H88z" fill="#dce3d9"/>':''}<path d="M31 94h112" stroke="#5e6260" stroke-width="2"/><rect x="40" y="32" width="15" height="43" rx="3" fill="#d1c2aa"/><rect x="58" y="43" width="34" height="22" rx="8" stroke="#a69983"/><rect x="155" y="27" width="30" height="31" rx="2" fill="#f6f4ee" stroke="#b6bcb0"/><rect x="155" y="81" width="30" height="31" rx="2" fill="#f6f4ee" stroke="#b6bcb0"/><path d="M54 17h33m83 0h20M210 40v17" stroke="#9eb8be" stroke-width="4"/></svg>`;}
function openSuggestions(){const variants=[{id:'01',name:'Plass til hverdagen',tag:'ANBEFALT',text:'Åpen stue og to gode soverom. En balansert løsning med rom for samvær.',beds:2},{id:'02',name:'Mer plass til ro',tag:'ALTERNATIV',text:'Et større hovedsoverom og et kompakt ekstrarom til gjester eller hjemmekontor.',beds:2},{id:'03',name:'Et rom til',tag:'FAMILIE',text:'Tre soverom og en mer kompakt sosial sone. Krever nærmere faglig vurdering.',beds:3}];openDialog('Hvordan vil du bo?','Fortell om behovene dine, og utforsk mulighetene.',`<div class="needs-grid"><div class="need-control"><span>${icon('bed')} Soverom</span><div class="counter"><button data-count="bedrooms" data-delta="-1" aria-label="Færre soverom">−</button><strong id="desired-bedrooms">${project.bedrooms}</strong><button data-count="bedrooms" data-delta="1" aria-label="Flere soverom">+</button></div></div><div class="need-control"><span>${icon('bath')} Bad</span><div class="counter"><button data-count="bathrooms" data-delta="-1" aria-label="Færre bad">−</button><strong id="desired-bathrooms">${project.bathrooms}</strong><button data-count="bathrooms" data-delta="1" aria-label="Flere bad">+</button></div></div></div><label class="field">Hva er viktig for deg?<textarea id="wishes-field" class="input" rows="3" placeholder="For eksempel et ekstra soverom, mer lys eller et større bad …">${esc(project.wishes)}</textarea></label><div class="suggestion-section-heading"><h3>Tre måter å se hjemmet på</h3><span class="status-pill">Eksempelforslag</span></div><div class="suggestion-grid">${variants.map(v=>`<button class="suggestion-card ${project.variant===v.id?'selected':''}" data-variant="${v.id}"><span class="recommend-badge">${v.tag}</span>${miniPlan(v.id)}<div class="suggestion-info"><h3>${v.name}</h3><span>${v.beds} soverom · 1 bad</span><p>${v.text}</p><strong>${project.variant===v.id?'Valgt planløsning':'Utforsk denne løsningen'} ${icon(project.variant===v.id?'check':'arrow-right')}</strong></div></button>`).join('')}</div><div class="info-banner">${icon('info')}<p>Dette er redigerbare eksempelplaner, ikke AI-analyse av opplastede filer. Ønskene lagres i prosjektbriefen. Nye bad og konstruktive endringer må prosjekteres faglig.</p></div>`,`<button class="button secondary" id="suggest-back">${icon('arrow-right')} Grunnlag</button><button class="button primary" id="use-suggestion">Åpne i designstudio ${icon('arrow-right')}</button>`,true);
$('#wishes-field').maxLength=4000;$('#wishes-field').oninput=e=>{project.wishes=e.target.value;persist();};
document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{const key=b.dataset.count;project[key]=Math.max(1,Math.min(key==='bedrooms'?5:3,project[key]+Number(b.dataset.delta)));$('#desired-'+key).textContent=project[key];persist();});
let choice=project.variant;document.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>{choice=b.dataset.variant;document.querySelectorAll('[data-variant]').forEach(c=>{c.classList.toggle('selected',c===b);c.querySelector('.suggestion-info strong').innerHTML=(c===b?'Valgt planløsning':'Utforsk denne løsningen')+icon(c===b?'check':'arrow-right');});});
$('#suggest-back').onclick=()=>{project.wishes=$('#wishes-field').value;workflow(1);};$('#use-suggestion').onclick=()=>{project.wishes=$('#wishes-field').value;if(choice!==project.variant){project.variant=choice;editor.setVariant(choice);}renderProject();persist();closeDialog();toast('Planløsningen er åpen. Gjør den til din.');};}
const checks=[
{title:'Bæring og riving',status:'Krever faglig vurdering',text:'Veggens funksjon må avklares før riving. Inngrep i bærevegg eller bæresøyle krever søknad og tillatelse.',url:'https://www.dibk.no/bygge-eller-endre/arbeid-pa-eksisterende-bygg/innvendig-ombygging',source:'DiBK · Innvendig ombygging'},
{title:'Dagslys i oppholdsrom',status:'Mangler dokumentasjon',text:'Vindusstørrelse, plassering og utvendig skjerming må dokumenteres. En plantegning alene er ikke tilstrekkelig.',url:'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/13/v/13-7',source:'TEK17 § 13-7 · Lys'},
{title:'Rømning og brannsikkerhet',status:'Må avklares',text:'Planen må bevare sikker rømning og brannskiller. Rømningsløsningen må vurderes for boligen og bygningen som helhet.',url:'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/iv/11-13',source:'TEK17 § 11-13 · Utgang fra branncelle'},
{title:'Bad, fukt og ventilasjon',status:'Krever dokumentasjon',text:'Sluk, fall, tettesjikt og ventilasjon må prosjekteres. Arbeid som berører flere bruksenheter eller brannceller kan utløse søknadsplikt.',url:'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/13/vi/13-15',source:'TEK17 § 13-15 · Våtrom'},
{title:'Godkjent bruk av rommene',status:'Må sammenlignes',text:'Sammenlign med kommunens godkjente tegninger. Å gjøre en bod om til soverom er en søknadspliktig bruksendring.',url:'https://www.dibk.no/bygge-eller-endre/hva-er-en-bruksendring',source:'DiBK · Bruksendring'},
{title:'Kommunale planer og vedlegg',status:'Ikke ferdig dokumentert',text:'Samle eksisterende og nye måltegninger og tiltaksbeskrivelse. Avklar lokale planer, fasadeendringer og nødvendige vedlegg med kommunen.',url:'https://www.dibk.no/bygge-eller-endre/hva-er-en-bruksendring',source:'DiBK · Søknad og dokumentasjon'}
];
function openCheck(){openDialog('Et steg nærmere realisering','En foreløpig gjennomgang av det du bør avklare.',`<div class="check-overview"><span class="check-overview-icon">${icon('shield')}</span><div><span class="status-pill warning-pill">FORELØPIG GJENNOMGANG</span><h3>6 forhold må avklares</h3><p>Planen er et godt utgangspunkt for en samtale med fagfolk.</p></div></div><div class="check-metrics"><span><strong>${rooms().length}</strong> tegnede rom</span><span><strong>${esc(project.municipality||'Ikke valgt')}</strong> kommune</span><span><strong>6</strong> åpne kontrollpunkter</span></div><div class="check-list">${checks.map((c,i)=>`<article class="check-item"><span class="check-icon">${icon(i===0?'wall':i===1?'window':i===2?'shield':i===3?'bath':'document')}</span><div><div class="check-item-heading"><h3>${c.title}</h3><span class="check-status">${c.status}</span></div><p>${c.text}</p><a class="check-link" href="${c.url}" target="_blank" rel="noopener noreferrer">${c.source} ↗</a></div></article>`).join('')}</div><div class="notice">${icon('info')}<p>Dette er en veiledende sjekkliste, ikke en teknisk kontroll eller kommunal godkjenning. Relevant regelverk avhenger av tiltaket og bygningen. Bæring og søknadsplikt må bekreftes med dokumentasjon og fagkompetanse. Ingen søknad sendes fra prototypen.</p></div>`,`<button class="button secondary" id="check-back">Tilbake til tegningen</button><button class="button primary" id="download-review">${icon('download')} Last ned prosjektbrief</button>`,true);$('#check-back').onclick=closeDialog;$('#download-review').onclick=downloadReport;}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function downloadReport(){const state=editor.getState();const text=`ROMLY – PROSJEKTBRIEF\n${project.name}\nKommune: ${project.municipality||'Ikke oppgitt'}\nDato: ${new Date().toLocaleDateString('nb-NO')}\n\nINTERAKTIV PROTOTYPE / EKSEMPELPLAN\nIkke AI-analyse, teknisk godkjenning eller ferdig byggesøknad.\n\nDINE ØNSKER\n${project.bedrooms} soverom, ${project.bathrooms} bad\n${project.wishes}\n\nTEGNEDE ROM\n${state.rooms.map(r=>`${r.name}: ${fmt(r.width)} × ${fmt(r.height)} m (${fmt(r.area??r.width*r.height)} m²)`).join('\n')}\n\nFORHOLD SOM MÅ AVKLARES\n${checks.map((c,i)=>`${i+1}. ${c.title} – ${c.status}\n${c.text}\nKilde: ${c.url}`).join('\n\n')}\n\nMålene er skisseverdier og må kontrolleres mot oppmåling. Regelverket må vurderes for det konkrete tiltaket. Kommunale planer er ikke kontrollert.\n`;download('romly-prosjektbrief.txt',text,'text/plain;charset=utf-8');toast('Prosjektbriefen er lastet ned.');}
function openExport(){
  openDialog('Ta med deg planene videre','Eksporter skissen eller ta inn et tidligere prosjekt.',`<div class="export-options"><button class="export-option" id="export-svg">${icon('image')}<div><strong>Plantegning som SVG</strong><span>Skarp vektortegning av løsningen din</span></div>${icon('download')}</button><button class="export-option" id="export-brief">${icon('document')}<div><strong>Prosjektbrief og sjekkliste</strong><span>Ønsker, rommål og punkter for faglig gjennomgang</span></div>${icon('download')}</button><button class="export-option" id="export-json">${icon('file')}<div><strong>Lagre redigerbart prosjekt</strong><span>JSON-kopi av den synlige tegningen og ønskene</span></div>${icon('download')}</button><button class="export-option" id="import-json">${icon('upload')}<div><strong>Importer prosjektfil</strong><span>Opprett et nytt prosjekt fra en eksportert JSON-fil</span></div>${icon('arrow-right')}</button></div><div class="info-banner">${icon('info')}<p>Eksporten er et skissegrunnlag. Opplastede bilder og PDF-er er ikke inkludert i JSON-filen. Mål og tekniske forhold må kontrolleres før utførelse eller innsending.</p></div>`);
  $('#export-svg').onclick=()=>{download('romly-plantegning.svg',editor.exportSVG(),'image/svg+xml');toast('Plantegningen er lastet ned.');};
  $('#export-brief').onclick=downloadReport;$('#export-json').onclick=downloadProjectBackup;
  $('#import-json').onclick=()=>{
    if(!session.user){openAccount();return;}
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.onchange=async()=>{if(!input.files[0])return;try{if(input.files[0].size>256*1024)throw new Error('Prosjektfilen er for stor. Maks. 256 kB.');const data=validateProjectImport(JSON.parse(await input.files[0].text()));if(!await ensureCanLeave())return;openImportProject(data);}catch(error){toast(error.message||'Filen er ikke et gyldig Romly-prosjekt.');}};
    input.click();
  };
}
function openImportProject(data){
  openDialog('Importer prosjektet til kontoen','Tegningen opprettes som et nytt prosjekt.',`<label class="field">Prosjektnavn<input class="input" id="import-project-name" maxlength="70" value="${esc(data.project.name)}"></label><div class="info-banner">${icon('info')}<p>Eksisterende prosjekter beholdes. Prosjektfilen inneholder tegning og ønsker; eventuelle bilder og PDF-er må lastes opp separat.</p></div><p class="project-message error" id="import-project-error" hidden></p>`,`<button class="button secondary" id="import-project-cancel">Avbryt</button><button class="button primary" id="import-project-submit">${icon('upload')} Importer til kontoen</button>`);
  $('#import-project-cancel').onclick=closeDialog;
  $('#import-project-submit').onclick=async e=>{const button=e.currentTarget;const name=$('#import-project-name').value.trim();if(!name){$('#import-project-name').focus();return;}button.disabled=true;try{await createCloudProject({...data.project,name},data.plan);toast('Prosjektfilen er importert og lagret på kontoen.');}catch(error){button.disabled=false;if($('#import-project-error')){$('#import-project-error').hidden=false;$('#import-project-error').textContent=error.message;}}};
}
function openAddRoom(){openDialog('Gi plass til et nytt rom','Legg til et rom i skissen. Plassering og tilkomst må vurderes.',`<label class="field">Romnavn<input class="input" id="new-room-name" value="Nytt soverom" maxlength="40"></label><div class="info-banner">${icon('info')}<p>Det nye rommet opprettes som en skissesone. Juster størrelse og kontroller at det passer i planløsningen.</p></div>`,`<button class="button secondary" id="cancel-room">Avbryt</button><button class="button primary" id="confirm-room">${icon('plus')} Legg til rom</button>`);$('#cancel-room').onclick=closeDialog;$('#confirm-room').onclick=()=>{const name=$('#new-room-name').value.trim()||'Nytt rom';editor.addItem('room');const last=rooms().at(-1);if(last){editor.updateRoom(last.id,{name});editor.selectRoom(last.id);}closeDialog();toast('Rommet er lagt til som en skissesone.');};}
function openHelp(){openDialog('Fra første tanke til ny plan','Slik utforsker du hjemmets muligheter i Romly.',`<div class="help-steps">${[['1','Start med grunnlaget','Legg til bilder og plantegninger, og gi prosjektet et navn. Bilder og plantegninger lagres privat på kontoen.'],['2','Utforsk planforslag','Beskriv behovene dine og velg en av tre redigerbare eksempelplaner.'],['3','Gjør planen til din','Velg rom, endre mål og materialer, og plasser dører, vinduer og møbler. Dra i rommets hjørne for å endre størrelse.'],['4','Forbered neste steg','Bruk sjekklisten og eksporter en prosjektbrief til dialog med fagfolk.']].map(([n,t,p])=>`<article class="help-step"><span class="step-number">${n}</span><div><h3>${t}</h3><p>${p}</p></div></article>`).join('')}</div><div class="notice">${icon('info')}<p>Prosjekter og opplastede filer lagres på kontoen når du er innlogget. AI-analyse, en målfast byggmodell og kommunale oppslag er ikke tilkoblet ennå. Eksempelvisningen lagres ikke automatisk.</p></div>`);}
function initials(name){return String(name||'').split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase()||'R';}
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
function rememberProject(id){try{if(preferenceKey()){if(id)localStorage.setItem(preferenceKey(),id);else localStorage.removeItem(preferenceKey());}}catch{}}
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
async function applyCloudRecord(record,{checkRecovery=true}={}){
  if(record.status==='deleting'){openDeleteProject(record);return;}
  const result=await api.files(record.id);
  loadingProject=true;
  try{
    activeRecord=record;project=clone(record.project);uploads=result.files||[];
    sync.activate(record);selectedId=record.plan.rooms[0]?.id||'living';editor.loadState(record.plan);
    setTool('select');zoom=100;editor.setZoom(100);$('#zoom-value').textContent='100 %';setView('2d');
    renderProject();renderRooms();selectRoom(rooms().find(room=>room.id===selectedId)||rooms()[0]);rememberProject(record.id);
  }finally{loadingProject=false;}
  closeDialog({force:true});
  if(checkRecovery){const recovery=sync.recovery();if(recovery?.data)openRecovery(recovery);}
}
async function openCloudProject(id){
  return withProjectTransition(async()=>{const result=await api.get(id);await applyCloudRecord(result.project);});
}
async function createCloudProject(data,plan,{flush=true}={}){
  if(!session.user){openAccount();return;}
  return withProjectTransition(async()=>{
    const result=await api.create({project:clone(data),plan:clone(plan)});
    await applyCloudRecord(result.project,{checkRecovery:false});
    return result.project;
  },{flush});
}
function openRecovery(recovery){
  openDialog('Endringer venter på denne enheten','Et tidligere lagringsforsøk ble ikke bekreftet.',`<p class="account-note">Det finnes en lokal gjenopprettingskopi for dette prosjektet. Kontoversjonen er åpnet i studioet. Du kan hente tilbake de lokale endringene eller beholde kontoversjonen.</p><div class="info-banner">${icon('info')}<p>${recovery.revision===sync.record.revision?'Kontoversjonen har samme revisjon som sist du redigerte.':'Prosjektet på kontoen er endret i mellomtiden. Lagre de lokale endringene som et nytt prosjekt for å beholde begge versjonene.'}</p></div>`,`<button class="button secondary" id="discard-recovery">Behold kontoversjonen</button><button class="button primary" id="restore-recovery">${recovery.revision===sync.record.revision?'Hent tilbake endringer':'Lagre endringer som nytt prosjekt'}</button>`);
  $('#discard-recovery').onclick=()=>{sync.clearRecovery();closeDialog();};
  $('#restore-recovery').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{
    const data=validateProjectImport({format:'romly-v1',...recovery.data});
    if(recovery.revision!==sync.record.revision){const oldRecoveryKey=sync.recoveryKey;await createCloudProject({...data.project,name:(data.project.name+' – gjenopprettet').slice(0,70)},data.plan,{flush:false});removeRecoveryKey(oldRecoveryKey);toast('Gjenopprettingskopien er lagret som et nytt prosjekt.');return;}
    await withProjectTransition(async()=>{
      loadingProject=true;try{project=clone(data.project);editor.loadState(data.plan);renderProject();}finally{loadingProject=false;}
      persist();await sync.flush();closeDialog({force:true});
    },{flush:false});
    toast('Endringene er hentet tilbake og lagret på kontoen.');
  }catch(error){button.disabled=false;toast(error.message||'Gjenopprettingskopien kunne ikke åpnes.');}};
}
function showSaveProblem(error=sync.error){
  const conflict=error?.status===409;
  openDialog(conflict?'Prosjektet har en nyere kontoversjon':'Endringene er ikke lagret på kontoen',conflict?'Vi overskriver ikke endringer fra en annen økt.':'Behold en kopi mens du prøver å koble til igjen.',`<p class="account-note">${esc(error?.message||'Lagringen kunne ikke fullføres.')} De synlige endringene beholdes i studioet. ${storageAvailable?'En gjenopprettingskopi beholdes også på denne enheten.':'Lokal gjenoppretting er utilgjengelig. Last ned en kopi før du lukker siden.'}</p><div class="conflict-actions"><button class="button secondary" id="problem-download">${icon('download')} Last ned de synlige endringene</button><button class="button secondary" id="problem-copy">${icon('plus')} Lagre som nytt prosjekt</button>${conflict?`<button class="button secondary" id="problem-reload">${icon('cloud')} Forkast lokale endringer og hent kontoversjonen</button>`:''}</div>`,`<button class="button secondary" id="problem-stay">Fortsett her</button>${conflict?'':`<button class="button primary" id="problem-retry">Prøv lagringen igjen</button>`}`);
  $('#problem-download').onclick=downloadProjectBackup;
  $('#problem-stay').onclick=closeDialog;
  $('#problem-copy').onclick=async e=>{const button=e.currentTarget;button.disabled=true;const oldRecoveryKey=sync.recoveryKey;try{await createCloudProject({...project,name:(project.name+' – kopi').slice(0,70)},editor.getState(),{flush:false});removeRecoveryKey(oldRecoveryKey);toast('Endringene er lagret som et nytt prosjekt.');}catch(copyError){button.disabled=false;toast(copyError.message);}};
  if($('#problem-retry'))$('#problem-retry').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{await sync.flush();closeDialog();toast('Endringene er lagret på kontoen.');}catch(retryError){button.disabled=false;if(retryError.status===409)showSaveProblem(retryError);else toast(retryError.message);}};
  if($('#problem-reload'))$('#problem-reload').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{await withProjectTransition(async()=>{const result=await api.get(activeRecord.id);await applyCloudRecord(result.project,{checkRecovery:false});sync.clearRecovery();},{flush:false});toast('Kontoversjonen er åpnet.');}catch(loadError){button.disabled=false;toast(loadError.message);}};
}
function openAccount(){
  if(!session.user){
    openDialog('Ta med deg prosjektet videre','Logg inn for å lagre prosjekter og filer.',`<div class="project-empty">${icon('home')}<h3>Ditt hjem. Dine prosjekter.</h3><p>Med en konto kan du lagre flere prosjekter og åpne tegninger og bilder på andre enheter. Eksempelvisningen kan utforskes uten å opprette et prosjekt.</p><a class="button primary" href="${esc(session.signInUrl)}" target="_top">Logg inn med ChatGPT ${icon('arrow-right')}</a></div>${!sessionReady?'<p class="project-message error">Kontotjenesten kunne ikke lastes. Prøv å koble til igjen.</p>':''}`,`<button class="button secondary" id="account-demo">Utforsk eksempelvisningen</button><button class="button secondary" id="account-retry">Koble til igjen</button>`);
    $('#account-demo').onclick=closeDialog;$('#account-retry').onclick=initializeCloud;return;
  }
  openDialog('Kontoen din','Prosjekter og filer er knyttet til innloggingen din.',`<div class="account-summary"><span>${esc(initials(session.user.name||session.user.email))}</span><div><h3>${esc(session.user.name||session.user.email)}</h3><p>${esc(session.user.email)}</p></div></div><p class="account-note">Bare kontoen din har tilgang til dine prosjekter i appen. Tilgangen til selve nettstedet følger eksisterende delingsinnstillinger.</p><div class="account-actions"><button class="button secondary" id="account-projects">${icon('home')} Mine prosjekter</button><a class="button secondary" id="account-signout" href="${esc(session.signOutUrl)}" target="_top">Logg ut</a></div>`, `<button class="button primary" id="account-close">Tilbake til studio</button>`);
  $('#account-close').onclick=closeDialog;$('#account-projects').onclick=openProjects;
  let signingOut=false;$('#account-signout').onclick=async e=>{if(signingOut)return;e.preventDefault();if(!await ensureCanLeave())return;signingOut=true;$('#account-signout')?.click();};
}
function openCreateProject(){
  if(!session.user){openAccount();return;}
  openDialog('Gi prosjektet ditt en start','Opprett et privat prosjekt på kontoen din.',`<label class="field">Prosjektnavn<input id="create-project-name" class="input" maxlength="70" placeholder="For eksempel Leiligheten vår" value="Mitt oppussingsprosjekt"></label><label class="field">Kommune<input id="create-project-municipality" class="input" maxlength="70" placeholder="Skriv kommunen din"></label><div class="project-create-template">${miniPlan('01')}<div><strong>Starter med en eksempelplan</strong><p>En redigerbar bolig på 89,4 m². Opplastede tegninger tolkes ikke automatisk ennå.</p></div></div><p class="project-form-note">Du kan lagre egne bilder, tegninger og ønsker i prosjektet. Eksempelplanen er et skissegrunnlag som kan tilpasses.</p><p id="create-project-error" class="project-message error" hidden></p>`,`<button class="button secondary" id="create-project-back">Tilbake</button><button class="button primary" id="create-project-submit">${icon('plus')} Opprett prosjekt</button>`);
  $('#create-project-back').onclick=openProjects;
  $('#create-project-submit').onclick=async e=>{const button=e.currentTarget;const name=$('#create-project-name').value.trim();if(!name){$('#create-project-name').focus();return;}const municipality=$('#create-project-municipality').value.trim();if(!await ensureCanLeave())return;button.disabled=true;
    try{await createCloudProject({name,municipality,bedrooms:2,bathrooms:1,wishes:'',variant:'01'},initialPlan);toast('Prosjektet er opprettet og lagret på kontoen.');openGround();}
    catch(error){button.disabled=false;if($('#create-project-error')){$('#create-project-error').hidden=false;$('#create-project-error').textContent=error.message;}else toast(error.message);}
  };
}
function projectListMarkup(){
  if(!projectList.length)return`<div class="project-empty">${icon('home')}<h3>Gi plass til ditt første prosjekt</h3><p>Samle plantegninger, bilder og ideer på ett sted. Prosjektene lagres på kontoen din og kan åpnes på andre enheter.</p><button class="button primary" id="first-project-btn">${icon('plus')} Opprett ditt første prosjekt</button></div>`;
  return projectList.map(record=>`<article class="cloud-project-row ${record.id===activeRecord?.id?'current':''}"><button class="cloud-project-open" data-open-project="${esc(record.id)}">${miniPlan(record.project.variant)}<div>${record.status==='deleting'?'<span class="status-pill">SLETTING MÅ FULLFØRES</span>':record.id===activeRecord?.id?'<span class="status-pill">ÅPENT PROSJEKT</span>':''}<h3>${esc(record.project.name)}</h3><p>${esc(record.project.municipality||'Kommune ikke valgt')} · ${record.roomCount} rom · ${fmt(record.area)} m² · ${record.fileCount} filer</p><small>Sist endret ${esc(new Date(record.updatedAt).toLocaleString('nb-NO',{dateStyle:'short',timeStyle:'short'}))}</small></div></button><button class="cloud-project-delete" data-delete-project="${esc(record.id)}" aria-label="Slett ${esc(record.project.name)}" title="Slett prosjekt">${icon('trash')}</button></article>`).join('');
}
async function openProjects(){
  if(!session.user){openAccount();return;}
  const generation=++projectDialogGeneration;
  openDialog('Mine prosjekter','Planer, bilder og muligheter – samlet på kontoen din.',`<div class="projects-heading"><p>Prosjektene er private for kontoen din.</p><button class="button primary" id="new-cloud-project">${icon('plus')} Nytt prosjekt</button></div><div id="cloud-projects-list" class="cloud-projects-list"><p class="cloud-loading">Henter prosjektene dine …</p></div>${legacyAvailable()?`<div class="project-migration"><div><strong>Du har et lokalt prosjekt fra prototypen</strong><p>Velg selv om tegningen og ønskene skal kopieres til kontoen. Den opprinnelige lokale kopien beholdes.</p></div><button class="button secondary" id="migrate-local-project">Flytt til kontoen ${icon('arrow-right')}</button></div>`:''}`,activeRecord?`<button class="button secondary" id="projects-return">Tilbake til studio</button><button class="button secondary" id="projects-details">${icon('edit')} Prosjektdetaljer</button>`:'',true);
  $('#new-cloud-project').onclick=openCreateProject;
  if($('#projects-return'))$('#projects-return').onclick=closeDialog;if($('#projects-details'))$('#projects-details').onclick=openGround;
  if($('#migrate-local-project'))$('#migrate-local-project').onclick=async e=>{const button=e.currentTarget;if(!await ensureCanLeave())return;button.disabled=true;try{const data=validateProjectImport({format:'romly-v1',...stored});await createCloudProject(data.project,data.plan);try{localStorage.setItem('romly-legacy-imported:'+session.user.id,'1');}catch{}toast('Det lokale prosjektet er kopiert til kontoen.');}catch(error){button.disabled=false;toast(error.message||'Det lokale prosjektet kunne ikke importeres.');}};
  try{
    const result=await api.list();if(generation!==projectDialogGeneration||!$('#cloud-projects-list'))return;
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
  openDialog('Slette prosjektet?',esc(record.project.name),`<p class="account-note">Prosjektet og alle tilhørende opplastede filer slettes fra kontoen. Dette kan ikke angres. ${record.status==='deleting'?'En tidligere sletting ble avbrutt. Prøv igjen for å fullføre.':''}</p><p id="delete-project-error" class="project-message error" hidden></p>`,`<button class="button secondary" id="delete-project-cancel">Behold prosjektet</button><button class="button danger" id="delete-project-confirm">${icon('trash')} Slett prosjekt og filer</button>`);
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
  if(value.format!=='romly-v1'||!Array.isArray(value.plan.rooms)||!value.plan.rooms.length||value.plan.rooms.length>30||!value.plan.rooms.every(room=>typeof room.id==='string'&&typeof room.name==='string'&&room.name.length<80&&['x','y','w','h','width','height'].every(key=>Number.isFinite(room[key])&&Math.abs(room[key])<10000)&&room.w>0&&room.h>0&&room.width>0&&room.height>0&&/^#[a-f\d]{6}$/i.test(room.color)))throw new Error('Filen er ikke et gyldig Romly-prosjekt.');
  return value;
}
async function initializeCloud(){
  renderSaveStatus({state:'loading',message:'Kobler til kontoen …'});
  try{
    session=await api.session();sessionReady=true;sync.user=session.user;
    $('#profile-btn').textContent=session.user?initials(session.user.name||session.user.email):'Logg inn';
    $('#profile-btn').classList.toggle('signed-out',!session.user);
    $('#profile-btn').setAttribute('aria-label',session.user?'Åpne kontoen til '+(session.user.name||session.user.email):'Logg inn');
    $('#profile-btn').title=session.user?.name||'Logg inn';
    if(!session.user){sync.activate(null);openAccount();return;}
    const result=await api.list();projectList=result.projects||[];const lastId=previousProject();const choice=projectList.find(record=>record.id===lastId&&record.status!=='deleting')||projectList.find(record=>record.status!=='deleting');
    if(choice){await openCloudProject(choice.id);}
    else{sync.activate(null);openProjects();}
  }catch(error){sessionReady=false;renderSaveStatus({state:'error',message:'Kontotjenesten er utilgjengelig',error});toast(error.message);openAccount();}
}
function openInspiration(){openDialog('Et hjem som føles som deg','Tre retninger å utforske i din egen plan.',`<div class="inspiration-grid">${[{name:'Lunt og naturlig',text:'Lys eik, varme tekstiler og rolige grønntoner.',color:'#e9dfcc',cls:'natural'},{name:'Varm minimalisme',text:'Gyldent treverk, myke former og færre elementer.',color:'#d7bc98',cls:'warm-minimal'},{name:'Lyst og tidløst',text:'Lyse flater, dempede gråtoner og rene linjer.',color:'#e3e4df',cls:'timeless'}].map(x=>`<button class="inspiration-card" data-inspo="${x.color}"><span class="inspiration-visual ${x.cls}"><i></i><i></i><i></i></span><h3>${x.name}</h3><p>${x.text}</p><strong>Prøv i valgt rom ${icon('arrow-right')}</strong></button>`).join('')}</div>`, '',true);document.querySelectorAll('[data-inspo]').forEach(b=>b.onclick=()=>{editor.updateRoom(selectedId,{color:b.dataset.inspo});closeDialog();toast('Materialet er lagt til i det valgte rommet.');});}
function openShortcuts(){openDialog('Litt raskere fra tanke til tegning','Hurtigtaster i designstudioet.',`<div class="shortcut-grid">${[['Velg et rom','V'],['Tegn skillevegg','W'],['Plasser dør','D'],['Plasser vindu','F'],['Angre','Ctrl + Z'],['Gjør om','Ctrl + Shift + Z'],['Fjern valgt element','Delete'],['Tilbake til velg','Esc']].map(([n,k])=>`<span>${n}</span><kbd>${k}</kbd>`).join('')}</div>`);}
$('#help-btn').onclick=openHelp;$('#projects-nav').onclick=$('#breadcrumb-home').onclick=openProjects;$('#profile-btn').onclick=openAccount;$('#inspiration-nav').onclick=openInspiration;$('#export-btn').onclick=openExport;$('#check-btn').onclick=$('#summary-check').onclick=()=>workflow(4);$('#new-suggestion').onclick=()=>workflow(2);$('#shortcuts-btn').onclick=openShortcuts;
$('#floor-info').onclick=()=>toast('Eksempelprosjektet inneholder én etasje. Alle rom vises i denne planen.');
$('#insight-btn').onclick=()=>{openDialog('Mer plass til å være sammen','Et åpent rom trenger også gode soner.',`<div class="help-steps"><article class="help-step"><span class="room-icon">${icon('sofa')}</span><div><h3>La møblene skape soner</h3><p>Bruk sofa, spisebord og belysning til å definere ulike områder uten å lukke rommet.</p></div></article><article class="help-step"><span class="room-icon">${icon('wall')}</span><div><h3>Avklar veggen før du åpner opp</h3><p>En tegning eller et bilde kan ikke fastslå om veggen er bærende. Få konstruksjonen vurdert av fagfolk før riving.</p><a class="text-link" href="https://www.dibk.no/bygge-eller-endre/arbeid-pa-eksisterende-bygg/innvendig-ombygging" target="_blank" rel="noopener noreferrer">Les DiBKs veiledning ↗</a></div></article></div>`);};
document.addEventListener('keydown',e=>{if(transitioning||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||dialog.open)return;const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();e.shiftKey?editor.redo():editor.undo();return;}if(e.ctrlKey||e.metaKey)return;const shortcuts={v:'select',w:'wall',d:'door',f:'window'};if(shortcuts[key]){e.preventDefault();setTool(shortcuts[key]);}if(key==='escape')setTool('select');if(key==='delete'||key==='backspace'){e.preventDefault();editor.removeSelected();}});
window.addEventListener('beforeunload',event=>{if(sync.dirty||sync.saving||filesBusy||transitioning){event.preventDefault();event.returnValue='';}});
$('#save-status').onclick=()=>{if(sync.error)showSaveProblem();};
$('#save-status').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&sync.error){e.preventDefault();showSaveProblem();}};
$('#retry-save-btn').onclick=async()=>{if(sync.error?.status===409){showSaveProblem();return;}try{await sync.flush();toast('Endringene er lagret på kontoen.');}catch(error){showSaveProblem(error);}};
$('#save-copy-btn').onclick=()=>showSaveProblem();
$('#backup-unsaved-btn').onclick=downloadProjectBackup;
window.addEventListener('online',()=>{if(sync.dirty&&sync.error?.status!==409)sync.flush().catch(()=>{});});
window.romly={editor,getProject:()=>({...project}),getUploads:()=>uploads.length,getSession:()=>session,getActiveRecord:()=>activeRecord,getSync:()=>({dirty:sync.dirty,state:lastSaveStatus.state,revision:sync.record?.revision,transitioning,filesBusy}),flush:()=>sync.flush()};
initializeCloud();
