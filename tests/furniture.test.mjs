import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor, PLAN_VERSION, ITEM_TYPES, migratePlan } from '../public/studio/plan.js';
import { FURNITURE, FURNITURE_GROUPS, FURNITURE_LIMITS, LEGACY_SIZES, furnitureSize } from '../public/studio/furniture.js';
import { furnitureConflicts, deriveSceneSpec } from '../public/studio/scene-geometry.js';
import { FURNITURE_TYPES, validateProjectPayload } from '../lib/projects-api.mjs';

const element=()=>({innerHTML:'',dataset:{},style:{},addEventListener(){}});
const room=(id,x,y,w,h,type='living')=>({id,name:id,type,x,y,w,h,color:'#e8e1d1',width:w/50,height:h/50,area:w*h/2500});
const piece=(id,type,x,y,extra={})=>({id,type,x,y,rotation:0,...furnitureSize({type}),...extra});
const plan=(items,extra={})=>({rooms:[room('a',0,0,200,200),room('b',200,0,200,200,'bedroom')],items,variant:'custom',walls:[],schemaVersion:PLAN_VERSION,...extra});
const editorWith=state=>{const editor=new PlanEditor(element());editor.loadState(state);return editor;};
const kinds=(state,id)=>(furnitureConflicts(state).get(id)||[]).map(entry=>entry.kind).sort();
const doorOpening=editor=>deriveSceneSpec(editor.getState()).walls.flatMap(wall=>wall.openings).find(opening=>opening.id==='d');

test('every piece has a name, a group and a real size within the limits', () => {
  for (const [type,entry] of Object.entries(FURNITURE)) {
    assert.ok(entry.name&&FURNITURE_GROUPS.includes(entry.group),type);
    for (const size of [entry.width,entry.depth]) assert.ok(size>=FURNITURE_LIMITS[0]&&size<=FURNITURE_LIMITS[1],type);
  }
  assert.deepEqual([FURNITURE.bed.width,FURNITURE.bed.depth],[1.6,2],'a double bed is 160 × 200');
  assert.deepEqual(FURNITURE_TYPES,Object.keys(FURNITURE),'the server allows exactly the catalogue');
  assert.ok(Object.keys(FURNITURE).every(type=>ITEM_TYPES.includes(type)));
});

test('format 4: existing furniture keeps the size it was drawn at, also in the baseline; new pieces get real sizes', () => {
  const old={rooms:[room('a',0,0,200,200)],items:[{id:'s',type:'sofa',x:50,y:50,rotation:0},{id:'w',type:'window',x:100,y:0,rotation:0}],variant:'custom',walls:[],schemaVersion:3,baseline:{savedAt:'2026-11-03T10:00:00.000Z',rooms:[room('a',0,0,200,200)],items:[{id:'b',type:'bed',x:100,y:100,rotation:0}],walls:[]}};
  const migrated=migratePlan(old);
  assert.equal(migrated.schemaVersion,4);
  assert.deepEqual([migrated.items[0].width,migrated.items[0].depth],LEGACY_SIZES.sofa);
  assert.equal(migrated.items[1].width,undefined,'windows are untouched');
  assert.deepEqual([migrated.baseline.items[0].width,migrated.baseline.items[0].depth],LEGACY_SIZES.bed);
  const editor=editorWith(plan([]));
  editor.selectRoom('a');
  const added=editor.addItem('single-bed');
  assert.deepEqual([added.width,added.depth],[0.9,2]);
});

test('width and depth can be changed within the limits, with undo', () => {
  const editor=editorWith(plan([piece('t','table',100,100)]));
  assert.equal(editor.updateItem('t',{width:2.4,depth:1}),true);
  assert.deepEqual([editor.getState().items[0].width,editor.getState().items[0].depth],[2.4,1]);
  assert.equal(editor.updateItem('t',{width:9}),false,'too wide');
  assert.equal(editor.updateItem('t',{width:0.1}),false,'too narrow');
  editor.undo();
  assert.equal(editor.getState().items[0].width,FURNITURE.table.width);
});

test('furniture against a wall is fine; through a wall it is flagged, unless the wall is being demolished', () => {
  const against=plan([piece('bed','bed',100,50)]); // 80 × 100 units, touching the top wall
  assert.deepEqual(kinds(against,'bed'),[]);
  const through=plan([piece('bed','bed',100,45)]);
  assert.deepEqual(kinds(through,'bed'),['wall']);
  const sofa=plan([piece('s','sofa',200,100,{rotation:90})]); // across the wall between a and b
  assert.deepEqual(kinds(sofa,'s'),['wall']);
  assert.deepEqual(kinds({...sofa,walls:[{key:'a:right|b:left',status:'demolish',loadBearing:'no'}]},'s'),[]);
});

test('overlapping furniture is flagged both ways; touching pieces, a chair under a table and a plant on a dresser are not', () => {
  const overlap=plan([piece('t','table',100,100),piece('d','desk',120,110)]);
  assert.deepEqual([kinds(overlap,'t'),kinds(overlap,'d')],[['furniture'],['furniture']]);
  const touching=plan([piece('t','table',100,100),piece('d','dresser',100,100+22.5+11.25)]); // table depth 45, dresser depth 22.5
  assert.deepEqual(kinds(touching,'t'),[]);
  assert.deepEqual(kinds(plan([piece('t','table',100,100),piece('c','chair',100,115)]),'c'),[]);
  assert.deepEqual(kinds(plan([piece('k','dresser',100,100),piece('p','plant',100,100)]),'p'),[]);
});

test('furniture where a door swings is flagged, and the door says what is in its way', () => {
  // A 1 m door in the bottom wall of a, opening into a (rotation 180 puts the leaf on the room side).
  const door={id:'d',type:'door',x:100,y:200,rotation:180,width:1};
  const blocked=plan([door,piece('c','chair',100,180)]);
  assert.deepEqual(kinds(blocked,'c'),['door']);
  assert.deepEqual(furnitureConflicts(blocked).get('d'),[{kind:'furniture',id:'c'}]);
  const editor=editorWith(blocked);
  assert.deepEqual(editor.itemProblems().get('d'),['«Stol» står i veien når døren åpnes.']);
  assert.deepEqual(editor.itemProblems().get('c'),['Står i veien når en dør åpnes.']);
});

test('a mirrored door sweeps from the other end of its opening', () => {
  // Local frame of the door: hinge at x = -25 (or +25 mirrored), leaf towards +y. Rotation 180 turns +y into the room.
  // A small plant near the far corner from the default hinge is clear of the default sweep, but inside the mirrored one.
  const at=(lx,ly)=>({x:100-lx,y:200-ly}); // rotation 180 maps local (x, y) to (100 - x, 200 - y)
  const plantAt=piece('p','plant',at(20,45).x,at(20,45).y,{width:0.2,depth:0.2});
  const door={id:'d',type:'door',x:100,y:200,rotation:180,width:1};
  assert.deepEqual(kinds(plan([door,plantAt]),'p'),[]);
  assert.deepEqual(kinds(plan([{...door,mirrored:true},plantAt]),'p'),['door']);
});

test('«Bytt hengselside» moves the hinge; «Slå andre veien» keeps the hinge and opens to the other side', () => {
  const editor=editorWith(plan([{id:'d',type:'door',x:100,y:200,rotation:0,width:0.9}]));
  const before=doorOpening(editor);
  editor.selectedItem='d';
  assert.equal(editor.mirrorSelected(),true);
  const mirrored=doorOpening(editor);
  assert.notEqual(mirrored.hinge,before.hinge);
  assert.equal(mirrored.swing,before.swing);
  editor.mirrorSelected();
  editor.rotateSelected(90);
  const turned=doorOpening(editor);
  assert.equal(turned.hinge,before.hinge,'the hinge stays at the same end');
  assert.equal(turned.swing,-before.swing,'the leaf opens to the other side');
  assert.equal(editor.getState().items[0].rotation,180);
  editor.selectedItem=null;
  assert.equal(editor.mirrorSelected(),false,'only a selected door can be mirrored');
});

test('2D and 3D draw furniture at its own size', () => {
  const editor=editorWith(plan([piece('s','sofa',100,100)]));
  assert.ok(editor.itemMarkup(editor.getState().items[0]).includes(`width="${2.1*50+8}"`),'the hit box follows the 2,1 m sofa');
  const spec=deriveSceneSpec(editor.getState()).furniture.find(entry=>entry.id==='s');
  assert.deepEqual([spec.type,spec.width,spec.depth],['sofa',2.1,0.9]);
  const shelf=deriveSceneSpec(plan([piece('k','bookshelf',100,100)])).furniture.find(entry=>entry.id==='k');
  assert.deepEqual([shelf.type,shelf.height],['cabinet',1.9]);
});

test('a room the user furnishes drops its automatic furniture, but a bathroom keeps its fittings', () => {
  const rooms=[room('a',0,0,300,250),room('b',300,0,200,250,'bedroom'),room('c',0,250,150,150,'bath')];
  const auto=(state,id)=>deriveSceneSpec(state).furniture.filter(entry=>!entry.explicit&&entry.roomId===id).map(entry=>entry.type).sort();
  const empty={rooms,items:[],variant:'custom'};
  assert.ok(auto(empty,'a').includes('sofa')&&auto(empty,'b').includes('bed'));
  const furnished={...empty,items:[piece('s','sofa',150,100),piece('w','washer',50,300)]};
  assert.ok(auto(empty,'a').some(type=>['coffee','rug','plant'].includes(type)));
  assert.deepEqual(auto(furnished,'a'),['island','kitchen'],'the living room keeps its kitchen and has only the user\'s sofa');
  assert.ok(auto(furnished,'b').includes('bed'),'other rooms keep theirs');
  assert.deepEqual(auto(furnished,'c'),auto(empty,'c'),'a washer in the bathroom keeps the bath, sink and toilet');
  const editor=editorWith(furnished);
  assert.equal(editor.genericFurniture().includes('clip-a'),false,'2D skips the furnished living room');
  assert.ok(editor.genericFurniture().includes('clip-b'));
});

test('the server keeps furniture sizes and door hinges, and refuses sizes out of range', () => {
  const payload=(items)=>({project:{name:'Test',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'},plan:{...plan(items),schemaVersion:PLAN_VERSION}});
  const valid=validateProjectPayload(payload([piece('w','wardrobe',100,100,{width:1.5}),{id:'d',type:'door',x:100,y:200,rotation:0,mirrored:true}]));
  assert.deepEqual([valid.plan.items[0].width,valid.plan.items[0].depth],[1.5,0.6]);
  assert.equal(valid.plan.items[1].mirrored,true);
  assert.throws(()=>validateProjectPayload(payload([piece('w','wardrobe',100,100,{width:9})])),/møbel/i);
  assert.throws(()=>validateProjectPayload(payload([{id:'r',type:'rug',x:0,y:0,rotation:0}])));
});
