const MAX_RASTER_EDGE=2048;
const MAX_RASTER_PIXELS=4_000_000;
const VENDOR_URL=new URL('./vendor/',import.meta.url);

export function calibrateReference(file,page,image,points,meters){
  if(!image||!Number.isFinite(image.width)||!Number.isFinite(image.height)||image.width<=0||image.height<=0||!Array.isArray(points)||points.length!==2||!points.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.y>=0&&point.x<=image.width&&point.y<=image.height)||!Number.isFinite(meters)||meters<=0||meters>100)throw new Error('Marker to punkter i tegningen og angi en lengde mellom 0 og 100 meter.');
  const distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
  if(distance<5)throw new Error('Velg to punkter med større avstand.');
  const scale=meters*50/distance;
  const w=image.width*scale,h=image.height*scale;
  if(w<10||h<10||w>5000||h>5000)throw new Error('Målestokken gir en tegning utenfor 0,2–100 meter. Kontroller målet og punktene.');
  return{fileId:file.id,name:file.name,mimeType:file.mimeType,page,pixelWidth:image.width,pixelHeight:image.height,x:0,y:0,w,h,opacity:0.7};
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
