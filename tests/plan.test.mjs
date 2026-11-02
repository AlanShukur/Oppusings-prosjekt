import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor, PLAN_VERSION, initialRooms } from '../public/studio/plan.js';

function createEditor(){
  return new PlanEditor({innerHTML:'',dataset:{},style:{},addEventListener(){}});
}

test('switching projects cannot undo or redo into another project',()=>{
  const editor=createEditor();
  editor.updateRoom('living',{name:'Prosjekt A'});
  editor.undo();
  const incoming={rooms:structuredClone(initialRooms),items:[],variant:'01'};
  incoming.rooms[0].name='Prosjekt B';
  editor.loadState(incoming);
  assert.equal(editor.undo(),false);
  assert.equal(editor.redo(),false);
  assert.equal(editor.getState().rooms[0].name,'Prosjekt B');
});

test('new project load clears pending placement and selected objects',()=>{
  const editor=createEditor();
  editor.addItem('sofa');
  editor.wallStart={x:200,y:200};
  editor.loadState({rooms:structuredClone(initialRooms),items:[],variant:'01',schemaVersion:PLAN_VERSION});
  assert.equal(editor.removeSelected(),false);
  assert.equal(editor.wallStart,null);
  assert.deepEqual(editor.getState().items,[]);
});
