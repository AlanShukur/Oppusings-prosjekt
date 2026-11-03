// Driving the editor: tools, zoom, 2D/3D, layers, adding rooms and the keyboard shortcuts.
import { icon, $, toast, compactWorkspace, setWorkspacePanel } from './ui.js';
import { singleLine } from './format.js';
import { studio, editor } from './state.js';
import { dialog, openDialog, closeDialog } from './dialog.js';
import { rooms } from './inspector.js';

let zoom=100,currentView='2d',viewGeneration=0;
export function setTool(tool){if(currentView==='3d'||editor.view==='loading3d')setView('2d');$('.studio').dataset.tool=tool;editor.setTool(tool);document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('#canvas-hint').innerHTML=icon(tool==='select'?'cursor':tool==='pan'?'hand':tool)+({select:'Klikk på et rom eller en vegg for å tilpasse. Dra i tomt område for å panorere',pan:'Dra for å flytte tegningen. Rull for å zoome',room:'Dra fra ett hjørne til et annet for å tegne rommet',wall:'Klikk for å tegne skillevegger etter hverandre. Esc avslutter',door:'Klikk på en vegg for å plassere en dør',window:'Klikk på en yttervegg for å plassere et vindu'}[tool]||'Klikk i plantegningen');}
export function setZoom(value){zoom=Math.max(25,Math.min(400,value));editor.setZoom(zoom);$('#zoom-value').textContent=zoom+' %';}
/** Shows a zoom level the editor already has, e.g. after a wheel zoom or a new plan. */
export function showZoom(value){zoom=value;$('#zoom-value').textContent=value+' %';}
export async function setView(view){
  const generation=++viewGeneration;$('#view-3d').disabled=view==='3d';
  try{const actual=await editor.setView(view);if(generation!==viewGeneration)return;currentView=actual||view;}
  catch(error){if(generation!==viewGeneration)return;currentView='2d';toast(error.message||'3D kunne ikke åpnes på denne enheten.');}
  finally{if(generation===viewGeneration){$('#view-3d').disabled=false;$('.studio').dataset.view=currentView;for(const mode of ['2d','3d']){$('#view-'+mode).classList.toggle('active',currentView===mode);$('#view-'+mode).setAttribute('aria-pressed',String(currentView===mode));}}}
}
function openAddRoom(){
  if(!rooms().length){setTool('room');setWorkspacePanel('canvas');toast('Dra fra ett hjørne til et annet for å tegne det første rommet.');return;}
  openAddRoomDialog();
}
function openAddRoomDialog(){openDialog('Gi plass til et nytt rom','Legg til et rom i skissen. Plassering og tilkomst må vurderes.',`<label class="field">Romnavn<input class="input" id="new-room-name" value="Nytt soverom" maxlength="40"></label><div class="info-banner">${icon('info')}<p>Det nye rommet opprettes som en skissesone. Juster størrelse og kontroller at det passer i planløsningen.</p></div>`,`<button class="button secondary" id="cancel-room">Avbryt</button><button class="button primary" id="confirm-room">${icon('plus')} Legg til rom</button>`);$('#cancel-room').onclick=closeDialog;$('#confirm-room').onclick=()=>{const name=singleLine($('#new-room-name').value).trim()||'Nytt rom';editor.addItem('room');const last=rooms().at(-1);if(last){editor.updateRoom(last.id,{name});editor.selectRoom(last.id);}closeDialog();toast('Rommet er lagt til som en skissesone.');};}
export function openShortcuts(){openDialog('Litt raskere fra tanke til tegning','Hurtigtaster i designstudioet.',`<div class="shortcut-grid">${[['Velg og flytt','V'],['Tegn rom','R'],['Tegn skillevegger','W'],['Plasser dør','D'],['Plasser vindu','F'],['Panorer','H'],['Zoom','Rullehjul'],['Roter eller snu valgt','Q / E'],['Dupliser valgt','Ctrl + D'],['Flytt valgt','Piltaster (Shift for større steg)'],['Angre','Ctrl + Z'],['Gjør om','Ctrl + Shift + Z'],['Fjern valgt element','Delete'],['Tilbake til velg','Esc']].map(([n,k])=>`<span>${n}</span><kbd>${k}</kbd>`).join('')}</div>`);}
export function bindTools(){
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{setTool(b.dataset.tool);if(compactWorkspace.matches)setWorkspacePanel('canvas');});
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{editor.addItem(b.dataset.add);if(compactWorkspace.matches)setWorkspacePanel('canvas');toast('Møbelet er lagt til. Dra det til ønsket plass.');});
  document.querySelectorAll('[data-tool-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tool-tab]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',x===b);});$('#build-tools').classList.toggle('hidden',b.dataset.toolTab!=='build');$('#interior-tools').classList.toggle('hidden',b.dataset.toolTab!=='interior');setTool('select');});
  $('#add-window').onclick=()=>{setTool('window');if(compactWorkspace.matches)setWorkspacePanel('canvas');toast('Klikk på en yttervegg for å plassere vinduet.');};$('#add-door').onclick=()=>{setTool('door');if(compactWorkspace.matches)setWorkspacePanel('canvas');toast('Klikk på en vegg for å plassere døren.');};
  $('#add-room-btn').onclick=()=>openAddRoom();
  $('#delete-selection').onclick=()=>{if(!editor.removeSelected())toast('Velg en dør, et vindu eller et møbel du har lagt til først.');};
  $('#undo-btn').onclick=()=>editor.undo();$('#redo-btn').onclick=()=>editor.redo();
  $('#zoom-out').onclick=()=>setZoom(Math.round(zoom/1.2));$('#zoom-in').onclick=()=>setZoom(Math.round(zoom*1.2));$('#zoom-fit').onclick=$('#zoom-value').onclick=()=>{setZoom(100);editor.resetView();setView(currentView);};
  $('#view-2d').onclick=()=>setView('2d');$('#view-3d').onclick=()=>setView('3d');
  for(const [id,key] of [['show-dimensions','dimensions'],['show-furniture','furniture']])$('#'+id).onchange=e=>editor.setLayers({[key]:e.target.checked});
  $('#layer-heading').onclick=()=>{const expanded=$('#layer-heading').getAttribute('aria-expanded')==='true';$('#layer-heading').setAttribute('aria-expanded',!expanded);$('#layer-controls').classList.toggle('hidden',expanded);};
  // Editor shortcuts never fire while a form control has focus; Delete/arrows also leave focused buttons and links alone.
  document.addEventListener('keydown',e=>{
    if(studio.transitioning||dialog.open||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
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
}
