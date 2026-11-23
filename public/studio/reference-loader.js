const MAX_RASTER_EDGE=2048;
const MAX_RASTER_PIXELS=4_000_000;
const VENDOR_URL=new URL('./vendor/',import.meta.url);

/** Units a dimension can be typed in. Norwegian drawings usually write dimensions in millimetres. */
export const LENGTH_UNITS={m:1,cm:0.01,mm:0.001};
export function lengthInMeters(value,unit='m'){return Number.isFinite(value)&&LENGTH_UNITS[unit]?value*LENGTH_UNITS[unit]:NaN;}

const pointsInside=(points,image)=>Array.isArray(points)&&points.length===2&&points.every(point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y)&&point.x>=0&&point.y>=0&&point.x<=image.width&&point.y<=image.height);
const validLength=meters=>Number.isFinite(meters)&&meters>0&&meters<=100;

/**
 * Plan units (50 per metre) per image pixel, across and down. One measurement gives the same scale
 * both ways. A second measurement across the first also fixes the proportions of a straightened photo,
 * which are only approximate: each line gives dx²·sx² + dy²·sy² = length², two lines give both.
 */
export function axisScales(points,meters,cross){
  const dx1=points[1].x-points[0].x,dy1=points[1].y-points[0].y,first=Math.hypot(dx1,dy1);
  if(first<5)throw new Error('Velg to punkter med større avstand.');
  const scale=meters*50/first;
  if(!cross)return{sx:scale,sy:scale};
  const dx2=cross.points[1].x-cross.points[0].x,dy2=cross.points[1].y-cross.points[0].y,second=Math.hypot(dx2,dy2);
  if(second<5)throw new Error('Velg to punkter med større avstand for målet på tvers.');
  const l1=(meters*50)**2,l2=(cross.meters*50)**2;
  const det=dx1*dx1*dy2*dy2-dx2*dx2*dy1*dy1;
  // sin(angle between the lines)·sin(sum of their angles): near 0 when both lines run the same way, or mirror each other diagonally.
  if(Math.abs(det)/(first*first*second*second)<0.3)throw new Error('Målet på tvers må gå omtrent vinkelrett på det første målet, langs tegningens kanter.');
  const sx2=(l1*dy2*dy2-l2*dy1*dy1)/det,sy2=(dx1*dx1*l2-dx2*dx2*l1)/det;
  if(!(sx2>0&&sy2>0))throw new Error('De to målene passer ikke sammen. Kontroller tallene og punktene.');
  const sx=Math.sqrt(sx2),sy=Math.sqrt(sy2);
  if(sx/sy>1.6||sy/sx>1.6)throw new Error('De to målene gir svært ulik målestokk på langs og på tvers. Kontroller tallene og punktene.');
  return{sx,sy};
}

export function calibrateReference(file,page,image,points,meters,cross=null){
  if(!image||!Number.isFinite(image.width)||!Number.isFinite(image.height)||image.width<=0||image.height<=0||!pointsInside(points,image)||!validLength(meters))throw new Error('Marker to punkter i tegningen og angi en lengde mellom 0 og 100 meter.');
  if(cross&&(!pointsInside(cross.points,image)||!validLength(cross.meters)))throw new Error('Marker to punkter for målet på tvers og angi en lengde mellom 0 og 100 meter.');
  const{sx,sy}=axisScales(points,meters,cross);
  const w=image.width*sx,h=image.height*sy;
  if(w<10||h<10||w>5000||h>5000)throw new Error('Målestokken gir en tegning utenfor 0,2–100 meter. Kontroller målet og punktene.');
  return{fileId:file.id,name:file.name,mimeType:file.mimeType,page,pixelWidth:image.width,pixelHeight:image.height,x:0,y:0,w,h,opacity:0.7};
}

/** The RGBA pixels of an image blob, for straightening. Browser only. */
export async function blobPixels(blob){
  const bitmap=await createImageBitmap(blob);
  try{
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0);
    const{data}=context.getImageData(0,0,canvas.width,canvas.height);canvas.width=canvas.height=1;
    return{width:bitmap.width,height:bitmap.height,data};
  }finally{bitmap.close();}
}
/** Encodes straightened pixels again. JPEG keeps photos small; PNG keeps line drawings sharp. Browser only. */
export async function pixelsBlob(pixels,type='image/png'){
  const canvas=document.createElement('canvas');canvas.width=pixels.width;canvas.height=pixels.height;
  const context=canvas.getContext('2d');context.putImageData(new ImageData(pixels.data,pixels.width,pixels.height),0,0);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Plantegningen kunne ikke gjøres klar.')),type,0.9));
  canvas.width=canvas.height=1;return{blob,width:pixels.width,height:pixels.height};
}

const canvasBlob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Plantegningen kunne ikke gjøres klar.')),'image/png'));
function rasterDimensions(width,height){
  const scale=Math.min(1,MAX_RASTER_EDGE/Math.max(width,height),Math.sqrt(MAX_RASTER_PIXELS/(width*height)));
  return{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),scale};
}

/** Reads bytes locally. PDF.js and its worker are loaded only for a PDF import. */
export async function openFloorplanFile(blob,mimeType){
  if(mimeType==='application/pdf'){
    const pdfjs=await import('./vendor/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.mjs',VENDOR_URL).href;
    const task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,cMapUrl:new URL('cmaps/',VENDOR_URL).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',VENDOR_URL).href,wasmUrl:new URL('wasm/',VENDOR_URL).href});
    let pdf;
    try{pdf=await task.promise;}catch(error){await task.destroy();throw new Error(error?.name==='PasswordException'?'PDF-en er passordbeskyttet. Last opp en kopi uten passord.':'PDF-en kunne ikke åpnes. Kontroller filen og prøv igjen.');}
    if(pdf.numPages>200){await pdf.destroy();throw new Error('PDF-en har mer enn 200 sider. Last opp en kortere plantegning.');}
    let disposed=false;
    return{numPages:pdf.numPages,async renderPage(pageNumber=1){
      if(disposed)throw new Error('Importen er lukket.');
      const page=await pdf.getPage(pageNumber);
      const base=page.getViewport({scale:1});
      const target=rasterDimensions(base.width*2,base.height*2);
      const viewport=page.getViewport({scale:target.width/base.width});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const context=canvas.getContext('2d',{alpha:false});
      await page.render({canvasContext:context,viewport,background:'rgb(255,255,255)'}).promise;
      const result={blob:await canvasBlob(canvas),width:canvas.width,height:canvas.height};
      canvas.width=canvas.height=1;page.cleanup();return result;
    },async dispose(){disposed=true;await pdf.destroy();}};
  }
  if(!['image/jpeg','image/png','image/webp'].includes(mimeType))throw new Error('Bruk en JPG-, PNG-, WebP- eller PDF-plantegning.');
  let bitmap;
  try{bitmap=await createImageBitmap(blob);}catch{throw new Error('Bildet kunne ikke åpnes. Kontroller at det er en gyldig bildefil.');}
  const size=rasterDimensions(bitmap.width,bitmap.height);
  const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fff';context.fillRect(0,0,size.width,size.height);context.drawImage(bitmap,0,0,size.width,size.height);bitmap.close();
  const image={blob:await canvasBlob(canvas),width:size.width,height:size.height};canvas.width=canvas.height=1;
  return{numPages:1,async renderPage(){return image;},async dispose(){}};
}
