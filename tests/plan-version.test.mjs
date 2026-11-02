import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor, PLAN_VERSION, migratePlan, initialRooms, exampleOpenings } from '../public/studio/plan.js';
import { PLAN_VERSION as SERVER_PLAN_VERSION, validateProjectPayload } from '../lib/projects-api.mjs';

const element=()=>({innerHTML:'',dataset:{},style:{},addEventListener(){}});
const room=(id,x,y,w,h,type='room')=>({id,name:id,type,x,y,w,h,color:'#e8e1d1',width:w/50,height:h/50,area:w*h/2500});
const legacyExample=()=>({rooms:structuredClone(initialRooms),items:[],variant:'01'});
const project={name:'Testhus',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'};

test('client and server agree on the plan format version', () => {
  assert.equal(SERVER_PLAN_VERSION,PLAN_VERSION);
});

test('a plan saved before versioning is migrated and stamped without changing the input', () => {
  const legacy=legacyExample(),before=JSON.stringify(legacy);
  const migrated=migratePlan(legacy);
  assert.equal(migrated.schemaVersion,PLAN_VERSION);
  assert.equal(migrated.items.length,exampleOpenings(initialRooms).length);
  assert.equal(JSON.stringify(legacy),before);
  const custom={rooms:[room('a',0,0,100,100)],items:[],variant:'custom'};
  assert.deepEqual(migratePlan(custom),{...custom,schemaVersion:PLAN_VERSION});
});

test('a current plan passes through unchanged, so migrating twice changes nothing', () => {
  const current=migratePlan(legacyExample());
  assert.deepEqual(migratePlan(current),current);
});

test('plans from a newer Romly and broken versions are refused', () => {
  const plan=schemaVersion=>({rooms:[],items:[],variant:'custom',schemaVersion});
  assert.throws(()=>migratePlan(plan(PLAN_VERSION+1)),{code:'plan_too_new'});
  for(const version of [-1,1.5,'1',null])assert.throws(()=>migratePlan(plan(version)),{code:'invalid_plan'},String(version));
});

test('the editor saves the version and migrates what it loads', () => {
  const editor=new PlanEditor(element());
  assert.equal(editor.getState().schemaVersion,PLAN_VERSION);
  editor.loadState(legacyExample());
  assert.equal(editor.getState().schemaVersion,PLAN_VERSION);
  assert.ok(editor.getState().items.some(item=>item.type==='door'));
});

test('doors and windows deleted from an example plan stay deleted after reopening', () => {
  const editor=new PlanEditor(element());
  const saved={...editor.getState(),items:[]};
  editor.loadState(saved);
  assert.deepEqual(editor.getState().items,[]);
});

test('loading a plan from a newer Romly leaves the open plan untouched', () => {
  const editor=new PlanEditor(element());
  const before=JSON.stringify(editor.getState());
  assert.throws(()=>editor.loadState({rooms:[room('a',0,0,100,100)],items:[],variant:'custom',schemaVersion:PLAN_VERSION+1}),{code:'plan_too_new'});
  assert.equal(JSON.stringify(editor.getState()),before);
});

test('the server keeps the version, accepts unversioned plans and refuses newer ones', () => {
  const plan={rooms:[room('a',0,0,100,100,'living')],items:[],variant:'custom'};
  assert.equal(validateProjectPayload({project,plan:{...plan,schemaVersion:PLAN_VERSION}}).plan.schemaVersion,PLAN_VERSION);
  assert.equal('schemaVersion' in validateProjectPayload({project,plan}).plan,false);
  assert.throws(()=>validateProjectPayload({project,plan:{...plan,schemaVersion:PLAN_VERSION+1}}),{code:'plan_too_new'});
  assert.throws(()=>validateProjectPayload({project,plan:{...plan,schemaVersion:'1'}}),{code:'invalid_plan'});
});
