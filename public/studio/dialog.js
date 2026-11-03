// The one modal dialog (#app-dialog) that every studio dialog opens in.
import { icon, icons, $ } from './ui.js';
import { esc } from './format.js';
import { studio } from './state.js';

export const dialog=$('#app-dialog');let lastFocus;
let dialogCleanup=null;
function cleanupDialog(){if(dialogCleanup){const cleanup=dialogCleanup;dialogCleanup=null;cleanup();}}
/** Runs once when the dialog closes or another dialog replaces it. */
export function setDialogCleanup(cleanup){dialogCleanup=cleanup;}
export function openDialog(title,subtitle,body,footer='',wide=false){cleanupDialog();lastFocus=document.activeElement;dialog.setAttribute('aria-labelledby','dialog-title');$('#dialog-content').innerHTML=`<div class="dialog-header"><div><h2 id="dialog-title">${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="icon-button dialog-close" aria-label="Lukk">${icon('close')}</button></div><div class="dialog-body">${body}</div>${footer?`<div class="dialog-footer">${footer}</div>`:''}`;dialog.classList.toggle('wide-dialog',wide);icons(dialog);if(!dialog.open)dialog.showModal();dialog.querySelector('.dialog-close').onclick=closeDialog;}
export function closeDialog(options={}){if(studio.transitioning&&options?.force!==true)return;cleanupDialog();dialog.close();lastFocus?.focus();document.querySelectorAll('.workflow-step').forEach(b=>{b.classList.toggle('active',b.dataset.step==='3');if(b.dataset.step==='3')b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});}
export function bindDialog(){
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
}
