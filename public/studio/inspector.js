// The rooms list and the Egenskaper panels for the selected room, element or wall.
import { icon, $, toast, compactWorkspace, setWorkspacePanel } from './ui.js';
import { esc, fmt, decimal, singleLine, inputNumber } from './format.js';
import { studio, editor } from './state.js';
import { updateWorkflowProgress } from './workflow.js';
import { setTool } from './tools.js';

function roomIcon(r){return r?.type==='bedroom'?'bed':r?.type==='bath'?'bath':r?.type==='hall'?'hall':r?.type==='office'?'table':r?.type==='storage'?'layers':'sofa';}
export function rooms(){return editor?.getState().rooms||[];}
function renderRooms(){
  const state=editor?.getState();const list=state?.rooms||[];
  // Rebuilding the list must not drop keyboard focus from the row the user is on.
  const focusedRoom=document.activeElement?.closest?.('#room-list [data-room]')?.dataset.room;
  $('#room-list').innerHTML=list.length?list.map(r=>`<button class="room-row ${r.id===studio.selectedId?'active':''}" data-room="${esc(r.id)}" aria-pressed="${r.id===studio.selectedId}"><span class="room-icon">${icon(roomIcon(r))}</span><span class="room-details"><strong>${esc(r.name)}</strong><small>${r.type==='bedroom'?'Ro og hvile':r.type==='bath'?'Bad og våtrom':r.type==='storage'?'Bod og oppbevaring':r.type==='room'?'Velg romtype i egenskaper':'Ditt rom'}</small></span><span class="room-size">${fmt(r.area??r.width*r.height)}<small> m²</small></span></button>`).join(''):`<div class="empty-rooms">Tegn rom oppå plantegningen for å bygge din egen modell.<button class="button secondary" id="trace-first-room">${icon('plus')} Tegn første rom</button></div>`;
  if(focusedRoom)$('#room-list').querySelector(`[data-room="${CSS.escape(focusedRoom)}"]`)?.focus({preventScroll:true});
  if($('#trace-first-room'))$('#trace-first-room').onclick=()=>{setTool('room');setWorkspacePanel('canvas');};
  $('#total-area').innerHTML=`${fmt(list.reduce((a,r)=>a+(r.area??r.width*r.height),0))} <small>m²</small>`;
  // Count by the room type the user chose; names are only a fallback for untyped rooms.
  $('#bedroom-count').textContent=list.filter(r=>r.type==='bedroom'||(r.type==='room'&&/soverom/i.test(r.name))).length;
  $('#bath-count').textContent=list.filter(r=>r.type==='bath'||(r.type==='room'&&/^bad/i.test(r.name))).length;
  updateWorkflowProgress();
  const ref=state?.reference;$('#reference-details').hidden=!ref;$('#reference-name').textContent=ref?ref.name:'';if(ref)$('#reference-opacity').value=ref.opacity??0.7;
}
export function selectRoom(r){
  studio.selectedId=r?.id||null;
  $('#selected-room-title').textContent=r?.name||'Ingen rom valgt';
  $('#room-name').value=r?.name||'';$('#room-width').value=r?inputNumber(r.width):'';$('#room-height').value=r?inputNumber(r.height):'';
  $('#room-type').value=r?.type||'room';$('#room-area').textContent=r?fmt(r.area??r.width*r.height)+' m²':'—';$('#selected-room-icon').innerHTML=icon(roomIcon(r));
  $('#room-ceiling').value=r&&Number.isFinite(r.ceilingHeight)?inputNumber(r.ceilingHeight):'';$('#room-ceiling').placeholder=Number.isFinite(studio.project.building?.ceilingHeight)?'Som boligen ('+inputNumber(studio.project.building.ceilingHeight)+')':'Ikke oppgitt';$('#room-previous-use').value=r?.previousUse||'';
  for(const el of document.querySelectorAll('#room-name,#room-width,#room-height,#room-type,[data-material],#rename-room,#room-ceiling,#room-previous-use'))el.disabled=!r;
  document.querySelectorAll('.material').forEach(b=>b.classList.toggle('active',b.dataset.material===r?.color));renderRooms();
}
const ITEM_NAMES={window:'Vindu',door:'Dør',sofa:'Sofa',table:'Bord',bed:'Seng',plant:'Plante',wall:'Skillevegg'};
let shownItem=null;
export function showItem(item){
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
let shownWall=null;
export function showWall(wall){
  shownWall=wall;const panel=$('#wall-properties');panel.hidden=!wall;if(!wall)return;
  $('#wall-title').textContent=wall.partition?'Skillevegg':wall.exterior?'Yttervegg':'Innervegg';$('#wall-length').textContent=fmt(wall.length)+' m';
  $('#wall-between').textContent=wall.partition?'Tegnet med veggverktøyet.':wall.rooms.length>1?`Mellom ${wall.rooms.join(' og ')}`:wall.rooms[0]?`${wall.rooms[0]} – mot det fri`:'';
  $('#wall-status').value=wall.status;$('#wall-bearing').value=wall.loadBearing;
  $('#wall-hint').textContent=wall.status==='demolish'&&wall.loadBearing==='yes'?'En bærende vegg kan ikke bare fjernes. En fagperson må vurdere konstruksjonen og hvordan lastene skal tas opp.':wall.status==='demolish'&&wall.loadBearing==='unknown'?'Finn ut om veggen er bærende før du planlegger å rive den. Spør en fagperson hvis du er usikker.':'Marker om veggen skal stå, rives eller bygges ny, og om den er bærende.';
}
export function updateWallLegend(state){$('#wall-legend').hidden=!state?.walls?.length;}
export function bindInspector(){
  $('#room-list').addEventListener('click',e=>{const row=e.target.closest('[data-room]');if(row){editor.selectRoom(row.dataset.room);if(compactWorkspace.matches){setWorkspacePanel('properties');$('[data-workspace-panel="properties"]').focus({preventScroll:true});}}});
  $('#room-name').addEventListener('change',e=>{const value=singleLine(e.target.value).trim();if(value)editor.updateRoom(studio.selectedId,{name:value});else e.target.value=rooms().find(r=>r.id===studio.selectedId)?.name||'';});
  $('#room-type').onchange=e=>editor.updateRoom(studio.selectedId,{type:e.target.value});
  // The editor clamps to what the plan allows (0,5–100 m in own plans, the outline in the example home).
  for(const [id,key] of [['room-width','width'],['room-height','height']]){$('#'+id).addEventListener('change',e=>{const value=decimal(e.target.value);if(!Number.isFinite(value)||value<0.5||value>100){toast('Skriv et mål i meter, for eksempel 3,6.');selectRoom(rooms().find(r=>r.id===studio.selectedId));return;}editor.updateRoom(studio.selectedId,{[key]:value});});}
  $('#room-ceiling').addEventListener('change',e=>{const value=decimal(e.target.value);if(value!==null&&(!Number.isFinite(value)||value<1.5||value>6)){toast('Skriv takhøyden i meter, for eksempel 2,4.');selectRoom(rooms().find(r=>r.id===studio.selectedId));return;}editor.updateRoom(studio.selectedId,{ceilingHeight:value});});
  $('#room-previous-use').onchange=e=>editor.updateRoom(studio.selectedId,{previousUse:e.target.value||null});
  $('#item-rotate').onclick=()=>editor.rotateSelected(90);
  $('#item-duplicate').onclick=()=>{if(editor.duplicateSelected())toast('Elementet er duplisert.');};
  $('#item-delete').onclick=()=>editor.removeSelected();
  for(const [id,key] of [['item-width','width'],['item-height','height'],['item-sill','sillHeight']])$('#'+id).addEventListener('change',e=>{if(!shownItem)return;const value=decimal(e.target.value);if(value!==null&&!Number.isFinite(value)){toast('Skriv målet i meter, for eksempel 1,2.');showItem(shownItem);return;}const before=shownItem[key];editor.updateItem(shownItem.id,{[key]:value});const after=editor.selectedItemState();if(after&&value!==null&&after[key]===before)toast('Målet er utenfor det som er mulig for dette elementet.');if(after)showItem({...after,detached:shownItem.detached});});
  $('#item-escape').onchange=e=>shownItem&&editor.updateItem(shownItem.id,{escape:e.target.checked});
  $('#item-entrance').onchange=e=>shownItem&&editor.updateItem(shownItem.id,{entrance:e.target.checked});
  $('#wall-status').onchange=e=>shownWall&&editor.updateWall(shownWall.key,{status:e.target.value});
  $('#wall-bearing').onchange=e=>shownWall&&editor.updateWall(shownWall.key,{loadBearing:e.target.value});
  $('#rename-room').onclick=()=>{$('#room-name').focus();$('#room-name').select();};
  document.querySelectorAll('[data-material]').forEach(b=>b.onclick=()=>editor.updateRoom(studio.selectedId,{color:b.dataset.material}));
}
