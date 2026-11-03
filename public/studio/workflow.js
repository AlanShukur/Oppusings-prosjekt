// The four steps along the top: Grunnlag, Planforslag, Designstudio and Prosjektkontroll.
import { icon } from './ui.js';
import { studio, editor } from './state.js';
import { closeDialog } from './dialog.js';
import { openGround } from './ground.js';
import { openSuggestions } from './suggestions.js';
import { openCheck } from './check-ui.js';

export function workflow(step){document.querySelectorAll('.workflow-step').forEach(b=>{b.classList.toggle('active',b.dataset.step===String(step));if(b.dataset.step===String(step))b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});if(step===1)openGround();if(step===2)openSuggestions();if(step===3)closeDialog();if(step===4)openCheck();}
export function updateWorkflowProgress(){
  const done={1:studio.uploads.length>0||!!editor?.getState().reference,2:!!studio.project.wishes?.trim()};
  document.querySelectorAll('.workflow-step').forEach(step=>{const number=Number(step.dataset.step);if(number>2)return;step.classList.toggle('completed',done[number]);const badge=step.querySelector('.step-number');if(badge&&badge.dataset.done!==String(done[number])){badge.dataset.done=String(done[number]);badge.innerHTML=done[number]?icon('check'):String(number);}});
}
export function bindWorkflow(){
  document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>workflow(Number(b.dataset.step)));
}
