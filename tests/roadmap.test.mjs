import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor } from '../public/studio/plan.js';
import { buildRoadmap, roadmapBranch, ROADMAP_FLAGS } from '../public/studio/roadmap.js';
import { evaluatePlan } from '../public/studio/tek17-check.js';
import { validateProjectPayload } from '../lib/projects-api.mjs';

const element=()=>({innerHTML:'',dataset:{},style:{},addEventListener(){}});
const room=(id,x,y,w,h,type,name)=>({id,name,type,x,y,w,h,color:'#e8e1d1',width:w/50,height:h/50,area:w*h/2500});
const home=()=>({rooms:[room('a',0,0,200,200,'living','Stue'),room('b',200,0,200,200,'bedroom','Soverom')],items:[],variant:'custom',walls:[]});
const editorWith=plan=>{const editor=new PlanEditor(element());editor.loadState(plan);return editor;};
const project=(extra={})=>({name:'Test',municipality:'Oslo',bedrooms:2,bathrooms:1,wishes:'',variant:'01',...extra});
const answers={bearingWall:'nei',facade:false,useChange:'nei',newPipesThroughFireSeparation:false};
const status=(roadmap,id)=>[...roadmap.trunk,...roadmap.branches.soknad,...roadmap.branches.ingen].find(step=>step.id===id).status;
const SHARED='a:right|b:left';

test('a new project on the example home has only the first step done', () => {
  const editor=new PlanEditor(element());
  const roadmap=buildRoadmap(editor.getState(),project(),{example:true});
  assert.deepEqual(roadmap.trunk.map(step=>step.id),['project','ground','draw','baseline','changes','facts','check']);
  assert.deepEqual(roadmap.trunk.map(step=>step.done),[true,false,false,false,false,false,false]);
  assert.equal(roadmap.next.id,'ground');
  assert.equal(roadmap.branch,'uavklart');
  assert.deepEqual([roadmap.done,roadmap.total],[1,7],'with the branch open only the trunk counts');
});

test('the trunk ticks off as the project fills in', () => {
  const editor=editorWith(home());
  let roadmap=buildRoadmap(editor.getState(),project(),{fileCount:1});
  assert.deepEqual(['ground','draw','baseline'].map(id=>status(roadmap,id)),['done','done','next']);
  editor.setBaseline();
  roadmap=buildRoadmap(editor.getState(),project(),{fileCount:1});
  assert.deepEqual(['baseline','changes'].map(id=>status(roadmap,id)),['done','next']);
  editor.updateWall(SHARED,{status:'demolish',loadBearing:'no'});
  roadmap=buildRoadmap(editor.getState(),project(),{fileCount:1});
  assert.deepEqual(['changes','facts'].map(id=>status(roadmap,id)),['done','next']);
  assert.match(roadmap.trunk[5].text,/^0 av 4/);
  roadmap=buildRoadmap(editor.getState(),project({measures:answers}),{fileCount:1});
  assert.deepEqual(['facts','check'].map(id=>status(roadmap,id)),['done','next'],'the check is not done until it has been opened');
  roadmap=buildRoadmap(editor.getState(),project({measures:answers,roadmap:{checkSeen:true}}),{fileCount:1});
  assert.equal(status(roadmap,'check'),'done');
});

test('a traced plan counts as the ground work, and a step done out of order is still done', () => {
  const plan={...home(),reference:{fileId:'f',page:1,name:'plan.png',x:0,y:0,w:400,h:200}};
  assert.equal(status(buildRoadmap(plan,project()),'ground'),'done');
  const later=buildRoadmap(home(),project({measures:answers}));
  assert.equal(status(later,'facts'),'done');
  assert.equal(later.next.id,'ground');
});

// A drawn home with an uploaded plan, today's layout saved, and the wall between the rooms marked for demolition.
const changed=loadBearing=>{const editor=editorWith(home());editor.setBaseline();editor.updateWall(SHARED,{status:'demolish',loadBearing});return editor.getState();};
const withFile={fileCount:1};

test('removing a load-bearing wall takes the «søknad» branch, down to «Send søknad»', () => {
  const plan=changed('yes'),base=project({measures:{...answers,bearingWall:'ja'}});
  const roadmap=flags=>buildRoadmap(plan,{...base,roadmap:flags},withFile);
  const start=roadmap({checkSeen:true});
  assert.equal(start.branch,'soknad');
  assert.deepEqual(start.branches.soknad.map(step=>step.id),['professional','neighbours','documents','send']);
  assert.equal(start.branches.soknad.at(-1).title,'Send søknad');
  assert.deepEqual([start.done,start.total,start.next.id],[7,11,'professional']);
  assert.equal(roadmap({checkSeen:true,professional:true}).next.id,'neighbours');
  assert.equal(roadmap({checkSeen:true,professional:true,neighbours:true}).next.id,'documents');
  assert.equal(roadmap({checkSeen:true,professional:true,neighbours:true,briefDownloaded:true}).next.id,'send');
  const all=roadmap(Object.fromEntries(ROADMAP_FLAGS.map(flag=>[flag,true])));
  assert.deepEqual([all.done,all.total,all.next],[11,11,null]);
  assert.equal(status(all,'send'),'done');
});

test('a non-load-bearing change with every question answered takes the «ingen søknad» branch', () => {
  const roadmap=buildRoadmap(changed('no'),project({measures:answers,roadmap:{checkSeen:true}}),withFile);
  assert.equal(roadmap.branch,'ingen');
  assert.deepEqual(roadmap.branches.ingen.map(step=>step.id),['documents','ready']);
  assert.deepEqual([roadmap.done,roadmap.total,roadmap.next.id],[7,9,'documents']);
  assert.match(roadmap.branches.ingen[1].text,/veiledende/);
  const done=buildRoadmap(changed('no'),project({measures:answers,roadmap:{checkSeen:true,briefDownloaded:true}}),withFile);
  assert.deepEqual([done.done,done.total,done.next],[9,9,null]);
  assert.equal(status(done,'send'),'todo','the other branch stays out of the count');
  const switched=buildRoadmap(changed('yes'),project({measures:{...answers,bearingWall:'ja'},roadmap:{checkSeen:true,briefDownloaded:true}}),withFile);
  assert.deepEqual([status(switched,'ready'),switched.branches.ingen[0].status,status(switched,'documents')],['todo','todo','done'],'a tick from before never shows as done on the way not taken');
});

test('the branch stays open while the check has questions, and warnings follow the application steps', () => {
  const open=buildRoadmap(changed('unknown'),project({measures:answers,roadmap:{checkSeen:true}}),withFile);
  assert.equal(open.branch,'uavklart');
  assert.deepEqual([status(open,'check'),open.done,open.total],['next',6,7],'the check was opened, but it is not settled');
  const facade=project({measures:{...answers,facade:true},roadmap:{checkSeen:true}});
  const warned=buildRoadmap(changed('no'),facade,withFile);
  assert.deepEqual([warned.branch,warned.next.id,warned.total],['avklar','professional',11]);
  assert.equal(roadmapBranch(evaluatePlan(changed('no'),facade),false),'uavklart','nothing drawn, nothing decided');
});

test('the roadmap never claims approval', () => {
  const editor=editorWith(home());
  const roadmap=buildRoadmap(editor.getState(),project({measures:answers}));
  const text=[...roadmap.trunk,...roadmap.branches.soknad,...roadmap.branches.ingen].map(step=>step.title+' '+step.text).join(' ');
  assert.doesNotMatch(text,/godkjent|lovlig å|klar til innsending/i);
});

test('the server keeps roadmap ticks and drops anything else', () => {
  const payload={project:{...project(),roadmap:{neighbours:true,sent:false,hacked:'x'}},plan:{...home(),schemaVersion:4}};
  assert.deepEqual(validateProjectPayload(payload).project.roadmap,{neighbours:true});
  assert.equal(validateProjectPayload({...payload,project:project()}).project.roadmap,undefined);
});
