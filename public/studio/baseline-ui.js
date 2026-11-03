// "Dagens planløsning": a saved snapshot of the plan that the check compares changes with (plan-diff.js).
import { compareToBaseline } from './plan-diff.js';
import { icon, $, toast } from './ui.js';
import { esc, savedDate } from './format.js';
import { editor } from './state.js';
import { openDialog, closeDialog } from './dialog.js';

export function updateBaselineButton(state){
  const saved=state?.baseline,button=$('#baseline-btn');
  button.classList.toggle('saved',!!saved);button.querySelector('[data-icon]').innerHTML=icon(saved?'check':'document');
  $('#baseline-label').textContent=saved?`Dagens planløsning · ${savedDate(saved.savedAt)}`:'Lagre dagens planløsning';
  button.title=saved?'Dagens planløsning er lagret. Prosjektkontrollen sammenligner med den.':'Lagre tegningen slik boligen er i dag';
}
function baselineSummary(diff){
  const lines=[],count=(n,one,many)=>`${n} ${n===1?one:many}`;
  if(diff.removedWalls.length)lines.push(count(diff.removedWalls.length,'vegg er fjernet','vegger er fjernet'));
  if(diff.newWalls.length)lines.push(count(diff.newWalls.length,'ny vegg','nye vegger'));
  const facade=[...diff.newOpenings,...diff.removedOpenings].filter(entry=>entry.exterior).length;
  if(facade)lines.push(count(facade,'endring','endringer')+' av vinduer eller dører i yttervegg');
  return lines;
}
function openBaseline(){
  const state=editor.getState(),saved=state.baseline;
  if(!saved){
    const bearing=(state.walls||[]).filter(note=>note.loadBearing==='yes').length;
    openDialog('Dagens planløsning','Lagre tegningen slik boligen er i dag.',`<p class="account-note">Deretter kan du endre planen fritt. Prosjektkontrollen sammenligner med dagens planløsning og finner fjernede vegger, endrede vinduer og dører i yttervegg, nye bad og bod som blir oppholdsrom.</p><div class="info-banner">${icon('info')}<p>${bearing?`${bearing} ${bearing===1?'vegg er':'vegger er'} markert som bærende.`:'Ingen vegger er markert som bærende ennå.'} Marker bærende vegger før du lagrer, så vet kontrollen hvilke fjernede vegger som var bærende.</p></div>`,`<button class="button secondary" id="baseline-cancel">Avbryt</button><button class="button primary" id="baseline-save">${icon('check')} Lagre som dagens planløsning</button>`);
    $('#baseline-cancel').onclick=closeDialog;
    $('#baseline-save').onclick=()=>{editor.setBaseline();closeDialog();toast('Dagens planløsning er lagret. Nå kan du endre planen.');};
    return;
  }
  const lines=baselineSummary(compareToBaseline(state));
  openDialog('Dagens planløsning',`Lagret ${savedDate(saved.savedAt)}. ${saved.rooms.length} rom.`,`<h4 class="baseline-heading">Endringer siden da</h4>${lines.length?`<ul class="baseline-changes">${lines.map(line=>`<li>${esc(line)}</li>`).join('')}</ul>`:'<p class="account-note">Ingen endringer i vegger, vinduer eller dører ennå.</p>'}<label class="check-row"><input type="checkbox" id="baseline-ghosts" ${editor.layers.baseline!==false?'checked':''}><span>Vis fjernede vegger i tegningen</span></label><p class="info-banner" id="baseline-confirm" hidden></p>`,`<button class="button secondary" id="baseline-remove">Fjern</button><button class="button secondary" id="baseline-replace">Erstatt med tegningen nå</button><button class="button primary" id="baseline-close">Lukk</button>`);
  $('#baseline-close').onclick=closeDialog;
  $('#baseline-ghosts').onchange=e=>editor.setLayers({baseline:e.target.checked});
  // Removing or replacing the baseline loses what the check compares with, so both ask once more.
  let pending=null;
  const confirm=(action,label,warning,run)=>{
    if(pending!==action){pending=action;$('#baseline-confirm').hidden=false;$('#baseline-confirm').textContent=warning;$('#baseline-remove').textContent=action==='remove'?'Bekreft fjerning':'Fjern';$('#baseline-replace').textContent=action==='replace'?'Bekreft erstatning':'Erstatt med tegningen nå';return;}
    run();closeDialog();toast(label);
  };
  $('#baseline-remove').onclick=()=>confirm('remove','Dagens planløsning er fjernet.','Kontrollen slutter å sammenligne med dagens planløsning. Du kan angre med Ctrl+Z.',()=>editor.clearBaseline());
  $('#baseline-replace').onclick=()=>confirm('replace','Dagens planløsning er erstattet med tegningen.','Tegningen slik den er nå blir dagens planløsning, og endringene du har gjort forsvinner fra sammenligningen. Du kan angre med Ctrl+Z.',()=>editor.setBaseline());
}
export function bindBaseline(){
  $('#baseline-btn').onclick=openBaseline;
}
