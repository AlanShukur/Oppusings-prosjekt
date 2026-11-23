import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrateReference, lengthInMeters } from '../public/studio/reference-loader.js';

const file={id:'drawing-file',name:'Boligen.png',mimeType:'image/png'};
test('calibration turns a known measured distance into a consistent meter scale',()=>{
  const reference=calibrateReference(file,1,{width:1200,height:800},[{x:100,y:50},{x:700,y:50}],6);
  assert.equal(reference.w,600);assert.equal(reference.h,400);
  assert.equal(reference.w/50,12);assert.equal(reference.h/50,8);
  assert.equal(reference.fileId,file.id);assert.equal(reference.pixelWidth,1200);
  assert.equal('url' in reference,false,'temporary object URLs must not be stored in project data');
});
test('a dimension can be typed the way the drawing writes it',()=>{
  assert.equal(lengthInMeters(4200,'mm'),4.2);assert.equal(lengthInMeters(420,'cm'),4.2);assert.equal(lengthInMeters(4.2,'m'),4.2);
  assert.ok(Number.isNaN(lengthInMeters(4,'ft')));assert.ok(Number.isNaN(lengthInMeters(null,'m')));
});
// A straightened photo whose true scale is 0.5 plan units per pixel across and 0.4 down.
const sx=0.5,sy=0.4,photo={width:1000,height:1000};
const metersFor=(a,b)=>Math.hypot((b.x-a.x)*sx,(b.y-a.y)*sy)/50;
test('a second dimension across the first fixes the proportions of a photo',()=>{
  const main=[{x:0,y:100},{x:800,y:100}],across=[{x:100,y:0},{x:100,y:500}];
  const single=calibrateReference(file,1,photo,main,metersFor(...main));
  assert.equal(single.w,500);assert.equal(single.h,500,'one dimension assumes square pixels');
  const both=calibrateReference(file,1,photo,main,metersFor(...main),{points:across,meters:metersFor(...across)});
  assert.ok(Math.abs(both.w-500)<1e-9&&Math.abs(both.h-400)<1e-9,`${both.w} × ${both.h}`);
});
test('the two dimensions may run at an angle, as long as they cross',()=>{
  const main=[{x:100,y:100},{x:400,y:273.2}],across=[{x:500,y:100},{x:400,y:500}];
  const both=calibrateReference(file,1,photo,main,metersFor(...main),{points:across,meters:metersFor(...across)});
  assert.ok(Math.abs(both.w-500)<1e-6&&Math.abs(both.h-400)<1e-6,`${both.w} × ${both.h}`);
});
test('parallel or contradicting dimensions are refused with a reason',()=>{
  const main=[{x:0,y:100},{x:800,y:100}];
  assert.throws(()=>calibrateReference(file,1,photo,main,8,{points:[{x:0,y:300},{x:600,y:330}],meters:6}),/vinkelrett/);
  assert.throws(()=>calibrateReference(file,1,photo,main,8,{points:[{x:100,y:0},{x:100,y:500}],meters:0.5}),/passer ikke|ulik målestokk/);
  assert.throws(()=>calibrateReference(file,1,photo,main,8,{points:[{x:100,y:0},{x:100,y:5000}],meters:4}),/punkter for målet på tvers/);
});
test('calibration rejects missing, coincident, nonfinite and unreasonable measurements',()=>{
  for(const [points,length] of [[[],6],[[{x:1,y:1},{x:1,y:1}],6],[[{x:0,y:0},{x:100,y:0}],NaN],[[{x:0,y:0},{x:10,y:0}],100]]){
    assert.throws(()=>calibrateReference(file,1,{width:1200,height:800},points,length));
  }
});
