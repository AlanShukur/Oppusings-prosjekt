import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor, PLAN_VERSION, migratePlan } from '../public/studio/plan.js';
import { compareToBaseline } from '../public/studio/plan-diff.js';
import { evaluatePlan } from '../public/studio/tek17-check.js';
import { validateProjectPayload } from '../lib/projects-api.mjs';

const element=()=>({innerHTML:'',dataset:{},style:{},addEventListener(){}});
const room=(id,x,y,w,h,type='room',name=id)=>({id,name,type,x,y,w,h,color:'#e8e1d1',width:w/50,height:h/50,area:w*h/2500});
const window_=(id,x,y)=>({id,type:'window',x,y,rotation:0});
const today=()=>({rooms:[room('a',0,0,200,200,'living','Stue'),room('b',200,0,200,200,'storage','Bod')],items:[window_('w1',100,0)],walls:[]});
const SHARED='a:right|b:left';
const withBaseline=(after,before=today())=>({variant:'custom',walls:[],...after,baseline:{savedAt:'2026-11-03T10:00:00.000Z',...before}});
// Today's Stue and Bod merged into one bedroom, with a second window in the old Bod.
const merged=(extra={})=>withBaseline({rooms:[room('a',0,0,400,200,'bedroom','Soverom')],items:[window_('w1',100,0),window_('w2',300,0)],...extra});
const titled=(report,title)=>report.results.filter(result=>result.title===title);

test('no baseline means no comparison', () => {
  assert.equal(compareToBaseline({rooms:[],items:[]}),null);
});

test('an unchanged plan has no changes, and drawing noise is not a change', () => {
  const same=compareToBaseline(withBaseline(today()));
  assert.deepEqual([same.removedWalls.length,same.newWalls.length,same.newOpenings.length,same.removedOpenings.length],[0,0,0,0]);
  const nudged=today();nudged.rooms[1]={...nudged.rooms[1],x:201,w:199};nudged.items[0]={...nudged.items[0],x:108};
  const noise=compareToBaseline(withBaseline(nudged));
  assert.deepEqual([noise.removedWalls.length,noise.newWalls.length,noise.newOpenings.length],[0,0,0]);
});

test('merging two rooms removes the wall between them and nothing else', () => {
  const diff=compareToBaseline(merged());
  assert.deepEqual(diff.removedWalls.map(wall=>[wall.key,wall.length]),[[SHARED,200]]);
  assert.deepEqual(diff.newWalls,[]);
  assert.deepEqual(diff.newOpenings.map(entry=>[entry.item.id,entry.exterior]),[['w2',true]]);
});

test('moving a wall is one removed and one new wall', () => {
  const moved=today();moved.rooms=[room('a',0,0,260,200,'living'),room('b',260,0,140,200,'storage')];
  const diff=compareToBaseline(withBaseline(moved));
  assert.deepEqual(diff.removedWalls.map(wall=>wall.key),[SHARED]);
  assert.equal(diff.newWalls.filter(wall=>wall.roomIds.length===2).length,1);
});

test('the editor saves, answers on and clears the baseline, with undo', () => {
  const editor=new PlanEditor(element());
  editor.loadState({...today(),variant:'custom',schemaVersion:PLAN_VERSION});
  editor.updateWall(SHARED,{loadBearing:'yes'});
  assert.equal(editor.setBaseline(),true);
  const saved=editor.getState().baseline;
  assert.equal(saved.rooms.length,2);
  assert.deepEqual(saved.walls,[{key:SHARED,status:'existing',loadBearing:'yes'}],'notes made before saving travel with it');
  assert.ok(!Number.isNaN(Date.parse(saved.savedAt)));
  assert.equal(editor.hasCustomEdits(),true);
  assert.equal(editor.updateBaselineWall(SHARED,{loadBearing:'no'}),true);
  assert.equal(editor.getState().baseline.walls[0].loadBearing,'no');
  assert.equal(editor.updateBaselineWall(SHARED,{loadBearing:'unknown'}),true);
  assert.deepEqual(editor.getState().baseline.walls,[],'back at the default stores nothing');
  assert.equal(editor.updateBaselineWall('a:right|z:left',{loadBearing:'yes'}),false);
  assert.equal(editor.updateBaselineWall(SHARED,{loadBearing:'maybe'}),false);
  assert.equal(editor.clearBaseline(),true);
  assert.equal(editor.getState().baseline,undefined);
  editor.undo();
  assert.ok(editor.getState().baseline,'undo brings it back');
});

test('removed walls are drawn as ghosts, and the layer can hide them', () => {
  const container=element(),editor=new PlanEditor(container);
  editor.loadState({...merged(),schemaVersion:PLAN_VERSION});
  assert.equal((container.innerHTML.match(/data-removed-wall/g)||[]).length,1);
  editor.setLayers({baseline:false});
  assert.equal(container.innerHTML.includes('data-removed-wall'),false);
});

test('loading cleans the baseline, and version 2 plans migrate without one', () => {
  const editor=new PlanEditor(element());
  editor.loadState({...merged(),schemaVersion:PLAN_VERSION,baseline:{savedAt:'not a date',rooms:[room('a',0,0,200,200),{id:'bad'}],items:[window_('w1',100,0),null],walls:[{key:SHARED,status:'existing',loadBearing:'yes'},{key:7}]}});
  const baseline=editor.getState().baseline;
  assert.deepEqual([baseline.rooms.length,baseline.items.length,baseline.walls.length],[1,1,1]);
  assert.equal(baseline.savedAt,new Date(0).toISOString());
  const migrated=migratePlan({rooms:[],items:[],variant:'custom',walls:[],schemaVersion:2});
  assert.equal(migrated.schemaVersion,PLAN_VERSION);
  assert.equal('baseline' in migrated,false);
});

test('a removed wall that was load-bearing in today\'s plan needs an application', () => {
  const plan=merged();plan.baseline.walls=[{key:SHARED,status:'existing',loadBearing:'yes'}];
  const [result]=titled(evaluatePlan(plan,{}),'Fjernet bærende vegg');
  assert.equal(result.status,'soknad');
  assert.equal(result.baselineWallKey,SHARED);
  assert.match(result.message,/^Veggen mellom «Stue» og «Bod» i dagens planløsning er bærende/);
});

test('a removed wall without an answer is asked about, and the answer settles it', () => {
  const [asked]=titled(evaluatePlan(merged(),{}),'Var veggen bærende?');
  assert.equal(asked.status,'ukjent');
  assert.equal(asked.baselineWallKey,SHARED);
  const answered=merged();answered.baseline.walls=[{key:SHARED,status:'existing',loadBearing:'no'}];
  const report=evaluatePlan(answered,{});
  assert.equal(titled(report,'Var veggen bærende?').length,0);
  assert.equal(titled(report,'Fjernet bærende vegg').length,0);
});

test('facade changes found in the drawing replace the facade question', () => {
  const report=evaluatePlan(merged(),{});
  assert.equal(titled(report,'Vinduer og dører i yttervegg')[0].status,'advarsel');
  assert.equal(titled(report,'Fasadeendring').length,0);
  const extended=withBaseline({rooms:[room('a',0,0,300,200,'living','Stue'),room('b',300,0,200,200,'storage','Bod')],items:[window_('w1',100,0)]});
  assert.equal(titled(evaluatePlan(extended,{}),'Fjernet yttervegg').length,1,'pushing out the outer wall removes it');
});

test('a bod that becomes part of a bedroom is a change of use', () => {
  const report=evaluatePlan(merged(),{measures:{useChange:'nei'}});
  const [result]=titled(report,'Bod blir oppholdsrom');
  assert.equal(result.status,'soknad');
  assert.match(result.message,/«Bod» i dagens planløsning er nå en del av «Soverom»/);
  assert.equal(titled(report,'Ikke-bærende vegger').length,0,'the exemption needs no change of use');
});

test('a bathroom that was not a bathroom today counts as a new bathroom', () => {
  const plan=withBaseline({rooms:[room('a',0,0,200,200,'living','Stue'),room('b',200,0,200,200,'bath','Bad')],items:[window_('w1',100,0)]});
  assert.equal(titled(evaluatePlan(plan,{}),'Nytt bad').length,1);
  assert.equal(titled(evaluatePlan(withBaseline(today()),{}),'Nytt bad').length,0);
});

test('the server keeps a valid baseline and refuses a broken one', () => {
  const project={name:'Testhus',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'};
  const plan=baseline=>({...merged(),schemaVersion:PLAN_VERSION,baseline});
  const good=today();good.walls=[{key:SHARED,status:'existing',loadBearing:'yes'}];
  const kept=validateProjectPayload({project,plan:plan({savedAt:'2026-11-03T10:00:00.000Z',...good})}).plan.baseline;
  assert.deepEqual([kept.rooms.map(r=>r.id),kept.items.length,kept.walls.length],[['a','b'],1,1],'baseline rooms may reuse plan ids');
  for(const baseline of [
    {savedAt:'nope',...today()},
    {savedAt:'2026-11-03T10:00:00.000Z',...today(),rooms:'x'},
    {savedAt:'2026-11-03T10:00:00.000Z',...today(),rooms:[room('a',0,0,200,200),room('a',200,0,200,200)]},
    {savedAt:'2026-11-03T10:00:00.000Z',...today(),walls:[{key:'a:middle',status:'existing',loadBearing:'yes'}]},
  ])assert.throws(()=>validateProjectPayload({project,plan:plan(baseline)}),{code:'invalid_plan'});
});
