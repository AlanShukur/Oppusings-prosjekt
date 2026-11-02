import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor, initialRooms, exampleOpenings, upgradeExamplePlan } from '../public/studio/plan.js';
import { deriveWalls, deriveSceneSpec, assignOpenings } from '../public/studio/scene-geometry.js';

const target=(selector)=>({closest(query){return query===selector?{dataset:{}}:null;}});
const event=(x,y,extra={})=>({button:0,clientX:x,clientY:y,pointerId:1,target:{closest(){return null;}},preventDefault(){},...extra});
function createEditor(options={}){
  const container={innerHTML:'',dataset:{},style:{},addEventListener(){},setPointerCapture(){}};
  const editor=new PlanEditor(container,options);
  editor.point=input=>({x:input.clientX,y:input.clientY});
  return {editor,container};
}
const room=(id,x,y,w,h,type='room')=>({id,name:id,type,x,y,w,h,color:'#e8e1d1',width:w/50,height:h/50,area:w*h/2500});

test('shared walls are merged even when the split point is a non-terminating fraction', () => {
  const walls=deriveWalls({rooms:[room('a',0,0,300,430),room('b',300,0,200,160),room('c',300,160,200,270)],items:[]});
  const shared=walls.filter(wall=>wall.x===300&&wall.x2===300);
  assert.equal(shared.length,2);
  assert.ok(shared.every(wall=>wall.roomIds.length===2&&!wall.exterior));
  const spec=deriveSceneSpec({rooms:[room('a',0,0,300,430),room('b',300,0,200,160),room('c',300,160,200,270)],items:[{id:'d',type:'door',x:300,y:80,rotation:90}],variant:'custom'});
  const doorWalls=spec.walls.filter(wall=>wall.openings.some(opening=>opening.id==='d'));
  assert.equal(doorWalls.length,1);
  assert.deepEqual(doorWalls[0].roomIds,['a','b']);
});

test('the example plan has one living-room wall shared with each neighbour', () => {
  const walls=deriveWalls({rooms:structuredClone(initialRooms),items:[]});
  assert.equal(walls.filter(wall=>wall.roomIds.includes('living')&&wall.roomIds.length===2).length,3);
});

test('drag-resizing a room moves every neighbour on that edge by the same amount', () => {
  const {editor}=createEditor();
  editor.pointerDown(event(460,530,{target:target('[data-resize]')}));
  editor.pointerMove(event(500,530));
  editor.pointerUp(event(500,530));
  const rooms=Object.fromEntries(editor.getState().rooms.map(r=>[r.id,r]));
  const edge=rooms.living.x+rooms.living.w;
  assert.equal(rooms.bed1.x,edge);assert.equal(rooms.bed2.x,edge);assert.equal(rooms.hall.x,edge);
  assert.equal(editor.getState().items.find(item=>item.id==='example-door-bed1').x,edge);
});

test('a neighbour that only partly shares an edge freezes it instead of creating an overlap', () => {
  const notices=[];
  const {editor}=createEditor({onNotice:message=>notices.push(message)});
  editor.loadState({rooms:[room('a',0,0,100,100),room('b',100,0,100,200),room('c',0,100,100,100)],items:[],variant:'custom'});
  editor.updateRoom('a',{width:1.6});
  const rooms=Object.fromEntries(editor.getState().rooms.map(r=>[r.id,r]));
  assert.equal(rooms.a.w,100);assert.equal(rooms.b.x,100);
  assert.equal(notices.length,1);
});

test('renaming a room never resizes it', () => {
  const {editor}=createEditor();
  editor.loadState({rooms:[room('a',0,0,100,100),room('b',100,0,100,200),room('c',0,100,100,100)],items:[],variant:'custom'});
  const before=JSON.stringify(editor.getState().rooms.map(({x,y,w,h})=>[x,y,w,h]));
  editor.updateRoom('a',{name:'Kontor',color:'#e4e9df'});
  assert.equal(JSON.stringify(editor.getState().rooms.map(({x,y,w,h})=>[x,y,w,h])),before);
});

test('the example home keeps its doors and windows when the user draws a room', () => {
  const {editor}=createEditor();
  const before=editor.getState().items.length;
  assert.equal(before,12);
  editor.addRoom({x:700,y:100,w:100,h:100});
  assert.equal(editor.getState().variant,'custom');
  assert.equal(editor.getState().items.length,before);
  const openings=deriveSceneSpec(editor.getState()).walls.flatMap(wall=>wall.openings);
  assert.equal(openings.length,before);
  assert.ok(openings.every(opening=>!opening.synthetic));
});

test('every example variant attaches all openings and gives every bedroom an exterior window', () => {
  for(const variant of ['01','02','03']){
    const {editor}=createEditor();
    editor.setVariant(variant);
    const state=editor.getState();
    const entries=assignOpenings(state);
    assert.ok(entries.every(entry=>!entry.offWall),`variant ${variant}`);
    for(const bedroom of state.rooms.filter(r=>r.type==='bedroom'))assert.ok(entries.some(entry=>entry.item.type==='window'&&entry.exterior&&entry.roomIds.includes(bedroom.id)),`${variant}/${bedroom.id}`);
    const hallDoor=entries.find(entry=>entry.item.id==='example-door-hall');
    assert.ok(hallDoor.roomIds.includes('hall')&&!hallDoor.roomIds.includes('bed2'),'the entré opens to the living area, not a bedroom');
  }
});

test('windows and doors stay on their wall when a room is resized', () => {
  const {editor}=createEditor();
  editor.updateRoom('bed1',{width:3});
  const state=editor.getState();
  const bed1=state.rooms.find(r=>r.id==='bed1');
  const window=state.items.find(item=>item.id==='example-window-bed1-2');
  assert.equal(window.x,bed1.x+bed1.w);
  assert.ok(assignOpenings(state).every(entry=>!entry.offWall));
});

test('legacy example projects get real openings on load; own plans are untouched', () => {
  const legacy=upgradeExamplePlan({rooms:structuredClone(initialRooms),items:[],variant:'01'});
  assert.equal(legacy.items.length,exampleOpenings(initialRooms).length);
  const custom={rooms:[room('a',0,0,100,100)],items:[],variant:'custom'};
  assert.equal(upgradeExamplePlan(custom),custom);
});

test('the wall tool respects the 300-element limit the server enforces', () => {
  const notices=[];
  const {editor}=createEditor({onNotice:message=>notices.push(message)});
  editor.loadState({rooms:[room('a',0,0,400,400)],items:Array.from({length:300},(_,i)=>({id:`p${i}`,type:'plant',x:10,y:10,rotation:0})),variant:'custom'});
  editor.setTool('wall');
  editor.pointerDown(event(50,50));editor.pointerDown(event(150,50));
  assert.equal(editor.getState().items.length,300);
  assert.equal(notices.length,1);
});

test('doors slide along walls while dragged and are flagged when pulled off a wall', () => {
  const {editor,container}=createEditor();
  editor.loadState({rooms:[room('a',0,0,300,200)],items:[],variant:'custom'});
  editor.setTool('door');editor.pointerDown(event(150,205));
  const door=editor.getState().items[0];
  assert.equal(door.y,200);
  editor.setTool('select');
  const itemTarget={closest(query){return query==='[data-item-id]'?{dataset:{itemId:door.id}}:null;}};
  editor.pointerDown(event(150,200,{target:itemTarget}));editor.pointerMove(event(190,230));editor.pointerUp(event(190,230));
  assert.deepEqual([editor.getState().items[0].x,editor.getState().items[0].y],[190,200]);
  editor.pointerDown(event(190,200,{target:itemTarget}));editor.pointerUp(event(190,400));
  assert.ok(container.innerHTML.includes('Står ikke på en vegg'));
});

test('placing a window away from any wall is refused with feedback', () => {
  const notices=[];
  const {editor}=createEditor({onNotice:message=>notices.push(message)});
  editor.loadState({rooms:[room('a',0,0,400,400)],items:[],variant:'custom'});
  editor.setTool('window');editor.pointerDown(event(200,200));
  assert.equal(editor.getState().items.length,0);
  assert.equal(notices.length,1);
});

test('3D door openings are centred on the 2D symbol and swing to the same side', () => {
  const spec=deriveSceneSpec({rooms:[room('a',0,0,300,200)],items:[{id:'d',type:'door',x:100,y:200,rotation:0}],variant:'custom'});
  const opening=spec.walls.flatMap(wall=>wall.openings)[0];
  assert.ok(Math.abs(opening.start-(100-21)/50)<1e-9&&Math.abs(opening.end-(100+21)/50)<1e-9);
  assert.deepEqual([opening.hinge,opening.swing],['start',1]);
  const flipped=deriveSceneSpec({rooms:[room('a',0,0,300,200)],items:[{id:'d',type:'door',x:100,y:200,rotation:180}],variant:'custom'}).walls.flatMap(wall=>wall.openings)[0];
  assert.deepEqual([flipped.hinge,flipped.swing],['end',-1]);
});

test('window size and sill height drive the 3D opening', () => {
  const spec=deriveSceneSpec({rooms:[room('a',0,0,300,200)],items:[{id:'w',type:'window',x:150,y:0,rotation:0,width:2,height:1.5,sillHeight:.6}],variant:'custom'});
  const opening=spec.walls.flatMap(wall=>wall.openings)[0];
  assert.ok(Math.abs(opening.end-opening.start-2)<1e-9);
  assert.equal(opening.bottom,.6);assert.ok(Math.abs(opening.top-2.1)<1e-9);
});

test('a second finger does not start a second gesture or wipe the redo stack', () => {
  const {editor}=createEditor();
  editor.loadState({rooms:[room('a',0,0,400,400)],items:[{id:'s1',type:'sofa',x:100,y:100,rotation:0},{id:'s2',type:'sofa',x:300,y:300,rotation:0}],variant:'custom'});
  editor.updateRoom('a',{name:'B'});editor.undo();
  const on=id=>({closest(query){return query==='[data-item-id]'?{dataset:{itemId:id}}:null;}});
  editor.pointerDown(event(100,100,{pointerId:1,target:on('s1')}));
  editor.pointerDown(event(300,300,{pointerId:2,target:on('s2')}));
  editor.pointerUp(event(300,300,{pointerId:2}));editor.pointerUp(event(100,100,{pointerId:1}));
  assert.equal(editor.history.length,0);
  assert.equal(editor.redo(),true);
});

test('furniture rotates, doors flip, and items can be duplicated and nudged', () => {
  const {editor}=createEditor();
  editor.loadState({rooms:[room('a',0,0,400,300)],items:[{id:'s',type:'sofa',x:100,y:100,rotation:0},{id:'d',type:'door',x:200,y:300,rotation:0}],variant:'custom'});
  editor.selectedItem='s';editor.rotateSelected(90);
  assert.equal(editor.getState().items[0].rotation,90);
  editor.selectedItem='d';editor.rotateSelected(90);
  assert.equal(editor.getState().items[1].rotation,180);
  const copy=editor.duplicateSelected();
  assert.notEqual(copy.id,'d');assert.equal(copy.y,300);
  editor.nudgeSelected(10,20);
  assert.equal(editor.getState().items.at(-1).y,300,'a door nudged off its wall snaps back onto it');
});

test('own rooms can be moved; edges snap to the neighbour and its windows follow', () => {
  const {editor}=createEditor();
  editor.loadState({rooms:[room('a',0,0,200,200),room('b',300,0,200,200)],items:[{id:'w',type:'window',x:400,y:0,rotation:0}],variant:'custom'});
  const on={closest(query){return query==='[data-room-id]'?{dataset:{roomId:'b'}}:null;}};
  editor.pointerDown(event(400,100,{target:on}));editor.pointerMove(event(305,100));editor.pointerUp(event(305,100));
  const state=editor.getState();
  assert.equal(state.rooms[1].x,200,'snapped onto the neighbour edge');
  assert.equal(state.items[0].x,300);
  assert.equal(deriveWalls(state).filter(wall=>wall.roomIds.length===2).length,1);
});

test('reference opacity changes do not add undo steps or reset zoom', () => {
  const {editor}=createEditor();
  editor.setReference({fileId:'f',name:'p.png',mimeType:'image/png',page:1,pixelWidth:100,pixelHeight:100,x:0,y:0,w:500,h:500,opacity:.7});
  editor.setZoom(150);const history=editor.history.length;
  editor.setReferenceOpacity(.4);
  assert.equal(editor.history.length,history);assert.equal(editor.zoom,150);
  assert.equal(editor.getState().reference.opacity,.4);
});
