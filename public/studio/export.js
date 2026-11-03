// Export (SVG, brief, project file), and importing a project file or a full backup.
import { icon, $, toast, download } from './ui.js';
import { esc, singleLine } from './format.js';
import { api, editor } from './state.js';
import { openDialog, closeDialog } from './dialog.js';
import { downloadReport } from './check-ui.js';
import { downloadProjectBackup, ensureCanLeave, createCloudProject, validateProjectImport } from './projects.js';
import { openProjects } from './project-dialogs.js';

export function openExport(){
  openDialog('Ta med deg planene videre','Eksporter skissen eller ta inn et tidligere prosjekt.',`<div class="export-options"><button class="export-option" id="export-svg">${icon('image')}<div><strong>Plantegning som SVG</strong><span>Skarp vektortegning av løsningen din</span></div>${icon('download')}</button><button class="export-option" id="export-brief">${icon('document')}<div><strong>Prosjektbrief og sjekkliste</strong><span>Ønsker, rommål og punkter for faglig gjennomgang</span></div>${icon('download')}</button><button class="export-option" id="export-json">${icon('file')}<div><strong>Lagre redigerbart prosjekt</strong><span>JSON-kopi av den synlige tegningen og ønskene</span></div>${icon('download')}</button><button class="export-option" id="import-json">${icon('upload')}<div><strong>Importer prosjektfil</strong><span>Opprett et nytt prosjekt fra en eksportert JSON-fil</span></div>${icon('arrow-right')}</button></div><div class="info-banner">${icon('info')}<p>Eksporten er et skissegrunnlag. Opplastede bilder og PDF-er er ikke inkludert i JSON-filen. Mål og tekniske forhold må kontrolleres før utførelse eller innsending.</p></div>`);
  $('#export-svg').onclick=()=>{download('romly-plantegning.svg',editor.exportSVG(),'image/svg+xml');toast('Plantegningen er lastet ned.');};
  $('#export-brief').onclick=downloadReport;$('#export-json').onclick=downloadProjectBackup;
  $('#import-json').onclick=()=>{
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    // Accepts a single project file (romly-v1) or a full backup from «Lagring på denne enheten» (romly-backup-v1).
    input.onchange=async()=>{if(!input.files[0])return;try{if(input.files[0].size>10*1024*1024)throw new Error('Filen er for stor. Maks. 10 MB.');const raw=JSON.parse(await input.files[0].text());if(raw?.format==='romly-backup-v1'&&Array.isArray(raw.projects)){await restoreBackup(raw);return;}const data=validateProjectImport(raw);if(!await ensureCanLeave())return;openImportProject(data);}catch(error){toast(error.message||'Filen er ikke et gyldig Romly-prosjekt.');}};
    input.click();
  };
}
function openImportProject(data){
  openDialog('Importer prosjektet','Tegningen opprettes som et nytt prosjekt.',`<label class="field">Prosjektnavn<input class="input" id="import-project-name" maxlength="70" value="${esc(data.project.name)}"></label><div class="info-banner">${icon('info')}<p>Eksisterende prosjekter beholdes. Prosjektfilen inneholder tegning og ønsker; eventuelle bilder og PDF-er må lastes opp separat.</p></div><p class="project-message error" id="import-project-error" hidden></p>`,`<button class="button secondary" id="import-project-cancel">Avbryt</button><button class="button primary" id="import-project-submit">${icon('upload')} Importer</button>`);
  $('#import-project-cancel').onclick=closeDialog;
  $('#import-project-submit').onclick=async e=>{const button=e.currentTarget;const name=singleLine($('#import-project-name').value).trim();if(!name){$('#import-project-name').focus();return;}button.disabled=true;try{await createCloudProject({...data.project,name},data.plan);toast('Prosjektfilen er importert.');}catch(error){button.disabled=false;if($('#import-project-error')){$('#import-project-error').hidden=false;$('#import-project-error').textContent=error.message;}}};
}
async function restoreBackup(data){
  const projects=data.projects.map(entry=>validateProjectImport({format:'romly-v1',project:entry.project,plan:entry.plan}));
  if(!await ensureCanLeave())return;
  let restored=0;for(const entry of projects){try{await api.create({project:entry.project,plan:entry.plan});restored++;}catch(error){toast(error.message);break;}}
  toast(`${restored} av ${projects.length} prosjekter er hentet inn fra sikkerhetskopien.`);openProjects();
}
