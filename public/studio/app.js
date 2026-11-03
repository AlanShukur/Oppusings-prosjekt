// Studio entry point: creates the editor, binds every UI module in order and opens the last project.
import { installErrorReporting, reportProblem } from './error-reporter.js';
import { icons, $, toast, bindWorkspacePanels } from './ui.js';
import { session, studio, editor, createEditor } from './state.js';
import { bindDialog } from './dialog.js';
import { workflow, bindWorkflow } from './workflow.js';
import { rooms, selectRoom, showItem, showWall, updateWallLegend, bindInspector } from './inspector.js';
import { showZoom, setView, openShortcuts, bindTools } from './tools.js';
import { updateBaselineButton, bindBaseline } from './baseline-ui.js';
import { bindPlanImport } from './plan-import.js';
import { bindGround } from './ground.js';
import { sync, persist, renderProject, renderSaveStatus, initializeStorage, bindProjects } from './projects.js';
import { openStorage, openProjects } from './project-dialogs.js';
import { openExport } from './export.js';
import { openHelp, openInspiration, openInsight } from './help.js';

installErrorReporting();
icons();
bindWorkspacePanels();
createEditor($('#floorplan'),{onSelect:selectRoom,onChange:state=>{persist(state);updateWallLegend(state);updateBaselineButton(state);},onViewError:error=>{reportProblem(error,{context:'3d'});setView('2d');toast(error.message||'3D ble avbrutt. Tegningen er åpnet i 2D.');},onNotice:toast,onItemSelect:showItem,onWallSelect:showWall,onZoom:showZoom});
renderProject();selectRoom(rooms().find(r=>r.id===studio.selectedId)||rooms()[0]);
renderSaveStatus(studio.lastSaveStatus);
bindInspector();bindBaseline();bindTools();bindDialog();bindWorkflow();bindPlanImport();bindGround();bindProjects();
$('#help-btn').onclick=openHelp;$('#projects-nav').onclick=$('#breadcrumb-home').onclick=openProjects;$('#profile-btn').onclick=openStorage;$('#inspiration-nav').onclick=openInspiration;$('#export-btn').onclick=openExport;$('#check-btn').onclick=$('#summary-check').onclick=()=>workflow(4);$('#new-suggestion').onclick=()=>workflow(2);$('#shortcuts-btn').onclick=openShortcuts;
$('#floor-info').onclick=()=>toast('Eksempelprosjektet inneholder én etasje. Alle rom vises i denne planen.');
$('#insight-btn').onclick=openInsight;
window.romly={editor,getProject:()=>({...studio.project}),getUploads:()=>studio.uploads.length,getSession:()=>session,getActiveRecord:()=>studio.activeRecord,getSync:()=>({dirty:sync.dirty,state:studio.lastSaveStatus.state,revision:sync.record?.revision,transitioning:studio.transitioning,filesBusy:studio.filesBusy}),flush:()=>sync.flush()};
initializeStorage();
