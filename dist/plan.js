const NS = 'http://www.w3.org/2000/svg';
const SCALE = 50;
const clone = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const format = value => Number(value).toLocaleString('nb-NO', {maximumFractionDigits: 1});

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
  constructor(container, {onSelect=()=>{},onChange=()=>{}}={}) {
    this.container=container;
    this.onSelect=onSelect;
    this.onChange=onChange;
    this.state={rooms:clone(initialRooms),items:[],variant:'balanced'};
    this.selected='living';
    this.selectedItem=null;
    this.tool='select';this.view='2d';this.zoom=100;
    this.layers={dimensions:true,furniture:true};
    this.history=[];this.future=[];
    this.drag=null;
    this.wallStart=null;this.wallEnd=null;
    this.render();
    this.container.addEventListener('pointerdown',event=>this.pointerDown(event));
    this.container.addEventListener('pointermove',event=>this.pointerMove(event));
    this.container.addEventListener('pointerup',()=>this.pointerUp());
    this.container.addEventListener('pointercancel',()=>this.pointerUp());
  }

  getState(){return clone(this.state);}
  room(){return this.state.rooms.find(room=>room.id===this.selected);}
  selectRoom(id){if(!this.state.rooms.some(room=>room.id===id))return;this.selected=id;this.selectedItem=null;this.render();this.onSelect(clone(this.room()));}
  checkpoint(){this.history.push(this.getState());if(this.history.length>40)this.history.shift();this.future=[];}
  notify(){this.onChange(this.getState());const room=this.room();if(room)this.onSelect(clone(room));}
  loadState(state){if(!state||!Array.isArray(state.rooms))return;this.state={rooms:clone(state.rooms),items:clone(state.items||[]),variant:state.variant||'balanced'};this.selected=this.state.rooms[0]?.id;this.render();this.notify();}
  setTool(tool){this.tool=tool;this.wallStart=null;this.wallEnd=null;this.container.dataset.tool=tool;this.container.style.cursor=['window','door','wall'].includes(tool)?'crosshair':tool==='pan'?'grab':'default';this.render();}
  setView(view){this.view=view;this.render();}
  setZoom(zoom){this.zoom=Math.max(50,Math.min(180,number(zoom)||100));this.render();}
  resetView(){this.zoom=100;this.view='2d';this.render();}
  setLayers(layers){Object.assign(this.layers,layers);this.render();}
  undo(){if(!this.history.length)return false;this.future.push(this.getState());this.state=this.history.pop();this.render();this.notify();return true;}
  redo(){if(!this.future.length)return false;this.history.push(this.getState());this.state=this.future.pop();this.render();this.notify();return true;}
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
    if(patch.color!==undefined&&/^#[0-9a-f]{6}$/i.test(patch.color))room.color=patch.color;
    const old={x:room.x,y:room.y,w:room.w,h:room.h};
    if(patch.width!==undefined)room.w=Math.min(660-room.x,Math.max(70,number(patch.width)*SCALE));
    if(patch.height!==undefined)room.h=Math.min(530-room.y,Math.max(70,number(patch.height)*SCALE));
    this.state.rooms.forEach(other=>{
      if(other.id===id)return;
      if(Math.abs(other.x-(old.x+old.w))<1&&other.y<old.y+old.h&&other.y+other.h>old.y)room.w=Math.min(room.w,old.w+other.w-70);
      if(Math.abs(other.y-(old.y+old.h))<1&&other.x<old.x+old.w&&other.x+other.w>old.x)room.h=Math.min(room.h,old.h+other.h-70);
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
  addItem(type){
    this.checkpoint();const room=this.room()||this.state.rooms[0];
    if(type==='room'){
      const direction=room.w>=room.h?'vertical':'horizontal';const newRoom={...clone(room),id:`room-${Date.now()}`,name:'Nytt rom',type:'bedroom',color:'#e7e9dc'};
      if(direction==='vertical'){room.w=Math.round(room.w*.56/5)*5;newRoom.x=room.x+room.w;newRoom.w=newRoom.w-room.w;}
      else {room.h=Math.round(room.h*.56/5)*5;newRoom.y=room.y+room.h;newRoom.h=newRoom.h-room.h;}
      this.state.rooms.push(newRoom);this.selected=newRoom.id;this.selectedItem=null;this.recalculate();this.render();this.notify();return clone(newRoom);
    }
    const item={id:`item-${Date.now()}-${this.state.items.length}`,type,x:room.x+room.w/2,y:room.y+room.h/2,rotation:0};
    if(type==='wall'){item.x-=45;item.x2=item.x+90;item.y2=item.y;}
    if(type==='window'){item.x=room.x+room.w/2;item.y=room.y;}
    if(type==='door'){item.x=room.x+Math.min(50,room.w/2);item.y=room.y+room.h;}
    this.state.items.push(item);this.selectedItem=item.id;this.render();this.notify();
    return clone(item);
  }
  removeSelected(){if(!this.selectedItem)return false;this.checkpoint();this.state.items=this.state.items.filter(item=>item.id!==this.selectedItem);this.selectedItem=null;this.render();this.notify();return true;}
  exportSVG(){const svg=this.container.querySelector('svg');if(!svg)return '';const result=svg.cloneNode(true);result.querySelectorAll('[data-resize],[data-selection]').forEach(el=>el.remove());result.setAttribute('xmlns',NS);return new XMLSerializer().serializeToString(result);}

  point(event){const svg=this.container.querySelector('svg');const matrix=svg.getScreenCTM();const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(matrix.inverse());}
  pointerDown(event){
    if(event.button!==0||this.view==='3d')return;
    const point=this.point(event);const itemEl=event.target.closest('[data-item-id]');const roomEl=event.target.closest('[data-room-id]');
    if(event.target.closest('[data-resize]')){
      this.checkpoint();this.drag={type:'resize',start:point,room:clone(this.room()),state:this.getState()};this.container.setPointerCapture(event.pointerId);event.preventDefault();return;
    }
    if(this.tool==='wall'){
      const snapped={x:Math.round(point.x/5)*5,y:Math.round(point.y/5)*5};
      if(!this.wallStart){this.wallStart=snapped;this.wallEnd=snapped;this.render();return;}
      if(Math.hypot(snapped.x-this.wallStart.x,snapped.y-this.wallStart.y)<10)return;
      this.checkpoint();const item={id:`item-${Date.now()}`,type:'wall',x:this.wallStart.x,y:this.wallStart.y,x2:snapped.x,y2:snapped.y,rotation:0};
      this.state.items.push(item);this.selectedItem=item.id;this.wallStart=null;this.wallEnd=null;this.render();this.notify();return;
    }
    if(['window','door','plant','sofa','table','bed'].includes(this.tool)){
      this.checkpoint();let x=point.x,y=point.y;const walls=[{n:'top',d:Math.abs(y-100),x,y:100,r:0},{n:'bottom',d:Math.abs(y-530),x,y:530,r:0},{n:'left',d:Math.abs(x-140),x:140,y,r:90},{n:'right',d:Math.abs(x-660),x:660,y,r:90},{n:'inner',d:Math.abs(x-460),x:460,y,r:90}];walls.sort((a,b)=>a.d-b.d);const closest=walls[0];
      if(['window','door'].includes(this.tool)&&closest.d<45){x=closest.x;y=closest.y;}
      const item={id:`item-${Date.now()}`,type:this.tool,x:Math.round(x/5)*5,y:Math.round(y/5)*5,rotation:['door','window'].includes(this.tool)?closest.r:0};this.state.items.push(item);this.selectedItem=item.id;this.render();this.notify();return;
    }
    if(itemEl){this.checkpoint();this.selectedItem=itemEl.dataset.itemId;const item=this.state.items.find(item=>item.id===this.selectedItem);this.drag={type:'item',start:point,item:clone(item)};this.container.setPointerCapture(event.pointerId);this.render();return;}
    if(roomEl){this.selected=roomEl.dataset.roomId;this.selectedItem=null;this.render();this.onSelect(clone(this.room()));}
  }
  pointerMove(event){
    if(this.wallStart&&!this.drag){const point=this.point(event);this.wallEnd={x:Math.round(point.x/5)*5,y:Math.round(point.y/5)*5};this.render();return;}
    if(!this.drag)return;const point=this.point(event);const dx=point.x-this.drag.start.x,dy=point.y-this.drag.start.y;
    if(this.drag.type==='item'){
      const item=this.state.items.find(item=>item.id===this.drag.item.id);if(!item)return;item.x=Math.round((this.drag.item.x+dx)/5)*5;item.y=Math.round((this.drag.item.y+dy)/5)*5;
      if(item.type==='wall'){item.x2=(this.drag.item.x2??this.drag.item.x+90)+(item.x-this.drag.item.x);item.y2=(this.drag.item.y2??this.drag.item.y)+(item.y-this.drag.item.y);}
    } else {
      this.state=clone(this.drag.state);const room=this.room(),old=this.drag.room;
      const newW=Math.max(70,Math.min(660-old.x,Math.round((old.w+dx)/5)*5));
      const newH=Math.max(70,Math.min(530-old.y,Math.round((old.h+dy)/5)*5));
      room.w=newW;room.h=newH;
      this.state.rooms.forEach(other=>{
        if(other.id===room.id)return;
        if(Math.abs(other.x-old.x-old.w)<1&&other.y<old.y+old.h&&other.y+other.h>old.y){const delta=Math.min(newW-old.w,other.w-70);room.w=old.w+delta;other.x+=delta;other.w-=delta;}
        if(Math.abs(other.y-old.y-old.h)<1&&other.x<old.x+old.w&&other.x+other.w>old.x){const delta=Math.min(newH-old.h,other.h-70);room.h=old.h+delta;other.y+=delta;other.h-=delta;}
      });this.recalculate();
    }
    this.render();
  }
  pointerUp(){if(!this.drag)return;this.drag=null;this.notify();}

  furniture(){
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
    const rooms=this.state.rooms;
    const selected=this.room();
    const zoom=this.zoom/100;
    const viewWidth=800/zoom,viewHeight=630/zoom;
    const viewBox=`${400-viewWidth/2} ${315-viewHeight/2} ${viewWidth} ${viewHeight}`;
    const roomFills=rooms.map(room=>`<g data-room-id="${clean(room.id)}" style="cursor:pointer"><rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="${clean(room.color)}"/><rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="url(#${room.type==='bath'?'tiles':'wood'})" opacity="${room.type==='bath'?.5:.22}"/></g>`).join('');
    const roomHitboxes=rooms.map(room=>`<rect data-room-id="${clean(room.id)}" x="${room.x+5}" y="${room.y+5}" width="${Math.max(1,room.w-10)}" height="${Math.max(1,room.h-10)}" fill="transparent" style="cursor:${this.tool==='select'?'pointer':'inherit'}"/>`).join('');
    const labels=this.layers.dimensions?rooms.map(room=>{
      let x=room.x+room.w/2,y=room.y+room.h-20;
      if(room.id==='living'){x=room.x+room.w*.67;y=room.y+room.h-45;}
      if(room.id==='bath'){x=room.x+room.w/2;y=room.y+room.h-16;}
      if(room.id==='hall'){x=room.x+room.w/2;y=room.y+room.h-30;}
      return `<g pointer-events="none" text-anchor="middle" fill="#515a50" font-family="Inter,Arial,sans-serif"><text x="${x}" y="${y}" font-size="11.5" font-weight="600">${clean(room.name)}</text><text x="${x}" y="${y+16}" font-size="10" fill="#7c8377">${format(room.area)} m²</text></g>`;
    }).join(''):'';
    const walls=rooms.map(room=>`<rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="none" stroke="#626a60" stroke-width="6" stroke-linejoin="miter"/>`).join('')+`<rect x="140" y="100" width="520" height="430" fill="none" stroke="#4e584e" stroke-width="9"/>`;
    const bedroom1=rooms.find(r=>r.id==='bed1'),bedroom2=rooms.find(r=>r.id==='bed2'),hall=rooms.find(r=>r.id==='hall'),bathroom=rooms.find(r=>r.id==='bath');
    const doors=doorway(bedroom1.x,bedroom1.y+bedroom1.h-54,'down',39)+doorway(bedroom2.x,bedroom2.y+bedroom2.h-58,'down',38)+doorway(hall.x+31,hall.y,'right',35)+doorway(bathroom.x,bathroom.y+49,'down',34)+doorway(hall.x+22,hall.y+hall.h,'right',37);
    const windows=windowMark(203,100,124)+windowMark(140,193,89,true)+windowMark(140,377,91,true)+windowMark(531,100,80)+windowMark(660,143,73,true)+windowMark(660,290,75,true)+windowMark(574,530,51);
    const dimensions=this.layers.dimensions?`<g fill="none" stroke="#a8aca3" stroke-width=".8"><path d="M140 69H660M140 61V80M660 61V80M140 88V58M660 88V58M108 100V530M100 100H117M100 530H117M128 100H96M128 530H96"/><path d="M140 69l5-3m-5 3 5 3m515-3-5-3m5 3-5 3"/></g><g fill="#8e9688" font-family="Inter,Arial,sans-serif" font-size="10" text-anchor="middle"><text x="400" y="60">10,40 m</text><text transform="translate(96 315) rotate(-90)">8,60 m</text><text x="300" y="557">${format(rooms[0]?.width||6.4)} m</text><text x="560" y="557">4,00 m</text></g>`:'';
    const selection=this.view==='2d'&&selected&&!this.selectedItem?`<g data-selection="true"><rect x="${selected.x+5}" y="${selected.y+5}" width="${selected.w-10}" height="${selected.h-10}" fill="#8b6ac808" stroke="#9275c6" stroke-width="1.5" stroke-dasharray="5 4" pointer-events="none"/><rect data-resize="true" x="${selected.x+selected.w-10}" y="${selected.y+selected.h-10}" width="12" height="12" rx="3" fill="#fff" stroke="#8b6ac8" stroke-width="2" style="cursor:nwse-resize"/><path d="M${selected.x+selected.w-6} ${selected.y+selected.h-2}l4-4" stroke="#8b6ac8" stroke-width="1" pointer-events="none"/></g>`:'';
    const wallPreview=this.wallStart&&this.wallEnd?`<path d="M${this.wallStart.x} ${this.wallStart.y}L${this.wallEnd.x} ${this.wallEnd.y}" stroke="#9275c6" stroke-width="6" stroke-dasharray="5 4" pointer-events="none"/>`:'';
    const body=roomFills+(this.layers.furniture?this.furniture():'')+roomHitboxes+walls+doors+windows+labels+this.state.items.map(item=>this.itemMarkup(item)).join('')+selection+wallPreview;
    const isoWalls=this.view==='3d'?`<g fill="#e1e5da" stroke="#9da694" stroke-width="1"><path d="M140 100L122 68H642L660 100Z"/><path d="M140 100L122 68V498L140 530Z" fill="#c5cdbd"/><path d="M660 100L642 68V498L660 530Z" fill="#cbd2c4" opacity=".9"/><path d="M${bedroom1.x} 100l-18-32V${bedroom2.y+bedroom2.h-32}l18 32Z" fill="#d3dacb" opacity=".7"/><path d="M${bedroom2.x} ${bedroom2.y}l-18-32H642l18 32Z" fill="#e7ebe1" opacity=".85"/></g>`:'';
    const transform=this.view==='3d'?'translate(400 335) rotate(-27) skewX(25) scale(.94 .72) translate(-400 -315)':'';
    const clips=rooms.map(room=>`<clipPath id="clip-${clean(room.id)}"><rect x="${room.x+5}" y="${room.y+5}" width="${Math.max(1,room.w-10)}" height="${Math.max(1,room.h-10)}"/></clipPath>`).join('');
    this.container.innerHTML=`<svg xmlns="${NS}" width="100%" height="100%" viewBox="${viewBox}" role="img" aria-label="Redigerbar plantegning. Velg et rom for å endre egenskaper." style="display:block;overflow:visible;touch-action:none;user-select:none"><defs>${clips}<pattern id="wood" patternUnits="userSpaceOnUse" width="16" height="90"><path d="M0 0V90M16 0V90M0 0H16M0 45H8M8 90V45" stroke="#baab8f" stroke-width=".6" fill="none"/></pattern><pattern id="tiles" patternUnits="userSpaceOnUse" width="22" height="22"><path d="M0 0H22V22H0Z" stroke="#acbec5" stroke-width=".7" fill="none"/></pattern><filter id="plan-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#29332c" flood-opacity=".07"/></filter></defs><g transform="${transform}" filter="url(#plan-shadow)">${body}${isoWalls}</g>${this.view==='2d'?dimensions:''}</svg>`;
  }
}
