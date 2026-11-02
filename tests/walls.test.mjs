import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor, PLAN_VERSION } from '../public/studio/plan.js';
import { deriveWalls, deriveSceneSpec } from '../public/studio/scene-geometry.js';
import { validateProjectPayload } from '../lib/projects-api.mjs';

const element=()=>({innerHTML:'',dataset:{},style:{},addEventListener(){}});
const room=(id,x,y,w,h,type='room')=>({id,name:id,type,x,y,w,h,color:'#e8e1d1',width:w/50,height:h/50,area:w*h/2500});
const twoRooms=(extra={})=>({rooms:[room('a',0,0,200,200,'living'),room('b',200,0,200,200,'bedroom')],items:[],variant:'custom',walls:[],schemaVersion:PLAN_VERSION,...extra});
const SHARED='a:right|b:left';
const editorWith=(plan,options)=>{const editor=new PlanEditor(element(),options);editor.loadState(plan);return editor;};
const wallOf=(editor,key)=>deriveWalls(editor.getState()).find(wall=>wall.key===key);
// Resizes and moves happen inside a drag, which records history before and notifies after.
const drag=(editor,change)=>{editor.checkpoint();change();editor.notify();};

test('walls are keyed by the room sides that form them', () => {
  assert.deepEqual(deriveWalls(twoRooms()).map(wall=>wall.key).sort(),['a:bottom','a:left','a:top',SHARED,'b:bottom','b:right','b:top'].sort());
});

test('a wall note survives resizing and moving rooms while they still share the wall', () => {
  const editor=editorWith(twoRooms());
  assert.equal(editor.updateWall(SHARED,{status:'demolish',loadBearing:'yes'}),true);
  drag(editor,()=>editor.resizeRoomTo('a',250,200));
  const [a,b]=editor.getState().rooms;
  assert.deepEqual([a.w,b.x],[250,250],'the shared edge moved with the neighbour');
  assert.deepEqual([wallOf(editor,SHARED).status,wallOf(editor,SHARED).loadBearing],['demolish','yes']);
  drag(editor,()=>editor.moveRoomBy('b',0,60,{snapEdges:false}));
  assert.equal(wallOf(editor,SHARED).status,'demolish','still touching over part of the edge');
});

test('a note is dropped when its wall disappears, and undo brings it back', () => {
  const editor=editorWith(twoRooms());
  editor.updateWall(SHARED,{status:'demolish'});
  drag(editor,()=>editor.moveRoomBy('b',300,0,{snapEdges:false}));
  assert.deepEqual(editor.getState().walls,[]);
  editor.undo();
  assert.equal(wallOf(editor,SHARED).status,'demolish');
});

test('only walls that differ from the default are stored, and bad input changes nothing', () => {
  const editor=editorWith(twoRooms());
  editor.updateWall(SHARED,{status:'new'});
  assert.deepEqual(editor.getState().walls,[{key:SHARED,status:'new',loadBearing:'unknown'}]);
  assert.equal(editor.updateWall(SHARED,{status:'gone'}),false);
  assert.equal(editor.updateWall(SHARED,{loadBearing:'maybe'}),false);
  assert.equal(editor.updateWall('a:right|z:left',{status:'demolish'}),false);
  assert.deepEqual(editor.getState().walls,[{key:SHARED,status:'new',loadBearing:'unknown'}]);
  editor.updateWall(SHARED,{status:'existing'});
  assert.deepEqual(editor.getState().walls,[]);
});

test('a drawn partition wall carries its own note, removed with the wall', () => {
  const editor=editorWith(twoRooms({items:[{id:'item-p',type:'wall',x:50,y:0,x2:50,y2:200,rotation:0}]}));
  assert.equal(editor.updateWall('item:item-p',{status:'new',loadBearing:'no'}),true);
  assert.equal(wallOf(editor,'item:item-p').status,'new');
  editor.selectedItem='item-p';
  assert.equal(editor.removeSelected(),true);
  assert.deepEqual(editor.getState().walls,[]);
});

test('selecting a wall reports it, and Delete never removes the rooms around it', () => {
  const seen=[];
  const editor=editorWith(twoRooms(),{onWallSelect:wall=>seen.push(wall)});
  assert.equal(editor.selectWall(SHARED),true);
  assert.deepEqual(seen.at(-1),{key:SHARED,status:'existing',loadBearing:'unknown',partition:false,exterior:false,length:4,rooms:['a','b']});
  assert.equal(editor.removeSelected(),false);
  assert.equal(editor.getState().rooms.length,2);
  editor.updateWall(SHARED,{loadBearing:'yes'});
  assert.equal(seen.at(-1).loadBearing,'yes');
  editor.clearItemSelection();
  assert.equal(seen.at(-1),null);
});

test('loading cleans saved notes: invalid, duplicate and default entries are dropped', () => {
  const editor=editorWith(twoRooms({walls:[
    {key:SHARED,status:'demolish',loadBearing:'yes',extra:'x'},
    {key:SHARED,status:'new',loadBearing:'no'},
    {key:'a:top',status:'existing',loadBearing:'unknown'},
    {key:'a:left',status:'gone',loadBearing:'yes'},
    {status:'new',loadBearing:'yes'},
  ]}));
  assert.deepEqual(editor.getState().walls,[{key:SHARED,status:'demolish',loadBearing:'yes'}]);
});

test('marked walls count as own work before a suggestion replaces the plan', () => {
  const editor=new PlanEditor(element());
  assert.equal(editor.hasCustomEdits(),false);
  const shared=deriveWalls(editor.getState()).find(wall=>wall.roomIds.length===2);
  editor.updateWall(shared.key,{status:'demolish'});
  assert.equal(editor.hasCustomEdits(),true);
  editor.setVariant('02');
  assert.deepEqual(editor.getState().walls,[]);
});

test('3D gets the wall status', () => {
  const plan=twoRooms({walls:[{key:SHARED,status:'demolish',loadBearing:'unknown'}]});
  assert.equal(deriveSceneSpec(plan).walls.find(wall=>wall.key===SHARED).status,'demolish');
});

test('the server keeps valid wall notes and refuses broken ones', () => {
  const project={name:'Testhus',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'};
  const payload=walls=>({project,plan:twoRooms({walls})});
  assert.deepEqual(validateProjectPayload(payload([{key:SHARED,status:'demolish',loadBearing:'yes',extra:1},{key:'item:item-p',status:'new',loadBearing:'no'}])).plan.walls,
    [{key:SHARED,status:'demolish',loadBearing:'yes'},{key:'item:item-p',status:'new',loadBearing:'no'}]);
  for(const walls of [
    [{key:'a:middle',status:'new',loadBearing:'no'}],
    [{key:'<a>:right',status:'new',loadBearing:'no'}],
    [{key:SHARED,status:'gone',loadBearing:'no'}],
    [{key:SHARED,status:'new',loadBearing:'no'},{key:SHARED,status:'demolish',loadBearing:'no'}],
    Array.from({length:301},(_,i)=>({key:`item:w${i}`,status:'new',loadBearing:'no'})),
    'walls',
  ])assert.throws(()=>validateProjectPayload(payload(walls)),{code:'invalid_plan'});
});
