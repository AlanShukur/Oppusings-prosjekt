// Your own floor plan as the drawing reference: importing it, straightening a photo, setting the scale, and showing it under the plan.
import { openFloorplanFile, calibrateReference, lengthInMeters, blobPixels, pixelsBlob } from './reference-loader.js';
import { defaultCorners, cornersUnchanged, orderCorners, validQuad, rotatePixels, warpPixels, CORNER_NAMES } from './photo-correct.js';
import { icon, $, toast, setWorkspacePanel } from './ui.js';
import { esc, fmt, decimal } from './format.js';
import { api, session, studio, editor } from './state.js';
import { setDialogCleanup, openDialog, closeDialog } from './dialog.js';
import { setTool, showZoom, setView } from './tools.js';
import { openGround } from './ground.js';
import { sync, renderProject, ensureCanLeave, withProjectTransition, createCloudProject, showSaveProblem } from './projects.js';
import { openStorage, openProjects } from './project-dialogs.js';

let referenceFailedKey='',referenceAssetKey='',referenceObjectURL=null,referenceGeneration=0,importingPlan=false;
export function releaseReferenceAsset(){
  referenceGeneration++;referenceAssetKey='';referenceFailedKey='';
  if(referenceObjectURL)URL.revokeObjectURL(referenceObjectURL);
  referenceObjectURL=null;$('#reference-loading')?.remove();
}
export async function resolveReferenceImage(plan=editor.getState()){
  const ref=plan.reference;const key=ref&&studio.activeRecord?studio.activeRecord.id+':'+ref.fileId+':'+ref.page:'';
  if(key===referenceAssetKey){if(editor.referenceImage!==referenceObjectURL)editor.setReferenceImage(referenceObjectURL);return;}
  if(key&&key===referenceFailedKey)return;
  releaseReferenceAsset();referenceAssetKey=key;
  if(!key){editor.setReferenceImage?.(null);return;}
  const generation=referenceGeneration;
  const file=studio.uploads.find(item=>item.id===ref.fileId&&item.status==='ready');
  if(!file){toast('Tegnegrunnlaget mangler i prosjektet. Last opp filen på nytt.');return;}
  const label=document.createElement('div');label.id='reference-loading';label.className='reference-loading';label.textContent='Åpner plantegningen …';$('#plan-canvas').append(label);
  let sourceDocument;
  try{
    const response=await fetch(file.url,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Plantegningen kunne ikke lastes.');
    sourceDocument=await openFloorplanFile(await response.blob(),file.mimeType);
    const image=await sourceDocument.renderPage(ref.page||1);
    if(generation!==referenceGeneration)return;
    referenceObjectURL=URL.createObjectURL(image.blob);editor.setReferenceImage(referenceObjectURL);
  }catch(error){if(generation===referenceGeneration){referenceAssetKey='';referenceFailedKey=key;toast((error.message||'Plantegningen kunne ikke åpnes.')+' Åpne prosjektet på nytt for å prøve igjen.');}}
  finally{await sourceDocument?.dispose().catch(()=>{});if(generation===referenceGeneration)$('#reference-loading')?.remove();}
}
export function choosePlanFile(){
  if(!session.user){openStorage();return;}
  if(studio.filesBusy||studio.transitioning||importingPlan){toast('Vent til den pågående filhandlingen er ferdig.');return;}
  $('#plan-file-input').click();
}

/** A rotated or straightened drawing is saved as its own file, so the original stays untouched under Grunnlag. */
async function saveCorrectedCopy(projectId,file,image){
  const photo=file.mimeType==='image/jpeg'||file.mimeType==='image/webp',type=photo?'image/jpeg':'image/png';
  const encoded=photo?await pixelsBlob(await blobPixels(image.blob),type):image;
  const name=`${file.name.replace(/\.[^.]+$/,'').slice(0,150)||'Plantegning'} (rettet).${photo?'jpg':'png'}`;
  studio.filesBusy++;studio.fileMutation++;
  try{const result=await api.upload(projectId,new File([encoded.blob],name,{type}));studio.uploads.push(result.file);return result.file;}
  finally{studio.filesBusy--;}
}

const MAIN_COLOUR='#7961ce',MAIN_LABEL='#6951bc',CROSS_COLOUR='#0f766e',CROSS_LABEL='#0b5f58';

export async function openPlanImport(file){
  if(!studio.activeRecord||!session.user){openProjects();return;}
  if(!await ensureCanLeave())return;
  const projectId=studio.activeRecord.id;
  // `original` is the rendered page; `image` is what the user sees and measures on, after any rotation or straightening.
  let live=true,source=null,original=null,image=null,previewURL=null,points=[],page=1,renderGeneration=0;
  let mode='measure',corners=[],dragCorner=-1,busy=false,corrected=false;
  openDialog('Bruk din egen plantegning','Rett opp tegningen, sett målestokk, og tegn rommene oppå grunnlaget.',`<div class="import-intro"><p>Er tegningen fotografert, kan du rotere og rette den opp først. Klikk så på to punkter med kjent avstand, for eksempel endene av et mål i tegningen, og skriv lengden.</p><label class="import-page-control" id="import-page-control" hidden>Side<input class="input" id="import-page" type="number" min="1" value="1"><span id="import-page-total"></span></label></div><div class="import-tools" role="toolbar" aria-label="Rett opp tegningen"><button class="button secondary" id="import-rotate-left" type="button" disabled>${icon('rotate-left')} Roter mot venstre</button><button class="button secondary" id="import-rotate-right" type="button" disabled>${icon('rotate-right')} Roter mot høyre</button><button class="button secondary" id="import-straighten" type="button" aria-pressed="false" disabled>${icon('crop')} Beskjær og rett opp</button><button class="button secondary" id="import-reset-correction" type="button" hidden>${icon('undo')} Tilbakestill</button></div><div class="import-drawing" id="import-drawing"><p class="import-empty">Åpner ${esc(file.name)} …</p></div><div class="import-straighten-bar" id="import-straighten-bar" hidden><p>Dra de fire hjørnene til hjørnene av tegningen. Et valgt hjørne kan også flyttes med piltastene, og med Shift i større steg.</p><button class="button secondary" id="straighten-cancel" type="button">Avbryt</button><button class="button primary" id="straighten-apply" type="button">${icon('crop')} Rett opp</button></div><div id="import-measure-panel"><div class="import-measurements"><label class="field">Lengde mellom punkt 1 og 2<input class="input" id="calibration-meters" type="text" inputmode="decimal" autocomplete="off" placeholder="For eksempel 4,20"></label><label class="field import-unit">Enhet<select class="input" id="calibration-unit"><option value="m">meter</option><option value="cm">cm</option><option value="mm">mm</option></select></label><button class="button secondary" id="calibration-reset" type="button">Velg punkter på nytt</button><p class="measure-help" id="calibration-measure" aria-live="polite">Marker to punkter i plantegningen.</p></div><label class="import-cross-toggle"><input type="checkbox" id="calibration-cross"> Legg til et mål på tvers, så både lengden og bredden blir riktige (anbefales for foto)</label><div class="import-measurements import-cross" id="import-cross" hidden><label class="field">Lengde mellom punkt 3 og 4<input class="input" id="cross-meters" type="text" inputmode="decimal" autocomplete="off" placeholder="For eksempel 3,60"></label><p class="measure-help">Marker punkt 3 og 4 langs et mål som går på tvers av det første. Enheten gjelder begge målene.</p></div></div><p class="import-error" id="calibration-error" role="alert" hidden></p><p class="import-warning">Rommene tegner du selv; filen tolkes ikke automatisk med AI. En rotert eller rettet tegning lagres som en egen kopi på denne enheten, og originalen beholdes. Tegningen i studioet erstattes, og kan hentes tilbake med Angre.</p>`,`<button class="button secondary" id="calibration-cancel">Avbryt</button><button class="button primary" id="calibration-apply" disabled>${icon('layers')} Bruk tegningen i studio</button>`,true);
  setDialogCleanup(()=>{live=false;renderGeneration++;if(previewURL)URL.revokeObjectURL(previewURL);source?.dispose().catch(()=>{});});

  const showError=message=>{const element=$('#calibration-error');if(!element)return;element.hidden=!message;element.textContent=message||'';};
  const crossOn=()=>!!$('#calibration-cross')?.checked;
  const clampPoint=point=>({x:Math.max(0,Math.min(image.width,point.x)),y:Math.max(0,Math.min(image.height,point.y))});
  const handleSize=()=>Math.max(image.width,image.height)/45;
  const syncControls=()=>{
    if(!live)return;
    const ready=!!image&&!busy,straightening=mode==='straighten';
    $('#import-rotate-left').disabled=$('#import-rotate-right').disabled=$('#import-straighten').disabled=!ready||straightening;
    $('#import-straighten').setAttribute('aria-pressed',String(straightening));
    $('#import-reset-correction').hidden=!corrected;$('#import-reset-correction').disabled=!ready||straightening;
    $('#import-straighten-bar').hidden=!straightening;$('#import-measure-panel').hidden=straightening;
    $('#import-page').disabled=busy||straightening;
    $('#import-drawing').setAttribute('aria-busy',String(busy));
  };
  const buildReference=(target=file)=>{
    const unit=$('#calibration-unit').value;
    const cross=crossOn()?{points:points.slice(2,4),meters:lengthInMeters(decimal($('#cross-meters').value),unit)}:null;
    return calibrateReference(target,corrected?1:page,image,points.slice(0,2),lengthInMeters(decimal($('#calibration-meters').value),unit),cross);
  };
  const updateMeasure=()=>{
    if(!live)return;
    const main=decimal($('#calibration-meters').value),across=decimal($('#cross-meters').value),cross=crossOn();
    let message='',valid=false;showError('');
    if(!image)message='Vent mens siden gjøres klar.';
    else if(points.length<2)message=`Marker ${points.length?'det andre punktet':'to punkter'} i plantegningen.`;
    else if(main===null)message='Skriv den kjente avstanden mellom punkt 1 og 2.';
    else if(Number.isNaN(main))message='Bruk et tall, for eksempel 4,20.';
    else if(cross&&points.length<4)message=`Marker punkt ${points.length+1} for målet på tvers.`;
    else if(cross&&across===null)message='Skriv lengden mellom punkt 3 og 4.';
    else if(cross&&Number.isNaN(across))message='Bruk et tall for målet på tvers, for eksempel 3,60.';
    else{try{const ref=buildReference();message=`Tegningen blir ${fmt(ref.w/50)} × ${fmt(ref.h/50)} meter.`;valid=true;}catch(error){showError(error.message);}}
    $('#calibration-measure').textContent=message;
    $('#calibration-apply').disabled=!valid||busy||mode!=='measure';
  };
  const quadPath=()=>`M0 0H${image.width}V${image.height}H0Z M${corners.map(point=>`${point.x} ${point.y}`).join(' L')}Z`;
  const updateQuad=()=>{
    $('#straighten-shade')?.setAttribute('d',quadPath());
    $('#straighten-outline')?.setAttribute('points',corners.map(point=>`${point.x},${point.y}`).join(' '));
    document.querySelectorAll('.import-corner').forEach(element=>{const point=corners[Number(element.dataset.corner)];element.setAttribute('cx',point.x);element.setAttribute('cy',point.y);});
    const ok=validQuad(orderCorners(corners));
    $('#straighten-apply').disabled=busy||!ok;showError(ok?'':'Hjørnene må danne en firkant rundt tegningen.');
  };
  const pointMarkup=()=>points.map((point,index)=>`<circle cx="${point.x}" cy="${point.y}" r="${Math.max(image.width/140,4)}" fill="${index>1?CROSS_COLOUR:MAIN_COLOUR}" stroke="white" stroke-width="${image.width/400}"/><text x="${point.x+image.width/80}" y="${point.y-image.width/100}" font-size="${image.width/45}" fill="${index>1?CROSS_LABEL:MAIN_LABEL}" font-weight="700">${index+1}</text>`).join('');
  const lineMarkup=(a,b,colour)=>`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${colour}" stroke-width="${Math.max(image.width/450,1)}" stroke-dasharray="${image.width/120} ${image.width/180}"/>`;
  const quadMarkup=()=>{
    const size=handleSize();
    return `<path id="straighten-shade" d="${quadPath()}" fill="#1c142c" fill-opacity=".45" fill-rule="evenodd"/><polygon id="straighten-outline" points="" fill="none" stroke="${MAIN_COLOUR}" stroke-width="${size/5}"/>${corners.map((point,index)=>`<circle class="import-corner" data-corner="${index}" cx="${point.x}" cy="${point.y}" r="${size}" tabindex="0" role="button" aria-label="Hjørne ${CORNER_NAMES[index]}. Flytt med piltastene." fill="#ffffff" stroke="${MAIN_LABEL}" stroke-width="${size/4}"/>`).join('')}`;
  };
  const toImage=(svg,event)=>{const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(svg.getScreenCTM().inverse());};
  const draw=()=>{
    if(!live||!image)return;
    const straightening=mode==='straighten';
    // While straightening, a margin keeps the corner handles visible and grabbable at the image's own corners.
    const margin=straightening?handleSize()*1.4:0;
    const overlay=straightening?quadMarkup():(points.length>=2?lineMarkup(points[0],points[1],MAIN_COLOUR):'')+(points.length===4?lineMarkup(points[2],points[3],CROSS_COLOUR):'')+pointMarkup();
    $('#import-drawing').innerHTML=`<svg id="calibration-svg" class="${straightening?'is-straightening':''}" viewBox="${-margin} ${-margin} ${image.width+margin*2} ${image.height+margin*2}" role="${straightening?'group':'img'}" aria-label="${straightening?'Plantegning. Dra de fire hjørnene til hjørnene av tegningen.':'Plantegning. Marker to punkter for å sette målestokk.'}"><image href="${esc(previewURL)}" width="${image.width}" height="${image.height}"/>${overlay}</svg>`;
    const svg=$('#calibration-svg');
    if(straightening){
      svg.onpointerdown=event=>{
        const at=toImage(svg,event);let nearest=-1,best=handleSize()*2.5;
        corners.forEach((point,index)=>{const gap=Math.hypot(point.x-at.x,point.y-at.y);if(gap<best){best=gap;nearest=index;}});
        if(nearest<0||busy)return;
        event.preventDefault();dragCorner=nearest;svg.setPointerCapture?.(event.pointerId);
        svg.querySelector(`[data-corner="${nearest}"]`)?.focus({preventScroll:true});
      };
      svg.onpointermove=event=>{if(dragCorner<0)return;corners[dragCorner]=clampPoint(toImage(svg,event));updateQuad();};
      svg.onpointerup=svg.onpointercancel=()=>{dragCorner=-1;};
      svg.onkeydown=event=>{
        const index=Number(event.target?.dataset?.corner);if(!Number.isInteger(index)||busy)return;
        const step=Math.max(image.width,image.height)/(event.shiftKey?40:200);
        const delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
        if(!delta)return;event.preventDefault();
        corners[index]=clampPoint({x:corners[index].x+delta[0],y:corners[index].y+delta[1]});updateQuad();
      };
      updateQuad();
    }else{
      svg.onpointerdown=event=>{
        if(busy)return;
        const at=toImage(svg,event);
        if(at.x<0||at.y<0||at.x>image.width||at.y>image.height)return;
        if(points.length>=(crossOn()?4:2))points=[];
        points.push({x:at.x,y:at.y});draw();
      };
      updateMeasure();
    }
  };
  const setImage=(next,isCorrected)=>{
    if(previewURL)URL.revokeObjectURL(previewURL);
    image=next;previewURL=URL.createObjectURL(image.blob);points=[];corrected=isCorrected;mode='measure';
    syncControls();draw();
  };
  // Rotating and straightening work on the pixels and replace the picture being measured.
  const transform=async(work,fallback)=>{
    if(busy||!image)return;
    const focused=document.activeElement,generation=renderGeneration;
    busy=true;syncControls();showError('');
    let next=null,failure='';
    try{next=await pixelsBlob(work(await blobPixels(image.blob)));}catch(error){failure=error.message||fallback;}
    if(!live||generation!==renderGeneration)return;
    busy=false;
    if(next)setImage(next,true);else{syncControls();draw();showError(failure);}
    const target=focused?.isConnected&&!focused.disabled&&focused.offsetParent!==null?focused:$('#import-straighten');
    target?.focus({preventScroll:true});
  };
  const renderPage=async value=>{
    const generation=++renderGeneration;image=null;original=null;points=[];corrected=false;mode='measure';busy=false;syncControls();showError('');
    $('#calibration-apply').disabled=true;$('#calibration-measure').textContent='Vent mens siden gjøres klar.';$('#import-drawing').innerHTML='<p class="import-empty">Gjør klar siden …</p>';
    try{const next=await source.renderPage(value);if(!live||generation!==renderGeneration)return;page=value;$('#import-page').value=String(value);original=next;setImage(next,false);}
    catch(error){if(live&&generation===renderGeneration)showError(error.message||'Siden kunne ikke åpnes.');}
  };

  $('#import-rotate-left').onclick=()=>transform(pixels=>rotatePixels(pixels,-1),'Tegningen kunne ikke roteres.');
  $('#import-rotate-right').onclick=()=>transform(pixels=>rotatePixels(pixels,1),'Tegningen kunne ikke roteres.');
  $('#import-straighten').onclick=()=>{
    if(!image||busy)return;
    mode='straighten';corners=defaultCorners(image.width,image.height);syncControls();draw();
    document.querySelector('.import-corner')?.focus({preventScroll:true});
  };
  $('#straighten-cancel').onclick=()=>{mode='measure';syncControls();draw();$('#import-straighten').focus({preventScroll:true});};
  $('#straighten-apply').onclick=()=>{
    const ordered=orderCorners(corners);
    if(!validQuad(ordered)){showError('Hjørnene må danne en firkant rundt tegningen.');return;}
    if(cornersUnchanged(ordered,image.width,image.height)){mode='measure';syncControls();draw();$('#import-straighten').focus({preventScroll:true});return;}
    transform(pixels=>warpPixels(pixels,ordered),'Tegningen kunne ikke rettes opp.');
  };
  $('#import-reset-correction').onclick=()=>{if(original&&!busy){setImage(original,false);$('#import-straighten').focus({preventScroll:true});}};
  $('#calibration-cross').onchange=()=>{$('#import-cross').hidden=!crossOn();if(!crossOn()&&points.length>2)points=points.slice(0,2);draw();};
  $('#calibration-cancel').onclick=closeDialog;$('#calibration-reset').onclick=()=>{points=[];draw();};
  $('#calibration-meters').oninput=updateMeasure;$('#cross-meters').oninput=updateMeasure;$('#calibration-unit').onchange=updateMeasure;
  $('#import-page').onchange=e=>{const requested=Number(e.target.value);if(source&&Number.isInteger(requested)&&requested>=1&&requested<=source.numPages)renderPage(requested);else e.target.value=page;};
  $('#calibration-apply').onclick=async event=>{
    const button=event.currentTarget;if(!live||!image||busy||projectId!==studio.activeRecord?.id)return;button.disabled=true;
    try{
      buildReference();// Check the measurements before saving a copy of the drawing.
      let target=file;
      if(corrected){$('#calibration-measure').textContent='Lagrer den rettede tegningen …';target=await saveCorrectedCopy(projectId,file,image);if(!live)return;}
      const reference=buildReference(target);
      await withProjectTransition(async()=>{
        await setView('2d');
        releaseReferenceAsset();referenceAssetKey=studio.activeRecord.id+':'+target.id+':'+reference.page;referenceObjectURL=URL.createObjectURL(image.blob);
        editor.setReference(reference,{replace:true});editor.setReferenceImage(referenceObjectURL);
        studio.selectedId=null;renderProject();showZoom(100);setTool('room');setWorkspacePanel('canvas');
        await sync.flush();closeDialog({force:true});
      });
      toast(corrected?'Den rettede plantegningen er importert. Dra over hvert rom for å lage modellen.':'Plantegningen er importert. Dra over hvert rom for å lage modellen.');
    }catch(error){button.disabled=false;if($('#calibration-error'))showError(error.message);else showSaveProblem(error);}
  };
  try{
    const response=await fetch(file.url,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Filen kunne ikke hentes fra prosjektet.');
    const loaded=await openFloorplanFile(await response.blob(),file.mimeType);if(!live){await loaded.dispose();return;}source=loaded;
    $('#import-page-control').hidden=source.numPages===1;$('#import-page').max=source.numPages;$('#import-page-total').textContent='av '+source.numPages;
    await renderPage(1);
  }catch(error){if(live){$('#import-drawing').innerHTML='<p class="import-empty">Plantegningen kunne ikke åpnes.</p>';showError(error.message);}}
}
export function bindPlanImport(){
  $('#import-floorplan').onclick=choosePlanFile;
  $('#plan-file-input').onchange=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||!file.size||file.size>20*1024*1024){toast('Bruk JPG, PNG, WebP eller PDF, maksimalt 20 MB.');return;}
    if(!await ensureCanLeave())return;
    try{
      if(!studio.activeRecord)await createCloudProject({name:file.name.replace(/\.[^.]+$/,'').slice(0,70)||'Min plantegning',municipality:'',bedrooms:2,bathrooms:1,wishes:'',variant:'01'},{rooms:[],items:[],variant:'custom'});
      importingPlan=true;studio.filesBusy++;studio.fileMutation++;
      openDialog('Importerer plantegningen','Filen lagres på denne enheten før du setter målestokk.',`<p class="cloud-loading">Laster opp ${esc(file.name)} …</p>`);
      const result=await api.upload(studio.activeRecord.id,file);studio.uploads.push(result.file);
      studio.filesBusy--;importingPlan=false;
      await openPlanImport(result.file);
    }catch(error){if(importingPlan){studio.filesBusy--;importingPlan=false;}toast(error.message||'Plantegningen kunne ikke importeres.');openGround();}
  };
  $('#show-reference').onchange=e=>editor.setLayers({reference:e.target.checked});
  $('#reference-opacity').oninput=e=>editor.setReferenceOpacity(Number(e.target.value));
  $('#remove-reference').onclick=()=>{
    const ref=editor.getState().reference;if(!ref)return;
    openDialog('Fjerne tegnegrunnlaget?',ref.name,'<p class="account-note">Rommene og elementene du har tegnet beholdes. Den opplastede filen ligger fortsatt under Grunnlag.</p>',`<button class="button secondary" id="keep-reference">Behold underlaget</button><button class="button primary" id="confirm-remove-reference">Fjern underlaget</button>`);
    $('#keep-reference').onclick=closeDialog;$('#confirm-remove-reference').onclick=()=>{editor.clearReference();renderProject();closeDialog();};
  };
}
