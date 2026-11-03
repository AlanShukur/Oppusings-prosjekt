import { deriveWalls, getSceneBounds, projectToWall, assignOpenings, openingWidthUnits, furnitureConflicts, furnishedRoomIds, WALL_STATUSES, LOAD_BEARING } from './scene-geometry.js';
import { compareToBaseline } from './plan-diff.js';
import { FURNITURE, FURNITURE_LIMITS, LEGACY_SIZES, isFurniture, furnitureSize } from './furniture.js';

const NS = 'http://www.w3.org/2000/svg';
const SCALE = 50;
const clone = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const format = value => Number(value).toLocaleString('nb-NO', {maximumFractionDigits: 1});
const snap = value => Math.round(value / 2.5) * 2.5;
const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,9)}`}`;
const ROOM_TYPES = new Set(['living','bedroom','bath','hall','office','kitchen','dining','storage','room']);
export const MAX_ROOMS = 30, MAX_ITEMS = 300;
const EXAMPLE_ROOM_IDS = ['living','bed1','bed2','bath','hall'];
const normalizeAngle = angle => Math.round((((angle % 360) + 360) % 360) * 1000) / 1000;
const wallAngle = wall => Math.atan2(wall.y2-wall.y, wall.x2-wall.x) * 180 / Math.PI;
const precise = value => Math.round(value * 100) / 100;
/** Which edge of a room rectangle an opening sits on (within tolerance), or null. */
function edgeOf(room,item,tolerance=3){
  const insideX=item.x>=room.x-tolerance&&item.x<=room.x+room.w+tolerance,insideY=item.y>=room.y-tolerance&&item.y<=room.y+room.h+tolerance;
  if(insideX&&Math.abs(item.y-room.y)<=tolerance)return 'top';
  if(insideX&&Math.abs(item.y-room.y-room.h)<=tolerance)return 'bottom';
  if(insideY&&Math.abs(item.x-room.x)<=tolerance)return 'left';
  if(insideY&&Math.abs(item.x-room.x-room.w)<=tolerance)return 'right';
  return null;
}
export const getWallSegments = state => deriveWalls(state);
export function getPlanBounds(state){
  const bounds=getSceneBounds(state);
  return {...bounds,x:bounds.minX,y:bounds.minY,w:bounds.width,h:bounds.height};
}

export const initialRooms = [
  {id:'living',name:'Stue / kjøkken',type:'living',x:140,y:100,w:320,h:430,color:'#f0e9dc'},
  {id:'bed1',name:'Soverom 1',type:'bedroom',x:460,y:100,w:200,h:160,color:'#e4e9df'},
  {id:'bed2',name:'Soverom 2',type:'bedroom',x:460,y:260,w:200,h:150,color:'#e9ebdf'},
  {id:'bath',name:'Bad',type:'bath',x:540,y:410,w:120,h:120,color:'#e2eaf0'},
  {id:'hall',name:'Entré',type:'hall',x:460,y:410,w:80,h:120,color:'#efe9df'}
].map(room => ({...room,width:room.w/SCALE,height:room.h/SCALE,area:room.w*room.h/SCALE**2}));

function doorOnLeftEdge(id,room,rooms,preferred){
  const spans=rooms.filter(other=>other.id!==room.id&&Math.abs(other.x+other.w-room.x)<1).map(other=>[Math.max(other.y,room.y)+24,Math.min(other.y+other.h,room.y+room.h)-24]).filter(([low,high])=>high>=low);
  if(!spans.length)return null;
  const [low,high]=spans.find(([low,high])=>preferred>=low&&preferred<=high)||spans.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];
  return {id,type:'door',x:room.x,y:Math.max(low,Math.min(high,preferred)),rotation:90,width:.84};
}
/** Doors and windows of the example home as real plan items, so 2D, 3D and the TEK17 check read the same data. */
export function exampleOpenings(rooms=[]){
  const byId=Object.fromEntries(rooms.map(room=>[room.id,room]));
  if(!EXAMPLE_ROOM_IDS.every(id=>byId[id]))return [];
  const {living,bed1,bed2,bath,hall}=byId;
  const along=(room,side,offset)=>side==='top'||side==='bottom'?{x:Math.max(room.x+30,Math.min(room.x+room.w-30,room.x+offset)),y:side==='top'?room.y:room.y+room.h,rotation:0}:{x:side==='left'?room.x:room.x+room.w,y:Math.max(room.y+30,Math.min(room.y+room.h-30,room.y+offset)),rotation:90};
  const pane=(id,room,side,offset,width,height,sillHeight)=>({id,type:'window',...along(room,side,offset),width,height,sillHeight});
  // The lower west window belongs to whichever room now occupies that stretch (Stue, or Soverom 3 in variant 03).
  const lowerY=living.y+322.5,lowerLeft=rooms.find(room=>Math.abs(room.x-living.x)<1&&room.y<=lowerY&&room.y+room.h>=lowerY)||living;
  const doors=[
    doorOnLeftEdge('example-door-bed1',bed1,rooms,bed1.y+bed1.h-34.5),
    doorOnLeftEdge('example-door-bed2',bed2,rooms,bed2.y+bed2.h-39),
    doorOnLeftEdge('example-door-hall',hall,rooms,hall.y+hall.h/2),
    doorOnLeftEdge('example-door-bath',bath,rooms,bath.y+66),
    {id:'example-door-entrance',type:'door',...along(hall,'bottom',40.5),width:.9,entrance:true},
  ].filter(Boolean);
  return [...doors,
    pane('example-window-living-1',living,'top',125,2.48,1.4,.8),
    pane('example-window-living-2',living,'left',137.5,1.78,1.4,.8),
    pane('example-window-living-3',lowerLeft,'left',lowerY-lowerLeft.y,1.82,1.4,.8),
    pane('example-window-bed1-1',bed1,'top',111,1.6,1.2,.9),
    pane('example-window-bed1-2',bed1,'right',79.5,1.46,1.2,.9),
    pane('example-window-bed2',bed2,'right',67.5,1.5,1.2,.9),
    pane('example-window-bath',bath,'bottom',59.5,1.02,.6,1.4)];
}
/** Example projects saved before openings were plan items get them on load (3D used to invent them). */
export function upgradeExamplePlan(plan){
  if(!plan||plan.variant==='custom'||plan.reference||(plan.items||[]).some(item=>item.type==='door'||item.type==='window'))return plan;
  const openings=exampleOpenings(plan.rooms||[]);
  return openings.length?{...plan,items:[...(plan.items||[]),...openings].slice(0,MAX_ITEMS)}:plan;
}
/** Version of the saved plan format. Bump it with a new MIGRATIONS entry whenever saved plans change shape, and keep PLAN_VERSION in lib/projects-api.mjs equal (a test checks). */
export const PLAN_VERSION=4;
// MIGRATIONS[n] turns a version n plan into version n+1. Version 0 is every plan saved before versioning.
// 0 → 1: example plans get real doors and windows. 1 → 2: walls get saved notes (status, load-bearing); none exist yet.
// 2 → 3: plans may carry a baseline ("Dagens planløsning"); none exists yet, so nothing changes.
// 3 → 4: furniture gets its own width and depth. Existing pieces keep the size they were drawn at, also in the baseline.
const legacySized=items=>Array.isArray(items)?items.map(item=>LEGACY_SIZES[item?.type]&&!Number.isFinite(item.width)?{...item,width:LEGACY_SIZES[item.type][0],depth:LEGACY_SIZES[item.type][1]}:item):items;
const MIGRATIONS=[upgradeExamplePlan,plan=>({...plan,walls:[]}),plan=>plan,plan=>({...plan,items:legacySized(plan.items),...(plan.baseline?{baseline:{...plan.baseline,items:legacySized(plan.baseline.items)}}:{})})];
/** Every item type a plan can hold. */
export const ITEM_TYPES=['window','door','wall',...Object.keys(FURNITURE)];
const MAX_WALL_NOTES=300;
/** Wall notes from storage or an import: valid, unique, and only those that differ from the default. */
function cleanWallNotes(list){
  const notes=new Map();
  for(const note of Array.isArray(list)?list:[]){
    if(!note||typeof note.key!=='string'||note.key.length>400||notes.has(note.key)||!WALL_STATUSES.includes(note.status)||!LOAD_BEARING.includes(note.loadBearing))continue;
    if(note.status!=='existing'||note.loadBearing!=='unknown')notes.set(note.key,{key:note.key,status:note.status,loadBearing:note.loadBearing});
  }
  return [...notes.values()].slice(0,MAX_WALL_NOTES);
}
/** A saved baseline from storage or an import, or undefined. Its geometry is kept as saved; only its shape is checked. */
function cleanBaseline(baseline){
  if(!baseline||!Array.isArray(baseline.rooms)||!Array.isArray(baseline.items))return undefined;
  const rooms=baseline.rooms.filter(room=>room&&typeof room.id==='string'&&[room.x,room.y,room.w,room.h].every(Number.isFinite)&&room.w>0&&room.h>0).slice(0,MAX_ROOMS);
  const items=baseline.items.filter(item=>item&&typeof item.id==='string'&&Number.isFinite(item.x)&&Number.isFinite(item.y)).slice(0,MAX_ITEMS);
  return {savedAt:typeof baseline.savedAt==='string'&&!Number.isNaN(Date.parse(baseline.savedAt))?baseline.savedAt:new Date(0).toISOString(),rooms:clone(rooms),items:clone(items),walls:cleanWallNotes(baseline.walls)};
}
/** Demolished walls are dashed red and new walls green; load-bearing walls are drawn wider by the caller. */
function wallStroke(status,exterior,width){
  if(status==='demolish')return `stroke="#c4553f" stroke-width="${width}" stroke-dasharray="${precise(width*1.4)} ${precise(width*.9)}" stroke-linecap="butt"`;
  return `stroke="${status==='new'?'#2f7f6f':exterior?'#4e584e':'#626a60'}" stroke-width="${width}" stroke-linecap="square"`;
}
const planError=(message,code)=>Object.assign(new Error(message),{code});
/** The plan in the current format; the input is not changed. Plans from a newer Romly are refused, because this code would drop what it does not know. */
export function migratePlan(plan){
  const version=plan?.schemaVersion===undefined?0:plan.schemaVersion;
  if(!Number.isInteger(version)||version<0)throw planError('Plantegningen har en ugyldig formatversjon.','invalid_plan');
  if(version>PLAN_VERSION)throw planError('Prosjektet er lagret med en nyere versjon av Romly. Last inn siden på nytt for å åpne det.','plan_too_new');
  let next=clone(plan);for(let v=version;v<PLAN_VERSION;v++)next=MIGRATIONS[v](next);
  return {...next,schemaVersion:PLAN_VERSION};
}

function rect(x,y,w,h,fill='#fff',rx=2,stroke='#a5a39a',sw=1.2){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;}
function plant(x,y,r=13){return `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#d9ddcd" stroke="#a7b49d"/><path d="M0 7C-18-1-11-15 0-3C8-23 19-8 3 1C22-2 13 16 2 6C-8 21-18 9-2 2" fill="#9eaf92" stroke="#859b7b" stroke-width=".7"/></g>`;}
function bed(x,y,w,h){return `<g>${rect(x-3,y-3,w+6,h+6,'#c6c9b9',2,'#a8ae9d')}${rect(x,y,w,h,'#f9f8f1',3,'#9ea494')}${rect(x+7,y+7,w/2-10,24,'#eeede5',4,'#bfc2b6')}${rect(x+w/2+3,y+7,w/2-10,24,'#eeede5',4,'#bfc2b6')}<path d="M${x} ${y+41}H${x+w}V${y+h}H${x}Z" fill="#d3d8c6" stroke="#aeb6a1"/><path d="M${x+6} ${y+47}H${x+w-6}" fill="none" stroke="#b4bda8"/>${rect(x-20,y+8,13,21,'#e5d7bd',1,'#b5aa96')}${rect(x+w+7,y+8,13,21,'#e5d7bd',1,'#b5aa96')}</g>`;}
function doorway(x,y,orientation='right',size=38){let transform = orientation==='down'?`translate(${x} ${y}) rotate(90)`:`translate(${x} ${y})`;return `<g transform="${transform}"><path d="M0 0H${size}" stroke="#f3f0e8" stroke-width="9"/><path d="M0 0V${size}A${size} ${size} 0 0 0 ${size} 0" fill="none" stroke="#8f948e" stroke-width="1.2"/><path d="M0 0V${size}" stroke="#6f7770" stroke-width="2"/></g>`;}
/** A piece of furniture drawn in a w × d box (plan units) centred on the item; the back is at the top (-y). */
function furnitureSymbol(kind,w,d){
  const x=-w/2,y=-d/2,line=(path,stroke)=>`<path d="${path}" fill="none" stroke="${stroke}"/>`;
  switch(kind){
    case 'bed':{const pillows=w>=55?2:1,gap=4,pw=(w-12-(pillows-1)*gap)/pillows;return rect(x,y,w,d,'#f9f8f1',3,'#9ea494')+Array.from({length:pillows},(_,i)=>rect(x+6+i*(pw+gap),y+5,pw,Math.min(22,d*.18),'#eeede5',4,'#bfc2b6')).join('')+`<path d="M${x} ${y+d*.3}H${x+w}V${y+d}H${x}Z" fill="#d3d8c6" stroke="#aeb6a1"/>`;}
    case 'sofa':{const back=Math.min(14,d*.25),arm=Math.min(12,w*.16),seats=Math.max(1,Math.round((w-2*arm)/50)),seat=(w-2*arm)/seats;return rect(x,y,w,d,'#cbd4c3',7,'#8fa082')+Array.from({length:seats},(_,i)=>rect(x+arm+i*seat+1.5,y+back+1.5,seat-3,d-back-5,'#e1e7db',5,'#a8b59b')).join('');}
    case 'table':return rect(x,y,w,d,'#e7d6b8',4,'#b6a186');
    case 'low-table':return rect(x,y,w,d,'#e6d8be',Math.min(10,d/3),'#bba98d');
    case 'round-table':return `<ellipse rx="${w/2}" ry="${d/2}" fill="#e7d6b8" stroke="#b6a186" stroke-width="1.2"/>`;
    case 'chair':return rect(x,y,w,d,'#f7f3e9',5,'#b4aa95')+rect(x,y,w,Math.min(6,d*.25),'#e5dccb',2,'#b4aa95');
    case 'desk':return rect(x,y,w,d,'#e5d9c5',3,'#b3a58e')+rect(-Math.min(24,w*.3),y+4,Math.min(48,w*.6),Math.min(9,d*.25),'#626f6a',2,'#a8b0a6');
    case 'closet':return rect(x,y,w,d,'#e6dfce',1,'#bab4a5')+line(`M0 ${y}V${y+d}M${x} ${y+d-4}H${x+w}`,'#bab4a5');
    case 'cabinet':return rect(x,y,w,d,'#e4decc',1,'#bcb5a2')+line(`M${x} ${y+d-3}H${x+w}`,'#bcb5a2');
    case 'appliance':return rect(x,y,w,d,'#f4f6f5',3,'#a9b5b3')+`<circle r="${Math.min(w,d)*.3}" fill="#e3ebea" stroke="#a9b5b3"/>`;
    case 'plant':return `<g transform="scale(${Math.max(w,d)/34})">${plant(0,0,17)}</g>`;
    default:return rect(x,y,w,d,'#e7d6b8',4,'#b6a186');
  }
}
function windowMark(x,y,length=80,vertical=false){return `<g transform="translate(${x} ${y})${vertical?' rotate(90)':''}"><path d="M0 0H${length}" stroke="#fbfdfd" stroke-width="10"/><path d="M0-4H${length}M0 4H${length}M0 0H${length}" stroke="#9bb8bd" stroke-width="1.4"/><path d="M0-5V5M${length/2}-4V4M${length}-5V5" stroke="#819ea4" stroke-width="1.4"/></g>`;}

export class PlanEditor {
  constructor(container, {onSelect=()=>{},onChange=()=>{},onViewError=()=>{},onNotice=()=>{},onItemSelect=()=>{},onWallSelect=()=>{},onZoom=()=>{}}={}) {
    this.container=container;
    this.onSelect=onSelect;
    this.onChange=onChange;
    this.onViewError=onViewError;
    this.onNotice=onNotice;
    this.onItemSelect=onItemSelect;
    this.onWallSelect=onWallSelect;
    this.onZoom=onZoom;
    this.state={rooms:clone(initialRooms),items:exampleOpenings(initialRooms),variant:'balanced',walls:[]};
    this.selected='living';
    this.selectedItem=null;this.selectedWall=null;this.wallSignature='';
    this.tool='select';this.view='2d';this.zoom=100;this.viewport=null;
    this.layers={dimensions:true,furniture:true,reference:true,baseline:true};
    this.history=[];this.future=[];
    this.drag=null;
    this.wallStart=null;this.wallEnd=null;
    this.roomStart=null;this.roomEnd=null;this.referenceImage=null;
    this.viewer=null;this.viewGeneration=0;this.renderFrame=null;this.renderCount=0;this.itemSignature='';this.exporting=false;
    this.render();
    this.container.addEventListener('pointerdown',event=>this.pointerDown(event));
    this.container.addEventListener('pointermove',event=>this.pointerMove(event));
    this.container.addEventListener('pointerup',event=>this.pointerUp(event));
    this.container.addEventListener('pointercancel',()=>this.cancelPointer());
    this.container.addEventListener('wheel',event=>this.wheel(event),{passive:false});
  }

  getState(){return {...clone(this.state),schemaVersion:PLAN_VERSION};}
  room(){return this.state.rooms.find(room=>room.id===this.selected);}
  isCustom(){return this.state.variant==='custom'||!!this.state.reference;}
  isExample(){return !this.state.reference&&this.state.variant!=='custom'&&EXAMPLE_ROOM_IDS.every(id=>this.state.rooms.some(room=>room.id===id));}
  selectRoom(id){if(!this.state.rooms.some(room=>room.id===id))return;this.selected=id;this.selectedItem=null;this.render();this.onSelect(clone(this.room()));}
  checkpoint(){this.history.push(this.getState());if(this.history.length>40)this.history.shift();this.future=[];}
  notify(){this.pruneWallNotes();this.onChange(this.getState());const room=this.room();this.onSelect(room?clone(room):null);}
  loadState(state){
    if(!state||!Array.isArray(state.rooms))throw new Error('Plantegningen kunne ikke leses.');
    state=migratePlan(state);
    this.state={rooms:clone(state.rooms),items:clone(state.items||[]),variant:state.variant||'balanced',walls:cleanWallNotes(state.walls)};this.selectedWall=null;
    const baseline=cleanBaseline(state.baseline);if(baseline)this.state.baseline=baseline;
    if(state.reference)this.state.reference=clone(state.reference);
    this.history=[];this.future=[];this.drag=null;this.selectedItem=null;this.wallStart=null;this.wallEnd=null;this.roomStart=null;this.roomEnd=null;
    this.referenceImage=null;this.viewGeneration++;this.viewer?.dispose();this.viewer=null;this.view='2d';this.viewport=null;
    this.selected=this.state.rooms[0]?.id;
    this.render();this.notify();
  }
  setReference(reference,{replace=true}={}){
    if(!reference||!Number.isFinite(reference.w)||!Number.isFinite(reference.h)||reference.w<=0||reference.h<=0)throw new Error('Plantegningen mangler gyldig målestokk.');
    this.checkpoint();
    if(reference.fileId!==this.state.reference?.fileId)this.referenceImage=null;
    this.state=replace?{rooms:[],items:[],variant:'custom',walls:[],reference:clone(reference)}:{...this.state,variant:'custom',reference:clone(reference)};
    this.selected=replace?null:this.selected;this.selectedItem=null;this.selectedWall=null;this.drag=null;this.wallStart=null;this.roomStart=null;
    if(replace){this.zoom=100;this.viewport=null;this.onZoom(100);}
    this.render();this.notify();
  }
  /** Display-only change: no undo step and no zoom reset. */
  setReferenceOpacity(opacity){
    if(!this.state.reference||!Number.isFinite(opacity))return false;
    this.state.reference.opacity=Math.max(.1,Math.min(1,opacity));
    this.render();this.onChange(this.getState());return true;
  }
  setReferenceImage(url){
    this.referenceImage=typeof url==='string'&&/^(blob:|\/api\/projects\/|data:image\/(?:png|jpeg|webp);base64,)/.test(url)?url:null;
    this.render();
  }
  clearReference(){
    if(!this.state.reference)return false;
    this.checkpoint();delete this.state.reference;this.referenceImage=null;
    this.render();this.notify();return true;
  }
  setCursor(){this.container.style.cursor=['window','door','wall','room'].includes(this.tool)?'crosshair':this.tool==='pan'?'grab':'default';}
  setTool(tool){this.tool=tool;this.wallStart=null;this.wallEnd=null;this.roomStart=null;this.roomEnd=null;this.container.dataset.tool=tool;this.setCursor();this.render();}
  async setView(view){
    if(view==='3d'&&this.viewer){this.view='3d';return '3d';}
    const generation=++this.viewGeneration;
    this.viewer?.dispose();this.viewer=null;
    if(view!=='3d'){this.view='2d';this.render();return '2d';}
    this.view='loading3d';
    this.container.innerHTML='<div role="status" style="display:grid;place-items:center;width:100%;height:100%;color:#7961ce;font:14px sans-serif">Åpner 3D-modellen …</div>';
    try{
      const {createPlan3D}=await import('./vendor/viewer3d.js');
      if(generation!==this.viewGeneration)return this.view;
      const viewer=await createPlan3D(this.container,this.getState(),{referenceImage:this.referenceImage,layers:this.layers,onRoomSelect:id=>this.selectRoom(id),onError:error=>{if(generation===this.viewGeneration){this.setView('2d');this.onViewError(error);}}});
      if(generation!==this.viewGeneration){viewer.dispose();return this.view;}
      this.viewer=viewer;this.view='3d';viewer.setZoom?.(Math.max(50,Math.min(180,this.zoom)));return '3d';
    }catch(error){
      if(generation===this.viewGeneration){this.view='2d';this.render();}
      throw error;
    }
  }
  fitViewport(){
    const bounds=getPlanBounds(this.state);
    const size=Math.max(bounds.width,bounds.height),padding=Math.max(35,Math.min(90,size*.12));
    return {cx:bounds.centerX,cy:bounds.centerY,w:bounds.width+padding*2,h:bounds.height+padding*2,size};
  }
  /** The 2D view stays where the user left it; it is only refitted on load, import, variant change and 'Tilpass'. */
  ensureViewport(){if(!this.viewport)this.viewport=this.fitViewport();return this.viewport;}
  setZoom(zoom){this.zoom=Math.max(25,Math.min(400,number(zoom)||100));if(this.viewer)this.viewer.setZoom?.(Math.max(50,Math.min(180,this.zoom)));else this.render();}
  zoomAt(zoom,point){
    const next=Math.max(25,Math.min(400,zoom)),viewport=this.ensureViewport();
    if(point){const ratio=this.zoom/next;viewport.cx=point.x-(point.x-viewport.cx)*ratio;viewport.cy=point.y-(point.y-viewport.cy)*ratio;}
    this.zoom=next;this.onZoom(Math.round(next));this.scheduleRender();
  }
  wheel(event){
    if(this.view!=='2d')return;
    event.preventDefault?.();
    const point=this.point(event);
    this.zoomAt(this.zoom*Math.exp(-Math.max(-60,Math.min(60,number(event.deltaY)))*.004),point);
  }
  get3DStats(){return this.viewer?.getStats?.()||null;}
  resetView(){this.zoom=100;this.viewport=null;if(this.viewer)this.viewer.resetView?.();else this.render();}
  setLayers(layers){Object.assign(this.layers,layers);if(this.viewer)this.viewer.setLayers?.(this.layers);else this.render();}
  undo(){if(!this.history.length)return false;this.future.push(this.getState());this.state=this.history.pop();this.selected=this.state.rooms.find(r=>r.id===this.selected)?.id||this.state.rooms[0]?.id;this.selectedItem=null;this.render();this.notify();return true;}
  redo(){if(!this.future.length)return false;this.history.push(this.getState());this.state=this.future.pop();this.selected=this.state.rooms.find(r=>r.id===this.selected)?.id||this.state.rooms[0]?.id;this.selectedItem=null;this.render();this.notify();return true;}
  setVariant(id){
    this.checkpoint();this.state={rooms:clone(initialRooms),items:[],variant:id,walls:[]};this.selectedWall=null;
    if(id==='family'||id==='three'||id==='3'||id==='03'){
      const room=this.state.rooms.find(room=>room.id==='living');room.h=270;room.height=5.4;room.area=room.w*room.h/SCALE**2;
      this.state.rooms.push({id:'bed3',name:'Soverom 3',type:'bedroom',x:140,y:370,w:175,h:160,width:3.5,height:3.2,area:11.2,color:'#e8e6db'});
      this.state.rooms.push({id:'dining',name:'Spisestue',type:'living',x:315,y:370,w:145,h:160,width:2.9,height:3.2,area:9.28,color:'#f0e9dc'});
    } else if(id==='02'||id==='open'||id==='social') {
      const main=this.state.rooms.find(room=>room.id==='bed1');
      const second=this.state.rooms.find(room=>room.id==='bed2');
      main.h=190;second.y=290;second.h=120;
    }
    this.recalculate();this.state.items=exampleOpenings(this.state.rooms);this.selected='living';this.selectedItem=null;this.viewport=null;this.render();this.notify();
  }
  /** True when switching suggestion would discard the user's own work. */
  hasCustomEdits(){
    if(this.isCustom()||this.state.walls?.length||this.state.baseline)return true;
    const pristine=new Map(exampleOpenings(this.state.rooms).map(item=>[item.id,JSON.stringify(item)]));
    if(this.state.items.some(item=>pristine.get(item.id)!==JSON.stringify(item))||this.state.items.length!==pristine.size)return true;
    const base=new Map(initialRooms.map(room=>[room.id,room]));
    return this.state.rooms.some(room=>!['bed3','dining'].includes(room.id)&&(!base.has(room.id)||base.get(room.id).name!==room.name||base.get(room.id).color!==room.color||base.get(room.id).type!==room.type));
  }

  attachOpenings(rooms){
    const attached=[];
    for(const item of this.state.items){
      if(item.type!=='door'&&item.type!=='window')continue;
      for(const room of rooms){const side=edgeOf(room,item);if(side){attached.push({item,room,side});break;}}
    }
    return attached;
  }
  /** Keep doors and windows on the edge they were attached to after rooms move or resize. */
  reattachOpenings(attached){
    for(const {item,room,side} of attached){
      const horizontal=side==='top'||side==='bottom',length=horizontal?room.w:room.h;
      const half=Math.min(openingWidthUnits(item)/2+3,length/2);
      if(horizontal){item.y=side==='top'?room.y:room.y+room.h;item.x=Math.max(room.x+half,Math.min(room.x+room.w-half,item.x));}
      else{item.x=side==='left'?room.x:room.x+room.w;item.y=Math.max(room.y+half,Math.min(room.y+room.h-half,item.y));}
    }
  }
  /**
   * Resize a room from its top-left corner. Neighbours that lie entirely along the moved edge
   * share one clamped delta; a neighbour that only partly shares the edge freezes it, so
   * resizing never opens gaps or creates overlaps.
   */
  resizeRoomTo(id,newW,newH,{quiet=false}={}){
    const room=this.state.rooms.find(room=>room.id===id);if(!room)return false;
    const old={x:room.x,y:room.y,w:room.w,h:room.h},custom=this.isCustom(),minimum=custom?25:70;
    const w=Math.min(custom?5000:660-old.x,Math.max(minimum,number(newW))),h=Math.min(custom?5000:530-old.y,Math.max(minimum,number(newH)));
    const others=this.state.rooms.filter(other=>other.id!==id);
    const right=others.filter(other=>Math.abs(other.x-old.x-old.w)<1&&other.y<old.y+old.h-.5&&other.y+other.h>old.y+.5);
    const below=others.filter(other=>Math.abs(other.y-old.y-old.h)<1&&other.x<old.x+old.w-.5&&other.x+other.w>old.x+.5);
    let dx=w-old.w,dy=h-old.h,blocked=false;
    if(right.some(other=>other.y<old.y-1||other.y+other.h>old.y+old.h+1)){blocked=Math.abs(dx)>.01;dx=0;}
    else for(const other of right)dx=Math.min(dx,other.w-minimum);
    if(below.some(other=>other.x<old.x-1||other.x+other.w>old.x+old.w+1)){blocked=blocked||Math.abs(dy)>.01;dy=0;}
    else for(const other of below)dy=Math.min(dy,other.h-minimum);
    const attached=this.attachOpenings([room,...right,...below]);
    room.w=old.w+dx;room.h=old.h+dy;
    for(const other of right){other.x+=dx;other.w-=dx;}
    for(const other of below){other.y+=dy;other.h-=dy;}
    this.reattachOpenings(attached);this.recalculate();
    if(blocked&&!quiet)this.onNotice('Et naborom deler bare en del av veggen, så den kan ikke flyttes. Juster naborommet først.');
    return true;
  }
  /** Move a room (own plans only); edges snap to neighbouring rooms, and its own doors/windows follow. */
  moveRoomBy(id,dx,dy,{snapEdges=true}={}){
    const room=this.state.rooms.find(room=>room.id===id);if(!room)return false;
    const others=this.state.rooms.filter(other=>other.id!==id);
    const tolerance=10/Math.max(.25,this.pixelsPerUnit());
    const align=(raw,size,list)=>{
      if(!snapEdges)return raw;
      let best=null;
      for(const value of list)for(const edge of [raw,raw+size]){const diff=value-edge;if(Math.abs(diff)<=tolerance&&(best===null||Math.abs(diff)<Math.abs(best)))best=diff;}
      return best===null?snap(raw):raw+best;
    };
    const x=Math.max(-5000,Math.min(5000-room.w,align(room.x+dx,room.w,others.flatMap(other=>[other.x,other.x+other.w]))));
    const y=Math.max(-5000,Math.min(5000-room.h,align(room.y+dy,room.h,others.flatMap(other=>[other.y,other.y+other.h]))));
    const moveX=x-room.x,moveY=y-room.y;
    for(const item of this.state.items){
      if((item.type==='door'||item.type==='window')&&edgeOf(room,item)&&!others.some(other=>edgeOf(other,item))){item.x=precise(item.x+moveX);item.y=precise(item.y+moveY);}
    }
    room.x=x;room.y=y;return true;
  }

  updateRoom(id,patch){
    const room=this.state.rooms.find(room=>room.id===id);if(!room)return;
    this.checkpoint();
    if(patch.name!==undefined)room.name=String(patch.name).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,60);
    if(patch.type!==undefined&&ROOM_TYPES.has(patch.type))room.type=patch.type;
    if(patch.color!==undefined&&/^#[0-9a-f]{6}$/i.test(patch.color))room.color=patch.color;
    if(patch.ceilingHeight!==undefined){if(Number.isFinite(patch.ceilingHeight)&&patch.ceilingHeight>=1.5&&patch.ceilingHeight<=6)room.ceilingHeight=precise(patch.ceilingHeight);else delete room.ceilingHeight;}
    if(patch.previousUse!==undefined){if(['hoveddel','tilleggsdel'].includes(patch.previousUse))room.previousUse=patch.previousUse;else delete room.previousUse;}
    // Only a size change may move walls; renaming or recolouring never resizes.
    if(patch.width!==undefined||patch.height!==undefined)this.resizeRoomTo(id,patch.width!==undefined?number(patch.width)*SCALE:room.w,patch.height!==undefined?number(patch.height)*SCALE:room.h);
    this.recalculate();this.render();this.notify();
  }
  recalculate(){this.state.rooms.forEach(room=>{room.width=room.w/SCALE;room.height=room.h/SCALE;room.area=room.w*room.h/SCALE**2;});}
  addRoom({x,y,w,h,name,type='room',color='#e8e1d1'}){
    if(this.state.rooms.length>=MAX_ROOMS)throw new Error('Plantegningen kan ha maksimalt 30 rom.');
    if(![x,y,w,h].every(Number.isFinite)||w<25||h<25||w>5000||h>5000||Math.abs(x)>5000||Math.abs(y)>5000)throw new Error('Rommet må være minst 0,5 × 0,5 meter.');
    this.checkpoint();
    const room={id:uid('room'),name:String(name||`Rom ${this.state.rooms.length+1}`).slice(0,60),type:ROOM_TYPES.has(type)?type:'room',color:/^#[0-9a-f]{6}$/i.test(color)?color:'#e8e1d1',x,y,w,h,width:w/SCALE,height:h/SCALE,area:w*h/SCALE**2};
    this.state.rooms.push(room);this.state.variant='custom';this.selected=room.id;this.selectedItem=null;
    this.render();this.notify();return clone(room);
  }
  finishRoom(start,end){
    const x=Math.min(start.x,end.x),y=Math.min(start.y,end.y),w=Math.abs(end.x-start.x),h=Math.abs(end.y-start.y);
    if(w<25||h<25)return false;
    this.roomStart=null;this.roomEnd=null;this.drag=null;
    try{this.addRoom({x,y,w,h});}catch(error){this.onNotice(error.message);this.flushRender();}
    return true;
  }
  addItem(type){
    const room=this.room()||this.state.rooms[0];
    if(type==='room'){
      if(!room){this.setTool('room');return null;}
      if(this.state.rooms.length>=MAX_ROOMS)throw new Error('Plantegningen kan ha maksimalt 30 rom.');
      if(Math.max(room.w,room.h)<50)throw new Error('Rommet er for lite til å deles i to. Tegn et nytt rom i stedet.');
      this.checkpoint();
      const direction=room.w>=room.h?'vertical':'horizontal';const newRoom={...clone(room),id:uid('room'),name:'Nytt rom',type:'bedroom',color:'#e7e9dc'};
      delete newRoom.ceilingHeight;delete newRoom.previousUse;
      if(direction==='vertical'){room.w=Math.max(25,Math.min(room.w-25,Math.round(room.w*.56/5)*5));newRoom.x=room.x+room.w;newRoom.w=newRoom.w-room.w;}
      else {room.h=Math.max(25,Math.min(room.h-25,Math.round(room.h*.56/5)*5));newRoom.y=room.y+room.h;newRoom.h=newRoom.h-room.h;}
      this.state.rooms.push(newRoom);this.selected=newRoom.id;this.selectedItem=null;this.recalculate();this.render();this.notify();return clone(newRoom);
    }
    if(this.state.items.length>=MAX_ITEMS)throw new Error('Plantegningen kan ha maksimalt 300 elementer.');
    this.checkpoint();const bounds=getPlanBounds(this.state);
    const item={id:uid('item'),type,x:room?room.x+room.w/2:bounds.centerX,y:room?room.y+room.h/2:bounds.centerY,rotation:0,...furnitureSize({type})};
    if(type==='wall'){item.x-=45;item.x2=item.x+90;item.y2=item.y;}
    if(type==='window'&&room){item.x=room.x+room.w/2;item.y=room.y;}
    if(type==='door'&&room){item.x=room.x+Math.min(50,room.w/2);item.y=room.y+room.h;}
    this.state.items.push(item);this.selectedItem=item.id;this.render();this.notify();
    return clone(item);
  }
  removeSelected(){
    if(this.selectedWall&&!this.selectedItem)return false; // a room wall is changed through its status, never deleted
    if(this.selectedItem){this.checkpoint();this.state.items=this.state.items.filter(item=>item.id!==this.selectedItem);this.selectedItem=null;this.render();this.notify();return true;}
    // Example rooms tile a fixed outline; rooms the user added or traced can always be removed.
    if(this.selected&&(this.state.variant==='custom'||!EXAMPLE_ROOM_IDS.includes(this.selected))){this.checkpoint();this.state.rooms=this.state.rooms.filter(room=>room.id!==this.selected);this.selected=this.state.rooms[0]?.id;this.render();this.notify();return true;}
    return false;
  }
  selectedItemState(){const item=this.state.items.find(item=>item.id===this.selectedItem);return item?clone(item):null;}
  clearItemSelection(){if(!this.selectedItem&&!this.selectedWall)return false;this.selectedItem=null;this.selectedWall=null;this.render();return true;}
  /** The saved note for a wall key, or the default when none is saved. */
  wallNote(key){const note=(this.state.walls||[]).find(note=>note.key===key);return note?clone(note):{key,status:'existing',loadBearing:'unknown'};}
  selectWall(key){if(!getWallSegments(this.state).some(wall=>wall.key===key))return false;this.selectedWall=key;this.selectedItem=null;this.render();return true;}
  /** Sets a wall's status and/or load-bearing. A wall back at the default stores nothing. */
  updateWall(key,patch){
    if(typeof key!=='string'||!getWallSegments(this.state).some(wall=>wall.key===key))return false;
    const note=this.wallNote(key);
    if(patch.status!==undefined){if(!WALL_STATUSES.includes(patch.status))return false;note.status=patch.status;}
    if(patch.loadBearing!==undefined){if(!LOAD_BEARING.includes(patch.loadBearing))return false;note.loadBearing=patch.loadBearing;}
    this.checkpoint();
    const rest=(this.state.walls||[]).filter(entry=>entry.key!==key);
    this.state.walls=note.status==='existing'&&note.loadBearing==='unknown'?rest:[...rest,note].slice(-MAX_WALL_NOTES);
    this.render();this.notify();return true;
  }
  /** Notes belong to walls that exist: a resize that keeps two rooms touching keeps their wall's note. */
  pruneWallNotes(){if(!this.state.walls?.length)return;const keys=new Set(getWallSegments(this.state).map(wall=>wall.key));this.state.walls=this.state.walls.filter(note=>keys.has(note.key));}
  /** Saves the drawing as it is now as "Dagens planløsning"; the check compares later changes with it. */
  setBaseline(){this.checkpoint();this.state.baseline={savedAt:new Date().toISOString(),rooms:clone(this.state.rooms),items:clone(this.state.items),walls:clone(this.state.walls||[])};this.render();this.notify();return true;}
  clearBaseline(){if(!this.state.baseline)return false;this.checkpoint();delete this.state.baseline;this.render();this.notify();return true;}
  /** Records whether a wall in the baseline was load-bearing; the check asks this for walls removed since. */
  updateBaselineWall(key,{loadBearing}={}){
    const baseline=this.state.baseline;if(!baseline||!LOAD_BEARING.includes(loadBearing))return false;
    if(!getWallSegments({rooms:baseline.rooms,items:baseline.items}).some(wall=>wall.key===key))return false;
    this.checkpoint();
    const old=baseline.walls.find(note=>note.key===key),note={key,status:old?.status||'existing',loadBearing};
    const rest=baseline.walls.filter(entry=>entry.key!==key);
    baseline.walls=note.status==='existing'&&note.loadBearing==='unknown'?rest:[...rest,note];
    this.render();this.notify();return true;
  }
  /**
   * Doors and windows flip (180°) so they stay on their wall; a door keeps its hinge at the same end and opens to
   * the other side. Furniture and partitions turn freely.
   */
  rotateSelected(delta=90){
    const item=this.state.items.find(item=>item.id===this.selectedItem);if(!item)return false;
    this.checkpoint();
    if(item.type==='wall'){
      const x2=item.x2??item.x+90,y2=item.y2??item.y,cx=(item.x+x2)/2,cy=(item.y+y2)/2,r=delta*Math.PI/180;
      const turn=(x,y)=>({x:precise(cx+(x-cx)*Math.cos(r)-(y-cy)*Math.sin(r)),y:precise(cy+(x-cx)*Math.sin(r)+(y-cy)*Math.cos(r))});
      const a=turn(item.x,item.y),b=turn(x2,y2);Object.assign(item,{x:a.x,y:a.y,x2:b.x,y2:b.y});
    } else item.rotation=normalizeAngle((item.rotation||0)+(item.type==='door'||item.type==='window'?180:delta));
    if(item.type==='door')this.toggleMirror(item);
    this.render();this.notify();return true;
  }
  toggleMirror(item){if(item.mirrored)delete item.mirrored;else item.mirrored=true;}
  /** Moves the selected door's hinge to the other end of the opening; it still opens to the same side. */
  mirrorSelected(){
    const item=this.state.items.find(item=>item.id===this.selectedItem);if(item?.type!=='door')return false;
    this.checkpoint();this.toggleMirror(item);this.render();this.notify();return true;
  }
  duplicateSelected(){
    const item=this.state.items.find(item=>item.id===this.selectedItem);if(!item)return null;
    if(this.state.items.length>=MAX_ITEMS){this.onNotice('Plantegningen kan ha maksimalt 300 elementer.');return null;}
    this.checkpoint();
    const copy={...clone(item),id:uid('item')};
    if(item.type==='door'||item.type==='window'){const r=(item.rotation||0)*Math.PI/180,step=openingWidthUnits(item)+10;copy.x=precise(item.x+Math.cos(r)*step);copy.y=precise(item.y+Math.sin(r)*step);}
    else{copy.x+=25;copy.y+=25;if(item.type==='wall'){copy.x2=(item.x2??item.x+90)+25;copy.y2=(item.y2??item.y)+25;}}
    this.state.items.push(copy);this.selectedItem=copy.id;this.render();this.notify();return clone(copy);
  }
  /** Arrow-key nudge: items (doors/windows slide along their wall) or, in own plans, the selected room. */
  nudgeSelected(dx,dy){
    const item=this.state.items.find(item=>item.id===this.selectedItem);
    if(item){
      this.checkpoint();
      if(item.type==='door'||item.type==='window'){const target=this.nearestWall({x:item.x+dx,y:item.y+dy},item.type==='window');if(target&&target.distance<=45){item.x=precise(target.x);item.y=precise(target.y);}}
      else{item.x+=dx;item.y+=dy;if(item.type==='wall'){item.x2=(item.x2??item.x-dx+90)+dx;item.y2=(item.y2??item.y-dy)+dy;}}
      this.render();this.notify();return true;
    }
    if(this.selected&&this.isCustom()){this.checkpoint();this.moveRoomBy(this.selected,dx,dy,{snapEdges:false});this.recalculate();this.render();this.notify();return true;}
    return false;
  }
  /** Measured properties of a door or window, or a piece of furniture's width and depth, in metres. null removes an opening's value. */
  updateItem(id,patch){
    const item=this.state.items.find(item=>item.id===id);if(!item)return false;
    if(isFurniture(item.type)){
      const [min,max]=FURNITURE_LIMITS,next={};
      for(const key of ['width','depth'])if(Number.isFinite(patch[key])&&patch[key]>=min&&patch[key]<=max&&patch[key]!==item[key])next[key]=precise(patch[key]);
      if(!Object.keys(next).length)return false;
      this.checkpoint();Object.assign(item,next);this.render();this.notify();return true;
    }
    if(item.type!=='door'&&item.type!=='window')return false;
    this.checkpoint();
    const limits={width:item.type==='door'?[.5,3]:[.2,6],height:[.2,3],sillHeight:[0,2.5]};
    for(const key of item.type==='door'?['width']:['width','height','sillHeight']){
      if(patch[key]===undefined)continue;
      const value=patch[key];
      if(value===null||value==='')delete item[key];
      else if(Number.isFinite(value)&&value>=limits[key][0]&&value<=limits[key][1])item[key]=precise(value);
    }
    if(item.type==='door'&&patch.entrance!==undefined){if(patch.entrance)item.entrance=true;else delete item.entrance;}
    if(item.type==='window'&&patch.escape!==undefined){if(patch.escape)item.escape=true;else delete item.escape;}
    this.render();this.notify();return true;
  }
  exportSVG(){
    if(typeof document==='undefined')return '';
    // Always export the whole plan at 100 %, with opaque rooms and no selection or private underlay.
    const saved={container:this.container,view:this.view,zoom:this.zoom,viewport:this.viewport,layers:this.layers,selected:this.selected,selectedItem:this.selectedItem};
    let svg;
    try{
      this.exporting=true;this.container=document.createElement('div');this.view='2d';this.zoom=100;this.viewport=null;this.layers={...this.layers,reference:false};this.selected=null;this.selectedItem=null;
      this.render();svg=this.container.querySelector('svg');
    }finally{Object.assign(this,saved);this.exporting=false;}
    if(!svg)return '';
    svg.querySelectorAll('[data-resize],[data-selection],[data-reference-image]').forEach(element=>element.remove());
    const [, , width, height]=(svg.getAttribute('viewBox')||'0 0 800 600').split(/\s+/).map(Number);
    svg.setAttribute('xmlns',NS);svg.setAttribute('width',String(Math.round(width)));svg.setAttribute('height',String(Math.round(height)));
    return new XMLSerializer().serializeToString(svg);
  }

  point(event){const svg=this.container.querySelector('svg');if(!svg)return null;const matrix=svg.getScreenCTM();if(!matrix)return null;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(matrix.inverse());}
  pixelsPerUnit(){const matrix=this.container.querySelector?.('svg')?.getScreenCTM?.();return matrix&&matrix.a>0?matrix.a:1;}
  /** Snap to existing room edges and partition endpoints within ~10 px, otherwise to the 5 cm grid. */
  snapPoint(point){
    const tolerance=10/Math.max(.25,this.pixelsPerUnit()),xs=[],ys=[];
    for(const room of this.state.rooms){xs.push(room.x,room.x+room.w);ys.push(room.y,room.y+room.h);}
    for(const item of this.state.items)if(item.type==='wall'){xs.push(item.x,item.x2??item.x+90);ys.push(item.y,item.y2??item.y);}
    const pick=(value,list)=>{let best=null;for(const candidate of list)if(Math.abs(candidate-value)<=tolerance&&(best===null||Math.abs(candidate-value)<Math.abs(best-value)))best=candidate;return best??snap(value);};
    return {x:pick(point.x,xs),y:pick(point.y,ys)};
  }
  scheduleRender(){
    if(this.renderFrame!==null)return;
    const request=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,0));
    this.renderFrame=request(()=>{this.renderFrame=null;this.render();});
  }
  flushRender(){
    if(this.renderFrame!==null){(globalThis.cancelAnimationFrame||clearTimeout)(this.renderFrame);this.renderFrame=null;}
    this.render();
  }
  capture(event){try{this.container.setPointerCapture?.(event.pointerId);}catch{/* Capture is a nicety; the gesture still works without it. */}event.preventDefault?.();}
  nearestWall(point,preferExterior=false){
    let nearest=null,exterior=null;
    for(const wall of getWallSegments(this.state)){
      if(wall.length<=28)continue;
      const projected={...projectToWall(wall,point),wall};
      if(!nearest||projected.distance<nearest.distance)nearest=projected;
      if(wall.exterior&&(!exterior||projected.distance<exterior.distance))exterior=projected;
    }
    return preferExterior&&exterior&&exterior.distance<=45?exterior:nearest;
  }
  startPan(event){
    const viewport=this.ensureViewport();
    this.drag={type:'pan',pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,cx:viewport.cx,cy:viewport.cy,ppu:this.pixelsPerUnit()};
    this.capture(event);this.container.style.cursor='grabbing';
  }
  pointerDown(event){
    if(this.view!=='2d'||this.drag)return; // one gesture at a time; a second finger is ignored
    if(event.button===1||(event.button===0&&this.tool==='pan')){this.startPan(event);return;}
    if(event.button!==0)return;
    const point=this.point(event);if(!point)return;
    const itemEl=event.target.closest?.('[data-item-id]');const roomEl=event.target.closest?.('[data-room-id]');
    this.ensureViewport();
    if(this.tool==='room'){
      const end=this.snapPoint(point);
      if(this.roomStart){if(!this.finishRoom(this.roomStart,end)){this.roomEnd=end;this.render();}return;}
      this.roomStart=end;this.roomEnd=end;
      this.drag={type:'room',pointerId:event.pointerId,start:end};this.capture(event);this.render();return;
    }
    if(event.target.closest?.('[data-resize]')){
      const future=this.future;this.checkpoint();this.drag={type:'resize',pointerId:event.pointerId,start:point,room:clone(this.room()),state:this.getState(),future,moved:false};this.capture(event);return;
    }
    if(this.tool==='wall'){
      const snapped=this.snapPoint(point);
      if(!this.wallStart){this.wallStart=snapped;this.wallEnd=snapped;this.render();return;}
      if(Math.hypot(snapped.x-this.wallStart.x,snapped.y-this.wallStart.y)<10)return;
      if(this.state.items.length>=MAX_ITEMS){this.onNotice('Plantegningen kan ha maksimalt 300 elementer.');this.wallStart=null;this.wallEnd=null;this.render();return;}
      this.checkpoint();const item={id:uid('item'),type:'wall',x:this.wallStart.x,y:this.wallStart.y,x2:snapped.x,y2:snapped.y,rotation:0};
      // Chain: the next wall starts where this one ended. Esc or another tool ends the chain.
      this.state.items.push(item);this.selectedItem=item.id;this.wallStart=snapped;this.wallEnd=snapped;this.render();this.notify();return;
    }
    if(['window','door'].includes(this.tool)){
      if(this.state.items.length>=MAX_ITEMS){this.onNotice('Plantegningen kan ha maksimalt 300 elementer.');return;}
      const closest=this.nearestWall(point,this.tool==='window');
      if(!closest||closest.distance>45){this.onNotice(this.tool==='window'?'Klikk på eller like ved en yttervegg for å plassere vinduet.':'Klikk på eller like ved en vegg for å plassere døren.');return;}
      this.checkpoint();
      const item={id:uid('item'),type:this.tool,x:precise(closest.x),y:precise(closest.y),rotation:normalizeAngle(wallAngle(closest.wall))};
      this.state.items.push(item);this.selectedItem=item.id;this.render();this.notify();
      if(this.tool==='window'&&!closest.wall.exterior)this.onNotice('Vinduet står på en innervegg og gir ikke dagslys.');
      return;
    }
    if(isFurniture(this.tool)){
      if(this.state.items.length>=MAX_ITEMS){this.onNotice('Plantegningen kan ha maksimalt 300 elementer.');return;}
      this.checkpoint();const item={id:uid('item'),type:this.tool,x:snap(point.x),y:snap(point.y),rotation:0,...furnitureSize({type:this.tool})};this.state.items.push(item);this.selectedItem=item.id;this.render();this.notify();return;
    }
    if(itemEl){
      const item=this.state.items.find(item=>item.id===itemEl.dataset.itemId);if(!item)return;
      const future=this.future;this.checkpoint();this.selectedItem=item.id;
      let flip=false;
      if(item.type==='door'||item.type==='window'){const wall=this.nearestWall(item);if(wall)flip=Math.cos(((item.rotation||0)-wallAngle(wall.wall))*Math.PI/180)<0;}
      this.drag={type:'item',pointerId:event.pointerId,start:point,item:clone(item),state:this.getState(),future,moved:false,flip};this.capture(event);this.render();return;
    }
    const wallEl=event.target.closest?.('[data-wall-key]');
    if(wallEl&&this.tool==='select'){this.selectWall(wallEl.dataset.wallKey);return;}
    if(roomEl){
      this.selected=roomEl.dataset.roomId;this.selectedItem=null;this.selectedWall=null;
      if(this.tool==='select'&&this.isCustom()){const future=this.future;this.checkpoint();this.drag={type:'move',pointerId:event.pointerId,start:point,room:clone(this.room()),state:this.getState(),future,moved:false};this.capture(event);}
      this.render();this.onSelect(clone(this.room()));return;
    }
    if(this.tool==='select'){this.clearItemSelection();this.startPan(event);}
  }
  pointerMove(event){
    if(this.view!=='2d')return;
    if(this.drag&&event.pointerId!==undefined&&this.drag.pointerId!==undefined&&event.pointerId!==this.drag.pointerId)return;
    if(this.drag?.type==='pan'){
      const viewport=this.ensureViewport();
      viewport.cx=this.drag.cx-(event.clientX-this.drag.clientX)/this.drag.ppu;viewport.cy=this.drag.cy-(event.clientY-this.drag.clientY)/this.drag.ppu;
      this.scheduleRender();return;
    }
    const point=this.point(event);if(!point)return;
    if(this.wallStart&&!this.drag){this.wallEnd=this.snapPoint(point);this.scheduleRender();return;}
    if(this.roomStart&&!this.drag){this.roomEnd=this.snapPoint(point);this.scheduleRender();return;}
    if(!this.drag)return;
    if(this.drag.type==='room'){this.roomEnd=this.snapPoint(point);this.scheduleRender();return;}
    const dx=point.x-this.drag.start.x,dy=point.y-this.drag.start.y;
    if(this.drag.type==='item'){
      this.drag.moved=this.drag.moved||Math.abs(dx)+Math.abs(dy)>.1;
      const item=this.state.items.find(item=>item.id===this.drag.item.id);if(!item)return;
      const target={x:this.drag.item.x+dx,y:this.drag.item.y+dy};
      if(item.type==='door'||item.type==='window'){
        // Openings slide along walls and hop to the nearest wall; off a wall they are flagged, not lost silently.
        const closest=this.nearestWall(target,item.type==='window');
        if(closest&&closest.distance<=45){item.x=precise(closest.x);item.y=precise(closest.y);item.rotation=normalizeAngle(wallAngle(closest.wall)+(this.drag.flip?180:0));}
        else{item.x=Math.round(target.x/5)*5;item.y=Math.round(target.y/5)*5;}
      } else {
        item.x=Math.round(target.x/5)*5;item.y=Math.round(target.y/5)*5;
        if(item.type==='wall'){item.x2=(this.drag.item.x2??this.drag.item.x+90)+(item.x-this.drag.item.x);item.y2=(this.drag.item.y2??this.drag.item.y)+(item.y-this.drag.item.y);}
      }
    } else if(this.drag.type==='move'){
      if(!this.drag.moved&&Math.abs(dx)+Math.abs(dy)<4)return;
      this.drag.moved=true;this.state=clone(this.drag.state);
      this.moveRoomBy(this.drag.room.id,dx,dy);this.recalculate();
    } else {
      this.drag.moved=this.drag.moved||Math.abs(dx)+Math.abs(dy)>.1;
      this.state=clone(this.drag.state);const old=this.drag.room;
      this.resizeRoomTo(old.id,snap(old.w+dx),snap(old.h+dy),{quiet:true});
    }
    this.scheduleRender();
  }
  pointerUp(event){
    if(!this.drag)return;
    if(event&&event.pointerId!==undefined&&this.drag.pointerId!==undefined&&event.pointerId!==this.drag.pointerId)return;
    if(this.drag.type==='pan'){this.drag=null;this.setCursor();this.flushRender();return;}
    if(event)this.pointerMove(event);
    if(this.drag.type==='room'){
      const start=this.roomStart,end=this.roomEnd;this.drag=null;
      if(start&&end&&this.finishRoom(start,end))return;
      this.flushRender();return;
    }
    const drag=this.drag;this.drag=null;
    if(!drag.moved){this.history.pop();this.future=drag.future;this.flushRender();return;}
    this.flushRender();this.notify();
  }
  cancelPointer(){
    if(this.drag?.state){this.state=this.drag.state;this.history.pop();this.future=this.drag.future;}
    if(this.drag?.type==='pan')this.setCursor();
    this.drag=null;this.roomStart=null;this.roomEnd=null;this.wallStart=null;this.wallEnd=null;this.flushRender();
  }

  furniture(){
    if(this.state.variant==='custom'||this.state.reference||!['living','bed1','bed2','bath','hall'].every(id=>this.state.rooms.some(room=>room.id===id)))return this.genericFurniture();
    const variant=this.state.variant;const living=this.state.rooms.find(r=>r.id==='living');const bx=this.state.rooms.find(r=>r.id==='bed1');const b2=this.state.rooms.find(r=>r.id==='bed2');const bath=this.state.rooms.find(r=>r.id==='bath');
    const family=['family','three','3','03'].includes(variant);
    const clipped=(id,markup)=>`<g clip-path="url(#clip-${clean(id)})">${markup}</g>`;
    const kitchen=`<g>${rect(151,111,living.w-22,47,'#f7f6ee',1,'#b4b2a5')}${[0,1,2,3,4].map(i=>rect(155+i*(living.w-30)/5,114,(living.w-30)/5-3,40,'#f1efe6',0,'#c9c5b9',.8)).join('')}${rect(174,119,45,28,'#e3e8e6',4,'#a7b2ac')}${rect(180,123,33,20,'#eef2ee',4,'#a7b2ac')}${rect(living.x+living.w-73,119,49,30,'#444d49',1,'#6a716b')}<g fill="none" stroke="#d7ddd7">${[0,1].flatMap(a=>[0,1].map(b=>`<circle cx="${living.x+living.w-62+a*22}" cy="${127+b*15}" r="5"/>`)).join('')}</g>${rect(257,184,112,43,'#e4d8c1',3,'#b9ad98')}${[277,313,349].map(x=>`<circle cx="${x}" cy="239" r="9" fill="#e8dfcc" stroke="#b7ac97"/>`).join('')}${plant(419,135,10)}</g>`;
    const lounge=family?`<g transform="translate(0 -52)">${this.lounge(159,297,.8)}</g>`:this.lounge(159,297,1);
    const dining=`<g>${rect(343,289,78,83,'#e6d8bf',22,'#bbad93')}${[[333,302],[333,344],[420,302],[420,344]].map(([x,y])=>rect(x,y,12,24,'#f7f3e9',5,'#b4aa95')).join('')}<circle cx="382" cy="331" r="10" fill="#f3ede0" stroke="#c1b59d"/>${plant(383,330,6)}</g>`;
    const mainBed=bed(bx.x+60,bx.y+21,83,104)+rect(bx.x+10,bx.y+10,28,bx.h-22,'#e6dfce',0,'#bab4a5')+`<path d="M${bx.x+10} ${bx.y+bx.h/2}h28" stroke="#bab4a5"/>`;
    const second=b2.type==='office'?`${rect(b2.x+30,b2.y+15,120,40,'#e5d9c5')}${rect(b2.x+72,b2.y+26,36,20,'#454c4a')}<circle cx="${b2.x+90}" cy="${b2.y+72}" r="14" fill="#d3c8db" stroke="#a698b0"/>${plant(b2.x+b2.w-25,b2.y+30)}`:bed(b2.x+76,b2.y+17,72,91)+rect(b2.x+10,b2.y+10,29,71,'#e4decc',1,'#bcb5a2');
    const bathing=`<g>${rect(bath.x+8,bath.y+8,48,72,'#f4f7f6',3,'#aabbbb')}${rect(bath.x+12,bath.y+12,40,63,'#edf2f2',13,'#b6c6c5')}<circle cx="${bath.x+31}" cy="${bath.y+25}" r="2" fill="#a2b6b6"/>${rect(bath.x+78,bath.y+8,30,33,'#f8faf7',3,'#a8b9b6')}<ellipse cx="${bath.x+93}" cy="${bath.y+25}" rx="10" ry="9" fill="#e9f0ee" stroke="#a8b9b6"/>${rect(bath.x+84,bath.y+65,21,29,'#fbfcf9',10,'#a8b9b6')}${rect(bath.x+82,bath.y+61,25,12,'#f3f6f2',2,'#a8b9b6')}</g>`;
    let extra='';if(this.state.rooms.some(r=>r.id==='bed3'))extra=bed(184,388,75,100);
    // A room the user furnishes drops the drawn furniture; the kitchen and the bathroom fittings stay.
    const furnished=furnishedRoomIds(this.state),loose=(id,markup)=>furnished.has(id)?'':markup;
    return clipped('living',kitchen+loose('living',lounge+(!family?dining:'')+plant(168,502,17)))+clipped('bed1',loose('bed1',mainBed))+clipped('bed2',loose('bed2',second))+clipped('bath',bathing)+(family?clipped('bed3',loose('bed3',extra))+clipped('dining',loose('dining',`<g transform="translate(0 100)">${dining}</g>`)):'')+clipped('hall',loose('hall',rect(471,421,21,54,'#e5ddcd',0,'#c0b5a2')));
  }
  lounge(x,y,scale){return `<g transform="translate(${x} ${y}) scale(${scale})">${rect(-8,-6,173,171,'#e7e2d6',9,'#d9d2c4',1)}<path d="M2 2H153M2 161H153" stroke="#d2cabc"/>${rect(0,0,65,151,'#c9cfc2',6,'#9da993')}${rect(7,5,51,45,'#e0e4d6',5,'#b0baa6')}${rect(7,54,51,44,'#e0e4d6',5,'#b0baa6')}${rect(7,102,51,42,'#e0e4d6',5,'#b0baa6')}${rect(-3,0,13,151,'#bcc6b2',3,'#9daa91')}${rect(6,-2,58,13,'#c5ceba',3,'#9daa91')}${rect(6,140,58,13,'#c5ceba',3,'#9daa91')}${rect(89,40,58,69,'#e6d8be',24,'#bba98d')}<ellipse cx="116" cy="74" rx="16" ry="17" fill="#f8f5eb" stroke="#c9bca2"/>${plant(118,75,7)}${rect(178,23,13,100,'#c7c1af',1,'#aaa593')}${rect(176,42,5,62,'#444d48',0,'#5d655b')}</g>`;}

  genericFurniture(){
    const furnished=furnishedRoomIds(this.state);
    return this.state.rooms.map(room=>{
      if(furnished.has(room.id)&&!['bath','kitchen'].includes(room.type))return '';
      const scale=Math.max(.1,Math.min(1,(room.w-14)/180,(room.h-14)/180));
      let markup='';
      if(room.type==='bedroom')markup=bed(-38,-54,76,108);
      else if(room.type==='bath')markup=rect(-65,-65,52,105,'#f5f8f6',14,'#b0c2c2')+rect(25,-62,34,32,'#f9fbf8',4,'#b0c2c2')+rect(27,32,28,35,'#fbfcf9',12,'#b0c2c2');
      else if(room.type==='office')markup=rect(-70,-62,140,45,'#e5d9c5',4,'#b3a58e')+rect(-24,-56,48,27,'#626f6a',2,'#a8b0a6')+'<circle cx="0" cy="8" r="18" fill="#d3c8db" stroke="#b6a6c1"/>';
      else if(room.type==='living')markup=rect(-70,-55,50,130,'#c9cfc2',6,'#9da993')+rect(-62,-46,34,53,'#e0e4d6',5,'#b0baa6')+rect(-62,12,34,53,'#e0e4d6',5,'#b0baa6')+rect(0,-15,58,63,'#e6d8be',20,'#bba98d');
      else if(room.type==='kitchen')markup=rect(-75,-65,150,40,'#f7f6ee',2,'#b4b2a5')+rect(-65,-60,40,28,'#e3e8e6',4,'#a7b2ac')+rect(30,-60,35,28,'#444d49',1,'#6a716b');
      else if(room.type==='dining')markup=rect(-45,-60,90,120,'#e6d8bf',22,'#bbad93');
      return markup?`<g clip-path="url(#clip-${clean(room.id)})"><g transform="translate(${room.x+room.w/2} ${room.y+room.h/2}) scale(${scale})">${markup}</g></g>`:'';
    }).join('');
  }

  /** What is in the way for each piece of furniture and each door, in words for the drawing and the Egenskaper panel. */
  itemProblems(walls=getWallSegments(this.state)){
    const name=id=>{const other=this.state.items.find(entry=>entry.id===id);return `«${FURNITURE[other?.type]?.name||'Møbel'}»`;};
    const problems=new Map();
    for(const [id,list] of furnitureConflicts(this.state,walls)){
      const item=this.state.items.find(entry=>entry.id===id),others=[...new Set(list.filter(entry=>entry.kind==='furniture').map(entry=>name(entry.id)))],messages=[];
      if(item?.type==='door'){problems.set(id,[`${others.join(' og ')} står i veien når døren åpnes.`]);continue;}
      if(list.some(entry=>entry.kind==='wall'))messages.push('Går gjennom en vegg.');
      if(list.some(entry=>entry.kind==='door'))messages.push('Står i veien når en dør åpnes.');
      if(others.length)messages.push(`Overlapper med ${others.join(' og ')}.`);
      problems.set(id,messages);
    }
    return problems;
  }
  itemMarkup(item,detached=false,problem=''){
    if(item.type==='wall'){
      const dx=(item.x2??item.x+90)-item.x,dy=(item.y2??item.y)-item.y,note=this.wallNote(`item:${item.id}`);
      return `<g data-item-id="${clean(item.id)}" transform="translate(${item.x} ${item.y})" style="cursor:move">${this.selectedItem===item.id?`<path d="M0 0L${dx} ${dy}" stroke="#9275c6" stroke-width="13" stroke-dasharray="4 3" opacity=".5" data-selection="true"/>`:''}<path d="M0 0L${dx} ${dy}" fill="none" ${wallStroke(note.status,false,note.loadBearing==='yes'?10:7)}/><path d="M0 0L${dx} ${dy}" stroke="transparent" stroke-width="20"/></g>`;
    }
    const span=openingWidthUnits(item),piece=FURNITURE[item.type];
    let inner,bounds;
    if(piece){const size=furnitureSize(item),w=size.width*SCALE,d=size.depth*SCALE;inner=furnitureSymbol(piece.kind,w,d);bounds={x:-w/2-4,y:-d/2-4,w:w+8,h:d+8};}
    else if(item.type==='window'){inner=windowMark(-span/2,0,span);bounds={x:-span/2-6,y:-16,w:span+12,h:32};}
    else if(item.type==='door'){const door=doorway(-span/2,0,'right',span);inner=item.mirrored?`<g transform="scale(-1 1)">${door}</g>`:door;bounds={x:-span/2-6,y:-14,w:span+12,h:span+20};}
    else{inner=rect(-33,-22,66,44,'#e7d6b8',15,'#b6a186');bounds={x:-45,y:-28,w:90,h:56};}
    const title=detached?'Står ikke på en vegg og telles ikke i 3D eller kontrollen':problem;
    const warning=title?`<rect data-item-problem="true" x="${bounds.x-3}" y="${bounds.y-3}" width="${bounds.w+6}" height="${bounds.h+6}" fill="#c4413a14" stroke="#c4413a" stroke-width="1.5" stroke-dasharray="3 3" rx="5"><title>${clean(title)}</title></rect>`:'';
    return `<g data-item-id="${clean(item.id)}" transform="translate(${item.x} ${item.y}) rotate(${item.rotation||0})" style="cursor:move">${warning}${this.selectedItem===item.id?`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="#8467cf12" stroke="#8261c4" stroke-dasharray="4 3" rx="4" data-selection="true"/>`:''}${inner}<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="transparent" stroke="none"/></g>`;
  }

  render(){
    if(this.renderFrame!==null){(globalThis.cancelAnimationFrame||clearTimeout)(this.renderFrame);this.renderFrame=null;}
    if(this.view==='loading3d')return;
    if(this.view==='3d'&&this.viewer){this.viewer.update?.(this.getState(),{referenceImage:this.referenceImage,layers:this.layers});return;}
    this.renderCount++;
    const rooms=this.state.rooms,selected=this.room(),reference=this.state.reference;
    const example=this.isExample();
    const viewport=this.ensureViewport();
    const zoom=this.zoom/100,viewWidth=viewport.w/zoom,viewHeight=viewport.h/zoom;
    const viewBox=`${viewport.cx-viewWidth/2} ${viewport.cy-viewHeight/2} ${viewWidth} ${viewHeight}`;
    const fontScale=Math.max(.8,Math.min(2.5,viewport.size/650));
    const wallSegments=getWallSegments(this.state);
    const detached=new Set(assignOpenings(this.state,wallSegments).filter(entry=>entry.offWall).map(entry=>entry.item.id));
    const problems=this.itemProblems(wallSegments);
    const referenceMarkup=reference&&this.layers.reference?`<g data-reference-image="true" pointer-events="none">${this.referenceImage?`<image href="${clean(this.referenceImage)}" x="${reference.x}" y="${reference.y}" width="${reference.w}" height="${reference.h}" preserveAspectRatio="none" opacity="${Math.max(.1,Math.min(1,reference.opacity??.7))}"/>`:`<rect x="${reference.x}" y="${reference.y}" width="${reference.w}" height="${reference.h}" fill="#fff" stroke="#d5cedf" stroke-dasharray="6 5"/>`}</g>`:'';
    const roomFills=rooms.map(room=>`<g data-room-id="${clean(room.id)}" style="cursor:pointer"><rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="${clean(room.color)}" opacity="${reference&&this.layers.reference?.25:1}"/><rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="url(#${room.type==='bath'?'tiles':'wood'})" opacity="${room.type==='bath'?.5:.22}"/></g>`).join('');
    const roomHitboxes=rooms.map(room=>`<rect data-room-id="${clean(room.id)}" x="${room.x+3}" y="${room.y+3}" width="${Math.max(1,room.w-6)}" height="${Math.max(1,room.h-6)}" fill="transparent" style="cursor:${this.tool==='select'?'pointer':'inherit'}"/>`).join('');
    const labels=this.layers.dimensions?rooms.map(room=>{
      let x=room.x+room.w/2,y=room.y+room.h-20*fontScale;
      if(example&&room.id==='living'){x=room.x+room.w*.67;y=room.y+room.h-45;}
      if(example&&room.id==='bath'){x=room.x+room.w/2;y=room.y+room.h-16;}
      if(example&&room.id==='hall'){x=room.x+room.w/2;y=room.y+room.h-30;}
      return `<g pointer-events="none" text-anchor="middle" fill="#515a50" font-family="Arial,sans-serif"><text x="${x}" y="${y}" font-size="${11.5*fontScale}" font-weight="600" paint-order="stroke" stroke="#fff" stroke-width="${reference?2:0}">${clean(room.name)}</text><text x="${x}" y="${y+16*fontScale}" font-size="${10*fontScale}" fill="#747d70" paint-order="stroke" stroke="#fff" stroke-width="${reference?2:0}">${format(room.area)} m²</text>${room.w>=60&&room.h>=60?`<text x="${x}" y="${y+29*fontScale}" font-size="${9*fontScale}" fill="#8e9688" paint-order="stroke" stroke="#fff" stroke-width="${reference?2:0}">${format(room.width)} × ${format(room.height)} m</text>`:''}</g>`;
    }).join(''):'';
    // Walls come from the same derived segments as 3D and the TEK17 check, also for example plans.
    // A wall note follows its key; a selection whose wall no longer exists (resize, undo) is dropped.
    if(this.selectedItem||(this.selectedWall&&!wallSegments.some(wall=>wall.key===this.selectedWall)))this.selectedWall=null;
    const roomWalls=wallSegments.filter(wall=>wall.source==='room');
    const wallPath=wall=>`M${wall.x} ${wall.y}L${wall.x2} ${wall.y2}`;
    const walls=roomWalls.map(wall=>{
      const width=(wall.exterior?(example?9:7):(example?6:5))+(wall.loadBearing==='yes'?3:0);
      const highlight=wall.key===this.selectedWall?`<path d="${wallPath(wall)}" stroke="#9275c6" stroke-width="${width+10}" stroke-linecap="round" opacity=".4" data-selection="true" pointer-events="none"/>`:'';
      return `${highlight}<path d="${wallPath(wall)}" fill="none" ${wallStroke(wall.status,wall.exterior,width)}/>`;
    }).join('');
    // Walls in "Dagens planløsning" that are gone from the drawing, as red dashed ghosts.
    const diff=this.state.baseline&&this.layers.baseline!==false?compareToBaseline(this.state):null;
    const ghosts=diff?diff.removedWalls.flatMap(wall=>wall.pieces).map(piece=>`<path data-removed-wall="true" d="M${precise(piece.x)} ${precise(piece.y)}L${precise(piece.x2)} ${precise(piece.y2)}" stroke="#c4553f" stroke-width="4" stroke-dasharray="7 5" opacity=".55" pointer-events="none"/>`).join(''):'';
    const wallHits=this.tool==='select'&&!this.exporting?roomWalls.map(wall=>`<path data-wall-key="${clean(wall.key)}" d="${wallPath(wall)}" stroke="transparent" stroke-width="12" style="cursor:pointer"/>`).join(''):'';
    let dimensions='';
    if(this.layers.dimensions&&(rooms.length||reference)){
      const measured=getPlanBounds(rooms.length?{rooms,items:[]}:{rooms,items:[],reference});
      const offset=28*fontScale,top=measured.minY-offset,left=measured.minX-offset;
      dimensions=`<g fill="none" stroke="#a8aca3" stroke-width="${.8*fontScale}" pointer-events="none"><path d="M${measured.minX} ${top}H${measured.maxX}M${measured.minX} ${top-6*fontScale}V${top+6*fontScale}M${measured.maxX} ${top-6*fontScale}V${top+6*fontScale}M${left} ${measured.minY}V${measured.maxY}M${left-6*fontScale} ${measured.minY}H${left+6*fontScale}M${left-6*fontScale} ${measured.maxY}H${left+6*fontScale}"/></g><g fill="#8e9688" font-family="Arial,sans-serif" font-size="${10*fontScale}" text-anchor="middle" pointer-events="none"><text x="${measured.centerX}" y="${top-8*fontScale}">${format(measured.width/SCALE)} m</text><text transform="translate(${left-8*fontScale} ${measured.centerY}) rotate(-90)">${format(measured.height/SCALE)} m</text></g>`;
    }
    const inset=3,handle=Math.max(8,Math.min(16,12*fontScale));
    const selection=selected&&!this.selectedItem&&!this.selectedWall?`<g data-selection="true"><rect x="${selected.x+inset}" y="${selected.y+inset}" width="${Math.max(1,selected.w-inset*2)}" height="${Math.max(1,selected.h-inset*2)}" fill="#8b6ac808" stroke="#9275c6" stroke-width="1.5" stroke-dasharray="5 4" pointer-events="none"/><rect data-resize="true" x="${selected.x+selected.w-handle/2}" y="${selected.y+selected.h-handle/2}" width="${handle}" height="${handle}" rx="3" fill="#fff" stroke="#8b6ac8" stroke-width="2" style="cursor:nwse-resize"/></g>`:'';
    const wallPreview=this.wallStart&&this.wallEnd?`<path d="M${this.wallStart.x} ${this.wallStart.y}L${this.wallEnd.x} ${this.wallEnd.y}" stroke="#9275c6" stroke-width="6" stroke-dasharray="5 4" pointer-events="none"/>`:'';
    let roomPreview='';
    if(this.roomStart&&this.roomEnd){
      const x=Math.min(this.roomStart.x,this.roomEnd.x),y=Math.min(this.roomStart.y,this.roomEnd.y),w=Math.abs(this.roomEnd.x-this.roomStart.x),h=Math.abs(this.roomEnd.y-this.roomStart.y);
      roomPreview=`<g pointer-events="none"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#a78bd52b" stroke="#9275c6" stroke-width="2" stroke-dasharray="5 4"/><text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${12*fontScale}" fill="#7354ac">${format(w/SCALE)} × ${format(h/SCALE)} m</text></g>`;
    }
    const body=referenceMarkup+roomFills+(this.layers.furniture?this.furniture():'')+roomHitboxes+walls+ghosts+wallHits+labels+this.state.items.map(item=>this.itemMarkup(item,detached.has(item.id),(problems.get(item.id)||[]).join(' '))).join('')+selection+wallPreview+roomPreview;
    const clips=rooms.map(room=>`<clipPath id="clip-${clean(room.id)}"><rect x="${room.x+3}" y="${room.y+3}" width="${Math.max(1,room.w-6)}" height="${Math.max(1,room.h-6)}"/></clipPath>`).join('');
    this.container.innerHTML=`<svg xmlns="${NS}" width="100%" height="100%" viewBox="${viewBox}" role="img" aria-label="Redigerbar plantegning. Velg et rom, eller tegn rom over ditt eget underlag." style="display:block;overflow:visible;touch-action:none;user-select:none"><defs>${clips}<pattern id="wood" patternUnits="userSpaceOnUse" width="16" height="90"><path d="M0 0V90M16 0V90M0 0H16M0 45H8M8 90V45" stroke="#baab8f" stroke-width=".6" fill="none"/></pattern><pattern id="tiles" patternUnits="userSpaceOnUse" width="22" height="22"><path d="M0 0H22V22H0Z" stroke="#acbec5" stroke-width=".7" fill="none"/></pattern></defs><g>${body}</g>${dimensions}</svg>`;
    if(!this.exporting){
      const item=this.selectedItem?this.state.items.find(item=>item.id===this.selectedItem):null;
      const itemProblems=item?problems.get(item.id)||[]:[];
      const signature=item?JSON.stringify(item)+detached.has(item.id)+itemProblems.join():'';
      if(signature!==this.itemSignature){this.itemSignature=signature;this.onItemSelect(item?{...clone(item),detached:detached.has(item.id),problems:itemProblems}:null);}
      // The wall panel follows a selected room wall, or a selected drawn partition wall.
      const key=item?(item.type==='wall'?`item:${item.id}`:null):this.selectedWall;
      const pieces=key?wallSegments.filter(wall=>wall.key===key):[];
      let wall=null;
      if(key&&(pieces.length||item)){
        const note=this.wallNote(key),partition=key.startsWith('item:');
        const length=partition?Math.hypot((item.x2??item.x+90)-item.x,(item.y2??item.y)-item.y):pieces.reduce((sum,piece)=>sum+piece.length,0);
        wall={key,status:note.status,loadBearing:note.loadBearing,partition,exterior:!partition&&pieces.every(piece=>piece.exterior),length:precise(length/SCALE),rooms:partition?[]:[...new Set(pieces.flatMap(piece=>piece.roomIds))].map(id=>rooms.find(room=>room.id===id)?.name).filter(Boolean)};
      }
      const wallSignature=wall?JSON.stringify(wall):'';
      if(wallSignature!==this.wallSignature){this.wallSignature=wallSignature;this.onWallSelect(wall);}
    }
  }
}
