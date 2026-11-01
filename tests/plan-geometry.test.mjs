import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor, initialRooms, getPlanBounds, getWallSegments } from '../public/studio/plan.js';

const reference={fileId:'drawing-1',name:'Min bolig.png',mimeType:'image/png',page:1,pixelWidth:1000,pixelHeight:600,x:0,y:0,w:1000,h:600,opacity:.7};
const point=(x,y)=>({button:0,clientX:x,clientY:y,pointerId:1,target:{closest(){return null;}},preventDefault(){}});
function createEditor(options={}){
  const container={innerHTML:'',dataset:{},style:{},addEventListener(){},setPointerCapture(){}};
  const editor=new PlanEditor(container,options);
  editor.point=event=>({x:event.clientX,y:event.clientY});
  return {editor,container};
}

test('a calibrated drawing replaces the example with an empty, undoable custom plan',()=>{
  const {editor,container}=createEditor();
  editor.setReference(reference);
  assert.equal(editor.getState().variant,'custom');
  assert.equal(editor.getState().rooms.length,0);
  assert.deepEqual(editor.getState().reference,reference);
  assert.ok(!container.innerHTML.includes('Soverom 1'));
  assert.ok(!container.innerHTML.includes('x="140" y="100" width="520"'));
  assert.equal(editor.undo(),true);
  assert.equal(editor.getState().rooms.length,initialRooms.length);
  assert.equal(editor.redo(),true);
  assert.equal(editor.getState().rooms.length,0);
});

test('private drawing URLs stay runtime-only while empty custom projects round-trip',()=>{
  const {editor,container}=createEditor();
  editor.setReference(reference);
  editor.setReferenceImage('blob:private-drawing');
  assert.ok(container.innerHTML.includes('blob:private-drawing'));
  assert.ok(!JSON.stringify(editor.getState()).includes('blob:'));
  const saved=editor.getState();
  editor.loadState(saved);
  assert.equal(editor.getState().rooms.length,0);
  assert.deepEqual(editor.getState().reference,reference);
  assert.ok(!container.innerHTML.includes('blob:private-drawing'));
});

test('room tracing creates metric geometry on the user drawing and commits only at pointer-up',()=>{
  let commits=0;
  const {editor}=createEditor({onChange(){commits++;}});
  editor.setReference(reference);commits=0;
  editor.setTool('room');
  editor.pointerDown(point(100,50));
  editor.pointerMove(point(350,250));
  assert.equal(editor.getState().rooms.length,0);
  assert.equal(commits,0);
  editor.pointerUp(point(350,250));
  const room=editor.getState().rooms[0];
  assert.deepEqual([room.x,room.y,room.w,room.h],[100,50,250,200]);
  assert.deepEqual([room.width,room.height,room.area],[5,4,20]);
  assert.equal(commits,1);
});

test('two clicks also trace a room and tiny accidental clicks do not create invalid rooms',()=>{
  const {editor}=createEditor();editor.setReference(reference);editor.setTool('room');
  editor.pointerDown(point(400,300));editor.pointerUp(point(400,300));
  assert.equal(editor.getState().rooms.length,0);
  editor.pointerDown(point(200,100));
  const room=editor.getState().rooms[0];
  assert.deepEqual([room.x,room.y,room.w,room.h],[200,100,200,200]);
  assert.equal(editor.getState().rooms.length,1);
});

test('custom geometry can extend beyond the old example apartment coordinates',()=>{
  const {editor}=createEditor();editor.setReference(reference);
  const room=editor.addRoom({x:1000,y:800,w:300,h:250,name:'Mitt soverom',type:'bedroom'});
  editor.updateRoom(room.id,{width:8,height:7});
  const updated=editor.getState().rooms[0];
  assert.deepEqual([updated.x,updated.y,updated.w,updated.h,updated.area],[1000,800,400,350,56]);
  const bounds=getPlanBounds(editor.getState());
  assert.equal(bounds.maxX,1400);assert.equal(bounds.maxY,1150);
  editor.removeSelected();assert.equal(editor.getState().rooms.length,0);
});

test('shared room boundaries are unique and custom window placement snaps to them',()=>{
  const {editor}=createEditor();editor.setReference(reference);
  editor.addRoom({x:900,y:700,w:200,h:200});editor.addRoom({x:1100,y:700,w:200,h:200});
  const shared=getWallSegments(editor.getState()).filter(wall=>wall.x===1100&&wall.x2===1100&&wall.y===700&&wall.y2===900);
  assert.equal(shared.length,1);assert.equal(shared[0].roomIds.length,2);
  editor.setTool('window');editor.pointerDown(point(1109,810));
  const item=editor.getState().items[0];
  assert.equal(item.x,1100);assert.equal(item.y,810);assert.equal(item.rotation,90);
});

test('a burst of pointer motion produces one scheduled SVG render and one committed snapshot',()=>{
  const originalRAF=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
  const callbacks=new Map();let next=0;
  globalThis.requestAnimationFrame=callback=>{const id=++next;callbacks.set(id,callback);return id;};
  globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
  try{
    let commits=0;const {editor}=createEditor({onChange(){commits++;}});
    editor.setReference(reference);editor.setTool('room');editor.pointerDown(point(50,50));commits=0;
    const before=editor.renderCount;
    for(let i=0;i<120;i++)editor.pointerMove(point(100+i,100+i));
    assert.equal(editor.renderCount,before);
    assert.equal(callbacks.size,1);
    const callback=callbacks.values().next().value;callbacks.clear();callback();
    assert.equal(editor.renderCount,before+1);
    editor.pointerUp(point(250,250));
    assert.equal(commits,1);
    assert.equal(editor.getState().rooms[0].area,16);
    assert.equal(callbacks.size,0,'a committed gesture must not leave a redundant SVG redraw queued');
  }finally{globalThis.requestAnimationFrame=originalRAF;globalThis.cancelAnimationFrame=originalCancel;}
});

test('cancelled tracing leaves the drawing and persistence history untouched',()=>{
  const {editor}=createEditor();editor.setReference(reference);const history=editor.history.length;
  editor.setTool('room');editor.pointerDown(point(100,100));editor.pointerMove(point(300,300));editor.cancelPointer();
  assert.equal(editor.getState().rooms.length,0);assert.equal(editor.history.length,history);
});

test('clearing the drawing underlay is undoable and preserves all traced rooms',()=>{
  const {editor,container}=createEditor();editor.setReference(reference);editor.setReferenceImage('blob:private-drawing');
  const room=editor.addRoom({x:100,y:100,w:250,h:200,name:'Soverom',type:'bedroom'});
  assert.equal(editor.clearReference(),true);
  assert.equal(editor.getState().reference,undefined);
  assert.equal(editor.getState().rooms[0].id,room.id);
  assert.equal(editor.getState().rooms[0].area,20);
  assert.ok(!container.innerHTML.includes('blob:private-drawing'));
  assert.equal(editor.undo(),true);
  assert.deepEqual(editor.getState().reference,reference);
  assert.equal(editor.getState().rooms[0].id,room.id);
});
