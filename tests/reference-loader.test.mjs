import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrateReference } from '../public/studio/reference-loader.js';

const file={id:'drawing-file',name:'Boligen.png',mimeType:'image/png'};
test('calibration turns a known measured distance into a consistent meter scale',()=>{
  const reference=calibrateReference(file,1,{width:1200,height:800},[{x:100,y:50},{x:700,y:50}],6);
  assert.equal(reference.w,600);assert.equal(reference.h,400);
  assert.equal(reference.w/50,12);assert.equal(reference.h/50,8);
  assert.equal(reference.fileId,file.id);assert.equal(reference.pixelWidth,1200);
  assert.equal('url' in reference,false,'temporary object URLs must not be stored in project data');
});
test('calibration rejects missing, coincident, nonfinite and unreasonable measurements',()=>{
  for(const [points,length] of [[[],6],[[{x:1,y:1},{x:1,y:1}],6],[[{x:0,y:0},{x:100,y:0}],NaN],[[{x:0,y:0},{x:10,y:0}],100]]){
    assert.throws(()=>calibrateReference(file,1,{width:1200,height:800},points,length));
  }
});
