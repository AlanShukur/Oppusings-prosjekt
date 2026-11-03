// Your own floor plan as the drawing reference: importing it, setting the scale, and showing it under the plan.
import { openFloorplanFile, calibrateReference } from './reference-loader.js';
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
export async function openPlanImport(file){
  if(!studio.activeRecord||!session.user){openProjects();return;}
  if(!await ensureCanLeave())return;
  const projectId=studio.activeRecord.id;
  let live=true,source=null,image=null,previewURL=null,points=[],page=1,renderGeneration=0;
  openDialog('Bruk din egen plantegning','Sett målestokk, og tegn rommene oppå grunnlaget.',`<div class="import-intro"><p>Klikk på to punkter i tegningen med kjent avstand, og skriv lengden i meter. Etter import kan du tegne rom, dører og vinduer i studioet.</p><label class="import-page-control" id="import-page-control" hidden>Side<input class="input" id="import-page" type="number" min="1" value="1"><span id="import-page-total"></span></label></div><div class="import-drawing" id="import-drawing"><p class="import-empty">Åpner ${esc(file.name)} …</p></div><div class="import-measurements"><label class="field">Avstand mellom punktene (meter)<input class="input" id="calibration-meters" type="text" inputmode="decimal" autocomplete="off" placeholder="For eksempel 4,20"></label><button class="button secondary" id="calibration-reset">Velg punkter på nytt</button><p class="measure-help" id="calibration-measure">Marker to punkter i plantegningen.</p></div><p class="import-error" id="calibration-error" hidden></p><p class="import-warning">Dette setter målestokken på underlaget. Rommene tegner du selv; filen tolkes ikke automatisk med AI. Tegningen i studioet erstattes, og kan hentes tilbake med Angre.</p>`,`<button class="button secondary" id="calibration-cancel">Avbryt</button><button class="button primary" id="calibration-apply" disabled>${icon('layers')} Bruk tegningen i studio</button>`,true);
  setDialogCleanup(()=>{live=false;renderGeneration++;if(previewURL)URL.revokeObjectURL(previewURL);source?.dispose().catch(()=>{});});
  const refresh=()=>{
    if(!live||!image)return;
    const pointMarkup=points.map((point,index)=>`<circle cx="${point.x}" cy="${point.y}" r="${Math.max(image.width/140,4)}" fill="#7961ce" stroke="white" stroke-width="${image.width/400}"/><text x="${point.x+image.width/80}" y="${point.y-image.width/100}" font-size="${image.width/45}" fill="#6951bc" font-weight="700">${index+1}</text>`).join('');
    const line=points.length===2?`<path d="M${points[0].x} ${points[0].y}L${points[1].x} ${points[1].y}" stroke="#7961ce" stroke-width="${Math.max(image.width/450,1)}" stroke-dasharray="${image.width/120} ${image.width/180}"/>`:'';
    $('#import-drawing').innerHTML=`<svg id="calibration-svg" viewBox="0 0 ${image.width} ${image.height}" role="img" aria-label="Plantegning. Marker to punkter for å sette målestokk."><image href="${esc(previewURL)}" width="${image.width}" height="${image.height}"/>${line}${pointMarkup}</svg>`;
    $('#calibration-svg').onpointerdown=event=>{
      const svg=event.currentTarget;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const mapped=point.matrixTransform(svg.getScreenCTM().inverse());
      if(mapped.x<0||mapped.y<0||mapped.x>image.width||mapped.y>image.height)return;
      if(points.length===2)points=[];points.push({x:mapped.x,y:mapped.y});refresh();
    };
    const meters=decimal($('#calibration-meters').value);let valid=false;
    if(points.length===2&&meters>0){try{const ref=calibrateReference(file,page,image,points,meters);$('#calibration-measure').textContent=`Tegningen blir ${fmt(ref.w/50)} × ${fmt(ref.h/50)} meter.`;valid=true;$('#calibration-error').hidden=true;}catch(error){$('#calibration-error').hidden=false;$('#calibration-error').textContent=error.message;}}
    else{$('#calibration-measure').textContent=points.length===2?(Number.isNaN(meters)?'Bruk et tall, for eksempel 4,20.':'Skriv den kjente avstanden i meter.'):`Marker ${points.length?'det andre punktet':'to punkter'} i plantegningen.`;$('#calibration-error').hidden=true;}
    $('#calibration-apply').disabled=!valid;
  };
  const renderPage=async value=>{
    const generation=++renderGeneration;image=null;points=[];$('#calibration-apply').disabled=true;$('#calibration-error').hidden=true;$('#calibration-measure').textContent='Vent mens siden gjøres klar.';$('#import-drawing').innerHTML='<p class="import-empty">Gjør klar siden …</p>';
    try{const next=await source.renderPage(value);if(!live||generation!==renderGeneration)return;if(previewURL)URL.revokeObjectURL(previewURL);image=next;page=value;$('#import-page').value=String(value);previewURL=URL.createObjectURL(image.blob);refresh();}
    catch(error){if(live&&generation===renderGeneration){$('#calibration-error').hidden=false;$('#calibration-error').textContent=error.message||'Siden kunne ikke åpnes.';}}
  };
  $('#calibration-cancel').onclick=closeDialog;$('#calibration-reset').onclick=()=>{points=[];refresh();};$('#calibration-meters').oninput=refresh;
  $('#import-page').onchange=e=>{const requested=Number(e.target.value);if(source&&Number.isInteger(requested)&&requested>=1&&requested<=source.numPages)renderPage(requested);else e.target.value=page;};
  $('#calibration-apply').onclick=async event=>{
    const button=event.currentTarget;if(!live||!image||projectId!==studio.activeRecord?.id)return;button.disabled=true;
    try{
      const reference=calibrateReference(file,page,image,points,decimal($('#calibration-meters').value));
      await withProjectTransition(async()=>{
        await setView('2d');
        releaseReferenceAsset();referenceAssetKey=studio.activeRecord.id+':'+file.id+':'+page;referenceObjectURL=URL.createObjectURL(image.blob);
        editor.setReference(reference,{replace:true});editor.setReferenceImage(referenceObjectURL);
        studio.selectedId=null;renderProject();showZoom(100);setTool('room');setWorkspacePanel('canvas');
        await sync.flush();closeDialog({force:true});
      });
      toast('Plantegningen er importert. Dra over hvert rom for å lage modellen.');
    }catch(error){button.disabled=false;if($('#calibration-error')){$('#calibration-error').hidden=false;$('#calibration-error').textContent=error.message;}else showSaveProblem(error);}
  };
  try{
    const response=await fetch(file.url,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Filen kunne ikke hentes fra prosjektet.');
    const loaded=await openFloorplanFile(await response.blob(),file.mimeType);if(!live){await loaded.dispose();return;}source=loaded;
    $('#import-page-control').hidden=source.numPages===1;$('#import-page').max=source.numPages;$('#import-page-total').textContent='av '+source.numPages;
    await renderPage(1);
  }catch(error){if(live){$('#import-drawing').innerHTML='<p class="import-empty">Plantegningen kunne ikke åpnes.</p>';$('#calibration-error').hidden=false;$('#calibration-error').textContent=error.message;}}
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
