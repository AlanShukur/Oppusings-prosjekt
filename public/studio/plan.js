import { deriveWalls, getSceneBounds, projectToWall } from './scene-geometry.js';

const NS = 'http://www.w3.org/2000/svg';
const SCALE = 50;
const clone = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const format = value => Number(value).toLocaleString('nb-NO', {maximumFractionDigits: 1});
const snap = value => Math.round(value / 2.5) * 2.5;
const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,9)}`}`;
const ROOM_TYPES = new Set(['living','bedroom','bath','hall','office','kitchen','dining','room']);
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

function rect(x,y,w,h,fill='#fff',rx=2,stroke='#a5a39a',sw=1.2){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;}
function plant(x,y,r=13){return `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#d9ddcd" stroke="#a7b49d"/><path d="M0 7C-18-1-11-15 0-3C8-23 19-8 3 1C22-2 13 16 2 6C-8 21-18 9-2 2" fill="#9eaf92" stroke="#859b7b" stroke-width=".7"/></g>`;}
function bed(x,y,w,h){return `<g>${rect(x-3,y-3,w+6,h+6,'#c6c9b9',2,'#a8ae9d')}${rect(x,y,w,h,'#f9f8f1',3,'#9ea494')}${rect(x+7,y+7,w/2-10,24,'#eeede5',4,'#bfc2b6')}${rect(x+w/2+3,y+7,w/2-10,24,'#eeede5',4,'#bfc2b6')}<path d="M${x} ${y+41}H${x+w}V${y+h}H${x}Z" fill="#d3d8c6" stroke="#aeb6a1"/><path d="M${x+6} ${y+47}H${x+w-6}" fill="none" stroke="#b4bda8"/>${rect(x-20,y+8,13,21,'#e5d7bd',1,'#b5aa96')}${rect(x+w+7,y+8,13,21,'#e5d7bd',1,'#b5aa96')}</g>`;}
function doorway(x,y,orientation='right',size=38){let transform = orientation==='down'?`translate(${x} ${y}) rotate(90)`:`translate(${x} ${y})`;return `<g transform="${transform}"><path d="M0 0H${size}" stroke="#f3f0e8" stroke-width="9"/><path d="M0 0V${size}A${size} ${size} 0 0 0 ${size} 0" fill="none" stroke="#8f948e" stroke-width="1.2"/><path d="M0 0V${size}" stroke="#6f7770" stroke-width="2"/></g>`;}
function windowMark(x,y,length=80,vertical=false){return `<g transform="translate(${x} ${y})${vertical?' rotate(90)':''}"><path d="M0 0H${length}" stroke="#fbfdfd" stroke-width="10"/><path d="M0-4H${length}M0 4H${length}M0 0H${length}" stroke="#9bb8bd" stroke-width="1.4"/><path d="M0-5V5M${length/2}-4V4M${length}-5V5" stroke="#819ea4" stroke-width="1.4"/></g>`;}

export class PlanEditor {
  constructor(container, {onSelect=()=>{},onChange=()=>{},onViewError=()=>{}}={}) {
    this.container=container;
    this.onSelect=onSelect;
    this.onChange=onChange;
    this.onViewError=onViewError;
    this.state={rooms:clone(initialRooms),items:[],variant:'balanced'};
    this.selected='living';
    this.selectedItem=null;
    this.tool='select';this.view='2d';this.zoom=100;
    this.layers={dimensions:true,furniture:true,reference:true};
    this.history=[];this.future=[];
    this.drag=null;
    this.wallStart=null;this.wallEnd=null;
    this.roomStart=null;this.roomEnd=null;this.referenceImage=null;
    this.viewer=null;this.viewGeneration=0;this.renderFrame=null;this.renderCount=0;
    this.render();
    this.container.addEventListener('pointerdown',event=>this.pointerDown(event));
    this.container.addEventListener('pointermove',event=>this.pointerMove(event));
    this.container.addEventListener('pointerup',event=>this.pointerUp(event));
    this.container.addEventListener('pointercancel',()=>this.cancelPointer());
  }

  getState(){return clone(this.state);}
  room(){return this.state.rooms.find(room=>room.id===this.selected);}
  selectRoom(id){if(!this.state.rooms.some(room=>room.id===id))return;this.selected=id;this.selectedItem=null;this.render();this.onSelect(clone(this.room()));}
  checkpoint(){this.history.push(this.getState());if(this.history.length>40)this.history.shift();this.future=[];}
  notify(){this.onChange(this.getState());const room=this.room();this.onSelect(room?clone(room):null);}
  loadState(state){
    if(!state||!Array.isArray(state.rooms))throw new Error('Plantegningen kunne ikke leses.');
    this.state={rooms:clone(state.rooms),items:clone(state.items||[]),variant:state.variant||'balanced'};
    if(state.reference)this.state.reference=clone(state.reference);
    this.history=[];this.future=[];this.drag=null;this.selectedItem=null;this.wallStart=null;this.wallEnd=null;this.roomStart=null;this.roomEnd=null;
    this.referenceImage=null;this.viewGeneration++;this.viewer?.dispose();this.viewer=null;this.view='2d';
    this.selected=this.state.rooms[0]?.id;
    this.render();this.notify();
  }
  setReference(reference,{replace=true}={}){
    if(!reference||!Number.isFinite(reference.w)||!Number.isFinite(reference.h)||reference.w<=0||reference.h<=0)throw new Error('Plantegningen mangler gyldig målestokk.');
    this.checkpoint();
    if(reference.fileId!==this.state.reference?.fileId)this.referenceImage=null;
    this.state=replace?{rooms:[],items:[],variant:'custom',reference:clone(reference)}:{...this.state,variant:'custom',reference:clone(reference)};
    this.selected=replace?null:this.selected;this.selectedItem=null;this.drag=null;this.wallStart=null;this.roomStart=null;
    this.zoom=100;this.render();this.notify();
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
  setTool(tool){this.tool=tool;this.wallStart=null;this.wallEnd=null;this.roomStart=null;this.roomEnd=null;this.container.dataset.tool=tool;this.container.style.cursor=['window','door','wall','room'].includes(tool)?'crosshair':tool==='pan'?'grab':'default';this.render();}
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
      this.viewer=viewer;this.view='3d';viewer.setZoom?.(this.zoom);return '3d';
    }catch(error){
      if(generation===this.viewGeneration){this.view='2d';this.render();}
      throw error;
    }
  }
  setZoom(zoom){this.zoom=Math.max(50,Math.min(180,number(zoom)||100));if(this.viewer)this.viewer.setZoom?.(this.zoom);else this.render();}
  get3DStats(){return this.viewer?.getStats?.()||null;}
  resetView(){this.zoom=100;if(this.viewer)this.viewer.resetView?.();else this.render();}
  setLayers(layers){Object.assign(this.layers,layers);if(this.viewer)this.viewer.setLayers?.(this.layers);else this.render();}
  undo(){if(!this.history.length)return false;this.future.push(this.getState());this.state=this.history.pop();this.selected=this.state.rooms.find(r=>r.id===this.selected)?.id||this.state.rooms[0]?.id;this.selectedItem=null;this.render();this.notify();return true;}
  redo(){if(!this.future.length)return false;this.history.push(this.getState());this.state=this.future.pop();this.selected=this.state.rooms.find(r=>r.id===this.selected)?.id||this.state.rooms[0]?.id;this.selectedItem=null;this.render();this.notify();return true;}
  setVariant(id){
    this.checkpoint();this.state={rooms:clone(initialRooms),items:[],variant:id};
    if(id==='family'||id==='three'||id==='3'||id==='03'){
      const room=this.state.rooms.find(room=>room.id==='living');room.h=270;room.height=5.4;room.area=room.w*room.h/SCALE**2;
      this.state.rooms.push({id:'bed3',name:'Soverom 3',type:'bedroom',x:140,y:370,w:175,h:160,width:3.5,height:3.2,area:11.2,color:'#e8e6db'});
      this.state.rooms.push({id:'dining',name:'Spisestue',type:'living',x:315,y:370,w:145,h:160,width:2.9,height:3.2,area:9.28,color:'#f0e9dc'});
    } else if(id==='02'||id==='open'||id==='social') {
      const main=this.state.rooms.find(room=>room.id==='bed1');
      const second=this.state.rooms.find(room=>room.id==='bed2');
      main.h=190;second.y=290;second.h=120;
    }
    this.recalculate();this.selected='living';this.render();this.notify();
  }

  updateRoom(id,patch){
    const room=this.state.rooms.find(room=>room.id===id);if(!room)return;
    this.checkpoint();
    if(patch.name!==undefined)room.name=String(patch.name).slice(0,60);
    if(patch.type!==undefined&&ROOM_TYPES.has(patch.type))room.type=patch.type;
    if(patch.color!==undefined&&/^#[0-9a-f]{6}$/i.test(patch.color))room.color=patch.color;
    const old={x:room.x,y:room.y,w:room.w,h:room.h};
    const custom=this.state.variant==='custom'||this.state.reference;
    const minimum=custom?25:70;
    if(patch.width!==undefined)room.w=Math.min(custom?5000:660-room.x,Math.max(minimum,number(patch.width)*SCALE));
    if(patch.height!==undefined)room.h=Math.min(custom?5000:530-room.y,Math.max(minimum,number(patch.height)*SCALE));
    this.state.rooms.forEach(other=>{
      if(other.id===id)return;
      if(Math.abs(other.x-(old.x+old.w))<1&&other.y<old.y+old.h&&other.y+other.h>old.y)room.w=Math.min(room.w,old.w+other.w-minimum);
      if(Math.abs(other.y-(old.y+old.h))<1&&other.x<old.x+old.w&&other.x+other.w>old.x)room.h=Math.min(room.h,old.h+other.h-minimum);
    });
    // Shared internal boundaries move with adjacent rooms.
    const dx=room.w-old.w,dy=room.h-old.h;
    this.state.rooms.forEach(other=>{
      if(other.id===id)return;
      if(Math.abs(other.x-(old.x+old.w))<1&&other.y<old.y+old.h&&other.y+other.h>old.y){other.x+=dx;other.w-=dx;}
      if(Math.abs(other.y-(old.y+old.h))<1&&other.x<old.x+old.w&&other.x+other.w>old.x){other.y+=dy;other.h-=dy;}
    });
    this.recalculate();this.render();this.notify();
  }
  recalculate(){this.state.rooms.forEach(room=>{room.width=room.w/SCALE;room.height=room.h/SCALE;room.area=room.w*room.h/SCALE**2;});}
  addRoom({x,y,w,h,name,type='room',color='#e8e1d1'}){
    if(this.state.rooms.length>=30)throw new Error('Plantegningen kan ha maksimalt 30 rom.');
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
    this.addRoom({x,y,w,h});return true;
  }
  addItem(type){
    const room=this.room()||this.state.rooms[0];
    if(type==='room'){
      if(!room){this.setTool('room');return null;}
      if(this.state.rooms.length>=30)throw new Error('Plantegningen kan ha maksimalt 30 rom.');
      if(Math.max(room.w,room.h)<50)throw new Error('Rommet er for lite til å deles i to. Tegn et nytt rom i stedet.');
      this.checkpoint();
      const direction=room.w>=room.h?'vertical':'horizontal';const newRoom={...clone(room),id:`room-${Date.now()}`,name:'Nytt rom',type:'bedroom',color:'#e7e9dc'};
      if(direction==='vertical'){room.w=Math.max(25,Math.min(room.w-25,Math.round(room.w*.56/5)*5));newRoom.x=room.x+room.w;newRoom.w=newRoom.w-room.w;}
      else {room.h=Math.max(25,Math.min(room.h-25,Math.round(room.h*.56/5)*5));newRoom.y=room.y+room.h;newRoom.h=newRoom.h-room.h;}
      this.state.rooms.push(newRoom);this.selected=newRoom.id;this.selectedItem=null;this.recalculate();this.render();this.notify();return clone(newRoom);
    }
    if(this.state.items.length>=300)throw new Error('Plantegningen kan ha maksimalt 300 elementer.');
    this.checkpoint();const bounds=getPlanBounds(this.state);
    const item={id:uid('item'),type,x:room?room.x+room.w/2:bounds.centerX,y:room?room.y+room.h/2:bounds.centerY,rotation:0};
    if(type==='wall'){item.x-=45;item.x2=item.x+90;item.y2=item.y;}
    if(type==='window'&&room){item.x=room.x+room.w/2;item.y=room.y;}
    if(type==='door'&&room){item.x=room.x+Math.min(50,room.w/2);item.y=room.y+room.h;}
    this.state.items.push(item);this.selectedItem=item.id;this.render();this.notify();
    return clone(item);
  }
  removeSelected(){
    if(this.selectedItem){this.checkpoint();this.state.items=this.state.items.filter(item=>item.id!==this.selectedItem);this.selectedItem=null;this.render();this.notify();return true;}
    if(this.state.variant==='custom'&&this.selected){this.checkpoint();this.state.rooms=this.state.rooms.filter(room=>room.id!==this.selected);this.selected=this.state.rooms[0]?.id;this.render();this.notify();return true;}
    return false;
  }
  exportSVG(){
    let svg=this.container.querySelector('svg');
    if(!svg&&typeof document!=='undefined'){
      const originalContainer=this.container,view=this.view,zoom=this.zoom;
      try{this.container=document.createElement('div');this.view='2d';this.zoom=100;this.render();svg=this.container.querySelector('svg')?.cloneNode(true);}
      finally{this.container=originalContainer;this.view=view;this.zoom=zoom;}
    }
    if(!svg)return '';
    const result=svg.cloneNode(true);
    result.querySelectorAll('[data-resize],[data-selection],[data-reference-image]').forEach(element=>element.remove());
    result.setAttribute('xmlns',NS);
    return new XMLSerializer().serializeToString(result);
  }

  point(event){const svg=this.container.querySelector('svg');if(!svg)return null;const matrix=svg.getScreenCTM();if(!matrix)return null;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(matrix.inverse());}
  scheduleRender(){
    if(this.renderFrame!==null)return;
    const request=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,0));
    this.renderFrame=request(()=>{this.renderFrame=null;this.render();});
  }
  flushRender(){
    if(this.renderFrame!==null){(globalThis.cancelAnimationFrame||clearTimeout)(this.renderFrame);this.renderFrame=null;}
    this.render();
  }
  capture(event){this.container.setPointerCapture?.(event.pointerId);event.preventDefault?.();}
  nearestWall(point){
    let nearest=null;
    for(const wall of getWallSegments(this.state)){
      const projected=projectToWall(wall,point);
      if(!nearest||projected.distance<nearest.distance)nearest={...projected,wall};
    }
    return nearest;
  }
  pointerDown(event){
    if(event.button!==0||this.view!=='2d')return;
    const point=this.point(event);if(!point)return;
    const itemEl=event.target.closest?.('[data-item-id]');const roomEl=event.target.closest?.('[data-room-id]');
    if(this.tool==='room'){
      const end={x:snap(point.x),y:snap(point.y)};
      if(this.roomStart){if(!this.finishRoom(this.roomStart,end)){this.roomEnd=end;this.render();}return;}
      this.roomStart=end;this.roomEnd=end;
      this.drag={type:'room',start:end,bounds:getPlanBounds(this.state)};this.capture(event);this.render();return;
    }
    if(event.target.closest('[data-resize]')){
      const future=this.future;this.checkpoint();this.drag={type:'resize',start:point,room:clone(this.room()),state:this.getState(),future,bounds:getPlanBounds(this.state),moved:false};this.capture(event);return;
    }
    if(this.tool==='wall'){
      const snapped={x:Math.round(point.x/5)*5,y:Math.round(point.y/5)*5};
      if(!this.wallStart){this.wallStart=snapped;this.wallEnd=snapped;this.render();return;}
      if(Math.hypot(snapped.x-this.wallStart.x,snapped.y-this.wallStart.y)<10)return;
      this.checkpoint();const item={id:uid('item'),type:'wall',x:this.wallStart.x,y:this.wallStart.y,x2:snapped.x,y2:snapped.y,rotation:0};
      this.state.items.push(item);this.selectedItem=item.id;this.wallStart=null;this.wallEnd=null;this.render();this.notify();return;
    }
    if(['window','door','plant','sofa','table','bed'].includes(this.tool)){
      if(this.state.items.length>=300)return;
      this.checkpoint();let x=point.x,y=point.y,rotation=0;
      const closest=this.nearestWall(point);
      if(['window','door'].includes(this.tool)&&closest&&closest.distance<45){x=closest.x;y=closest.y;rotation=Math.atan2(closest.wall.y2-closest.wall.y,closest.wall.x2-closest.wall.x)*180/Math.PI;}
      const item={id:uid('item'),type:this.tool,x:snap(x),y:snap(y),rotation};this.state.items.push(item);this.selectedItem=item.id;this.render();this.notify();return;
    }
    if(itemEl){const future=this.future;this.checkpoint();this.selectedItem=itemEl.dataset.itemId;const item=this.state.items.find(item=>item.id===this.selectedItem);if(!item)return;this.drag={type:'item',start:point,item:clone(item),state:this.getState(),future,bounds:getPlanBounds(this.state),moved:false};this.capture(event);this.render();return;}
    if(roomEl){this.selected=roomEl.dataset.roomId;this.selectedItem=null;this.render();this.onSelect(clone(this.room()));}
  }
  pointerMove(event){
    if(this.view!=='2d')return;
    const point=this.point(event);if(!point)return;
    if(this.wallStart&&!this.drag){this.wallEnd={x:snap(point.x),y:snap(point.y)};this.scheduleRender();return;}
    if(this.roomStart&&!this.drag){this.roomEnd={x:snap(point.x),y:snap(point.y)};this.scheduleRender();return;}
    if(!this.drag)return;
    if(this.drag.type==='room'){this.roomEnd={x:snap(point.x),y:snap(point.y)};this.scheduleRender();return;}
    const dx=point.x-this.drag.start.x,dy=point.y-this.drag.start.y;
    this.drag.moved=this.drag.moved||Math.abs(dx)+Math.abs(dy)>.1;
    if(this.drag.type==='item'){
      const item=this.state.items.find(item=>item.id===this.drag.item.id);if(!item)return;item.x=Math.round((this.drag.item.x+dx)/5)*5;item.y=Math.round((this.drag.item.y+dy)/5)*5;
      if(item.type==='wall'){item.x2=(this.drag.item.x2??this.drag.item.x+90)+(item.x-this.drag.item.x);item.y2=(this.drag.item.y2??this.drag.item.y)+(item.y-this.drag.item.y);}
    } else {
      this.state=clone(this.drag.state);const room=this.room(),old=this.drag.room;
      const custom=this.state.variant==='custom'||this.state.reference,minimum=custom?25:70;
      const newW=Math.max(minimum,Math.min(custom?5000:660-old.x,snap(old.w+dx)));
      const newH=Math.max(minimum,Math.min(custom?5000:530-old.y,snap(old.h+dy)));
      room.w=newW;room.h=newH;
      this.state.rooms.forEach(other=>{
        if(other.id===room.id)return;
        if(Math.abs(other.x-old.x-old.w)<1&&other.y<old.y+old.h&&other.y+other.h>old.y){const delta=Math.min(newW-old.w,other.w-minimum);room.w=old.w+delta;other.x+=delta;other.w-=delta;}
        if(Math.abs(other.y-old.y-old.h)<1&&other.x<old.x+old.w&&other.x+other.w>old.x){const delta=Math.min(newH-old.h,other.h-minimum);room.h=old.h+delta;other.y+=delta;other.h-=delta;}
      });this.recalculate();
    }
    this.scheduleRender();
  }
  pointerUp(event){
    if(!this.drag)return;
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
    return clipped('living',kitchen+lounge+(!family?dining:'')+plant(168,502,17))+clipped('bed1',mainBed)+clipped('bed2',second)+clipped('bath',bathing)+(family?clipped('bed3',extra)+clipped('dining',`<g transform="translate(0 100)">${dining}</g>`):'')+clipped('hall',rect(471,421,21,54,'#e5ddcd',0,'#c0b5a2'));
  }
  lounge(x,y,scale){return `<g transform="translate(${x} ${y}) scale(${scale})">${rect(-8,-6,173,171,'#e7e2d6',9,'#d9d2c4',1)}<path d="M2 2H153M2 161H153" stroke="#d2cabc"/>${rect(0,0,65,151,'#c9cfc2',6,'#9da993')}${rect(7,5,51,45,'#e0e4d6',5,'#b0baa6')}${rect(7,54,51,44,'#e0e4d6',5,'#b0baa6')}${rect(7,102,51,42,'#e0e4d6',5,'#b0baa6')}${rect(-3,0,13,151,'#bcc6b2',3,'#9daa91')}${rect(6,-2,58,13,'#c5ceba',3,'#9daa91')}${rect(6,140,58,13,'#c5ceba',3,'#9daa91')}${rect(89,40,58,69,'#e6d8be',24,'#bba98d')}<ellipse cx="116" cy="74" rx="16" ry="17" fill="#f8f5eb" stroke="#c9bca2"/>${plant(118,75,7)}${rect(178,23,13,100,'#c7c1af',1,'#aaa593')}${rect(176,42,5,62,'#444d48',0,'#5d655b')}</g>`;}

  genericFurniture(){
    return this.state.rooms.map(room=>{
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

  itemMarkup(item){
    if(item.type==='wall'){
      const dx=(item.x2??item.x+90)-item.x,dy=(item.y2??item.y)-item.y;
      return `<g data-item-id="${clean(item.id)}" transform="translate(${item.x} ${item.y})" style="cursor:move">${this.selectedItem===item.id?`<path d="M0 0L${dx} ${dy}" stroke="#9275c6" stroke-width="13" stroke-dasharray="4 3" opacity=".5" data-selection="true"/>`:''}<path d="M0 0L${dx} ${dy}" stroke="#5a625a" stroke-width="7" stroke-linecap="square"/><path d="M0 0L${dx} ${dy}" stroke="transparent" stroke-width="20"/></g>`;
    }
    let inner='';switch(item.type){case 'window':inner=windowMark(-35,0,70);break;case 'door':inner=doorway(0,0,'right',40);break;case 'plant':inner=plant(0,0,17);break;case 'bed':inner=bed(-32,-44,64,88);break;case 'sofa':inner=rect(-42,-22,84,44,'#cbd4c3',7,'#8fa082')+rect(-35,-17,31,32,'#e1e7db',5,'#a8b59b')+rect(3,-17,31,32,'#e1e7db',5,'#a8b59b');break;default:inner=rect(-33,-22,66,44,'#e7d6b8',15,'#b6a186');}
    const bounds=item.type==='bed'?{x:-55,y:-50,w:110,h:100}:{x:-45,y:-28,w:90,h:56};
    return `<g data-item-id="${clean(item.id)}" transform="translate(${item.x} ${item.y}) rotate(${item.rotation||0})" style="cursor:move">${this.selectedItem===item.id?`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="#8467cf12" stroke="#8261c4" stroke-dasharray="4 3" rx="4" data-selection="true"/>`:''}${inner}<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="transparent" stroke="none"/></g>`;
  }

  render(){
    if(this.renderFrame!==null){(globalThis.cancelAnimationFrame||clearTimeout)(this.renderFrame);this.renderFrame=null;}
    if(this.view==='loading3d')return;
    if(this.view==='3d'&&this.viewer){this.viewer.update?.(this.getState(),{referenceImage:this.referenceImage,layers:this.layers});return;}
    this.renderCount++;
    const rooms=this.state.rooms,selected=this.room(),reference=this.state.reference;
    const example=!reference&&this.state.variant!=='custom'&&['living','bed1','bed2','bath','hall'].every(id=>rooms.some(room=>room.id===id));
    const bounds=this.drag?.bounds||getPlanBounds(this.state);
    const padding=Math.max(35,Math.min(90,Math.max(bounds.width,bounds.height)*.12));
    const zoom=this.zoom/100,viewWidth=(bounds.width+padding*2)/zoom,viewHeight=(bounds.height+padding*2)/zoom;
    const viewBox=`${bounds.centerX-viewWidth/2} ${bounds.centerY-viewHeight/2} ${viewWidth} ${viewHeight}`;
    const fontScale=Math.max(.8,Math.min(2.5,Math.max(bounds.width,bounds.height)/650));
    const referenceMarkup=reference&&this.layers.reference?`<g data-reference-image="true" pointer-events="none">${this.referenceImage?`<image href="${clean(this.referenceImage)}" x="${reference.x}" y="${reference.y}" width="${reference.w}" height="${reference.h}" preserveAspectRatio="none" opacity="${Math.max(.1,Math.min(1,reference.opacity??.7))}"/>`:`<rect x="${reference.x}" y="${reference.y}" width="${reference.w}" height="${reference.h}" fill="#fff" stroke="#d5cedf" stroke-dasharray="6 5"/>`}</g>`:'';
    const roomFills=rooms.map(room=>`<g data-room-id="${clean(room.id)}" style="cursor:pointer"><rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="${clean(room.color)}" opacity="${reference&&this.layers.reference?.25:1}"/><rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="url(#${room.type==='bath'?'tiles':'wood'})" opacity="${room.type==='bath'?.5:.22}"/></g>`).join('');
    const roomHitboxes=rooms.map(room=>`<rect data-room-id="${clean(room.id)}" x="${room.x+3}" y="${room.y+3}" width="${Math.max(1,room.w-6)}" height="${Math.max(1,room.h-6)}" fill="transparent" style="cursor:${this.tool==='select'?'pointer':'inherit'}"/>`).join('');
    const labels=this.layers.dimensions?rooms.map(room=>{
      let x=room.x+room.w/2,y=room.y+room.h-20*fontScale;
      if(example&&room.id==='living'){x=room.x+room.w*.67;y=room.y+room.h-45;}
      if(example&&room.id==='bath'){x=room.x+room.w/2;y=room.y+room.h-16;}
      if(example&&room.id==='hall'){x=room.x+room.w/2;y=room.y+room.h-30;}
      return `<g pointer-events="none" text-anchor="middle" fill="#515a50" font-family="Arial,sans-serif"><text x="${x}" y="${y}" font-size="${11.5*fontScale}" font-weight="600" paint-order="stroke" stroke="#fff" stroke-width="${reference?2:0}">${clean(room.name)}</text><text x="${x}" y="${y+16*fontScale}" font-size="${10*fontScale}" fill="#747d70" paint-order="stroke" stroke="#fff" stroke-width="${reference?2:0}">${format(room.area)} m²</text></g>`;
    }).join(''):'';
    const walls=example?rooms.map(room=>`<rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="none" stroke="#626a60" stroke-width="6" stroke-linejoin="miter"/>`).join('')+'<rect x="140" y="100" width="520" height="430" fill="none" stroke="#4e584e" stroke-width="9"/>':getWallSegments({rooms,items:[]}).map(wall=>`<path d="M${wall.x} ${wall.y}L${wall.x2} ${wall.y2}" fill="none" stroke="${wall.exterior?'#4e584e':'#626a60'}" stroke-width="${wall.exterior?7:5}"/>`).join('');
    let doors='',windows='';
    if(example){
      const bedroom1=rooms.find(room=>room.id==='bed1'),bedroom2=rooms.find(room=>room.id==='bed2'),hall=rooms.find(room=>room.id==='hall'),bathroom=rooms.find(room=>room.id==='bath');
      doors=doorway(bedroom1.x,bedroom1.y+bedroom1.h-54,'down',39)+doorway(bedroom2.x,bedroom2.y+bedroom2.h-58,'down',38)+doorway(hall.x+31,hall.y,'right',35)+doorway(bathroom.x,bathroom.y+49,'down',34)+doorway(hall.x+22,hall.y+hall.h,'right',37);
      windows=windowMark(203,100,124)+windowMark(140,193,89,true)+windowMark(140,377,91,true)+windowMark(531,100,80)+windowMark(660,143,73,true)+windowMark(660,290,75,true)+windowMark(574,530,51);
    }
    let dimensions='';
    if(this.layers.dimensions&&(rooms.length||reference)){
      const measured=rooms.length?getPlanBounds({rooms,items:[]}):bounds;
      const offset=28*fontScale,top=measured.minY-offset,left=measured.minX-offset;
      dimensions=`<g fill="none" stroke="#a8aca3" stroke-width="${.8*fontScale}" pointer-events="none"><path d="M${measured.minX} ${top}H${measured.maxX}M${measured.minX} ${top-6*fontScale}V${top+6*fontScale}M${measured.maxX} ${top-6*fontScale}V${top+6*fontScale}M${left} ${measured.minY}V${measured.maxY}M${left-6*fontScale} ${measured.minY}H${left+6*fontScale}M${left-6*fontScale} ${measured.maxY}H${left+6*fontScale}"/></g><g fill="#8e9688" font-family="Arial,sans-serif" font-size="${10*fontScale}" text-anchor="middle" pointer-events="none"><text x="${measured.centerX}" y="${top-8*fontScale}">${format(measured.width/SCALE)} m</text><text transform="translate(${left-8*fontScale} ${measured.centerY}) rotate(-90)">${format(measured.height/SCALE)} m</text></g>`;
    }
    const inset=3,handle=Math.max(8,Math.min(16,12*fontScale));
    const selection=selected&&!this.selectedItem?`<g data-selection="true"><rect x="${selected.x+inset}" y="${selected.y+inset}" width="${Math.max(1,selected.w-inset*2)}" height="${Math.max(1,selected.h-inset*2)}" fill="#8b6ac808" stroke="#9275c6" stroke-width="1.5" stroke-dasharray="5 4" pointer-events="none"/><rect data-resize="true" x="${selected.x+selected.w-handle/2}" y="${selected.y+selected.h-handle/2}" width="${handle}" height="${handle}" rx="3" fill="#fff" stroke="#8b6ac8" stroke-width="2" style="cursor:nwse-resize"/></g>`:'';
    const wallPreview=this.wallStart&&this.wallEnd?`<path d="M${this.wallStart.x} ${this.wallStart.y}L${this.wallEnd.x} ${this.wallEnd.y}" stroke="#9275c6" stroke-width="6" stroke-dasharray="5 4" pointer-events="none"/>`:'';
    let roomPreview='';
    if(this.roomStart&&this.roomEnd){
      const x=Math.min(this.roomStart.x,this.roomEnd.x),y=Math.min(this.roomStart.y,this.roomEnd.y),w=Math.abs(this.roomEnd.x-this.roomStart.x),h=Math.abs(this.roomEnd.y-this.roomStart.y);
      roomPreview=`<g pointer-events="none"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#a78bd52b" stroke="#9275c6" stroke-width="2" stroke-dasharray="5 4"/><text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${12*fontScale}" fill="#7354ac">${format(w/SCALE)} × ${format(h/SCALE)} m</text></g>`;
    }
    const body=referenceMarkup+roomFills+(this.layers.furniture?this.furniture():'')+roomHitboxes+walls+doors+windows+labels+this.state.items.map(item=>this.itemMarkup(item)).join('')+selection+wallPreview+roomPreview;
    const clips=rooms.map(room=>`<clipPath id="clip-${clean(room.id)}"><rect x="${room.x+3}" y="${room.y+3}" width="${Math.max(1,room.w-6)}" height="${Math.max(1,room.h-6)}"/></clipPath>`).join('');
    this.container.innerHTML=`<svg xmlns="${NS}" width="100%" height="100%" viewBox="${viewBox}" role="img" aria-label="Redigerbar plantegning. Velg et rom, eller tegn rom over ditt eget underlag." style="display:block;overflow:visible;touch-action:none;user-select:none"><defs>${clips}<pattern id="wood" patternUnits="userSpaceOnUse" width="16" height="90"><path d="M0 0V90M16 0V90M0 0H16M0 45H8M8 90V45" stroke="#baab8f" stroke-width=".6" fill="none"/></pattern><pattern id="tiles" patternUnits="userSpaceOnUse" width="22" height="22"><path d="M0 0H22V22H0Z" stroke="#acbec5" stroke-width=".7" fill="none"/></pattern></defs><g>${body}</g>${dimensions}</svg>`;
  }
}
