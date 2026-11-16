import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanEditor } from '../public/studio/plan.js';

// The stub has no SVG: plan coordinates equal screen coordinates and one unit is one pixel.
function createEditor(options={}){
  const container={innerHTML:'',dataset:{},style:{},addEventListener(){},setPointerCapture(){}};
  const editor=new PlanEditor(container,options);
  editor.point=input=>({x:input.clientX,y:input.clientY});
  return editor;
}
const room=(id,x,y,w,h)=>({id,name:id,type:'room',x,y,w,h,color:'#e8e1d1',width:w/50,height:h/50,area:w*h/2500});
const touch=(id,x,y,target)=>({button:0,pointerType:'touch',pointerId:id,clientX:x,clientY:y,target:target||{closest(){return null;}},preventDefault(){}});
const on=id=>({closest(query){return query==='[data-item-id]'?{dataset:{itemId:id}}:null;}});
const sofaPlan=()=>({rooms:[room('a',0,0,400,400)],items:[{id:'s',type:'sofa',x:100,y:100,rotation:0,width:2.1,depth:0.9}],variant:'custom'});
const sofa=editor=>editor.getState().items[0];

test('spreading two fingers zooms in around the point between them; pinching zooms out', () => {
  const zooms=[];
  const editor=createEditor({onZoom:value=>zooms.push(value)});
  editor.loadState(sofaPlan());
  const before={...editor.ensureViewport()};
  editor.pointerDown(touch(1,100,200));editor.pointerDown(touch(2,300,200));
  editor.pointerMove(touch(1,0,200));editor.pointerMove(touch(2,400,200));
  assert.equal(editor.zoom,200,'twice the finger distance is twice the zoom');
  // The plan point between the fingers (200, 200) keeps its distance to the view centre on screen: half as far in plan units.
  assert.equal(editor.viewport.cx,200-(200-before.cx)/2);
  assert.equal(editor.viewport.cy,200-(200-before.cy)/2);
  editor.pointerMove(touch(1,150,200));editor.pointerMove(touch(2,250,200));
  assert.equal(editor.zoom,50);
  editor.pointerMove(touch(1,199,200));editor.pointerMove(touch(2,201,200));
  assert.equal(editor.zoom,25,'zoom stops at 25 %');
  editor.pointerUp(touch(1,199,200));editor.pointerUp(touch(2,201,200));
  assert.equal(zooms.at(-1),25);
  assert.equal(editor.history.length,0,'a pinch never changes the drawing');
});

test('moving both fingers together pans the drawing', () => {
  const editor=createEditor();
  editor.loadState(sofaPlan());
  const before={...editor.ensureViewport()};
  editor.pointerDown(touch(1,100,200));editor.pointerDown(touch(2,300,200));
  editor.pointerMove(touch(1,140,230));editor.pointerMove(touch(2,340,230));
  assert.equal(editor.zoom,100);
  assert.deepEqual([editor.viewport.cx,editor.viewport.cy],[before.cx-40,before.cy-30]);
});

test('a second finger undoes what the first finger started, and keeps redo', () => {
  const editor=createEditor();
  editor.loadState(sofaPlan());
  editor.updateRoom('a',{name:'B'});editor.undo();
  editor.pointerDown(touch(1,100,100,on('s')));
  editor.pointerMove(touch(1,160,140,on('s')));
  assert.deepEqual([sofa(editor).x,sofa(editor).y],[160,140],'one finger drags the sofa');
  editor.pointerDown(touch(2,300,300));
  assert.deepEqual([sofa(editor).x,sofa(editor).y],[100,100],'the pinch puts it back');
  assert.equal(editor.drag.type,'pinch');
  editor.pointerUp(touch(2,300,300));
  editor.pointerMove(touch(1,250,250,on('s')));
  assert.deepEqual([sofa(editor).x,sofa(editor).y],[100,100],'the finger left on the screen does nothing');
  editor.pointerUp(touch(1,250,250));
  assert.equal(editor.history.length,0);
  assert.equal(editor.redo(),true,'redo survived the gesture');
});

test('a pinch does not leave a wall or room half drawn', () => {
  const editor=createEditor();
  editor.loadState(sofaPlan());
  editor.setTool('wall');
  editor.pointerDown(touch(1,50,50));
  assert.ok(editor.wallStart,'one finger starts a wall');
  editor.pointerDown(touch(2,300,300));
  assert.equal(editor.wallStart,null);
  editor.pointerUp(touch(1,50,50));editor.pointerUp(touch(2,300,300));
  editor.setTool('room');
  editor.pointerDown(touch(1,500,50));editor.pointerMove(touch(1,700,250));editor.pointerDown(touch(2,300,300));
  editor.pointerUp(touch(1,700,250));editor.pointerUp(touch(2,300,300));
  assert.equal(editor.roomStart,null);
  assert.equal(editor.getState().rooms.length,1,'no room was added');
  assert.equal(editor.getState().items.length,1,'no wall was added');
});

test('one finger still works after a pinch, and a cancelled touch is forgotten', () => {
  const editor=createEditor();
  editor.loadState(sofaPlan());
  editor.pointerDown(touch(1,100,200));editor.pointerDown(touch(2,300,200));
  editor.cancelPointer(touch(1,100,200));editor.cancelPointer(touch(2,300,200));
  assert.equal(editor.touches.size,0);
  assert.equal(editor.drag,null);
  editor.pointerDown(touch(3,100,100,on('s')));editor.pointerMove(touch(3,150,100,on('s')));editor.pointerUp(touch(3,150,100,on('s')));
  assert.equal(sofa(editor).x,150);
  assert.equal(editor.history.length,1);
});

test('N steps through the placed elements in both directions', () => {
  const editor=createEditor();
  assert.equal(createEditor().selectItem('missing'),false);
  editor.loadState({rooms:[room('a',0,0,400,400)],items:[{id:'d',type:'door',x:100,y:400,rotation:0},{id:'s',type:'sofa',x:100,y:100,rotation:0},{id:'w',type:'window',x:200,y:0,rotation:0}],variant:'custom'});
  const order=[];
  for(let i=0;i<4;i++){editor.selectNextItem(1);order.push(editor.selectedItem);}
  assert.deepEqual(order,['d','s','w','d']);
  editor.selectNextItem(-1);
  assert.equal(editor.selectedItem,'w');
  editor.loadState({rooms:[room('a',0,0,400,400)],items:[],variant:'custom'});
  assert.equal(editor.selectNextItem(1),false);
});
